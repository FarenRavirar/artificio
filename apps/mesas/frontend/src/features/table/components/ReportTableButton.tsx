import { useState } from 'react';
import { Flag } from 'lucide-react';
import toast from 'react-hot-toast';

const REASON_LABELS: Record<string, string> = {
  golpe: 'Golpe / fraude',
  conteudo_inadequado: 'Conteúdo inadequado',
  spam: 'Spam',
  informacao_falsa: 'Informação falsa',
  outro: 'Outro',
};

interface ReportTableButtonProps {
  readonly slug: string;
}

/**
 * Denúncia de mesa específica (T6.6, spec 081) — diferente do FAB de
 * feedback do sistema já existente (aquele é sobre a ferramenta, não
 * sobre o anúncio). Aceita denúncia anônima.
 */
export function ReportTableButton({ slug }: ReportTableButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/v1/tables/${slug}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, details: details.trim() || undefined }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      toast.success('Denúncia enviada. Obrigado por ajudar a manter a comunidade segura.');
      setIsOpen(false);
      setReason('');
      setDetails('');
    } catch {
      toast.error('Não foi possível enviar a denúncia. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
      >
        <Flag className="h-3.5 w-3.5" /> Denunciar mesa
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#13213f] p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Denunciar esta mesa</p>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-white/50 mb-1">Motivo da denúncia</legend>
        {Object.entries(REASON_LABELS).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input
              type="radio"
              name="report-reason"
              value={value}
              checked={reason === value}
              onChange={() => setReason(value)}
              className="h-3.5 w-3.5"
            />
            {label}
          </label>
        ))}
      </fieldset>

      <label htmlFor="report-table-details" className="sr-only">Detalhes da denúncia (opcional)</label>
      <textarea
        id="report-table-details"
        value={details}
        onChange={(e) => setDetails(e.target.value.slice(0, 2000))}
        placeholder="Detalhes (opcional)"
        maxLength={2000}
        rows={3}
        className="w-full rounded-lg border border-white/10 bg-[#0B1220] p-2 text-sm text-white outline-none focus:border-[var(--color-artificio-orange)]"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!reason || isSubmitting}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          Enviar denúncia
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/5"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
