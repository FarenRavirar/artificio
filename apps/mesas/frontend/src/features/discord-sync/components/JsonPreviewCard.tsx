import type { PreviewResult } from '../hooks/useJsonImport';

interface JsonPreviewCardProps {
  readonly preview: PreviewResult;
}

export function JsonPreviewCard({ preview }: JsonPreviewCardProps) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-2">
      <p className="text-white font-semibold text-sm">Pré-visualização</p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-white/40">Servidor</p>
          <p className="text-white">{preview.guild.name}</p>
        </div>
        <div>
          <p className="text-white/40">Canal</p>
          <p className="text-white">{preview.channel.name}</p>
        </div>
        <div>
          <p className="text-white/40">Mensagens</p>
          <p className="text-white">{preview.messageCount}</p>
        </div>
        <div>
          <p className="text-white/40">Anexos</p>
          <p className="text-white">{preview.totalAttachments}</p>
        </div>
        <div>
          <p className="text-white/40">Embeds</p>
          <p className="text-white">{preview.totalEmbeds}</p>
        </div>
        <div>
          <p className="text-white/40">Exportado em</p>
          <p className="text-white">{preview.exportedAt ?? 'N/A'}</p>
        </div>
        {preview.dateRange && (
          <>
            <div>
              <p className="text-white/40">De</p>
              <p className="text-white">{preview.dateRange.after ?? 'N/A'}</p>
            </div>
            <div>
              <p className="text-white/40">Até</p>
              <p className="text-white">{preview.dateRange.before ?? 'N/A'}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
