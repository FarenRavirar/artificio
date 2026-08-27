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
