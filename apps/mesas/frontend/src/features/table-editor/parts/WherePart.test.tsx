// @vitest-environment jsdom
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WherePart, type CatalogPlatformOption } from './WherePart';
import { createDefaultEditorState } from '../hooks/useTableEditor';
import type { TableEditorApi } from '../hooks/useTableEditor';
import type { TableEditorState } from '../types';

/**
 * Teste da parte "Onde joga" — o contrato de exibição por modalidade
 * (spec 096, R23/A26): VTT/comunicação só em online OU híbrida (isOnline,
 * espelho do refine do backend tableValidators.ts:436-445); cidade/estado em
 * presencial OU híbrida (showsLocation — modalidade com componente
 * presencial). A26 valida exatamente estes casos.
 *
 * Fase 5 (T5.3): auto-marcação "com o porquê" (R3) — selecionar plataforma
 * que implica requisito marca o requisito E exibe a legenda derivada
 * ("Exigido por Foundry VTT"); só marca (nunca desmarca); dispara apenas na
 * troca de seleção do select, nunca como efeito de render.
 */

// vi.hoisted garante a init antes das factories de vi.mock (padrão do repo,
// ex. TableEditor.test.tsx). Os catálogos são injetados por teste.
const mockCatalogs = vi.hoisted(() => ({
  vtts: [] as CatalogPlatformOption[],
  comms: [] as CatalogPlatformOption[],
}));

vi.mock('../../../hooks/useVttPlatforms', () => ({
  useVttPlatforms: () => ({ platforms: mockCatalogs.vtts, loading: false, error: null }),
}));
vi.mock('../../../hooks/useCommunicationPlatforms', () => ({
  useCommunicationPlatforms: () => ({ platforms: mockCatalogs.comms, loading: false, error: null }),
}));

// Fixtures do catálogo (migration_162, plan.md §Regras VTT → requisitos):
// Foundry implica PC; Discord implica microfone; Zoom implica mic+câmera;
// Owlbear/Telegram não implicam nada.
const foundryVtt: CatalogPlatformOption = {
  id: 'vtt-foundry-id',
  name: 'Foundry VTT',
  slug: 'foundry-vtt',
  implies_pc: true,
  implies_microphone: false,
  implies_camera: false,
};
const owlbearVtt: CatalogPlatformOption = {
  id: 'vtt-owlbear-id',
  name: 'Owlbear Rodeo',
  slug: 'owlbear-rodeo',
  implies_pc: false,
  implies_microphone: false,
  implies_camera: false,
};
const discordComm: CatalogPlatformOption = {
  id: 'comm-discord',
  name: 'Discord',
  slug: 'discord',
  implies_pc: false,
  implies_microphone: true,
  implies_camera: false,
};
const telegramComm: CatalogPlatformOption = {
  id: 'comm-telegram',
  name: 'Telegram',
  slug: 'telegram',
  implies_pc: false,
  implies_microphone: false,
  implies_camera: false,
};
const zoomComm: CatalogPlatformOption = {
  id: 'comm-zoom',
  name: 'Zoom',
  slug: 'zoom',
  implies_pc: false,
  implies_microphone: true,
  implies_camera: true,
};

function makeApi(modality: 'online' | 'presencial' | 'hibrida'): TableEditorApi {
  return {
    state: { ...createDefaultEditorState(), modality },
    patch: vi.fn(),
    replaceState: vi.fn(),
    validateFieldOnBlur: vi.fn(),
    errors: {},
    revealedPending: false,
    publish: vi.fn(async () => true),
    publishError: null,
    publishing: false,
    isDirty: false,
    draftStatus: 'idle',
    isEditing: false,
    isActive: false,
    showRestoreModal: false,
    savedDraft: null,
    handleRestoreDraft: vi.fn(),
    handleDiscardDraft: vi.fn(),
    firstErrorFieldToFocus: null,
    gmProfileLoading: false,
    hasGmProfile: false,
    inheritedEdits: { displayName: false, bio: false, contacts: false },
    hasInheritedEdit: false,
    syncProfileToMaster: vi.fn(async () => true),
    syncingProfile: false,
  };
}

/**
 * Harness com `patch` real (atualiza o estado e re-renderiza) para os testes
 * de auto-marcação: a legenda do porquê é derivada do estado, então precisa
 * do estado evoluindo junto do patch. `patchSpy` observa cada chamada.
 */
