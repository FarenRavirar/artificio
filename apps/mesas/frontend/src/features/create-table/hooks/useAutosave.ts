import { useEffect, useState } from 'react';
import type { DraftStatus } from '../types/createTable.types';
import { draftStorage } from '../utils/draftStorage';

interface UseAutosaveOptions {
  key?: string;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseAutosaveReturn {
  draftStatus: DraftStatus;
  lastSaved: Date | null;
  clearDraft: () => void;
}

/**
 * Hook para autosave automático com feedback visual
 */
export function useAutosave(
  data: unknown,
  options: UseAutosaveOptions = {}
): UseAutosaveReturn {
  const {
    key = 'create-table-draft',
    debounceMs = 1000,
    enabled = true,
  } = options;

  const [draftStatus, setDraftStatus] = useState<DraftStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const savingTimeout = setTimeout(() => {
      setDraftStatus('saving');
    }, 0);

    const timeout = setTimeout(() => {
      draftStorage.save(key, data);
      setDraftStatus('saved');
      setLastSaved(new Date());

      // Voltar para idle após 2s
      setTimeout(() => setDraftStatus('idle'), 2000);
    }, debounceMs);

    return () => {
      clearTimeout(savingTimeout);
      clearTimeout(timeout);
    };
  }, [data, key, debounceMs, enabled]);

  const clearDraft = () => {
    draftStorage.clear(key);
    setDraftStatus('idle');
    setLastSaved(null);
  };

  return {
    draftStatus,
    lastSaved,
    clearDraft,
  };
}
