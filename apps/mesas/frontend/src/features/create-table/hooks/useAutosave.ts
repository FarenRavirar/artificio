import { useEffect, useRef, useState } from 'react';
import { draftStorage } from '../utils/draftStorage';

// T4.8 (spec 096): DraftStatus morava em types/createTable.types.ts, removido
// junto com o wizard antigo — o dono atual do conceito é este hook, então o
// tipo é exportado daqui (o editor de anúncio o importa para o selo de
// autosave).
export type DraftStatus = 'idle' | 'saving' | 'saved';

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

  // C4b (revisão adversarial Fase 4): os timers desta rodada do effect —
  // sem o registro, o setTimeout de "voltar para idle" (2s, criado DENTRO do
  // callback do save) nunca é limpo no cleanup e dispara setState após
  // desmonte. O ref também serve ao clearDraft: cancelar os pendentes evita
  // um save agendado ressuscitar o rascunho recém-limpo (ghost após publish).
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const savingTimeout = setTimeout(() => {
      setDraftStatus('saving');
    }, 0);
    timers.push(savingTimeout);

    const timeout = setTimeout(() => {
      draftStorage.save(key, data);
      setDraftStatus('saved');
      setLastSaved(new Date());

      // Voltar para idle após 2s
      const idleTimeout = setTimeout(() => setDraftStatus('idle'), 2000);
      timers.push(idleTimeout);
    }, debounceMs);
    timers.push(timeout);

    pendingTimersRef.current = timers;

    return () => {
      for (const timer of timers) clearTimeout(timer);
      if (pendingTimersRef.current === timers) pendingTimersRef.current = [];
    };
  }, [data, key, debounceMs, enabled]);

  const clearDraft = () => {
    // Cancela os timers pendentes ANTES de limpar: o debounce (1s) agendado
    // com o estado pré-publish dispararia DEPOIS do clear e reescreveria o
    // rascunho — o modal "Rascunho encontrado" voltaria a oferecer uma mesa
    // já publicada.
    for (const timer of pendingTimersRef.current) clearTimeout(timer);
    pendingTimersRef.current = [];
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
