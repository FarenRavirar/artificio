import { useState } from 'react';
import toast from 'react-hot-toast';
import { Copy } from 'lucide-react';
import type { TableDetail } from '../../../types/tables';
import { getMesasPublicOrigin } from '../../../utils/auth';
import { buildWhatsAppTableAnnouncement, copyTextToClipboard, normalizeTableDetailPayload, isTableAnnounceable } from '../share/whatsappAnnouncement';

type CopyAnnouncementButtonProps = {
  readonly table?: TableDetail;
  readonly loadTable?: () => Promise<TableDetail>;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly ariaLabel?: string;
  readonly label?: string;
};

export function CopyAnnouncementButton({
  table,
  loadTable,
  className,
  disabled = false,
  ariaLabel,
  label = 'Copiar anúncio',
}: CopyAnnouncementButtonProps) {
  const [isCopying, setIsCopying] = useState(false);

  const handleCopy = async () => {
    if (isCopying || disabled) return;

    setIsCopying(true);
    try {
      const sourceTable = table ?? await loadTable?.();
      const resolvedTable = sourceTable ? normalizeTableDetailPayload(sourceTable) : null;
      if (!resolvedTable || !isTableAnnounceable(resolvedTable)) {
        throw new Error('Mesa indisponível para anúncio');
      }

      const text = buildWhatsAppTableAnnouncement(resolvedTable, {
        publicOrigin: getMesasPublicOrigin(),
      });
      await copyTextToClipboard(text);
      toast.success('Anúncio copiado.');
    } catch {
      toast.error('Não foi possível copiar o anúncio.');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? (table ? `Copiar anúncio da mesa ${table.title}` : 'Copiar anúncio da mesa')}
      disabled={isCopying || disabled}
      onClick={handleCopy}
      className={className ?? 'w-full py-2 rounded-lg bg-[var(--fill)] hover:bg-[var(--fill)] text-[var(--fg)] text-sm font-medium transition disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2'}
    >
      <Copy size={16} aria-hidden="true" />
      <span>{isCopying ? 'Copiando...' : label}</span>
    </button>
  );
}
