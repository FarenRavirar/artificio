import { useMemo, useState } from 'react';
import { ConfirmProvider, useConfirm } from '@artificio/ui';
import {
  AdminTable,
  AdminWorkspaceLayout,
  PageHeader,
  SectionCard,
  StatusPill,
  type AdminBulkAction,
  type AdminColumn,
  type AdminRowAction,
} from '@artificio/ui/admin';
import type {
  CommunityModerationAdapter,
  CommentVersion,
  ModerationCase,
  ModerationLogEntry,
  ModerationQueue,
  ModeratorAppeal,
  OwnReport,
  ReportReason,
  SanctionHistoryEntry,
} from './moderation.js';

interface QueueRow {
  id: string;
  commentId: string;
  caseId: string | null;
  sourceApp: string;
  status: string;
  priority: number | null;
  signal: string;
  occurredAt: string;
}

export interface CommunityModerationWorkspaceProps {
  queue?: ModerationQueue;
  loading?: boolean;
  error?: string | null;
  selectedCase?: ModerationCase | null;
  selectedAppeal?: ModeratorAppeal | null;
  sanctions?: SanctionHistoryEntry[];
  log?: ModerationLogEntry[];
  versions?: CommentVersion[];
  adapter: CommunityModerationAdapter;
  onOpenCase?: (caseId: string) => void;
  onReload?: () => void;
  supportsPosting?: boolean;
}

function versionText(version: CommentVersion | undefined): string {
  if (!version || version.redacted_at) return 'Conteúdo expurgado';
  return version.body_markdown ?? version.legacy_content_html ?? '';
}

function compactDiff(before: string, after: string) {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix += 1;
  return {
    prefix: before.slice(0, prefix),
    removed: before.slice(prefix, before.length - suffix),
    added: after.slice(prefix, after.length - suffix),
    suffix: suffix ? before.slice(before.length - suffix) : '',
  };
}

function moderationRows(queue?: ModerationQueue): QueueRow[] {
  return [
    ...(queue?.items ?? []).map((item) => ({
      id: `case:${item.case_id}`,
      commentId: item.comment_id,
      caseId: item.case_id,
      sourceApp: item.source_app,
      status: item.status,
      priority: item.priority,
      signal: `${item.active_report_count} denúncia(ões): ${item.reason_codes.join(', ')}`,
      occurredAt: item.opened_at,
    })),
    ...(queue?.new_account_comments ?? []).map((item) => ({
      id: `new:${item.comment_id}`,
      commentId: item.comment_id,
      caseId: null,
      sourceApp: item.source_app,
      status: item.comment_visibility_state,
      priority: null,
      signal: `Conta nova: ${item.new_account_reasons.join(' + ')}; ${item.author_comment_count} comentário(s)`,
      occurredAt: item.created_at,
    })),
  ];
}

