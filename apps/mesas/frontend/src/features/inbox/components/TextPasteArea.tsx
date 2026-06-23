import { useState, useRef, useCallback, type FormEvent } from 'react';
import { Loader2, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Banner, Textarea, Field } from '@artificio/ui';
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
      <Field id="inbox-paste-textarea" label="Colar anúncio de mesa">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Cole aqui o texto do anúncio (um ou vários, separados por ---)..."
          disabled={state === 'sending'}
          rows={10}
        />
      </Field>

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

        <span className="text-xs text-[var(--fg-muted)]">
          {text.trim().length} caracteres
        </span>
      </div>

      <div aria-live="polite">
        {state === 'success' && result && (
          <Banner variant="success" icon={<CheckCircle2 className="w-4 h-4" aria-hidden="true" />}>
            {result.segments_found} segmento{result.segments_found === 1 ? '' : 's'} encontrado{result.segments_found === 1 ? '' : 's'}
            , {result.drafts_created} draft{result.drafts_created === 1 ? '' : 's'} criado{result.drafts_created === 1 ? '' : 's'}.
          </Banner>
        )}

        {state === 'no-drafts' && result && (
          <Banner variant="warning" icon={<AlertTriangle className="w-4 h-4" aria-hidden="true" />}>
            {result.segments_found > 0
              ? `${result.segments_found} segmento(s) encontrado(s), mas nenhum draft gerado. Verifique o formato do anúncio.`
              : 'Nenhum segmento de anúncio encontrado no texto.'}
          </Banner>
        )}

        {state === 'error' && errorMessage && (
          <Banner variant="danger" icon={<AlertTriangle className="w-4 h-4" aria-hidden="true" />}>
            {errorMessage}
          </Banner>
        )}
      </div>
    </form>
  );
}
