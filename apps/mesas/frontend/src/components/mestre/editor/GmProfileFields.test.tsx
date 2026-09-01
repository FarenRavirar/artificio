// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TaglineField,
  PromoBadgeField,
  ProfileTagsSection,
  SellingPointsEditor,
  ClosedGroupSection,
  ClosedGroupPriceField,
  BioLongField,
  ExperienceYearsField,
  type ClosedGroupEditorValue,
} from './GmProfileFields';
import {
  RECOMMENDED_GAIN,
  isValidSellingPoint,
  reaisParaCentavos,
  centavosParaReais,
} from './profileEditorDomain';
import { SELLING_POINT_ICON_KEYS, SELLING_POINT_ICON_LABELS } from '../sellingPointIcons';
import type { SellingPoint } from '../sellingPointIcons';
import type { SystemTreeNode } from '../../../types/systems';

/**
 * Editor de perfil de mestre (spec 099, fase B) — teste consolidado.
 *
 * Arquivo único para os seis campos do editor (antes: um teste por campo) e
 * para os conversores de preço que moram neste mesmo módulo. Casos e
 * asserções preservados dos arquivos originais, reorganizados em `describe`
 * por campo. O `useProfileContext` é mockado (o comportamento do TagInput é
 * exercitado aqui mesmo); `useSystemsCatalog` e `ContentEditor` são mockados
 * — o comportamento deles vive em useSystemsCatalog.test.ts e no pacote
 * @artificio/content-editor. O dicionário compartilhado vive em
 * MestreSellingPoints (fonte das 14 opções do Select).
 */

const { updateGm, authPost } = vi.hoisted(() => ({ updateGm: vi.fn(), authPost: vi.fn() }));

vi.mock('../../../contexts/useProfileContext', () => ({
  useProfileContext: () => ({
    updateGm,
    profile: {
      gm: { experience_years: null, specialties: [], languages: ['Português'], badges: [] },
    },
  }),
}));

vi.mock('../../../services/apiClient', () => ({ authPost }));

const SYSTEM_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const systemNode: SystemTreeNode = {
  id: SYSTEM_ID,
  name: 'Dungeons & Dragons',
  name_pt: null,
  slug: 'dungeons-dragons',
  parent_id: null,
  node_type: 'system',
  depth: 0,
  path_slug: 'dungeons-dragons',
  aliases: [],
  children: [],
};

vi.mock('../../../hooks/useSystemsCatalog', () => ({
  useSystemsCatalog: () => ({
    tree: [systemNode],
    loading: false,
    error: null,
    flat: [],
    forceRefresh: async () => undefined,
  }),
}));

