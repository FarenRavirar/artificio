// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingStylesField } from './SettingStylesField';

// Regressão do achado do mantenedor (2026-08-27): "a parte de estilos/temáticas
// não está funcionando. está zero funcionando." Medido no beta, três causas
// somadas:
//   1. as sugestões só consultavam `settingName` (texto livre), que fica VAZIO
//      quando há cenário do catálogo escolhido — então nunca sugeria nada;
//   2. a tabela `suggest-styles` não conhecia nenhum dos 25 cenários testados,
//      enquanto 111 dos 118 já trazem os estilos em `subgenres`;
//   3. clicar numa sugestão era a única forma de marcar estilo — sem sugestão,
//      o campo era inoperante.
// Cada bloco abaixo trava uma delas.

const stubFetch = (payload: unknown) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  stubFetch({ suggestions: [] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('SettingStylesField — estilos vindos do cenário do catálogo', () => {
  it('oferece os subgêneros do cenário escolhido, sem depender da API', async () => {
    render(
      <SettingStylesField
        settingName=""
        settingStyles={[]}
        onSettingNameChange={vi.fn()}
        onSettingStylesChange={vi.fn()}
        selectedScenarioName="2300 AD"
        selectedScenarioSubgenres={['ópera espacial', 'Ficção científica hard']}
      />,
    );

    // O caso real que não funcionava: cenário do catálogo escolhido, API sem
    // nenhuma sugestão para ele, e mesmo assim o mestre precisa ver opções.
    expect(await screen.findByRole('button', { name: '+ ópera espacial' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Ficção científica hard' })).toBeTruthy();
  });

  it('não reoferece estilo que já está selecionado', async () => {
    render(
      <SettingStylesField
        settingName=""
        settingStyles={['ópera espacial']}
        onSettingNameChange={vi.fn()}
        onSettingStylesChange={vi.fn()}
        selectedScenarioName="2300 AD"
        selectedScenarioSubgenres={['ópera espacial', 'Ficção científica hard']}
      />,
    );

    await screen.findByRole('button', { name: '+ Ficção científica hard' });
    expect(screen.queryByRole('button', { name: '+ ópera espacial' })).toBeNull();
  });

  it('consulta a API pelo cenário SELECIONADO, não pelo texto livre vazio', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [{ setting_name: 'x', suggested_styles: ['Investigação'] }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <SettingStylesField
        settingName=""
        settingStyles={[]}
        onSettingNameChange={vi.fn()}
        onSettingStylesChange={vi.fn()}
        selectedScenarioName="Forgotten Realms"
        selectedScenarioSubgenres={[]}
      />,
    );

    await vi.advanceTimersByTimeAsync(600);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Antes da correção o effect nem chamava: `settingName` vazio abortava em
    // `length < 3` e o nome do cenário era ignorado.
    expect(String(fetchMock.mock.calls[0][0])).toContain('Forgotten%20Realms');
  });
});

describe('SettingStylesField — entrada manual de estilo', () => {
  it('adiciona o estilo digitado pelo botão', async () => {
    const onChange = vi.fn();
    render(
      <SettingStylesField
        settingName=""
        settingStyles={[]}
        onSettingNameChange={vi.fn()}
        onSettingStylesChange={onChange}
        selectedScenarioName={null}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Adicionar estilo ou temática/i), {
      target: { value: 'Horror Cósmico' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(onChange).toHaveBeenCalledWith(['Horror Cósmico']);
  });

  it('Enter adiciona sem submeter a página', async () => {
    const onChange = vi.fn();
    render(
      <SettingStylesField
        settingName=""
        settingStyles={['Investigação']}
        onSettingNameChange={vi.fn()}
        onSettingStylesChange={onChange}
        selectedScenarioName={null}
      />,
    );

    const input = screen.getByLabelText(/Adicionar estilo ou temática/i);
    fireEvent.change(input, { target: { value: 'Sandbox' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['Investigação', 'Sandbox']);
  });

  it('ignora texto em branco', async () => {
    const onChange = vi.fn();
    render(
      <SettingStylesField
        settingName=""
        settingStyles={[]}
        onSettingNameChange={vi.fn()}
        onSettingStylesChange={onChange}
        selectedScenarioName={null}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Adicionar estilo ou temática/i), {
      target: { value: '   ' },
    });
    fireEvent.keyDown(screen.getByLabelText(/Adicionar estilo ou temática/i), { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('esconde a entrada ao atingir o limite de 10 estilos', () => {
    render(
      <SettingStylesField
        settingName=""
        settingStyles={Array.from({ length: 10 }, (_, i) => `e${i}`)}
        onSettingNameChange={vi.fn()}
        onSettingStylesChange={vi.fn()}
        selectedScenarioName={null}
      />,
    );

    expect(screen.queryByLabelText(/Adicionar estilo ou temática/i)).toBeNull();
    expect(screen.getByText(/Limite máximo de 10 estilos atingido/i)).toBeTruthy();
  });
});

describe('SettingStylesField — achados de review (Codex, PR #291)', () => {
  const base = {
    settingName: '',
    settingStyles: [] as string[],
    onSettingNameChange: vi.fn(),
    onSettingStylesChange: vi.fn(),
  };

  it('resposta fora de ordem não sobrescreve o cenário atual', async () => {
    // A resposta do cenário A resolve DEPOIS da de B. Sem abort/guarda, os
    // estilos de A apareciam sob o rótulo de B.
    const resolvers: Array<(v: unknown) => void> = [];
    const fetchMock = vi.fn((_url: string, init?: { signal?: AbortSignal }) => {
      return new Promise((resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
        resolvers.push(resolve);
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { rerender } = render(
      <SettingStylesField {...base} selectedScenarioName="Cenario A" selectedScenarioSubgenres={[]} />,
    );
    await vi.advanceTimersByTimeAsync(600);

    rerender(
      <SettingStylesField {...base} selectedScenarioName="Cenario B" selectedScenarioSubgenres={[]} />,
    );
    await vi.advanceTimersByTimeAsync(600);

    // A (índice 0) resolve por último, com estilo próprio.
    resolvers[1]?.({ ok: true, json: async () => ({ suggestions: [{ suggested_styles: ['DeB'] }] }) });
    await vi.advanceTimersByTimeAsync(50);
    resolvers[0]?.({ ok: true, json: async () => ({ suggestions: [{ suggested_styles: ['DeA'] }] }) });
    await vi.advanceTimersByTimeAsync(50);

    await waitFor(() => expect(screen.getByRole('button', { name: '+ DeB' })).toBeTruthy());
    expect(screen.queryByRole('button', { name: '+ DeA' })).toBeNull();
  });

  it('abort ao trocar de cenário não vira erro de rede na tela', async () => {
    // NOTA DE HONESTIDADE (medido): este teste passa mesmo removendo o ramo
    // `AbortError` do catch, porque o mesmo cleanup que aborta já põe
    // `active = false`, e o `if (!active) return` logo abaixo barra o setState
    // de erro. Ou seja: o ramo de abort é defesa em profundidade, não conserto
    // de um caso hoje observável. O teste fica porque trava o COMPORTAMENTO
    // (trocar de cenário não pinta erro de rede), que é o que importa para o
    // mestre — e continuaria valendo se alguém removesse a guarda `active`.
    vi.useRealTimers();
    const fetchMock = vi.fn((_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { rerender } = render(
      <SettingStylesField {...base} selectedScenarioName="Cenario A" selectedScenarioSubgenres={[]} />,
    );
    await screen.findByText(/Buscando sugestões/i, {}, { timeout: 3000 });

    // Troca de cenário: aborta a requisição de A ainda em voo.
    rerender(
      <SettingStylesField {...base} selectedScenarioName="Cenario B" selectedScenarioSubgenres={[]} />,
    );

    // 800ms > 500ms do debounce: sem isto o effect de B nem dispara (medido:
    // 400ms davam UM fetch só) e o teste nunca alcança o catch que trata o
    // abort — passava por não exercitar nada.
    await new Promise((r) => setTimeout(r, 800));

    expect(screen.queryByText(/Erro ao conectar com o servidor/i)).toBeNull();
    expect(screen.queryByText(/Não foi possível buscar sugestões/i)).toBeNull();
  });

  it('subgêneros do cenário continuam visíveis durante a busca remota', async () => {
    // Timers REAIS aqui de propósito: com `useFakeTimers` o debounce dispara,
    // mas o `setIsLoadingSuggestions(true)` não chega a pintar a tela, e o
    // teste passava mesmo com o defeito de volta (medido — era teste frouxo).
    // Com timer real o "Buscando sugestões..." aparece de fato, que é a
    // condição sob a qual os subgêneros locais sumiam.
    vi.useRealTimers();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    render(
      <SettingStylesField
        {...base}
        selectedScenarioName="2300 AD"
        selectedScenarioSubgenres={['ópera espacial']}
      />,
    );

    // Espera o estado de carregamento REALMENTE aparecer.
    await screen.findByText(/Buscando sugestões/i, {}, { timeout: 3000 });

    // Local, não depende de rede — não pode sumir porque a API demora.
    expect(screen.getByRole('button', { name: '+ ópera espacial' })).toBeTruthy();
  });

  it('cenário vazio cai no texto livre (o `||` não pode virar `??`)', async () => {
    // Trava a recusa do achado do Sonar (PR #291): com `??`, um
    // `selectedScenarioName` igual a `''` venceria o fallback e o termo viraria
    // `''`, ignorando o texto livre preenchido.
    vi.useRealTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ suggestions: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <SettingStylesField
        {...base}
        settingName="Eberron"
        selectedScenarioName=""
        selectedScenarioSubgenres={[]}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 3000 });
    expect(String(fetchMock.mock.calls[0][0])).toContain('Eberron');
  });

  it('adicionar estilo não refaz a busca do mesmo cenário', async () => {
    // Achado de review (Codex, PR #291): `selectedStylesSet` nas dependências
    // do effect fazia a busca reexecutar a cada clique. Medido antes da
    // correção: 1 requisição virava 2 ao adicionar um estilo — com 10 estilos
    // seriam 11 chamadas para o mesmo cenário.
    vi.useRealTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [{ suggested_styles: ['A', 'B'] }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const props = { ...base, selectedScenarioName: 'Forgotten Realms', selectedScenarioSubgenres: [] };
    const { rerender } = render(<SettingStylesField {...props} settingStyles={[]} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 3000 });

    // O mestre escolhe um estilo: `settingStyles` muda, o cenário não.
    rerender(<SettingStylesField {...props} settingStyles={['A']} />);
    await new Promise((r) => setTimeout(r, 900));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('estilo removido volta a ser oferecido, sem nova busca', async () => {
    // `handleAddStyle` mutava `suggestions`, apagando a resposta da API: tirado
    // o estilo do anúncio, ele não reaparecia até uma busca nova. O CLIQUE é
    // essencial aqui — só `rerender` não executa `handleAddStyle`, e o teste
    // passava com o defeito de volta (medido).
    vi.useRealTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [{ suggested_styles: ['A', 'B'] }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const props = { ...base, selectedScenarioName: 'Forgotten Realms', selectedScenarioSubgenres: [] };
    const { rerender } = render(<SettingStylesField {...props} settingStyles={[]} />);

    // Clique real: passa por handleAddStyle, que é onde estava a mutação.
    fireEvent.click(await screen.findByRole('button', { name: '+ A' }, { timeout: 3000 }));

    // O pai aplica a escolha…
    rerender(<SettingStylesField {...props} settingStyles={['A']} />);
    await waitFor(() => expect(screen.queryByRole('button', { name: '+ A' })).toBeNull());

    // …e depois o mestre remove. 'A' tem de voltar da resposta já em memória.
    rerender(<SettingStylesField {...props} settingStyles={[]} />);
    expect(await screen.findByRole('button', { name: '+ A' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('payload malformado não vira estilo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          { suggested_styles: ['Valido', 42, null, '  '] },
          { suggested_styles: 'nao-e-array' },
          null,
          'texto solto',
        ],
      }),
    }));

    render(<SettingStylesField {...base} selectedScenarioName="Qualquer" selectedScenarioSubgenres={[]} />);
    await vi.advanceTimersByTimeAsync(600);

    await waitFor(() => expect(screen.getByRole('button', { name: '+ Valido' })).toBeTruthy());
    expect(screen.queryByRole('button', { name: '+ 42' })).toBeNull();
  });
});
