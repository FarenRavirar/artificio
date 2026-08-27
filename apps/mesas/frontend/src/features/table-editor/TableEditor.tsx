import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Modal, Button } from '@artificio/ui';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import type { DraftStatus } from '../create-table/hooks/useAutosave';
import { useAuth } from '../../contexts/useAuth';
import { useSelectedSystemNode } from './hooks/useSelectedSystemNode';
import { useTableEditor } from './hooks/useTableEditor';
import type { TableEditorApi, TableEditorInitialData } from './hooks/useTableEditor';
import type { EditorPartId } from './types';
import { partOfField, pendingParts, fieldLevel, isFieldFilled, REQUIRED_FIELD_IDS } from './utils/editorValidation';
import { applyParserPreview } from './utils/previewMerge';
import { parseParserSignals } from './utils/parserSignals';
import { EDITOR_PARTS, getPartLabel } from './utils/editorParts';
import { authGet } from '../../utils/authenticatedFetch';
import { IdentityPart } from './parts/IdentityPart';
import { WhenPart } from './parts/WhenPart';
import { WherePart } from './parts/WherePart';
import { ValuesPart } from './parts/ValuesPart';
import { AudiencePart } from './parts/AudiencePart';
import { MasterPart } from './parts/MasterPart';
import { ExtrasPart } from './parts/ExtrasPart';
import { CardPreview } from './components/CardPreview';
import './TableEditor.css';

/**
 * Sistemas elegíveis ao selo DDAL (D&D Adventurers League) — D&D 5e 2014 E
 * 2024. A4 (revisão adversarial Fase 4): ESPELHA `DDAL_ELIGIBLE_PATHS` do
 * backend (`apps/mesas/backend/src/services/tableService.ts:18`) e a lista do
 * CreateTableForm antigo (wizard removido na T4.8); os slugs vêm do catálogo
 * real. Contrato entre as camadas: aqui a lista decide só a UX (mostrar o
 * selo e desmarcá-lo ao trocar de sistema); o backend revalida no submit e é
 * a autoridade. Divergir deixaria o mestre marcar um selo que o publish
 * recusa (ou esconder um que o backend aceitaria) — mudou de um lado, muda
 * do outro no mesmo passo.
 */
const DDAL_ELIGIBLE_PATHS = [
  'dungeons-dragons/5e/2024',
  'dungeons-dragons/5e/dungeons-dragons-5e-2014',
] as const;

type TableEditorProps = Readonly<{
  initialData?: TableEditorInitialData;
  onPublished: () => void;
  onBack: () => void;
}>;

/**
 * Editor de anúncio (R1/R2): casca de 3 faixas, lateral com as 7 partes,
 * documento com UMA parte visível por vez e campos sempre abertos. Criar e
 * editar são a mesma tela — a diferença é o selo e o rótulo do botão.
 */