function WorkspaceBody(props: Readonly<CommunityModerationWorkspaceProps>) {
  const { confirm } = useConfirm();
  const rows = useMemo(() => moderationRows(props.queue), [props.queue]);
  const [announcement, setAnnouncement] = useState('');
  const [reason, setReason] = useState('');
  const [caseReason, setCaseReason] = useState('');
  const [caseAction, setCaseAction] = useState<'no_change' | 'restore' | 'remove'>('no_change');
  const [verdicts, setVerdicts] = useState<Record<string, 'upheld' | 'dismissed' | 'no_determination'>>({});
  const [appealReason, setAppealReason] = useState('');
  const [sanctionReason, setSanctionReason] = useState('');
  const [sanctionLevel, setSanctionLevel] = useState<'warning' | 'temporary' | 'permanent'>('warning');
  const [sanctionScopes, setSanctionScopes] = useState<Array<'posting' | 'commenting'>>(['commenting']);
  const [expiresAt, setExpiresAt] = useState('');

  const requireReason = () => {
    const value = reason.trim();
    if (!value) throw new Error('Informe o motivo antes da ação.');
    return value;
  };

  const applyVisibility = async (selectedIds: string[], action: 'remove' | 'restore') => {
    const selected = rows.filter((row) => selectedIds.includes(row.id));
    const approved = await confirm({
      title: action === 'remove' ? 'Retirar comentários?' : 'Restaurar comentários?',
      message: `${selected.length} item(ns). A ação será registrada na auditoria.`,
      confirmText: action === 'remove' ? 'Retirar' : 'Restaurar',
      variant: action === 'remove' ? 'danger' : 'info',
    });
    if (!approved) return;
    const actionReason = requireReason();
    await Promise.all(selected.map((row) => props.adapter[action](row.commentId, actionReason)));
    setAnnouncement(`${selected.length} comentário(s) ${action === 'remove' ? 'retirado(s)' : 'restaurado(s)'}.`);
  };

  const columns: Array<AdminColumn<QueueRow>> = [
    { key: 'source', header: 'Origem', render: (row) => row.sourceApp },
    { key: 'status', header: 'Estado', render: (row) => <StatusPill tone={row.status === 'open' ? 'warn' : 'neutral'}>{row.status}</StatusPill> },
    { key: 'priority', header: 'Prioridade', render: (row) => row.priority === null ? 'triagem' : `P${row.priority}` },
    { key: 'signal', header: 'Sinal', render: (row) => row.signal },
    { key: 'time', header: 'Recebido', render: (row) => <time dateTime={row.occurredAt}>{new Date(row.occurredAt).toLocaleString('pt-BR')}</time> },
  ];
  const bulkActions: AdminBulkAction[] = [
    { key: 'remove', label: 'Retirar selecionados', tone: 'danger', onRun: (ids) => applyVisibility(ids, 'remove') },
    { key: 'restore', label: 'Restaurar selecionados', onRun: (ids) => applyVisibility(ids, 'restore') },
  ];
  const rowActions: Array<AdminRowAction<QueueRow>> = [
    { key: 'remove', label: 'Retirar', tone: 'danger', onRun: (row) => applyVisibility([row.id], 'remove') },
    { key: 'restore', label: 'Restaurar', onRun: (row) => applyVisibility([row.id], 'restore') },
  ];

  const resolveSelectedCase = async () => {
    const current = props.selectedCase;
    if (!current) return;
    const unresolved = current.reports.filter((report) => !verdicts[report.id]);
    if (unresolved.length > 0 || !caseReason.trim()) throw new Error('Defina cada veredito e a justificativa.');
    const approved = await confirm({
      title: 'Fechar caso de moderação?',
      message: 'Outro moderador poderá vencer a corrida. Em conflito, este formulário será preservado.',
      confirmText: 'Fechar caso',
      variant: caseAction === 'remove' ? 'danger' : 'warning',
    });
    if (!approved) return;
    await props.adapter.resolveCase(current.case_id, {
      verdicts: current.reports.map((report) => ({ report_id: report.id, verdict: verdicts[report.id]! })),
      action: caseAction,
      reason: caseReason.trim(),
    });
    setAnnouncement('Caso decidido e auditoria atualizada.');
  };

  const decideAppeal = async (outcome: 'upheld' | 'reversed') => {
    const appeal = props.selectedAppeal;
    if (!appeal || !appealReason.trim()) throw new Error('Nova justificativa é obrigatória.');
    const approved = await confirm({
      title: outcome === 'reversed' ? 'Reverter decisão?' : 'Manter decisão?',
      message: 'O resultado é privado do recorrente e ficará auditado.',
      confirmText: 'Registrar julgamento',
    });
    if (!approved) return;
    await props.adapter.decideAppeal(appeal.id, outcome, appealReason.trim());
    setAnnouncement('Recurso julgado.');
  };

  const applySanction = async () => {
    const actorId = props.selectedCase?.reported_author_actor_id;
    if (!actorId || sanctionScopes.length === 0 || !sanctionReason.trim()) throw new Error('Alvo, escopo e motivo são obrigatórios.');
    if (sanctionLevel === 'temporary' && !expiresAt) throw new Error('Suspensão temporária exige expiração.');
    const approved = await confirm({
      title: 'Aplicar sanção comunitária?',
      message: 'SSO e leitura continuam disponíveis. A progressão nunca é automática.',
      confirmText: 'Aplicar sanção',
      variant: 'danger',
    });
    if (!approved) return;
    await props.adapter.applySanction({
      target_actor_id: actorId,
      scopes: sanctionScopes,
      level: sanctionLevel,
      expires_at: sanctionLevel === 'temporary' ? new Date(expiresAt).toISOString() : null,
      reason: sanctionReason.trim(),
    });
    setAnnouncement('Sanção aplicada e auditada.');
  };

  const inspector = props.selectedCase ? (
    <div className="space-y-4 p-5">
      <SectionCard title={`Caso ${props.selectedCase.case_id}`} description={`Comentário ${props.selectedCase.comment_id}`}>
        <div className="space-y-3">
          {props.selectedCase.reports.map((report) => (
            <fieldset key={report.id} className="rounded border p-3">
              <legend>{report.reason_code} — {report.reporter_display_name ?? 'Identidade expurgada'}</legend>
              <p>{report.details ?? 'Sem detalhe'}</p>
              <label htmlFor={`verdict-${report.id}`}>Veredito</label>
              <select id={`verdict-${report.id}`} value={verdicts[report.id] ?? ''} onChange={(event) => setVerdicts((value) => ({ ...value, [report.id]: event.target.value as typeof verdicts[string] }))}>
                <option value="">Selecione</option><option value="upheld">Procedente</option><option value="dismissed">Improcedente</option><option value="no_determination">Sem determinação</option>
              </select>
            </fieldset>
          ))}
          <label htmlFor="case-action">Ação do caso</label>
          <select id="case-action" value={caseAction} onChange={(event) => setCaseAction(event.target.value as typeof caseAction)}>
            <option value="no_change">Não alterar visibilidade</option><option value="restore">Restaurar</option><option value="remove">Retirar</option>
          </select>
          <label htmlFor="case-reason">Justificativa</label>
          <textarea id="case-reason" value={caseReason} onChange={(event) => setCaseReason(event.target.value)} />
          <button type="button" onClick={() => void resolveSelectedCase()}>Fechar caso</button>
        </div>
      </SectionCard>

      <SectionCard title="Versões e diff" description="Versão denunciada comparada com a atual; conteúdo expurgado não é reconstruído.">
        {(() => {
          const reported = props.versions?.find((version) => version.is_reported);
          const current = props.versions?.find((version) => version.is_current);
          if (!reported || !current) return <p>Versões indisponíveis.</p>;
          const diff = compactDiff(versionText(reported), versionText(current));
          return <p className="whitespace-pre-wrap">{diff.prefix}<del>{diff.removed}</del><ins>{diff.added}</ins>{diff.suffix}</p>;
        })()}
      </SectionCard>

      {props.selectedAppeal && <SectionCard title="Recurso" description={props.selectedAppeal.original_decider_actor_id === props.selectedAppeal.current_decider_actor_id ? 'Você foi o decisor original; uma nova justificativa continua obrigatória.' : 'Resultado privado do recorrente.'}>
        <p>{props.selectedAppeal.reason}</p>
        <label htmlFor="appeal-reason">Nova justificativa</label>
        <textarea id="appeal-reason" value={appealReason} onChange={(event) => setAppealReason(event.target.value)} />
        <button type="button" onClick={() => void decideAppeal('upheld')}>Manter decisão</button>
        <button type="button" onClick={() => void decideAppeal('reversed')}>Reverter decisão</button>
      </SectionCard>}

      <SectionCard title="Sanção comunitária" description="Apoio manual; não bloqueia SSO nem leitura.">
        <label><input type="checkbox" checked={sanctionScopes.includes('commenting')} onChange={(event) => setSanctionScopes((value) => event.target.checked ? [...new Set([...value, 'commenting' as const])] : value.filter((scope) => scope !== 'commenting'))} /> Comentários</label>
        {props.supportsPosting && <label><input type="checkbox" checked={sanctionScopes.includes('posting')} onChange={(event) => setSanctionScopes((value) => event.target.checked ? [...new Set([...value, 'posting' as const])] : value.filter((scope) => scope !== 'posting'))} /> Postagens do domínio</label>}
        <label htmlFor="sanction-level">Gravidade</label>
        <select id="sanction-level" value={sanctionLevel} onChange={(event) => setSanctionLevel(event.target.value as typeof sanctionLevel)}><option value="warning">Aviso</option><option value="temporary">Suspensão temporária</option><option value="permanent">Suspensão permanente</option></select>
        {sanctionLevel === 'temporary' && <><label htmlFor="sanction-expiry">Expira em</label><input id="sanction-expiry" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></>}
        <label htmlFor="sanction-reason">Motivo</label><textarea id="sanction-reason" value={sanctionReason} onChange={(event) => setSanctionReason(event.target.value)} />
        <button type="button" onClick={() => void applySanction()}>Aplicar sanção</button>
        <ul>{(props.sanctions ?? []).map((item) => <li key={item.id}><StatusPill tone={item.active ? 'danger' : 'neutral'}>{item.active ? 'Ativa' : 'Encerrada'}</StatusPill> {item.scope} — {item.level}{item.expires_at ? <> até <time dateTime={item.expires_at}>{new Date(item.expires_at).toLocaleString('pt-BR')}</time></> : null}</li>)}</ul>
      </SectionCard>
    </div>
  ) : null;

  return <>
    <output role="status" className="sr-only">{announcement}</output>
    <AdminWorkspaceLayout
      workspace={<div className="space-y-4 p-5"><PageHeader title="Moderação comunitária" description={`${rows.length} item(ns) pendente(s); escopo isolado pela credencial do módulo.`} />
        <SectionCard title="Fila" description="Denúncias e contas novas. Publicação de conta nova não é bloqueada.">
          <label htmlFor="moderation-reason">Motivo da ação</label><textarea id="moderation-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          <AdminTable tableId="community-moderation" rows={rows} getRowId={(row) => row.id} getRowLabel={(row) => `comentário ${row.commentId}`} columns={columns} searchKeys={['commentId', 'sourceApp', 'signal']} loading={props.loading} error={props.error} bulkActions={bulkActions} rowActions={rowActions} onOpen={(row) => row.caseId && props.onOpenCase?.(row.caseId)} emptyTitle="Fila comunitária vazia." />
        </SectionCard>
        <SectionCard title="Registro de ações" description="Log global do source_app; o backend ainda não oferece filtro escalável por caso.">
          <ol>{(props.log ?? []).map((entry) => <li key={entry.id}><time dateTime={entry.occurred_at}>{new Date(entry.occurred_at).toLocaleString('pt-BR')}</time> — ator {entry.actor_id ?? 'sistema'} — {entry.action} em {entry.target_type} {entry.target_id}: {entry.reason}</li>)}</ol>
        </SectionCard>
        {props.error && <button type="button" onClick={props.onReload}>Recarregar</button>}
      </div>}
      inspector={inspector}
    />
  </>;
}

