import { Link } from 'react-router-dom';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Globe, MapPin } from 'lucide-react';
import type { TableCard } from '../types/tables';
import { getSlotsVisualState } from '../utils/slots';
import { SlotsIndicator } from './SlotsIndicator';
import { SystemBadge } from './SystemBadge';
import { CertificationBadges } from './CertificationBadges';
import { applyTableImageFallback, resolveTableImageSource } from '../utils/tableImage';
import { isUsableImageSrc } from '../utils/imageSource';

const modalityLabels: Record<string, string> = {
  online: 'Online',
  presencial: 'Presencial',
  hibrida: 'Híbrida',
};

export function TableCardSkeleton() {
  // CORREÇÃO UX-SENIOR-05: Skeleton realista que imita layout do card
  return (
    <div className="relative w-full min-h-[380px] rounded-2xl bg-[#1B2A4A] border border-white/10 overflow-hidden">
      {/* Cover placeholder */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2A3F6D] to-[#1B2A4A] animate-pulse" />
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d1a30] via-[#0d1a30]/70 to-transparent z-10" />
      
      {/* Content skeleton */}
      <div className="absolute bottom-0 left-0 p-5 z-20 w-full space-y-2.5">
        {/* Título */}
        <div className="h-6 bg-white/10 rounded w-3/4 animate-pulse" />
        
        {/* Vagas */}
        <div className="h-8 bg-white/10 rounded w-1/3 animate-pulse" />
        
        {/* Descrição */}
        <div className="space-y-1">
          <div className="h-3 bg-white/10 rounded w-full animate-pulse" />
          <div className="h-3 bg-white/10 rounded w-2/3 animate-pulse" />
        </div>
        
        {/* Tags */}
        <div className="flex gap-2">
          <div className="h-6 bg-white/10 rounded w-20 animate-pulse" />
          <div className="h-6 bg-white/10 rounded w-16 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function TableCardComponent({ table }: { table: TableCard }) {
  // Fonte única de verdade para vagas (lógica de badge e CTA)
  const { isFull } = getSlotsVisualState(table);

  // CTA principal único: varia entre entrar ou ver detalhes conforme status da mesa
  const canJoinDirectly = !isFull && table.status === 'active';
  const primaryCTA = canJoinDirectly
    ? { label: 'Entrar na mesa →', variant: 'primary' as const }
    : { label: 'Ver detalhes →', variant: 'secondary' as const };

  const queryClient = useQueryClient();

  // Prefetch no hover com debounce
  const handleMouseEnter = useCallback(() => {
    const timer = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: ['table', table.slug],
        queryFn: () =>
          fetch(`/api/v1/tables/${table.slug}`).then((res) => res.json()),
        staleTime: 5 * 60 * 1000,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [queryClient, table.slug]);

  // Click tracking
  const handleClick = useCallback(() => {
    fetch(`/api/v1/tables/${table.slug}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant: 'refactored_v4' }),
      keepalive: true,
    }).catch(() => {});
  }, [table.slug]);

  return (
    <Link
      to={`/mesas/${table.slug}`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      className="group relative flex h-full min-h-[430px] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1B2A4A] shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-artificio-orange)]/40 hover:shadow-[0_0_30px_rgba(255,87,34,0.15)]"
      id={`table-card-${table.slug}`}
    >
      {/* BLOCO 1: HEADER (Imagem + Badges críticos) */}
      <div className="aspect-[16/10] w-full relative overflow-hidden">
        <img
          src={resolveTableImageSource(table.cover_url)}
          alt={table.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={applyTableImageFallback}
        />

        {/* Badges críticos apenas */}
        <div className="absolute left-3 right-14 top-3 flex flex-wrap gap-2">
          <CertificationBadges is_covil={table.is_covil} is_ddal={table.is_ddal} />
          {isFull && (
            <span className="px-2 py-1 rounded-md text-[11px] font-black tracking-wide text-white bg-red-600 backdrop-blur-sm">
              Lotada
            </span>
          )}
        </div>

        {table.featured && (
          <span className="absolute top-3 right-3 max-w-[45%] truncate rounded-md bg-[var(--color-artificio-orange)] px-2 py-1 text-xs font-bold text-white">
            ★ Destaque
          </span>
        )}

        {(table.modality === 'online' || table.modality === 'hibrida') && table.vtt_platform?.logo_filename && (
          table.vtt_platform.website_url ? (
            <a
              href={table.vtt_platform.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-3 right-3 h-9 min-w-9 px-2 rounded-lg bg-black/55 border border-white/20 backdrop-blur-sm inline-flex items-center justify-center hover:bg-black/70 hover:border-white/40 transition-colors"
              title={`${table.vtt_platform.name} - Abrir site oficial`}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={`/vtt-logos/${table.vtt_platform.logo_filename}`}
                alt={table.vtt_platform.name}
                className="h-5 w-auto object-contain"
                onError={(event) => {
                  event.currentTarget.parentElement?.classList.add('hidden');
                }}
              />
            </a>
          ) : (
            <span
              className="absolute bottom-3 right-3 h-9 min-w-9 px-2 rounded-lg bg-black/55 border border-white/20 backdrop-blur-sm inline-flex items-center justify-center"
              title={table.vtt_platform.name}
            >
              <img
                src={`/vtt-logos/${table.vtt_platform.logo_filename}`}
                alt={table.vtt_platform.name}
                className="h-5 w-auto object-contain"
                onError={(event) => {
                  event.currentTarget.parentElement?.classList.add('hidden');
                }}
              />
            </span>
          )
        )}
      </div>

      {/* BLOCO 2: CONTENT (Título + Sistema/Modalidade) */}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex min-h-[34px] min-w-0 flex-wrap items-center gap-2">
          {table.system_name && (
            <SystemBadge
              name={table.system_name}
              logoFilename={table.system_logo_filename}
              websiteUrl={table.system_website_url}
            />
          )}
          <span className="shrink-0 whitespace-nowrap flex items-center gap-1 px-2 py-1 bg-[#13213f] rounded-md text-xs font-semibold text-white/80 border border-white/10">
            {table.modality === 'online' ? <Globe className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
            {modalityLabels[table.modality] ?? table.modality}
          </span>
        </div>

        <h3 className="mb-4 min-h-[4.75rem] shrink-0 text-lg font-bold leading-tight text-white transition-colors line-clamp-3 group-hover:text-[var(--color-artificio-orange)]">
          {table.title}
        </h3>

        {/* BLOCO 3: METADATA (Mestre + Vagas + Preço) */}
        <div className="mt-auto min-w-0 space-y-3">
          {table.gm_display_name && (
            <div className="flex min-w-0 items-center gap-2">
              {isUsableImageSrc(table.gm_avatar_url) ? (
                <img
                  src={table.gm_avatar_url}
                  alt={table.gm_display_name}
                  className="w-6 h-6 rounded-full border border-white/20"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">
                  👤
                </div>
              )}
              {table.gm_slug ? (
                <Link
                  to={`/mestre/${table.gm_slug}`}
                  onClick={(e) => e.stopPropagation()}
                  className="min-w-0 truncate text-sm font-medium text-white/70 transition-colors hover:text-white hover:underline"
                >
                  {table.gm_display_name}
                </Link>
              ) : (
                <span className="min-w-0 truncate text-sm font-medium text-white/70">
                  {table.gm_display_name}
                </span>
              )}
            </div>
          )}

          <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-3 gap-y-2">
            {/* Vagas */}
            <SlotsIndicator table={table} />

            {/* Preço */}
            {table.price_type === 'gratuita' ? (
              <span className="shrink-0 text-sm font-bold text-green-400">Gratuito</span>
            ) : table.price_value ? (
              <span className="flex shrink-0 items-baseline gap-1 whitespace-nowrap text-sm font-bold text-yellow-400">
                R$ {table.price_value}<span className="text-[10px] font-semibold text-white/50">/ sessão</span>
              </span>
            ) : null}
          </div>

          {/* BLOCO 4: ACTION (CTA primário + secundário opcional) */}
          <div className="space-y-2">
            <div className={`w-full py-2.5 rounded-lg text-sm font-bold text-center transition-all ${
              isFull
                ? 'bg-gray-600 text-white/50 cursor-not-allowed opacity-50'
                : primaryCTA.variant === 'primary'
                  ? 'bg-orange-600 hover:bg-orange-700 text-white'
                  : 'border-2 border-orange-600 text-orange-600 hover:bg-orange-600/10'
            }`}>
              {isFull ? 'Mesa lotada' : primaryCTA.label}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
