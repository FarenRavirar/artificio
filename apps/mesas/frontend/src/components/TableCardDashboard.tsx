import { useState } from 'react';
import { getSlotsVisualState } from '../utils/slots';
import { SystemBadge } from './SystemBadge';
import { CertificationBadges } from './CertificationBadges';
import { applyTableImageFallback, resolveTableImageSource } from '../utils/tableImage';
import { InlineDeleteConfirmation } from './InlineDeleteConfirmation';

interface TableMetrics {
  views: number;
  clicks: number;
  contacts: number;
  favorites: number;
}

interface MyTableEnhanced {
  id: string;
  slug: string;
  title: string;
  status: string;
  archived?: boolean; // D-MESAS1: fora do catálogo público
  modality: string;
  slots_total: number;
  slots_filled: number;
  slots_open?: number; // REQ-02: Vagas abertas para recrutamento
  system_name: string | null;
  system_logo_filename?: string | null;
  system_website_url?: string | null;
  image_url?: string | null;
  is_ddal?: boolean;
  is_covil?: boolean;
  metrics?: TableMetrics;
  vtt_platform?: {
    id: string;
    name: string;
    slug: string;
    logo_filename: string | null;
    website_url: string | null;
  } | null;
}

interface TableCardDashboardProps {
  table: MyTableEnhanced;
  onEdit: (id: string) => void;
  onToggle: (table: MyTableEnhanced) => void;
  onDelete: (table: MyTableEnhanced) => void;
  onArchive?: (table: MyTableEnhanced) => void;
  isToggling: boolean;
  isDeleting: boolean;
  isArchiving?: boolean;
}

