// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import toast from 'react-hot-toast';
import { DuplicatesTab } from './DuplicatesTab';
import type { DuplicateCandidate } from '../types';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const baseCandidate: DuplicateCandidate = {
  id: 'dup-1',
  score: 0.93,
  match_kind: 'exact',
  signals: { raw_hash_exact: true, same_channel: true },
  status: 'candidate',
  reviewed_by: null,
  reviewed_at: null,
  created_at: '2026-07-01T00:00:00Z',
  candidate_case_id: 'case-2',
  candidate_draft_id: 'draft-2',
  candidate_normalized_text: 'mesa igual ja importada',
  candidate_final_action: 'draft',
  candidate_draft_status: 'draft',
  candidate_draft_data: null,
};

describe('DuplicatesTab', () => {
  it('lista candidatos e sinais de duplicata', async () => {
    render(
      <DuplicatesTab
        draftId="draft-1"
        listDuplicateCandidates={vi.fn().mockResolvedValue([baseCandidate])}
        resolveDuplicateCandidate={vi.fn()}
      />,
    );

    expect(await screen.findByText('Duplicata exata')).toBeInTheDocument();
    expect(screen.getByText('score: 93%')).toBeInTheDocument();
    expect(screen.getByText('texto idêntico')).toBeInTheDocument();
    expect(screen.getByText('mesmo canal')).toBeInTheDocument();
    expect(screen.getByText('mesa igual ja importada')).toBeInTheDocument();
  });

  it('registra decisão humana e atualiza o status local', async () => {
    const resolveDuplicateCandidate = vi.fn().mockResolvedValue({
      ...baseCandidate,
      status: 'rejected_duplicate',
      reviewed_by: 'admin-test',
      reviewed_at: '2026-07-01T01:00:00Z',
    });

    render(
      <DuplicatesTab
        draftId="draft-1"
        listDuplicateCandidates={vi.fn().mockResolvedValue([baseCandidate])}
        resolveDuplicateCandidate={resolveDuplicateCandidate}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Não é duplicata' }));

    await waitFor(() => {
      expect(resolveDuplicateCandidate).toHaveBeenCalledWith('dup-1', 'rejected_duplicate');
      expect(toast.success).toHaveBeenCalledWith('Decisão registrada.');
    });
    expect(screen.getByText('Rejeitada (não é duplicata)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Não é duplicata' })).not.toBeInTheDocument();
  });

  it('mostra estado vazio quando nao ha candidatos', async () => {
    render(
      <DuplicatesTab
        draftId="draft-1"
        listDuplicateCandidates={vi.fn().mockResolvedValue([])}
        resolveDuplicateCandidate={vi.fn()}
      />,
    );

    expect(await screen.findByText('Nenhum candidato de duplicata encontrado para este draft.')).toBeInTheDocument();
  });

  it('limpa candidatos antigos e volta para loading quando draftId muda', async () => {
    let resolveSecondRequest: ((value: DuplicateCandidate[]) => void) | null = null;
    const listDuplicateCandidates = vi.fn()
      .mockResolvedValueOnce([baseCandidate])
      .mockImplementationOnce(() => new Promise<DuplicateCandidate[]>((resolve) => {
        resolveSecondRequest = resolve;
      }));

    const { rerender } = render(
      <DuplicatesTab
        draftId="draft-1"
        listDuplicateCandidates={listDuplicateCandidates}
        resolveDuplicateCandidate={vi.fn()}
      />,
    );

    expect(await screen.findByText('mesa igual ja importada')).toBeInTheDocument();

    rerender(
      <DuplicatesTab
        draftId="draft-2"
        listDuplicateCandidates={listDuplicateCandidates}
        resolveDuplicateCandidate={vi.fn()}
      />,
    );

    expect(screen.getByText('Buscando candidatos de duplicata...')).toBeInTheDocument();
    expect(screen.queryByText('mesa igual ja importada')).not.toBeInTheDocument();

    resolveSecondRequest?.([]);
    expect(await screen.findByText('Nenhum candidato de duplicata encontrado para este draft.')).toBeInTheDocument();
  });
});
