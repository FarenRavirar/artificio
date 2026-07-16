// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DraftEditorTab } from './DraftEditorTab';
import type { DraftForm } from '../draftFormUtils';

vi.mock('../../../components/SystemSuggestionModal', () => ({
  SystemSuggestionModal: ({ initialName }: { initialName?: string }) => (
    <input aria-label="Nome sugerido" value={initialName ?? ''} readOnly />
  ),
}));

const form: DraftForm = {
  title: 'Mesa teste',
  description: 'Descricao',
  system_id: '',
  system_name: 'D&D',
  type: 'campanha',
  modality: 'online',
  price_type: 'gratuita',
  price_value: '',
  slots_total: '5',
  slots_open: '2',
  day_of_week: 'sábado',
  start_time: '19:00',
  frequency: 'semanal',
  contact_url: 'https://forms.gle/teste',
  contact_discord: '',
  cover_url: '',
  cover_url_source: '',
  cover_quality: '',
  age_rating: '',
  experience_level: '',
  table_level: '',
  setting_name: '',
  setting_styles: '',
  requires_pc: false,
  requires_camera: false,
  requires_microphone: false,
  session_zero_free: false,
  scenario_id: '',
  vtt_platform_id: '',
  communication_platform_id: '',
};

function renderTab(overrides: Partial<ComponentProps<typeof DraftEditorTab>> = {}) {
  return render(
    <DraftEditorTab
      form={form}
      missingFields={[]}
      systems={[]}
      systemsLoading={false}
      scenarios={[]}
      scenariosLoading={false}
      vttPlatforms={[]}
      vttPlatformsLoading={false}
      communicationPlatforms={[]}
      communicationPlatformsLoading={false}
      coverPreviewUrl=""
      coverError={null}
      coverUploading={false}
      coverInputRef={{ current: null }}
      shouldShowSlotsDisambiguation={false}
      slotsAmbiguity={null}
      slotsInterpretation="filled_total"
      fieldInsights={{}}
      savingFields={false}
      onUpdateForm={vi.fn()}
      onSystemChange={vi.fn()}
      onCoverUpload={vi.fn()}
      onRemoveCover={vi.fn()}
      onSetCoverUrl={vi.fn()}
      onSetSlotsInterpretation={vi.fn()}
      onConfirmSlots={vi.fn()}
      {...overrides}
    />,
  );
}

describe('DraftEditorTab', () => {
  it('mostra possibilidades de sistema e aplica ID e nome juntos', () => {
    const onSystemChange = vi.fn();
    renderTab({
      systemCandidates: [{
        system_id: 'pathfinder-2e',
        name: 'Pathfinder 2e',
        score: 91,
        reasons: ['alias exato'],
      }],
      onSystemChange,
    });

    expect(screen.getByText('Possibilidades do catálogo:')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pathfinder 2e' }));
    expect(onSystemChange).toHaveBeenCalledWith('pathfinder-2e', 'Pathfinder 2e');
  });

  it('mostra origem e evidencia por campo sem adicionar formulario extra', () => {
    renderTab({
      fieldInsights: {
        title: { source: 'parser', evidence: ['Valor extraído do anúncio.'] },
        system_name: {
          source: 'learning-store',
          evidence: ['Sugestão pendente de learning-rules.'],
          suggestion: 'D&D 5e',
        },
        contact_url: { source: 'deepseek', evidence: ['Sugestão pendente de deepseek.'], suggestion: 'https://forms.gle/teste' },
        description: { source: 'humano', evidence: ['Valor alterado na revisão.'] },
      },
    });

    expect(screen.getByText('Parser')).toBeInTheDocument();
    expect(screen.getByText('Learning')).toBeInTheDocument();
    expect(screen.getByText('DeepSeek')).toBeInTheDocument();
    expect(screen.getByText('Humano')).toBeInTheDocument();
    expect(screen.getByText('Valor extraído do anúncio.')).toBeInTheDocument();
    expect(screen.getByText('sugestão: D&D 5e')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('mostra status IA, contador e aplica sugestao por campo', () => {
    const onApplySuggestion = vi.fn();
    renderTab({
      aiConfig: {
        mode: 'off',
        killSwitch: false,
        provider: 'deepseek',
        model: 'deepseek-chat',
        lowConfidenceThreshold: 0.5,
        autoApprovalEnabled: false,
        autoApprovalThreshold: 0.95,
      },
      llmActivity: {
        window_hours: 24,
        total: 3,
        extraction: 2,
        completeness_audit: 1,
        by_status: { success: 3 },
        rows: [],
      },
      fieldInsights: {
        system_name: {
          source: 'deepseek',
          evidence: ['Sugestao pendente de deepseek.'],
          suggestion: 'D&D 5e',
        },
      },
      onApplySuggestion,
      onAuditCompleteness: vi.fn(),
    });

    expect(screen.getByText('Assistente IA desligado')).toBeInTheDocument();
    expect(screen.getByText(/DeepSeek:\s*3\s*chamada\(s\)\s*nas ultimas\s*24h/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(onApplySuggestion).toHaveBeenCalledWith('system_name', 'D&D 5e');
  });

  it('preenche modal de sistema com termo pesquisado no picker', () => {
    renderTab({
      systems: [],
    });

    fireEvent.change(screen.getByRole('searchbox', { name: /buscar sistema/i }), {
      target: { value: 'Shadowdark' },
    });
    fireEvent.click(screen.getByRole('button', { name: /criar agora/i }));

    expect(screen.getByLabelText('Nome sugerido')).toHaveValue('Shadowdark');
  });
});
