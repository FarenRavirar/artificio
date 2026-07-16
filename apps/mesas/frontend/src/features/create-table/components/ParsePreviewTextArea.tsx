import { useState, useCallback, type FormEvent } from 'react';
import { Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { authPost } from '../../../utils/authenticatedFetch';
import { mapTableApiToInitialData } from '../utils/mapTableApiToInitialData';
import type { FormState } from '../types/createTable.types';

interface ParsePreviewResponse {
  parse_case_id: string | null;
  table: Record<string, unknown> | null;
  contacts: unknown[];
  schedules: unknown[];
}

interface ParsePreviewTextAreaProps {
  readonly onPreviewReady: (initialData: Partial<FormState>) => void;
}

type PreviewState = 'idle' | 'sending' | 'error' | 'empty-result';

/**
 * Requisito 8 (spec 079): entrada de texto do fluxo público de pré-
 * preenchimento (`create-table`, Card "Colar anúncio"). Chama a rota nova
 * `POST /gm/parse-preview` — reaproveita a MESMA engine de parser/aprendizado
 * do fluxo admin/Discord (`parseTextForPreview` no backend), nunca publica
 * sozinho: só devolve os campos sugeridos pro chamador popular o form normal
 * (`CreateTableForm`), que o mestre revisa/edita/confirma como sempre.
 */
export function ParsePreviewTextArea({ onPreviewReady }: ParsePreviewTextAreaProps) {
  const [text, setText] = useState('');
  const [state, setState] = useState<PreviewState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = text.trim().length >= 10 && state !== 'sending';

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setState('sending');
    setErrorMessage(null);

    try {
      const res = await authPost('/api/v1/gm/parse-preview', { text });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Erro ao processar texto colado.');
      }
      const json = await res.json();
      const data = json.data as ParsePreviewResponse;

      if (!data.table) {
        setState('empty-result');
        return;
      }

      const apiShapedData = {
        ...data.table,
        contacts: data.contacts,
        schedules: data.schedules,
      };
      const initialData = mapTableApiToInitialData(apiShapedData);
      onPreviewReady({ ...initialData, parseCaseId: data.parse_case_id });
      setState('idle');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar texto colado.';
      setErrorMessage(message);
      setState('error');
    }
  }, [canSubmit, text, onPreviewReady]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="parse-preview-textarea" className="text-sm font-medium text-white/80">
        Cole o texto do anúncio da sua mesa
      </label>
      <textarea
        id="parse-preview-textarea"
        value={text}
        onChange={(e) => { setText(e.target.value); setState('idle'); setErrorMessage(null); }}
        placeholder="Cole aqui o texto do seu anúncio (título, sistema, dias/horários, vagas, contato...)"
        disabled={state === 'sending'}
        rows={10}
        className="w-full rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/90 placeholder:text-white/30 focus:border-[var(--color-artificio-orange)] focus:outline-none"
      />

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--color-artificio-orange)] text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {state === 'sending' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Analisando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              Analisar texto
            </>
          )}
        </button>
        <span className="text-xs text-white/45">{text.trim().length} caracteres</span>
      </div>

      <div aria-live="polite">
        {state === 'empty-result' && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            Não consegui reconhecer um anúncio de mesa nesse texto. Você pode preencher o formulário manualmente abaixo.
          </div>
        )}
        {state === 'error' && errorMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            {errorMessage}
          </div>
        )}
      </div>
    </form>
  );
}
