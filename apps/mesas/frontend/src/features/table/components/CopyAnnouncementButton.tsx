import { useState } from 'react';
import toast from 'react-hot-toast';
import { Copy } from 'lucide-react';
import type { TableDetail } from '../../../types/tables';
import { getMesasPublicOrigin } from '../../../utils/auth';
import { buildWhatsAppTableAnnouncement, copyTextToClipboard } from '../share/whatsappAnnouncement';

type CopyAnnouncementButtonProps = {
  table?: TableDetail;
  loadTable?: () => Promise<TableDetail>;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  label?: string;
};

export function CopyAnnouncementButton({
  table,
  loadTable,
  className,
  disabled = false,
  ariaLabel,
  label = 'Copiar anuncio',
}: CopyAnnouncementButtonProps) {
  const [isCopying, setIsCopying] = useState(false);

  const handleCopy = async () => {
    if (isCopying || disabled) return;

    setIsCopying(true);
    try {
      const resolvedTable = table ?? await loadTable?.();
      if (!resolvedTable || resolvedTable.status !== 'active' || resolvedTable.archived_at) {
        throw new Error('Mesa indisponivel para anuncio');
      }

      const text = buildWhatsAppTableAnnouncement(resolvedTable, {
        publicOrigin: getMesasPublicOrigin(),
      });
      await copyTextToClipboard(text);
      toast.success('Anuncio copiado.');
    } catch {
      toast.error('Nao foi possivel copiar o anuncio.');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? (table ? `Copiar anuncio da mesa ${table.title}` : 'Copiar anuncio da mesa')}
      disabled={isCopying || disabled}
      onClick={handleCopy}
      className={className ?? 'w-full py-2 rounded-lg bg-[var(--fill)] hover:bg-[var(--fill)] text-[var(--fg)] text-sm font-medium transition disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2'}
    >
      <Copy size={16} aria-hidden="true" />
      <span>{isCopying ? 'Copiando...' : label}</span>
    </button>
  );
}
