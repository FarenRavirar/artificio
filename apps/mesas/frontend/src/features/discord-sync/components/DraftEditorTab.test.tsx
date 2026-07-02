// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DraftEditorTab } from './DraftEditorTab';
import type { DraftForm } from '../draftFormUtils';

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
};

function renderTab(overrides: Partial<ComponentProps<typeof DraftEditorTab>> = {}) {
  return render(
    <DraftEditorTab
      form={form}
      missingFields={[]}
      systems={[]}
      systemsLoading={false}
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
      onSetSlotsInterpretation={vi.fn()}
      onConfirmSlots={vi.fn()}
      {...overrides}
    />,
  );
}

describe('DraftEditorTab', () => {
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
});