export function CommunityModerationWorkspace(props: Readonly<CommunityModerationWorkspaceProps>) {
  return <ConfirmProvider><WorkspaceBody {...props} /></ConfirmProvider>;
}

export interface CommentReportPanelProps {
  commentId: string;
  reasons: ReportReason[];
  reports: OwnReport[];
  onSubmit: (reasonCode: string, details: string | null) => Promise<void>;
  onWithdraw: (reportId: string) => Promise<void>;
}

export function CommentReportPanel({ commentId, reasons, reports, onSubmit, onWithdraw }: Readonly<CommentReportPanelProps>) {
  const [reasonCode, setReasonCode] = useState('');
  const [details, setDetails] = useState('');
  const selected = reasons.find((reason) => reason.code === reasonCode);
  const own = reports.filter((report) => report.comment_id === commentId);
  const canSubmit = Boolean(selected) && (selected?.details_policy !== 'required' || Boolean(details.trim()));
  const submit = async () => {
    if (!selected) throw new Error('Escolha um motivo.');
    if (selected.details_policy === 'required' && !details.trim()) throw new Error('Detalhes são obrigatórios.');
    await onSubmit(reasonCode, selected.details_policy === 'forbidden' ? null : details.trim() || null);
  };
  return <section aria-labelledby={`report-title-${commentId}`}><h3 id={`report-title-${commentId}`}>Denunciar comentário</h3>
    <label htmlFor={`report-reason-${commentId}`}>Motivo</label><select id={`report-reason-${commentId}`} value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}><option value="">Selecione</option>{reasons.map((reason) => <option key={reason.code} value={reason.code}>{reason.label}</option>)}</select>
    {selected?.details_policy !== 'forbidden' && <><label htmlFor={`report-details-${commentId}`}>Detalhes {selected?.details_policy === 'required' ? '(obrigatórios)' : '(opcionais)'}</label><textarea id={`report-details-${commentId}`} value={details} onChange={(event) => setDetails(event.target.value)} /></>}
    <button type="button" disabled={!canSubmit} onClick={() => void submit()}>Enviar denúncia</button>
    <ul>{own.map((report) => <li key={report.id}>{report.reason_code}: {report.result ?? 'em análise'} {report.can_withdraw && <button type="button" onClick={() => void onWithdraw(report.id)}>Retirar denúncia</button>}</li>)}</ul>
  </section>;
}

export interface CommentAppealFormProps { deadline: string; alreadyFiled: boolean; onSubmit: (reason: string) => Promise<void> }
export function CommentAppealForm({ deadline, alreadyFiled, onSubmit }: Readonly<CommentAppealFormProps>) {
  const [reason, setReason] = useState('');
  const expired = Date.now() > Date.parse(deadline);
  return <section><h3>Recorrer da remoção</h3><p>Prazo: <time dateTime={deadline}>{new Date(deadline).toLocaleString('pt-BR')}</time></p><label htmlFor="appeal-public-reason">Justificativa</label><textarea id="appeal-public-reason" disabled={expired || alreadyFiled} value={reason} onChange={(event) => setReason(event.target.value)} /><button type="button" disabled={expired || alreadyFiled || !reason.trim()} onClick={() => void onSubmit(reason.trim())}>{alreadyFiled ? 'Recurso já enviado' : expired ? 'Prazo expirado' : 'Enviar recurso'}</button></section>;
}
