import { useRef, useState, type FormEvent } from 'react';
import { useSession } from '@artificio/auth/client';
import { ContentEditor, contentOverflow } from '@artificio/content-editor';
import { useQueryClient } from '@tanstack/react-query';
import { REPORT_DETAILS_MAX_LENGTH as DETAILS_MAX_LENGTH } from '@artificio/comments';
import { apiPost } from '../services/apiClient';

type ReportTarget =
  | { materialId: string; commentId?: never }
  | { commentId: string; materialId?: never };

const CATEGORY_OPTIONS = [
  ['malicious_link', 'Link malicioso ou fraude'],
  ['copyright_violation', 'Violação de direitos autorais'],
  ['inappropriate_content', 'Conteúdo impróprio ou abusivo'],
  ['broken_link', 'Link quebrado'],
  ['other', 'Outro problema'],
] as const;

export function ReportButton({ target }: Readonly<{ target: ReportTarget }>) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const categoryRef = useRef<HTMLSelectElement>(null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number][0]>('inappropriate_content');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function toggle() {
    const next = !open;
    setOpen(next);
    setError(null);
    setSuccess(false);
    if (next) requestAnimationFrame(() => categoryRef.current?.focus());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const response = await apiPost('/api/v1/reports', {
        ...('materialId' in target ? { material_id: target.materialId } : { comment_id: target.commentId }),
        category,
        details: details.trim() || undefined,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        if (response.status === 409) throw new Error('Você já denunciou este conteúdo.');
        throw new Error(body?.error ?? 'Não foi possível enviar a denúncia. Tente novamente.');
      }
      setSuccess(true);
      setOpen(false);
      setDetails('');
      await queryClient.invalidateQueries({ queryKey: ['downloads', 'reports', 'mine'] });
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Falha de rede. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return <p className="text-xs text-[var(--fg-muted)]">Entre com sua conta para denunciar.</p>;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="min-h-[44px] rounded-md px-3 py-2 text-sm text-[var(--fg-muted)] underline decoration-transparent hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-artificio-orange"
      >
        Denunciar
      </button>
      {open && (
        <form onSubmit={submit} className="mt-2 max-w-xl space-y-3 rounded-md border border-[var(--line)] p-4" aria-describedby={error ? 'report-error' : undefined}>
          <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
            Motivo{' '}
            <select
              ref={categoryRef}
              value={category}
              onChange={(event) => setCategory(event.target.value as typeof category)}
              className="min-h-[44px] rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-[var(--fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-artificio-orange"
            >
              {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <ContentEditor label="Detalhes (opcional)" value={details} onChange={setDetails} maxLength={DETAILS_MAX_LENGTH} minHeight={112} />
          {error && <p id="report-error" role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={submitting || contentOverflow(details, DETAILS_MAX_LENGTH) > 0} className="min-h-[44px] rounded-md bg-artificio-orange px-4 font-semibold text-white disabled:opacity-50">
              {submitting ? 'Enviando...' : 'Enviar denúncia'}
            </button>
            <button type="button" onClick={toggle} className="min-h-[44px] rounded-md border border-[var(--line)] px-4 text-[var(--fg)]">Cancelar</button>
          </div>
        </form>
      )}
      {success && <p role="status" aria-live="polite" className="mt-2 text-sm text-green-700">Denúncia enviada para análise humana.</p>}
    </div>
  );
}