export function TableEditor({ initialData, onPublished, onBack }: TableEditorProps) {
  const { user } = useAuth();
  const api: TableEditorApi = useTableEditor({ initialData, onPublished });
  const { state } = api;

  const [activePartId, setActivePartId] = useState<EditorPartId>('identity');
  /** O documento — é ele que rola (não cada parte), e volta ao topo a cada troca. */
  const documentRef = useRef<HTMLElement>(null);

  // Texto colado do parser vive AQUI, não dentro do componente: a parte é
  // desmontada ao trocar de parte, e com ela iria embora o anúncio inteiro
  // (lição do achado 2026-08-18 em PainelMestrePage.tsx:301-306).
  const [parseSourceText, setParseSourceText] = useState('');

  // ── Sistema selecionado: UM nó por id (?id=), não a árvore inteira. A21
  //    proíbe `view=tree` no editor — a árvore custava 503.907 bytes por
  //    abertura (§Gap 9, causa 2) para alimentar dois lookups sobre o mesmo nó.
  const {
    node: selectedSystemNode,
    resolved: systemNodeResolved,
    failed: systemNodeFailed,
  } = useSelectedSystemNode(state.selectedSystemId);

  // ── Elegibilidade DDAL (T4.0b) ──────────────────────────────────────────
  const isDdalEligible = useMemo(() => {
    const path = selectedSystemNode?.path_slug ?? null;
    if (!path) return false;
    return DDAL_ELIGIBLE_PATHS.some(
      (eligible) => path === eligible || path.startsWith(`${eligible}/`),
    );
  }, [selectedSystemNode]);

  // Desmarca DDAL ao trocar para sistema não elegível (A14 — efeito herdado
  // do CreateTableForm antigo, wizard removido na T4.8, :274-278).
  useEffect(() => {
    // Só desmarca depois que a busca do sistema VOLTOU E DEU CERTO: com ela em
    // voo (ou falhada por rede) o nó é `null`, e tratar isso como "não
    // elegível" apagaria o selo que o mestre marcou. O backend revalida o DDAL
    // no submit e é a autoridade — deixar o selo de pé até haver resposta é o
    // lado seguro.
    if (!systemNodeResolved || systemNodeFailed) return;
    if (isDdalEligible || !state.ddal.is_ddal) return;
    let active = true;
    // setState deferido p/ fora do corpo síncrono do effect.
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      api.patch({ ddal: { ...state.ddal, is_ddal: false } });
    })();
    return () => { active = false; };
  }, [systemNodeResolved, systemNodeFailed, isDdalEligible, state.ddal.is_ddal, state.ddal, api]);

  // ── Nome do cenário (SettingStylesField usa para o selo de selecionado) ──
  // B4 (revisão adversarial Fase 4): fetch cru → authGet (padrão do repo —
  // até rota pública de catálogo passa pelo wrapper: medido, GET
  // /api/v1/scenarios/:id NÃO tem authMiddleware (scenarios.ts:106-125) e
  // mesmo assim useSystemsCatalog/IdentityPart leem catálogo via authGet;
  // o wrapper dá retry/dedup/credenciais com zero custo aqui) + leitura
  // defensiva do `data.data.name` (payload é unknown até prova de string).
  const [selectedScenarioName, setSelectedScenarioName] = useState<string | null>(null);
  // Os subgêneros vêm da MESMA resposta que o nome — nenhuma requisição a mais.
  const [selectedScenarioSubgenres, setSelectedScenarioSubgenres] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    // setState só após await (sem set síncrono no corpo do effect).
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      // Limpa ANTES de resolver o id novo (achado de review — Codex, PR #291).
      // Sem isto, trocar do cenário A para o B deixava nome e subgêneros de A
      // no estado até o GET de B voltar: o seletor já mostrava B, e o
      // SettingStylesField oferecia os estilos de A sob o rótulo de B —
      // clicar num deles gravava no anúncio uma tag do cenário anterior.
      // Estado derivado de um id não pode sobreviver à troca desse id.
      setSelectedScenarioName(null);
      setSelectedScenarioSubgenres([]);
      if (!state.selectedScenarioId) {
        return;
      }
      try {
        const res = await authGet(`/api/v1/scenarios/${state.selectedScenarioId}`);
        if (res.ok && active) {
          const json: unknown = await res.json().catch(() => null);
          if (active) {
            setSelectedScenarioName(readScenarioName(json));
            setSelectedScenarioSubgenres(readScenarioSubgenres(json));
          }
        } else if (active) {
          setSelectedScenarioName(null);
          setSelectedScenarioSubgenres([]);
        }
      } catch (err) {
        console.error('[TableEditor] Erro ao buscar nome do cenário:', err);
        if (active) {
          setSelectedScenarioName(null);
          setSelectedScenarioSubgenres([]);
        }
      }
    })();
    return () => { active = false; };
  }, [state.selectedScenarioId]);

  // ── Pendências por parte + progresso (lateral) ──────────────────────────
  const pendingCounts = useMemo(() => {
    const counts: Record<EditorPartId, number> = {
      identity: 0, when: 0, where: 0, values: 0, audience: 0, master: 0, extras: 0,
    };
    for (const fieldId of Object.keys(api.errors)) {
      const part = partOfField(fieldId);
      counts[part] += 1;
    }
    return counts;
  }, [api.errors]);

  const progress = useMemo(() => {
    // Preenchimento = campos obrigatórios (no estado atual) sem erro.
    // A3 (revisão adversarial Fase 4): itera o registro único
    // REQUIRED_FIELD_IDS de editorValidation (nenhuma lista paralela) e
    // usa o isFieldFilled de lá — o array + switch duplicados morreram.
    const errors = api.errors;
    let total = 0;
    let filled = 0;
    for (const fieldId of REQUIRED_FIELD_IDS) {
      const level = fieldLevel(fieldId, state);
      if (level !== 'required') continue;
      total += 1;
      if (!errors[fieldId] && isFieldFilled(fieldId, state)) filled += 1;
    }
    return total === 0 ? 1 : filled / total;
  }, [api.errors, state]);

  // ── A4: publicar com pendências revela — vai à parte do primeiro erro e
  //    foca o campo. ────────────────────────────────────────────────────────
  const focusFirstError = useCallback(() => {
    const target = api.firstErrorFieldToFocus;
    if (!target) return;
    setActivePartId(partOfField(target));
  }, [api.firstErrorFieldToFocus]);

  useEffect(() => {
    if (!api.revealedPending) return;
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      focusFirstError();
    })();
    return () => { active = false; };
  }, [api.revealedPending, focusFirstError]);

  // Depois que a parte do erro estiver montada, foca o controle.
  useEffect(() => {
    const target = api.firstErrorFieldToFocus;
    if (!target || !api.revealedPending) return;
    const timer = setTimeout(() => {
      document.getElementById(target)?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [api.revealedPending, api.firstErrorFieldToFocus, activePartId]);

  // Troca de parte volta ao topo (achado de review, PR #290, Codex P2).
  // A <section> é a mesma em todas as partes — só os filhos condicionais
  // trocam —, então o scrollTop sobrevive à navegação: descer em "Identidade"
  // e saltar para outra parte a abria no mesmo deslocamento, escondendo os
  // primeiros campos dela. Medido com duas partes altas: 800px de scroll
  // persistiam intactos na parte de destino.
  //
  // Não conflita com o A4 (foco no primeiro erro): quando `revealedPending`
  // está ligado, quem manda no scroll é o `focus()` do efeito acima, que roda
  // depois deste e traz o controle à vista por conta própria.
  useEffect(() => {
    if (api.revealedPending) return;
    const doc = documentRef.current;
    if (!doc) return;
    // `scrollTo` de ELEMENTO não existe em todo ambiente (jsdom não o
    // implementa, e é o que denunciou isto aqui) — atribuir `scrollTop` é o
    // caminho universal e suficiente: não há animação a preservar.
    doc.scrollTop = 0;
  }, [activePartId, api.revealedPending]);

  // ── Prévia do parser: aplica como estado novo (criar fluxo do antigo
  //    PainelMestrePage, agora dentro do editor). Fase 6 (T6.2): registra
  //    TAMBÉM quais campos a fonte produziu (marca "Pelo anúncio") e os sinais
  //    de ambiguidade exibidos no IdentityPart. ─────────────────────────────
  const handlePreviewReady = useCallback(
    (result: { data: unknown; parseCaseId: string | null }) => {
      const applied = applyParserPreview(result.data, api.state);
      const signals = parseParserSignals(result.data);
      api.applyParserPreview(
        { ...applied.state, parseCaseId: result.parseCaseId },
        applied.extractedFields,
        signals,
      );
      toast.success('Anúncio analisado — revise os campos antes de publicar');
    },
    [api],
  );

  const footerParts = useMemo(() => pendingParts(api.errors), [api.errors]);

  return (
    <div className="table-editor bg-[var(--surface)] text-[var(--fg)]">
      <EditorTopBar
        isEditing={api.isEditing}
        isActive={api.isActive}
        draftStatus={api.draftStatus}
        publishing={api.publishing}
        onBack={onBack}
        onPublish={() => void api.publish()}
      />

      <div className="table-editor-body">
        {/* Lateral (R22/T4.2b): partes + pendências + progresso (memo) e,
            embaixo, a prévia do card como o jogador vê. O aside é o shell
            aqui, no TableEditor; o EditorSidebar memo preserva os botões
            criados uma vez (recriar mata o clique — bug medido T2.5) e a
            prévia re-renderiza a cada tecla de propósito: é espelho vivo. */}
        <aside className="flex flex-col gap-3.5 overflow-hidden border-r border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-3.5">
          <EditorSidebar
            activePartId={activePartId}
            pendingCounts={pendingCounts}
            progress={progress}
            onSelect={setActivePartId}
          />
          <CardPreview
            state={state}
            systemName={selectedSystemNode?.name ?? null}
            systemLogoFilename={selectedSystemNode?.logo_filename ?? null}
            systemWebsiteUrl={selectedSystemNode?.website_url ?? null}
          />
        </aside>

        <main ref={documentRef} className="table-editor-document">
          {/* pt 18px→24px (achado do mantenedor, 2026-08-26): com 18px o
              primeiro elemento da parte encostava na barra de abas e o botão
              "Colar anúncio" lia como cortado ao meio, embora estivesse
              inteiro (medido: 32 de 32px visíveis). O respiro é o conserto,
              não o recorte. */}
          <section
            className="table-editor-part px-7 pb-6 pt-6"
            aria-label={getPartLabel(activePartId)}
          >
            {activePartId === 'identity' && (
              <IdentityPart
                api={api}
                selectedScenarioName={selectedScenarioName}
                selectedScenarioSubgenres={selectedScenarioSubgenres}
                parseText={parseSourceText}
                onParseTextChange={setParseSourceText}
                onPreviewReady={handlePreviewReady}
                currentUserName={user?.name}
              />
            )}
            {activePartId === 'when' && <WhenPart api={api} />}
            {activePartId === 'where' && <WherePart api={api} />}
            {activePartId === 'values' && <ValuesPart api={api} />}
            {activePartId === 'audience' && <AudiencePart api={api} />}
            {activePartId === 'master' && <MasterPart api={api} />}
            {activePartId === 'extras' && (
              <ExtrasPart api={api} userRole={user?.role} isDdalEligible={isDdalEligible} />
            )}
          </section>
        </main>
      </div>

      <EditorPendingFooter pendingParts={footerParts} onSelect={setActivePartId} />

      {/* Modal de restauração de rascunho (A15) — mesmo texto do fluxo
          antigo, agora sobre o `Modal` do design system; o trap de foco
          devolve o foco ao "Continuar" (primeiro focável). */}
      {api.showRestoreModal && (
        <Modal
          open={api.showRestoreModal}
          title="Rascunho encontrado"
          description="Encontramos um rascunho salvo. Deseja continuar de onde parou?"
          onClose={api.handleDiscardDraft}
          closeLabel="Descartar"
          footer={
            <>
              <Button variant="primary" autoFocus onClick={api.handleRestoreDraft}>
                Continuar
              </Button>
              <Button variant="secondary" onClick={api.handleDiscardDraft}>
                Descartar
              </Button>
            </>
          }
        >
          <p className="text-[13px] opacity-60">
            O rascunho local vale por 7 dias e é cache de digitação — o que vale é o
            salvo no servidor.
          </p>
        </Modal>
      )}

      {api.publishError && (
        <div role="alert">
          {api.publishError}
        </div>
      )}
    </div>
  );
}

/** Chaves de obrigatórios que alimentam a barra de progresso — removido
 *  (A3): a fonte única agora é `REQUIRED_FIELD_IDS` + `isFieldFilled` de
 *  editorValidation.ts, junto do registro de obrigatoriedade (A11). */

/**
 * B4: lê `data.name` do envelope de GET /api/v1/scenarios/:id como string
 * ou null. Local de propósito (react-refresh/only-export-components recusa
 * export de função em arquivo de componente — mesmo padrão do closedTable.ts).
 */
function readScenarioName(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null;
  const data = (json as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return null;
  const name = (data as { name?: unknown }).name;
  return typeof name === 'string' && name.trim().length > 0 ? name.trim() : null;
}

/** Subgêneros do cenário: a fonte real de sugestão de estilo. 111 dos 118
 *  cenários do catálogo têm ao menos um (94%, medido 2026-08-27), enquanto a
 *  tabela `suggest-styles` não conhecia nenhum de 25 testados — era por isso que
 *  "Estilos/Temáticas" não sugeria nada, nunca. Mesma leitura defensiva do nome:
 *  payload de API é `unknown` até prova de tipo. */
function readScenarioSubgenres(json: unknown): string[] {
  if (typeof json !== 'object' || json === null) return [];
  const data = (json as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return [];
  const subgenres = (data as { subgenres?: unknown }).subgenres;
  if (!Array.isArray(subgenres)) return [];
  return subgenres
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// Casca do editor (spec 096, Fase 4): as 3 faixas da grade (barra de estado,
// lateral, rodapé de pendências) — chrome do TableEditor. O registro das 7
// partes (EDITOR_PARTS/getPartLabel) vive em utils/editorParts.ts:
// react-refresh/only-export-components recusa arquivo de componente que
// também exporta função/constante (mesmo padrão do closedTable.ts).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Barra de estado (faixa do topo da grade de 3 faixas): selo do estado da
 * mesa (Rascunho × No ar — a única diferença entre criar e editar é o estado,
 * R2/T4.4), indicador de autosave e o botão de publicar.
 */
type EditorTopBarProps = Readonly<{
  isEditing: boolean;
  isActive: boolean;
  draftStatus: DraftStatus;
  publishing: boolean;
  onBack: () => void;
  onPublish: () => void;
}>;

/** Texto do estado do rascunho local; `null` não desenha nada. */
function draftStatusLabel(status: DraftStatus): string | null {
  if (status === 'saving') return 'Salvando rascunho…';
  if (status === 'saved') return 'Rascunho salvo';
  return null;
}

function EditorTopBar({
  isEditing,
  isActive,
  draftStatus,
  publishing,
  onBack,
  onPublish,
}: EditorTopBarProps) {
  return (
    // `flex-wrap` + `gap-y` (achado de review, PR #290, Codex P1): os Button do
    // design system são `white-space: nowrap`, e em 390px o pior caso real —
    // "Rascunho salvo" com "Salvar alterações" — exige 439px de largura mínima
    // (medido). Sem quebrar, a raiz em `overflow:hidden` recortava justamente o
    // botão de publicar/salvar.
    <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-2">
      <div className="flex items-center gap-2.5">
        <Button variant="ghost" size="sm" onClick={onBack} type="button">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar ao painel
        </Button>
        {/* Só mesa em edição E no ar mostra "No ar"; todo o resto é rascunho
            (criação, ou edição de mesa que ainda não foi publicada). */}
        {isEditing && isActive ? (
          <Badge variant="success">No ar</Badge>
        ) : (
          <Badge variant="warning">Rascunho</Badge>
        )}
      </div>

      <div aria-live="polite">
        {draftStatusLabel(draftStatus) ? (
          <span className="text-xs opacity-60">{draftStatusLabel(draftStatus)}</span>
        ) : null}
      </div>

      <div className="flex items-center gap-2.5">
        <Button
          variant="primary"
          loading={publishing}
          onClick={onPublish}
          type="button"
          id="table-editor-publish"
        >
          {isEditing && isActive ? 'Salvar alterações' : 'Publicar'}
        </Button>
      </div>
    </header>
  );
}

/**
 * Conteúdo memo da lateral (~300px): progresso + as 7 partes na ordem
 * aprovada, com contagem de pendências por parte. O `<aside>` que envolve
 * (com a prévia do card embaixo, R22) vive no TableEditor.
 *
 * Os botões são criados UMA vez (memo + `key` estável por parte): recriar a
 * lista a cada tecla mata o clique junto com o nó — bug medido no protótipo
 * da Fase 2 (T2.5, spec 096). O componente é `memo` para não re-renderizar
 * junto com cada tecla do documento; as props só mudam em eventos de
 * validação (blur/publicar) e troca de parte.
 */
type EditorSidebarProps = Readonly<{
  activePartId: EditorPartId;
  pendingCounts: Record<EditorPartId, number>;
  progress: number;
  onSelect: (partId: EditorPartId) => void;
}>;

const EditorSidebar = memo(function EditorSidebar({
  activePartId,
  pendingCounts,
  progress,
  onSelect,
}: EditorSidebarProps) {
  return (
    <>
      <div>
        <div className="mb-1.5 text-xs opacity-70">
          {Math.round(progress * 100)}% preenchido
        </div>
        {/* Barra decorativa: o valor já é anunciado pelo texto "N% preenchido"
            logo acima, então marcar role="progressbar" aqui duplicaria o
            anúncio no leitor de tela. `<progress>` nativo não aceita esta
            estilização sem herdar o desenho do agente de usuário. */}
        <div
          className="h-1.5 overflow-hidden rounded-full bg-[var(--fill)]"
          aria-hidden="true"
        >
          <div
            className="h-full bg-[var(--color-artificio-orange)] transition-[width]"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>

      {/* `table-editor-parts-nav`: gancho estável para a media query da casca
          (TableEditor.css) virar esta lista em faixa horizontal abaixo de
          720px. Sem a classe, a regra dependeria do seletor de elemento e
          quebraria silenciosamente ao mudar o markup. */}
      <nav
        className="table-editor-parts-nav flex flex-col gap-1 overflow-hidden"
        aria-label="Partes do anúncio"
      >
        {EDITOR_PARTS.map((part) => {
          const pending = pendingCounts[part.id] ?? 0;
          const active = part.id === activePartId;
          return (
            <Button
              key={part.id}
              type="button"
              variant={active ? 'primary' : 'ghost'}
              size="sm"
              className="!justify-start w-full"
              aria-current={active ? 'page' : undefined}
              onClick={() => onSelect(part.id)}
            >
              <span className="flex-1 text-left">{part.label}</span>
              {pending > 0 ? (
                <span
                  className="min-w-5 rounded-full bg-[var(--state-danger-bg)] px-1.5 text-center text-[11px] text-[var(--state-danger-fg)]"
                  aria-label={`${pending} pendência(s)`}
                >
                  {pending}
                </span>
              ) : null}
            </Button>
          );
        })}
      </nav>
    </>
  );
});

/**
 * Rodapé de pendências (faixa de baixo da grade de 3 faixas). Depois de uma
 * tentativa de publicar com campos faltando (A4), LISTA as partes que têm
 * pendência — clicar salta para a parte. Fora disso fica em silêncio (faixa
 * fina, sem inventar conteúdo).
 */
type EditorPendingFooterProps = Readonly<{
  pendingParts: EditorPartId[];
  onSelect: (partId: EditorPartId) => void;
}>;

function EditorPendingFooter({ pendingParts, onSelect }: EditorPendingFooterProps) {
  if (pendingParts.length === 0) return null;

  return (
    // `<output>` no lugar de role="status": mesma semântica de região viva
    // (role=status implícito), com suporte melhor entre leitores de tela.
    // `flex-wrap` no lugar de `overflow-hidden` (achado de review, PR #290,
    // Codex P1): com as 7 partes pendentes a faixa exige 864px de largura
    // mínima (medido) — em 390px o `overflow-hidden` engolia os últimos
    // botões, e são eles que levam o mestre ao campo que falta. Recortar o
    // atalho de erro é o oposto do que esta faixa existe para fazer.
    <output
      className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-[var(--state-danger-line)] bg-[var(--state-danger-bg)] px-4 py-2"
    >
      <span className="whitespace-nowrap text-[13px] text-[var(--state-danger-fg)]">
        Campos obrigatórios faltando em:
      </span>
      {pendingParts.map((partId) => (
        <Button
          key={partId}
          type="button"
          variant="danger"
          size="sm"
          onClick={() => onSelect(partId)}
        >
          {getPartLabel(partId)}
        </Button>
      ))}
    </output>
  );
}