export function TableCardDashboard({
  table,
  onEdit,
  onToggle,
  onDelete,
  onArchive,
  isToggling,
  isDeleting,
  isArchiving,
}: TableCardDashboardProps) {
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const { open: openSlots } = getSlotsVisualState(table);
  const metrics = table.metrics || { views: 0, clicks: 0, contacts: 0, favorites: 0 };

  // Feedback inteligente: muitas views mas zero contatos
  const hasPerformanceIssue = metrics.views > 50 && metrics.contacts === 0;
  
  // UX: Identificar mesas desativadas
  const isInactive = table.status === 'cancelled' || table.status === 'ended';

  return (
    <div className={`relative rounded-2xl border p-4 flex flex-col gap-3 hover:scale-[1.01] transition-all ${
      isInactive 
        ? 'border-[var(--line)] bg-[var(--surface-subtle)] opacity-60' // Desativada: borda sutil, fundo escurecido, opacidade reduzida
        : 'border-[var(--line)] bg-[var(--surface-subtle)]' // Ativa: estilo normal
    }`}>
      {/* BADGE DE STATUS - Apenas para mesas desativadas */}
      {isInactive && (
        <div className="absolute top-2 right-2 bg-[var(--fill-strong)] text-[var(--fg)] text-xs px-2 py-1 rounded-md font-medium z-10">
          {table.status === 'cancelled' ? '⏸️ Desativada' : '🏁 Encerrada'}
        </div>
      )}

      {/* BADGE DE ARQUIVAMENTO (D-MESAS1) — some do catálogo público */}
      {table.archived && (
        <div className="absolute top-2 left-2 bg-[var(--artificio-bronze)] text-[var(--fg)] text-xs px-2 py-1 rounded-md font-medium z-20">
          🗄️ Arquivada
        </div>
      )}

      {/* IMAGE */}
      <a 
        href={`/mesas/${table.slug}`}
        className={`relative block h-32 rounded-lg overflow-hidden bg-[var(--fill)] hover:opacity-90 transition-opacity cursor-pointer ${
          isInactive ? 'grayscale' : '' // Desativada: imagem em escala de cinza
        }`}
      >
        <img
          src={resolveTableImageSource(table.image_url)}
          alt={table.title}
          className="w-full h-full object-cover"
          onError={applyTableImageFallback}
        />

        <div className="absolute top-2 left-2 flex flex-wrap gap-1.5 z-10">
          <CertificationBadges is_covil={table.is_covil} is_ddal={table.is_ddal} />
        </div>

        {(table.modality === 'online' || table.modality === 'hibrida') && table.vtt_platform?.logo_filename && (
          table.vtt_platform.website_url ? (
            <a
              href={table.vtt_platform.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-2 right-2 h-8 min-w-8 px-1.5 rounded-md bg-black/55 border border-[var(--line-strong)] backdrop-blur-sm inline-flex items-center justify-center hover:bg-black/70 hover:border-[var(--line-strong)] transition-colors"
              title={`${table.vtt_platform.name} - Abrir site oficial`}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={`/vtt-logos/${table.vtt_platform.logo_filename}`}
                alt={table.vtt_platform.name}
                className="h-[18px] w-auto object-contain"
                onError={(event) => {
                  event.currentTarget.parentElement?.classList.add('hidden');
                }}
              />
            </a>
          ) : (
            <span
              className="absolute bottom-2 right-2 h-8 min-w-8 px-1.5 rounded-md bg-black/55 border border-[var(--line-strong)] backdrop-blur-sm inline-flex items-center justify-center"
              title={table.vtt_platform.name}
            >
              <img
                src={`/vtt-logos/${table.vtt_platform.logo_filename}`}
                alt={table.vtt_platform.name}
                className="h-[18px] w-auto object-contain"
                onError={(event) => {
                  event.currentTarget.parentElement?.classList.add('hidden');
                }}
              />
            </span>
          )
        )}
      </a>

      {/* TITLE */}
      <div>
        <a 
          href={`/mesas/${table.slug}`}
          className={`font-semibold line-clamp-2 hover:text-[var(--color-artificio-orange)] transition-colors cursor-pointer ${
            isInactive ? 'text-[var(--fg-muted)]' : 'text-[var(--fg)]' // Desativada: texto mais apagado
          }`}
        >
          {table.title}
        </a>
        <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)] mt-1">
          {table.system_name && (
            <SystemBadge
              name={table.system_name}
              logoFilename={table.system_logo_filename}
              websiteUrl={table.system_website_url}
              className="!max-w-none !text-[10px]"
            />
          )}
          {!table.system_name && <span>Sistema livre</span>}
          <span>·</span>
          <span>{table.modality}</span>
        </div>
      </div>

      {/* STATUS HUMANO */}
      <div className="text-sm">
        {isInactive ? (
          <span className="text-[var(--fg-muted)]">
            {table.status === 'cancelled' ? '⏸️ Mesa pausada' : '🏁 Mesa encerrada'}
          </span>
        ) : openSlots === 0 ? (
          <span className="text-[var(--state-danger-fg)]">🔥 Mesa cheia</span>
        ) : openSlots <= 2 ? (
          <span className="text-[var(--state-warning-fg)]">⚡ Últimas vagas ({openSlots})</span>
        ) : (
          <span className="text-[var(--state-success-fg)]">✅ {openSlots} vagas abertas</span>
        )}
      </div>

      {/* METRICS */}
      <div className="flex gap-3 text-xs text-[var(--fg-muted)]">
        <span title="Visualizações">👁️ {metrics.views}</span>
        <span title="Contatos">💬 {metrics.contacts}</span>
        <span title="Favoritos">❤️ {metrics.favorites}</span>
      </div>

      {/* INSIGHT AUTOMÁTICO */}
      {hasPerformanceIssue && !isInactive && (
        <div className="text-xs bg-[var(--state-warning-bg)] border border-[var(--state-warning-line)] p-2 rounded-lg text-[var(--state-warning-fg)]">
          💡 Muitas visualizações, poucos contatos. Tente melhorar título ou imagem.
        </div>
      )}

      {/* ACTIONS */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={() => onEdit(table.id)}
          className="py-2 text-xs bg-[var(--artificio-info)] hover:bg-[var(--state-info-bg)] rounded-lg transition-colors"
        >
          Editar
        </button>

        <button
          onClick={() => onToggle(table)}
          disabled={isToggling}
          className="py-2 text-xs bg-[var(--artificio-warning)] hover:bg-[var(--state-warning-bg)] disabled:opacity-50 rounded-lg transition-colors"
        >
          {isToggling ? '⏳' : table.status === 'active' ? 'Desativar' : 'Ativar'}
        </button>

        {onArchive && (
          <button
            onClick={() => onArchive(table)}
            disabled={isArchiving}
            className="col-span-2 py-2 text-xs bg-[var(--artificio-bronze)] hover:brightness-110 text-[var(--fg)] disabled:opacity-50 rounded-lg transition"
          >
            {isArchiving ? '⏳' : table.archived ? '♻️ Desarquivar' : '🗄️ Arquivar'}
          </button>
        )}

        <InlineDeleteConfirmation
          title={table.title}
          isOpen={isDeleteConfirmOpen}
          onOpen={() => setIsDeleteConfirmOpen(true)}
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={() => onDelete(table)}
          isProcessing={isDeleting}
          disabled={isToggling}
          className="col-span-2 w-full"
          compact
        />
      </div>
    </div>
  );
}
