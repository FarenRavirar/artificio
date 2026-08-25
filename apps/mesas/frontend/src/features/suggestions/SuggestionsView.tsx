/**
 * Spec 096 / T4.0k — tela "Minhas sugestões" do mestre (consumo de API
 * existente, zero endpoint novo). Lista as sugestões do usuário via
 * GET /system-suggestions/mine e GET /scenario-suggestions/mine e dá botão ao
 * POST /vtt-platforms/suggest. Notificações são Fase 7 (T7.4b) — fora daqui.
 *
 * HTTP via utils/authenticatedFetch (regra do repo; o PainelMestrePage:17-18
 * registra que fluxos novos do perfil do mestre usam authenticatedFetch, não
 * apiClient). Estados com primitives de @artificio/ui — zero controle cru.
 */
import { useEffect, useState, type FormEvent } from 'react';
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Panel,
  TextInput,
} from '@artificio/ui';
import { MarkdownContent } from '@artificio/content-editor';
import { authPost } from '../../utils/authenticatedFetch';
import { formatDate } from '../admin/utils/format';
import { useMySuggestions, type SuggestionListItem, type SuggestionListState } from './useMySuggestions';
import {
  SUGGESTION_STATUS_LABELS,
  VTT_SUGGESTION_NAME_MAX,
  normalizeVttSuggestionResult,
  readApiErrorMessage,
  readBackendMessage,
  readPayloadData,
  validateVttSuggestionName,
} from './suggestionModels';

function SuggestionCard({ item }: { item: SuggestionListItem }) {
  const status = SUGGESTION_STATUS_LABELS[item.status];

  return (
    <Panel tone="subtle" as="article" className="flex flex-col gap-3 h-full">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{item.name}</h3>
          <p className="text-xs opacity-60 mt-1">
            {item.kindLabel} · Enviada em {formatDate(item.createdAt)}
          </p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      {item.status === 'approved' && item.reviewedAt && (
        <p className="text-xs opacity-60">Aprovada em {formatDate(item.reviewedAt)}</p>
      )}

      {item.description && (
        <MarkdownContent value={item.description} className="text-white/85 leading-relaxed text-sm" />
      )}

      {item.status === 'rejected' && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
          <p className="text-xs uppercase tracking-wide text-red-300/80 mb-1">Motivo da recusa</p>
          {item.rejectionReason ? (
            <MarkdownContent value={item.rejectionReason} className="text-red-200/90 leading-relaxed text-sm" />
          ) : (
            <p className="text-sm text-red-200/90">A equipe não informou um motivo.</p>
          )}
        </div>
      )}
    </Panel>
  );
}

function SuggestionList({
  title,
  emptyMessage,
  state,
  onRetry,
}: {
  title: string;
  emptyMessage: string;
  state: SuggestionListState;
  onRetry: () => void;
}) {
  const titleId = `list-${title.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className="text-xl font-bold mb-4">
        {title}
      </h2>
      {state.loading ? (
        <LoadingState title={`Carregando ${title.toLowerCase()}...`} variant="panel" />
      ) : state.error ? (
        <ErrorState
          title={`Não foi possível carregar ${title.toLowerCase()}`}
          message={state.error}
          action={
            <Button variant="secondary" onClick={onRetry}>
              Tentar novamente
            </Button>
          }
        />
      ) : state.items.length === 0 ? (
        <EmptyState title="Nada por aqui ainda" message={emptyMessage} />
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 list-none p-0 m-0">
          {state.items.map((item) => (
            <li key={item.id} id={`suggestion-${item.id}`} className="scroll-mt-24">
              <SuggestionCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Form de sugestão de plataforma VTT. Medido: o painel do mestre não tem tela
 * de GERENCIAMENTO de VTT (só o editor de preferências VttPlatformsEditor, e o
 * CRUD admin em features/admin/platforms) — então a entrada do POST
 * /vtt-platforms/suggest fica aqui, como seção própria da tela de sugestões.
 * Sem contexto de mesa nesta tela, o `table_id` opcional não é enviado
 * (o backend aceita ausente: vttPlatforms.ts:181, `table_id || null`).
 */
function VttSuggestionForm() {
  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateVttSuggestionName(name);
    if (validationError) {
      setFieldError(validationError);
      return;
    }

    setFieldError(null);
    setSuccessMessage(null);
    setSubmitError(null);
    setSubmitting(true);
    try {
      const response = await authPost('/api/v1/vtt-platforms/suggest', { suggested_name: name.trim() });
      if (response.ok) {
        const body: unknown = await response.json().catch(() => null);
        // Eco normalizado antes de qualquer uso (regra de normalização do
        // repo); se o eco não normalizar, cai na mensagem do backend.
        const created = normalizeVttSuggestionResult(readPayloadData(body));
        setSuccessMessage(
          created
            ? `Sugestão "${created.suggested_name}" enviada! Será analisada pela equipe.`
            : readBackendMessage(body) ?? 'Sugestão enviada com sucesso! Será analisada pela equipe.',
        );
        setName('');
      } else {
        setSubmitError(await readApiErrorMessage(response, 'Erro ao enviar sugestão.'));
      }
    } catch {
      setSubmitError('Erro ao enviar sugestão. Verifique sua conexão.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">Não encontrou sua plataforma VTT?</h2>
        <p className="text-sm text-white/60 mt-1">
          Sugira uma plataforma de jogo para o catálogo. A equipe avalia antes de publicar.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
        <Field
          id="vtt-suggestion-name"
          label="Nome da plataforma"
          hint={`Até ${VTT_SUGGESTION_NAME_MAX} caracteres.`}
          error={fieldError ?? undefined}
          required
        >
          <TextInput
            id="vtt-suggestion-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (fieldError) setFieldError(null);
            }}
            maxLength={VTT_SUGGESTION_NAME_MAX}
            invalid={!!fieldError}
            placeholder="Ex.: Foundry VTT"
            disabled={submitting}
          />
        </Field>

        {successMessage && <Banner variant="success">{successMessage}</Banner>}
        {submitError && <Banner variant="danger">{submitError}</Banner>}

        <div>
          <Button type="submit" variant="primary" loading={submitting}>
            Enviar sugestão
          </Button>
        </div>
      </form>
    </section>
  );
}

export function SuggestionsView({ highlightId }: { highlightId?: string | null }) {
  const { systems, scenarios, reload } = useMySuggestions();
  const loaded = !systems.loading && !scenarios.loading;

  // Deep link /perfil/minhas-sugestoes/:id (action_url emitido pelo backend em
  // suggestionHelpers.ts:79 e systemSuggestionsAdmin.ts:524) → rola até o item.
  useEffect(() => {
    if (!highlightId || !loaded) return;
    document.getElementById(`suggestion-${highlightId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [highlightId, loaded]);

  return (
    <div className="space-y-8">
      <SuggestionList
        title="Sugestões de sistemas"
        emptyMessage="Quando você sugerir um sistema para o catálogo, ele aparece aqui com o status da análise."
        state={systems}
        onRetry={reload}
      />
      <SuggestionList
        title="Sugestões de cenários"
        emptyMessage="Quando você sugerir um cenário para o catálogo, ele aparece aqui com o status da análise."
        state={scenarios}
        onRetry={reload}
      />
      <VttSuggestionForm />
    </div>
  );
}