vi.mock('@artificio/content-editor', () => ({
  ContentEditor: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

describe('TaglineField', () => {
  it('renderiza o campo com rótulo associado ao controle', () => {
    render(<TaglineField value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Slogan')).toBeTruthy();
  });

  it('marca o nível recomendado e mostra a frase do ganho', () => {
    const { container } = render(<TaglineField value="" onChange={() => {}} />);
    expect(container.querySelector('[data-ob="recommended"]')).not.toBeNull();
    expect(screen.getByText(`Recomendado — ${RECOMMENDED_GAIN.tagline}.`)).toBeTruthy();
  });

  it('limita a 200 caracteres, alinhado ao corte do PUT', () => {
    render(<TaglineField value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Slogan')).toHaveAttribute('maxlength', '200');
  });

  it('chama onChange a cada digitação', () => {
    const onChange = vi.fn();
    render(<TaglineField value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Slogan'), {
      target: { value: 'Mesas imersivas' },
    });
    expect(onChange).toHaveBeenCalledWith('Mesas imersivas');
  });

  it('exibe o erro quando informado', () => {
    render(<TaglineField value="" onChange={() => {}} error="Slogan muito longo" />);
    expect(screen.getByText('Slogan muito longo')).toBeTruthy();
  });
});

describe('PromoBadgeField', () => {
  beforeEach(() => {
    updateGm.mockReset();
  });

  it('renderiza com rótulo associado e maxLength 120 (corte do PUT)', () => {
    render(<PromoBadgeField value="" />);
    const input = screen.getByLabelText('Faixa promocional (opcional)');
    expect(input).toBeTruthy();
    expect(input).toHaveAttribute('maxlength', '120');
  });

  it('marca nível opcional (data-ob) e não mostra frase de ganho', () => {
    const { container } = render(<PromoBadgeField value="" />);
    expect(container.querySelector('[data-field="promo_badge_text"][data-ob="optional"]')).not.toBeNull();
    expect(screen.queryByText(/Recomendado/)).toBeNull();
  });

  it('grava via updateGm({ promo_badge_text }) a cada digitação', () => {
    render(<PromoBadgeField value="" />);
    fireEvent.change(screen.getByLabelText('Faixa promocional (opcional)'), {
      target: { value: 'Mesas novas toda sexta-feira' },
    });
    expect(updateGm).toHaveBeenCalledWith({ promo_badge_text: 'Mesas novas toda sexta-feira' });
  });

  it('limpar o campo grava null', () => {
    render(<PromoBadgeField value="Mesas novas toda sexta-feira" />);
    fireEvent.change(screen.getByLabelText('Faixa promocional (opcional)'), {
      target: { value: '' },
    });
    expect(updateGm).toHaveBeenCalledWith({ promo_badge_text: null });
  });
});

interface TagsValue {
  specialties?: string[];
  languages?: string[];
  badges?: string[];
}

function renderTagsSection(value: TagsValue = {}) {
  return render(
    <ProfileTagsSection
      specialties={value.specialties ?? []}
      languages={value.languages ?? []}
      badges={value.badges ?? []}
    />,
  );
}

describe('ProfileTagsSection', () => {
  beforeEach(() => {
    updateGm.mockReset();
  });

  it('renderiza os três campos com rótulo associado ao controle', () => {
    renderTagsSection();
    expect(screen.getByLabelText('Especialidades')).toBeTruthy();
    expect(screen.getByLabelText('Idiomas')).toBeTruthy();
    expect(screen.getByLabelText('Selos')).toBeTruthy();
  });

  it('marca specialties e languages como recomendados (com frase do ganho) e badges como opcional (sem frase)', () => {
    const { container } = renderTagsSection();
    expect(
      container.querySelector('[data-field="specialties"][data-ob="recommended"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-field="languages"][data-ob="recommended"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-field="badges"][data-ob="optional"]')).not.toBeNull();
    expect(screen.getByText(`Recomendado — ${RECOMMENDED_GAIN.specialties}.`)).toBeTruthy();
    expect(screen.getByText(`Recomendado — ${RECOMMENDED_GAIN.languages}.`)).toBeTruthy();
  });

  it('adicionar especialidade grava via updateGm({ specialties })', () => {
    renderTagsSection();
    const input = screen.getByLabelText('Especialidades');
    fireEvent.change(input, { target: { value: 'Horror' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateGm).toHaveBeenCalledWith({ specialties: ['Horror'] });
  });

  it('adicionar idioma grava via updateGm({ languages })', () => {
    renderTagsSection();
    const input = screen.getByLabelText('Idiomas');
    fireEvent.change(input, { target: { value: 'Inglês' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateGm).toHaveBeenCalledWith({ languages: ['Inglês'] });
  });

  it('adicionar selo grava via updateGm({ badges })', () => {
    renderTagsSection();
    const input = screen.getByLabelText('Selos');
    fireEvent.change(input, { target: { value: 'Streamer' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateGm).toHaveBeenCalledWith({ badges: ['Streamer'] });
  });

  it('remover especialidade grava o array sem ela', () => {
    renderTagsSection({ specialties: ['Horror', 'Intriga'] });
    fireEvent.click(screen.getByRole('button', { name: 'Remover Horror' }));
    expect(updateGm).toHaveBeenCalledWith({ specialties: ['Intriga'] });
  });
});

const validPoint: SellingPoint = {
  icon: 'shield',
  title: 'Mesa segura',
  description: 'Ferramentas de segurança combinadas na sessão zero.',
};

describe('SellingPointsEditor', () => {
  beforeEach(() => {
    updateGm.mockReset();
  });

  it('normaliza valor cru não-array (o {} do achado A1) sem quebrar', () => {
    render(<SellingPointsEditor value={{}} />);
    expect(screen.queryByTestId('selling-point-0')).toBeNull();
    expect(screen.getByText(`Recomendado — ${RECOMMENDED_GAIN.sellingPoints}.`)).toBeTruthy();
  });

  it('ícone vem de seleção: select com exatamente as 14 chaves, sem input livre', () => {
    render(<SellingPointsEditor value={[validPoint]} />);
    const select = screen.getByLabelText('Ícone do destaque 1');
    expect(select.tagName).toBe('SELECT');
    const optionValues = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(optionValues).toEqual([...SELLING_POINT_ICON_KEYS]);
    // Nenhum controle de texto para o ícone — só o select:
    expect(screen.queryByPlaceholderText(/ícone/i)).toBeNull();
    // Rótulo humano por chave (mesma fonte do dicionário):
    const labels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(labels).toEqual(SELLING_POINT_ICON_KEYS.map((key) => SELLING_POINT_ICON_LABELS[key] ?? key));
  });

  it('trocar o ícone grava a chave escolhida no array', () => {
    render(<SellingPointsEditor value={[validPoint]} />);
    fireEvent.change(screen.getByLabelText('Ícone do destaque 1'), {
      target: { value: 'trophy' },
    });
    expect(updateGm).toHaveBeenCalledWith({
      selling_points: [{ ...validPoint, icon: 'trophy' }],
    });
  });

  it('array válido grava inteiro via updateGm({ selling_points })', () => {
    render(<SellingPointsEditor value={[validPoint]} />);
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Mesa com ferramentas de segurança' },
    });
    expect(updateGm).toHaveBeenCalledWith({
      selling_points: [{ ...validPoint, title: 'Mesa com ferramentas de segurança' }],
    });
  });

  // Achado de review (#297): estes dois testes cobravam `selling_points: []` —
  // codificavam a EXCLUSAO do item ja salvo enquanto o mestre apagava o titulo
  // para reescrever. O nome dizia "NAO enviado" e a assercao mandava enviar
  // array vazio. Com a guarda de `salvosNoMonte` a gravacao e SUSPENSA enquanto
  // um item salvo esta invalido: o erro aparece, nada e enviado, e o ponto
  // sobrevive a uma pausa de 500ms no meio da edicao.
  it('item salvo com título vazio: erro visível e NADA enviado (não apaga o salvo)', () => {
    render(<SellingPointsEditor value={[validPoint]} />);
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: '' } });
    expect(
      screen.getByText('Título e descrição são obrigatórios para salvar o destaque.'),
    ).toBeTruthy();
    expect(updateGm).not.toHaveBeenCalled();
  });

  it('item salvo com descrição vazia: barrado igual, sem apagar o salvo', () => {
    render(<SellingPointsEditor value={[validPoint]} />);
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: '' } });
    expect(
      screen.getByText('Título e descrição são obrigatórios para salvar o destaque.'),
    ).toBeTruthy();
    expect(updateGm).not.toHaveBeenCalled();
  });

  it('nenhum payload enviado contém item inválido (contrato do formulário)', () => {
    render(<SellingPointsEditor value={[validPoint]} />);
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Voltou' } });
    expect(updateGm.mock.calls.length).toBeGreaterThan(0);
    for (const call of updateGm.mock.calls) {
      const payload = call[0] as { selling_points: SellingPoint[] };
      expect(payload.selling_points.every(isValidSellingPoint)).toBe(true);
    }
  });

  it('highlight opcional entra e sai do payload', () => {
    render(<SellingPointsEditor value={[validPoint]} />);
    fireEvent.change(screen.getByLabelText('Destaque (opcional)'), {
      target: { value: 'Sessão zero gratuita' },
    });
    expect(updateGm).toHaveBeenLastCalledWith({
      selling_points: [{ ...validPoint, highlight: 'Sessão zero gratuita' }],
    });
    fireEvent.change(screen.getByLabelText('Destaque (opcional)'), { target: { value: '' } });
    expect(updateGm).toHaveBeenLastCalledWith({ selling_points: [validPoint] });
  });

  it('adicionar cria item em edição e não grava até ficar válido', () => {
    render(<SellingPointsEditor value={[validPoint]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ponto forte' }));
    // Item novo aparece no rascunho (select do item 2), sem gravação:
    const item2 = screen.getByTestId('selling-point-1');
    expect(within(item2).getByLabelText('Ícone do destaque 2')).toBeTruthy();
    expect(updateGm).not.toHaveBeenCalled();

    // Preenchendo título e descrição, o item entra no próximo payload:
    fireEvent.change(within(item2).getByLabelText('Título'), {
      target: { value: 'Campanhas longas' },
    });
    fireEvent.change(within(item2).getByLabelText('Descrição'), {
      target: { value: 'Arcos de campanha completos.' },
    });
    expect(updateGm).toHaveBeenLastCalledWith({
      selling_points: [
        validPoint,
        { icon: 'sparkles', title: 'Campanhas longas', description: 'Arcos de campanha completos.' },
      ],
    });
  });

  it('remover item grava o array sem ele', () => {
    const second: SellingPoint = { icon: 'clock', title: 'Pontual', description: 'Sessões no horário.' };
    render(<SellingPointsEditor value={[validPoint, second]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover destaque 1' }));
    expect(updateGm).toHaveBeenCalledWith({ selling_points: [second] });
  });

  it('nível recomendado marcado no data-ob, com frase do ganho', () => {
    const { container } = render(<SellingPointsEditor value={[validPoint]} />);
    expect(container.querySelector('[data-field="sellingPoints"][data-ob="recommended"]')).not.toBeNull();
    expect(screen.getByText(`Recomendado — ${RECOMMENDED_GAIN.sellingPoints}.`)).toBeTruthy();
  });
});

const defaultValue: ClosedGroupEditorValue = {
  enabled: false,
  systems: [],
  description: '',
  min_price_cents: null,
};

function renderClosedGroupSection(value: Partial<ClosedGroupEditorValue> = {}) {
  const onChange = vi.fn();
  render(
    <ClosedGroupSection value={{ ...defaultValue, ...value }} onChange={onChange} />,
  );
  return { onChange };
}

describe('ClosedGroupSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggle começa desligado (aria-pressed=false) e não mostra os campos', () => {
    renderClosedGroupSection();
    const toggle = screen.getByRole('button', { name: 'Oferecer mesas para grupos fechados' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByLabelText('Preço mínimo (R$)')).toBeNull();
    expect(screen.queryByLabelText('Sistemas aceitos')).toBeNull();
  });

  it('liga o grupo fechado com um clique (aria-pressed=true)', () => {
    const { onChange } = renderClosedGroupSection();
    fireEvent.click(
      screen.getByRole('button', { name: 'Oferecer mesas para grupos fechados' }),
    );
    expect(onChange).toHaveBeenCalledWith({ enabled: true });
  });

  it('com toggle ligado, renderiza sistemas, descrição e preço', () => {
    renderClosedGroupSection({ enabled: true });
    expect(screen.getByRole('button', { name: 'Oferecer mesas para grupos fechados' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Sistemas aceitos')).toBeTruthy();
    expect(screen.getByLabelText('Descrição (opcional)')).toBeTruthy();
    expect(screen.getByLabelText('Preço mínimo (R$)')).toBeTruthy();
  });

  it('selecionar sistema grava o UUID, nunca o nome', () => {
    const { onChange } = renderClosedGroupSection({ enabled: true });
    // O CatalogTree só mostra raízes com busca digitada.
    fireEvent.change(screen.getByLabelText('Buscar sistema...'), {
      target: { value: 'dungeons' },
    });
    fireEvent.click(screen.getByText('Dungeons & Dragons'));
    expect(onChange).toHaveBeenCalledWith({ systems: [SYSTEM_ID] });
  });

  it('digitar descrição grava o texto', () => {
    const { onChange } = renderClosedGroupSection({ enabled: true });
    fireEvent.change(screen.getByLabelText('Descrição (opcional)'), {
      target: { value: 'Campanha sob medida.' },
    });
    expect(onChange).toHaveBeenCalledWith({ description: 'Campanha sob medida.' });
  });

  it('digitar preço em reais grava centavos (aceite da B2)', () => {
    const { onChange } = renderClosedGroupSection({ enabled: true });
    fireEvent.change(screen.getByLabelText('Preço mínimo (R$)'), {
      target: { value: '10,50' },
    });
    expect(onChange).toHaveBeenCalledWith({ min_price_cents: 1050 });
  });

  it('preço vazio/inválido grava null', () => {
    // Valor inicial não-vazio: mudar para '' com o input já em '' não dispara
    // onChange no React (valor DOM inalterado).
    const { onChange } = renderClosedGroupSection({ enabled: true, min_price_cents: 1050 });
    fireEvent.change(screen.getByLabelText('Preço mínimo (R$)'), {
      target: { value: '' },
    });
    expect(onChange).toHaveBeenCalledWith({ min_price_cents: null });
    fireEvent.change(screen.getByLabelText('Preço mínimo (R$)'), {
      target: { value: 'abc' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ min_price_cents: null });
  });
});

describe('reaisParaCentavos', () => {
  it('"10" → 1000', () => {
    expect(reaisParaCentavos('10')).toBe(1000);
  });

  it('"10,50" → 1050', () => {
    expect(reaisParaCentavos('10,50')).toBe(1050);
  });

  it('"0,99" → 99', () => {
    expect(reaisParaCentavos('0,99')).toBe(99);
  });

  it('"10,5" → 1050 (fração de 1 dígito são décimos)', () => {
    expect(reaisParaCentavos('10,5')).toBe(1050);
  });

  it('aceita o formato exato do formatPriceBRL (prefixo R$ e milhar com ponto)', () => {
    expect(reaisParaCentavos('R$ 1.234,56')).toBe(123456);
    expect(reaisParaCentavos('R$ 10,50')).toBe(1050);
    expect(reaisParaCentavos('R$10')).toBe(1000);
  });

  it('aceita ponto como decimal quando não há vírgula (digitação comum)', () => {
    expect(reaisParaCentavos('10.50')).toBe(1050);
    expect(reaisParaCentavos('0.99')).toBe(99);
  });

  it('milhar ambíguo com fração de 3 dígitos é inválido', () => {
    expect(reaisParaCentavos('1.234')).toBeNull();
  });

  it('vazio ou inválido → null', () => {
    expect(reaisParaCentavos('')).toBeNull();
    expect(reaisParaCentavos('   ')).toBeNull();
    expect(reaisParaCentavos('abc')).toBeNull();
    expect(reaisParaCentavos('10,abc')).toBeNull();
    expect(reaisParaCentavos('10,5,5')).toBeNull();
    expect(reaisParaCentavos('-5')).toBeNull();
    expect(reaisParaCentavos('10,501')).toBeNull();
  });
});

describe('centavosParaReais (exibição do valor salvo)', () => {
  it('1050 → "10,50"', () => {
    expect(centavosParaReais(1050)).toBe('10,50');
  });

  it('99 → "0,99"', () => {
    expect(centavosParaReais(99)).toBe('0,99');
  });

  it('null/undefined → ""', () => {
    expect(centavosParaReais(null)).toBe('');
    expect(centavosParaReais(undefined)).toBe('');
  });

  it('round-trip com a escrita: reaisParaCentavos(centavosParaReais(c)) === c', () => {
    for (const cents of [0, 99, 1000, 1050, 123456]) {
      expect(reaisParaCentavos(centavosParaReais(cents))).toBe(cents);
    }
  });
});

describe('BioLongField e ExperienceYearsField (B6 — recomendados extraídos da TabMestre)', () => {
  beforeEach(() => {
    updateGm.mockReset();
  });

  it('bio: marcada como recomendada com frase do ganho do registro', () => {
    const { container } = render(<BioLongField value="" />);
    expect(container.querySelector('[data-field="bioLong"][data-ob="recommended"]')).not.toBeNull();
    expect(screen.getByText(`Recomendado — ${RECOMMENDED_GAIN.bioLong}.`)).toBeTruthy();
  });

  it('bio: digitar grava via updateGm({ bio_long })', () => {
    render(<BioLongField value="" />);
    fireEvent.change(screen.getByLabelText('Bio detalhada'), {
      target: { value: 'Mestro há 10 anos.' },
    });
    expect(updateGm).toHaveBeenCalledWith({ bio_long: 'Mestro há 10 anos.' });
  });

  it('B11: analisar só mostra a sugestão; nenhuma escrita ocorre antes da confirmação', async () => {
    authPost.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          candidates: [
            { field: 'experience_years', value: 15, evidence: 'Mestro há 15 anos', confidence: 0.98 },
          ],
        },
      }),
    });
    render(<BioLongField value="Mestro há 15 anos." />);
    updateGm.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Sugerir atributos da bio' }));

    expect(await screen.findByText('Anos de experiência: 15')).toBeTruthy();
    expect(updateGm).not.toHaveBeenCalled();
    expect(authPost).toHaveBeenCalledWith('/api/v1/gm/profile/bio-suggestions', {
      bio: 'Mestro há 15 anos.',
    });
  });

  it('B11: só o clique explícito em confirmar chama updateGm com o atributo', async () => {
    authPost.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          candidates: [
            { field: 'specialties', value: 'The Witcher', evidence: 'Fanático por The Witcher', confidence: 0.91 },
          ],
        },
      }),
    });
    render(<BioLongField value="Fanático por The Witcher." />);
    updateGm.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir atributos da bio' }));
    await screen.findByText('Especialidade: The Witcher');

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e aplicar' }));

    await waitFor(() => expect(updateGm).toHaveBeenCalledTimes(1));
    expect(updateGm).toHaveBeenCalledWith({ specialties: ['The Witcher'] });
  });

  it('B11: falha da análise não grava e mantém a bio editável', async () => {
    authPost.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Sugestões indisponíveis agora. O perfil continua editável normalmente.' }),
    });
    render(<BioLongField value="Minha bio." />);
    updateGm.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir atributos da bio' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('continua editável normalmente');
    expect(updateGm).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Bio detalhada'), { target: { value: 'Minha bio continua.' } });
    expect(updateGm).toHaveBeenCalledWith({ bio_long: 'Minha bio continua.' });
  });

  // Achado de review (PR #301): os candidatos ficavam na tela depois de o mestre
  // editar a bio. Como `evidence` e trecho literal do texto analisado, a
  // sugestao sobrevivente citava frase que ja nao existia — e confirma-la
  // gravaria atributo tirado de bio antiga.
  it('B11: editar a bio retira as sugestoes da analise anterior', async () => {
    authPost.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          candidates: [
            { field: 'specialties', value: 'The Witcher', evidence: 'Fanático por The Witcher', confidence: 0.91 },
          ],
        },
      }),
    });
    render(<BioLongField value="Fanático por The Witcher." />);
    updateGm.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir atributos da bio' }));
    await screen.findByText('Especialidade: The Witcher');

    fireEvent.change(screen.getByLabelText('Bio detalhada'), { target: { value: 'Outro texto completamente diferente.' } });

    // O botao de confirmar sai da tela: nao ha como gravar a sugestao velha.
    expect(screen.queryByRole('button', { name: 'Confirmar e aplicar' })).toBeNull();
    expect(screen.queryByText('Especialidade: The Witcher')).toBeNull();
    expect(screen.getByText(/A bio mudou desde a última análise/)).toBeTruthy();
    expect(updateGm).not.toHaveBeenCalledWith({ specialties: ['The Witcher'] });
  });

  it('B11: resposta que chega depois de a bio mudar nao repovoa a lista', async () => {
    let liberaResposta: (() => void) | undefined;
    authPost.mockReturnValue(new Promise((resolve) => {
      liberaResposta = () => resolve({
        ok: true,
        json: async () => ({
          data: {
            candidates: [
              { field: 'badges', value: 'Editor', evidence: 'Editor do site', confidence: 0.9 },
            ],
          },
        }),
      });
    }));
    render(<BioLongField value="Editor do site." />);
    updateGm.mockClear();
    authPost.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir atributos da bio' }));

    // A bio muda ANTES de a analise voltar.
    fireEvent.change(screen.getByLabelText('Bio detalhada'), { target: { value: 'Texto novo do mestre.' } });
    liberaResposta?.();

    await waitFor(() => expect(authPost).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Selo: Editor')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirmar e aplicar' })).toBeNull();
  });

  it('experiência: marcada como recomendada com frase do ganho do registro', () => {
    const { container } = render(<ExperienceYearsField value={null} />);
    expect(
      container.querySelector('[data-field="experienceYears"][data-ob="recommended"]'),
    ).not.toBeNull();
    expect(
      screen.getByText(`Recomendado — ${RECOMMENDED_GAIN.experienceYears}.`),
    ).toBeTruthy();
  });

  it('experiência: digitar grava via updateGm({ experience_years }); vazio grava null', () => {
    render(<ExperienceYearsField value={null} />);
    const input = screen.getByLabelText('Anos de Experiência');
    fireEvent.change(input, { target: { value: '12' } });
    expect(updateGm).toHaveBeenCalledWith({ experience_years: 12 });
    fireEvent.change(input, { target: { value: '' } });
    expect(updateGm).toHaveBeenLastCalledWith({ experience_years: null });
  });

  // Achado de review (#297): `parseInt(v) || null` transformava o ZERO valido em
  // null (0 e falsy) e deixava passar decimal e negativo.
  it('experiência: zero e valido; decimal e negativo nao gravam', () => {
    render(<ExperienceYearsField value={null} />);
    const input = screen.getByLabelText('Anos de Experiência');

    fireEvent.change(input, { target: { value: '0' } });
    expect(updateGm).toHaveBeenLastCalledWith({ experience_years: 0 });

    const chamadasAntes = updateGm.mock.calls.length;
    fireEvent.change(input, { target: { value: '1.5' } });
    fireEvent.change(input, { target: { value: '-3' } });
    expect(updateGm.mock.calls.length).toBe(chamadasAntes);
  });
});