function renderStateful(initial: Partial<TableEditorState> = {}) {
  const patchSpy = vi.fn();
  function Harness() {
    const [state, setState] = useState<TableEditorState>(() => ({
      ...createDefaultEditorState(),
      modality: 'online',
      ...initial,
    }));
    const api: TableEditorApi = {
      ...makeApi('online'),
      state,
      patch: (partial) => {
        patchSpy(partial);
        setState((prev) => ({ ...prev, ...partial }));
      },
    };
    return <WherePart api={api} />;
  }
  render(<Harness />);
  return { patchSpy };
}

beforeEach(() => {
  mockCatalogs.vtts = [];
  mockCatalogs.comms = [];
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }),
  );
});

describe('WherePart — exibição por modalidade (R23/A26)', () => {
  it('online: VTT/comunicação visíveis, cidade/estado NÃO', () => {
    render(<WherePart api={makeApi('online')} />);
    expect(screen.getByLabelText(/Plataforma de jogo/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Cidade/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Estado/)).not.toBeInTheDocument();
  });

  it('presencial: cidade/estado visíveis, VTT/comunicação NÃO', () => {
    render(<WherePart api={makeApi('presencial')} />);
    expect(screen.getByLabelText(/Cidade/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Estado/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Plataforma de jogo/)).not.toBeInTheDocument();
  });

  it('híbrida: cidade/estado visíveis (A26) E VTT/comunicação visíveis (isOnline preservado)', () => {
    render(<WherePart api={makeApi('hibrida')} />);
    expect(screen.getByLabelText(/Cidade/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Estado/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Plataforma de jogo/)).toBeInTheDocument();
  });
});

describe('WherePart — D5: trocar para online limpa city/state', () => {
  it('presencial → online limpa os dois campos de localização no MESMO patch', () => {
    const api = makeApi('presencial');
    render(<WherePart api={api} />);

    fireEvent.change(screen.getByLabelText(/Modalidade/), { target: { value: 'online' } });

    // Sem a limpeza, o valor antigo ficaria no estado e iria no payload
    // (campo invisível não limpo — mesmo defeito corrigido em
    // handlePriceTypeChange do ValuesPart).
    expect(api.patch).toHaveBeenCalledWith({ modality: 'online', city: '', state: '' });
  });

  it('híbrida → online também limpa (a ida para online apaga sempre)', () => {
    const api = makeApi('hibrida');
    render(<WherePart api={api} />);

    fireEvent.change(screen.getByLabelText(/Modalidade/), { target: { value: 'online' } });

    expect(api.patch).toHaveBeenCalledWith({ modality: 'online', city: '', state: '' });
  });

  it('online → híbrida NÃO limpa (só a troca PARA online apaga os campos)', () => {
    const api = makeApi('online');
    render(<WherePart api={api} />);

    fireEvent.change(screen.getByLabelText(/Modalidade/), { target: { value: 'hibrida' } });

    expect(api.patch).toHaveBeenCalledWith({ modality: 'hibrida' });
  });
});

