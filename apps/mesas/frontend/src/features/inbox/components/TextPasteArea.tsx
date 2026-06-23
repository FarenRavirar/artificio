import { useState, useRef, useCallback, type FormEvent } from 'react';
import { Loader2, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { inboxApi } from '../api/inboxApi';
import type { InboxImportResult } from '../types';

interface TextPasteAreaProps {
  readonly onImportSuccess?: (result: InboxImportResult) => void;
  readonly titleHint?: string;
}

type PasteState = 'empty' | 'typing' | 'sending' | 'success' | 'no-drafts' | 'error';

export function TextPasteArea({ onImportSuccess, titleHint }: TextPasteAreaProps) {
  const [text, setText] = useState('');
  const [state, setState] = useState<PasteState>('empty');
  const [result, setResult] = useState<InboxImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSubmit = text.trim().length >= 10 && state !== 'sending';

  const handleTextChange = useCallback((value: string) => {
    setText(value);
    if (value.trim().length > 0) {
      setState('typing');
    } else {
      setState('empty');
    }
    setErrorMessage(null);
  }, []);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setState('sending');
    setErrorMessage(null);
    setResult(null);

    try {
      const data = await inboxApi.importText(text, titleHint);
      setResult(data);

      if (data.drafts_created > 0) {
        setState('success');
        setText('');
        onImportSuccess?.(data);
      } else if (data.segments_found > 0) {
        setState('no-drafts');
      } else {
        setState('no-drafts');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao importar texto.';
      setErrorMessage(message);
      setState('error');
      toast.error(message);
    } finally {
      textareaRef.current?.focus();
    }
  }, [canSubmit, text, titleHint, onImportSuccess]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="inbox-paste-textarea" className="text-sm font-medium text-[var(--artificio-fg)]">
        Colar anúncio de mesa
      </label>

      <textarea
        id="inbox-paste-textarea"
        ref={textareaRef}
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="Cole aqui o texto do anúncio (um ou vários, separados por ---)..."
        className="w-full min-h-[200px] p-4 rounded-md border border-[var(--artificio-border)] bg-[var(--artificio-surface)] text-[var(--artificio-fg)] text-sm resize-y placeholder:text-[var(--artificio-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--artificio-brand)] disabled:opacity-60"
        disabled={state === 'sending'}
        rows={10}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--artificio-brand)] text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {state === 'sending' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Importando...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" aria-hidden="true" />
              Importar anúncios
            </>
          )}
        </button>

        <span className="text-xs text-[var(--artificio-muted)]">
          {text.trim().length} caracteres
        </span>
      </div>

      <div aria-live="polite">
        {state === 'success' && result && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-800 dark:text-green-200">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {result.segments_found} segmento{result.segments_found === 1 ? '' : 's'} encontrado{result.segments_found === 1 ? '' : 's'}
              , {result.drafts_created} draft{result.drafts_created === 1 ? '' : 's'} criado{result.drafts_created === 1 ? '' : 's'}.
            </span>
          </div>
        )}

        {state === 'no-drafts' && result && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {result.segments_found > 0
                ? `${result.segments_found} segmento(s) encontrado(s), mas nenhum draft gerado. Verifique o formato do anúncio.`
                : 'Nenhum segmento de anúncio encontrado no texto.'}
            </span>
          </div>
        )}

        {state === 'error' && errorMessage && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </form>
  );
}