describe('aria-describedby (B7) — controle aponta para o <p> de hint/erro do Field', () => {
  // Achado de review (#297): a descricao ficava `invalid` sem apontar para a
  // explicacao — leitor de tela anunciava "invalido" sem dizer por que.
  it('SellingPointsEditor: descricao invalida aponta para o texto do erro', () => {
    render(<SellingPointsEditor value={[validPoint]} />);
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: '' } });
    const descricao = screen.getByLabelText('Descrição');
    expect(descricao).toHaveAttribute('aria-describedby', 'gm-selling-point-0-title-description');
  });

  it('TaglineField: input aponta para o hint/erro do Field', () => {
    render(<TaglineField value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Slogan')).toHaveAttribute(
      'aria-describedby',
      'gm-tagline-description',
    );
    expect(document.getElementById('gm-tagline-description')).not.toBeNull();
  });

  it('PromoBadgeField: input aponta para o hint do Field', () => {
    render(<PromoBadgeField value="" />);
    expect(screen.getByLabelText('Faixa promocional (opcional)')).toHaveAttribute(
      'aria-describedby',
      'gm-promo-badge-text-description',
    );
    expect(document.getElementById('gm-promo-badge-text-description')).not.toBeNull();
  });

  it('ProfileTagsSection: os três inputs apontam para o hint do próprio Field', () => {
    renderTagsSection();
    expect(screen.getByLabelText('Especialidades')).toHaveAttribute(
      'aria-describedby',
      'gm-specialties-description',
    );
    expect(screen.getByLabelText('Idiomas')).toHaveAttribute(
      'aria-describedby',
      'gm-languages-description',
    );
    expect(screen.getByLabelText('Selos')).toHaveAttribute(
      'aria-describedby',
      'gm-badges-description',
    );
  });

  it('SellingPointsEditor: título com erro aponta para o <p> do erro; sem erro, sem atributo', () => {
    render(<SellingPointsEditor value={[validPoint]} />);
    const title = screen.getByLabelText('Título');
    expect(title).not.toHaveAttribute('aria-describedby');

    fireEvent.change(title, { target: { value: '' } });
    expect(screen.getByLabelText('Título')).toHaveAttribute(
      'aria-describedby',
      'gm-selling-point-0-title-description',
    );
    expect(document.getElementById('gm-selling-point-0-title-description')).not.toBeNull();
  });

  it('SellingPointsEditor: campos sem hint/erro não recebem o atributo', () => {
    render(<SellingPointsEditor value={[validPoint]} />);
    expect(screen.getByLabelText('Ícone do destaque 1')).not.toHaveAttribute('aria-describedby');
    expect(screen.getByLabelText('Descrição')).not.toHaveAttribute('aria-describedby');
    expect(screen.getByLabelText('Destaque (opcional)')).not.toHaveAttribute('aria-describedby');
  });

  it('ClosedGroupPriceField: input aponta para o hint/erro do Field', () => {
    render(<ClosedGroupPriceField value={null} onChange={() => {}} />);
    expect(screen.getByLabelText('Preço mínimo (R$)')).toHaveAttribute(
      'aria-describedby',
      'gm-closed-group-price-description',
    );
    expect(document.getElementById('gm-closed-group-price-description')).not.toBeNull();
  });

  it('bio e experiência: sem hint/erro, sem aria-describedby (regra da B7)', () => {
    render(
      <>
        <BioLongField value="" />
        <ExperienceYearsField value={null} />
      </>,
    );
    expect(screen.getByLabelText('Bio detalhada')).not.toHaveAttribute('aria-describedby');
    expect(screen.getByLabelText('Anos de Experiência')).not.toHaveAttribute('aria-describedby');
  });
});