describe('WherePart — auto-marcação com o porquê (R3/T5.3)', () => {
  it('VTT que implica PC: marca requiresPc no MESMO patch e exibe a legenda', () => {
    mockCatalogs.vtts = [foundryVtt, owlbearVtt];
    const { patchSpy } = renderStateful();

    fireEvent.change(screen.getByLabelText(/Plataforma de jogo/), {
      target: { value: 'foundry-vtt' },
    });

    expect(patchSpy).toHaveBeenCalledWith({ vttPlatformId: 'foundry-vtt', requiresPc: true });
    expect(screen.getByText('Exigido por Foundry VTT.')).toBeInTheDocument();
    // A auto-marcação só marca o que a plataforma implica — nada mais.
    expect(patchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ requiresCamera: true }));
    expect(patchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ requiresMicrophone: true }));
  });

  it('comunicação que implica microfone: marca requiresMicrophone no MESMO patch', () => {
    mockCatalogs.comms = [discordComm, telegramComm];
    const { patchSpy } = renderStateful();

    fireEvent.change(screen.getByLabelText(/Plataforma de comunicação/), {
      target: { value: 'comm-discord' },
    });

    expect(patchSpy).toHaveBeenCalledWith({
      communicationPlatformId: 'comm-discord',
      requiresMicrophone: true,
    });
    expect(screen.getByText('Exigido por Discord.')).toBeInTheDocument();
  });

  it('Meet/Zoom: marca microfone E câmera, com legenda nos dois requisitos', () => {
    mockCatalogs.comms = [zoomComm];
    const { patchSpy } = renderStateful();

    fireEvent.change(screen.getByLabelText(/Plataforma de comunicação/), {
      target: { value: 'comm-zoom' },
    });

    expect(patchSpy).toHaveBeenCalledWith({
      communicationPlatformId: 'comm-zoom',
      requiresMicrophone: true,
      requiresCamera: true,
    });
    // Uma legenda ao lado do requisito de microfone e outra ao lado do de
    // câmera — texto idêntico, dois elementos.
    expect(screen.getAllByText('Exigido por Zoom.')).toHaveLength(2);
  });

  it('opção "custom" ou vazia NÃO marca requisito nenhum', () => {
    mockCatalogs.vtts = [foundryVtt];
    const { patchSpy } = renderStateful();
    const vttSelect = screen.getByLabelText(/Plataforma de jogo/);

    fireEvent.change(vttSelect, { target: { value: 'custom' } });
    expect(patchSpy).toHaveBeenCalledWith({ vttPlatformId: 'custom' });

    fireEvent.change(vttSelect, { target: { value: '' } });
    expect(patchSpy).toHaveBeenCalledWith({ vttPlatformId: '' });

    // Nenhuma chamada carregou requisito (toEqual exato já cobriria, mas o
    // objectContaining explicita a intenção da regra "só marca, nunca infere").
    expect(patchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ requiresPc: true }));
    expect(patchSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ requiresMicrophone: true }),
    );
    expect(patchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ requiresCamera: true }));
  });

  it('editar mesa existente (estado pré-carregado) NÃO re-marca nada', () => {
    mockCatalogs.vtts = [foundryVtt];
    const { patchSpy } = renderStateful({ vttPlatformId: 'foundry-vtt', requiresPc: false });

    // O mestre desmarcou PC numa sessão anterior; abrir o editor preserva a
    // escolha — a marcação só dispara quando ELE mexe no select (R3).
    expect(patchSpy).not.toHaveBeenCalled();
    // A legenda continua derivada da plataforma selecionada: explica o
    // porquê, mas não muda o estado.
    expect(screen.getByText('Exigido por Foundry VTT.')).toBeInTheDocument();
  });

  it('desmarcar manualmente NÃO re-marca — a legenda persiste informando a exigência', () => {
    mockCatalogs.vtts = [foundryVtt];
    const { patchSpy } = renderStateful({ vttPlatformId: 'foundry-vtt', requiresPc: true });

    fireEvent.click(screen.getByRole('button', { name: /Requer computador/ }));

    expect(patchSpy).toHaveBeenCalledWith({ requiresPc: false });
    // Nenhum efeito de render re-marcou depois da ação do mestre.
    expect(patchSpy).toHaveBeenCalledTimes(1);
    // Legenda continua (derivada da plataforma, não do estado do checkbox).
    expect(screen.getByText('Exigido por Foundry VTT.')).toBeInTheDocument();
  });

  it('trocar de plataforma após desmarcar re-aplica a marcação', () => {
    mockCatalogs.vtts = [foundryVtt, owlbearVtt];
    const { patchSpy } = renderStateful({ vttPlatformId: 'foundry-vtt', requiresPc: true });

    fireEvent.click(screen.getByRole('button', { name: /Requer computador/ }));
    expect(patchSpy).toHaveBeenLastCalledWith({ requiresPc: false });

    // Troca para plataforma sem implicação: nada é marcado.
    fireEvent.change(screen.getByLabelText(/Plataforma de jogo/), {
      target: { value: 'owlbear-rodeo' },
    });
    expect(patchSpy).toHaveBeenLastCalledWith({ vttPlatformId: 'owlbear-rodeo' });

    // Volta para Foundry: a auto-marcação dispara de novo (mudança de seleção).
    fireEvent.change(screen.getByLabelText(/Plataforma de jogo/), {
      target: { value: 'foundry-vtt' },
    });
    expect(patchSpy).toHaveBeenLastCalledWith({ vttPlatformId: 'foundry-vtt', requiresPc: true });
  });

  it('sem plataforma implicante selecionada → sem legenda', () => {
    mockCatalogs.vtts = [owlbearVtt];
    renderStateful({ vttPlatformId: 'owlbear-rodeo' });

    expect(screen.queryByText(/Exigido por/)).not.toBeInTheDocument();
  });
});
