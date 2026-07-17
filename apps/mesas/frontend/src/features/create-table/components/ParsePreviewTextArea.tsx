import { useState, useCallback, type FormEvent } from 'react';
import { Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { authPost } from '../../../utils/authenticatedFetch';
import type { FormState } from '../types/createTable.types';

interface ParsePreviewResponse {
  parse_case_id: string | null;
  table: Record<string, unknown> | null;
  contacts: unknown[];
  schedules: unknown[];
}

// Achado de review (CodeRabbit, PR #172): resposta da API era usada via cast
// cego (`as ParsePreviewResponse`), violando a regra de normalização do
// projeto (todo dado de API é `unknown` até passar por guard/normalizador
// tipado). Guard explícito em vez de lib nova (zod não é usado neste diretório
// do frontend — regra do projeto pede perguntar antes de introduzir lib nova).
function isValidParsePreviewResponse(value: unknown): value is ParsePreviewResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const hasValidParseCaseId = v.parse_case_id === null || typeof v.parse_case_id === 'string';
  const hasValidTable = v.table === null || (typeof v.table === 'object' && v.table !== null && !Array.isArray(v.table));
  const hasValidContacts = Array.isArray(v.contacts);
  const hasValidSchedules = Array.isArray(v.schedules);
  return hasValidParseCaseId && hasValidTable && hasValidContacts && hasValidSchedules;
}

interface ParsePreviewTextAreaProps {
  readonly onPreviewReady: (initialData: Partial<FormState>) => void;
  // Requisito 7/8 (spec 079, T5.9): nome de exibição da conta logada — usado
  // só pra decidir se mostra o banner de sugestão abaixo (extraído ≠ conta),
  // nunca pra sobrescrever nada automaticamente.
  readonly currentUserName?: string | null;
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
export function ParsePreviewTextArea({ onPreviewReady, currentUserName }: ParsePreviewTextAreaProps) {
  const [text, setText] = useState('');
  const [state, setState] = useState<PreviewState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [suggestedGmName, setSuggestedGmName] = useState<string | null>(null);

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
      const json: unknown = await res.json();
      const rawData = typeof json === 'object' && json !== null ? (json as Record<string, unknown>).data : undefined;

      if (!isValidParsePreviewResponse(rawData)) {
        throw new Error('Resposta inesperada do servidor ao analisar o texto.');
      }
      const data = rawData;

      if (!data.table) {
        setState('empty-result');
        return;
      }

      const apiShapedData = {
        ...data.table,
        contacts: data.contacts,
        schedules: data.schedules,
      };
      // Import dinâmico igual ao já usado em PainelMestrePage.tsx (modo
      // edição) — achado no build repo-wide (INEFFECTIVE_DYNAMIC_IMPORT):
      // import estático aqui anulava o code-split que já existia lá, porque
      // o bundler não consegue isolar o módulo em chunk separado quando ele
      // é importado das duas formas ao mesmo tempo.
      const { mapTableApiToInitialData } = await import('../utils/mapTableApiToInitialData');
      const initialData = mapTableApiToInitialData(apiShapedData);

      // Requisito 7/8 (T5.9): extraído do texto (actual_gm_name, vindo de
      // raw_gm_name — "Mestre:"/"Narrador:"/etc no anúncio) pode divergir de
      // quem está logado (caso comum: alguém posta anúncio por outra pessoa).
      // Mostra como sugestão visível, nunca sobrescreve o nome da conta.
      const extractedGmName = initialData.actualGmName?.trim() || null;
      const trimmedUserName = currentUserName?.trim() || null;
      setSuggestedGmName(
        extractedGmName && trimmedUserName && extractedGmName !== trimmedUserName
          ? extractedGmName
          : null,
      );

      onPreviewReady({ ...initialData, parseCaseId: data.parse_case_id });
      setState('idle');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar texto colado.';
      setErrorMessage(message);
      setState('error');
    }
  }, [canSubmit, text, onPreviewReady, currentUserName]);

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
        {suggestedGmName && state === 'idle' && (
          <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-200">
            <Sparkles className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            O texto menciona "{suggestedGmName}" como mestre — diferente do nome da sua conta. Revise o campo de mestre no formulário abaixo antes de publicar.
          </div>
        )}
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
