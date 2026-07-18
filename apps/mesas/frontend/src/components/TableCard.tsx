import { Link } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Globe, MapPin, Bookmark } from 'lucide-react';
import type { TableCard } from '../types/tables';
import { getSlotsVisualState } from '../utils/slots';
import { SlotsIndicator } from './SlotsIndicator';
import { SystemBadge } from './SystemBadge';
import { CertificationBadges } from './CertificationBadges';
import { applyTableImageFallback, resolveTableImageSource } from '../utils/tableImage';
import { isUsableImageSrc } from '../utils/imageSource';
import { useAuth } from '../contexts/useAuth';
import { startSsoLogin } from '../utils/auth';
import { GmReviewSummary } from '@artificio/ui';

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

function parseFavoritedPayload(data: unknown): boolean {
  return data && typeof data === 'object' && 'favorited' in data && typeof (data as { favorited: unknown }).favorited === 'boolean'
    ? (data as { favorited: boolean }).favorited
    : false;
}

// Carrega/alterna estado de favorito (achado Codex: card sempre iniciava
// isFavorited=false mesmo se o usuário já tinha favoritado a mesa antes).
function useTableFavorite(slug: string) {
  const { isAuthenticated } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    fetch(`/api/v1/tables/${slug}/favorite`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (!cancelled) setIsFavorited(parseFavoritedPayload(data));
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [isAuthenticated, slug]);

  const handleToggleFavorite = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      startSsoLogin(`/mesas/${slug}`);
      return;
    }

    if (isTogglingFavorite) return;
    setIsTogglingFavorite(true);

    fetch(`/api/v1/tables/${slug}/favorite`, { method: 'POST' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => setIsFavorited(parseFavoritedPayload(data)))
      .catch(() => {})
      .finally(() => setIsTogglingFavorite(false));
  }, [isAuthenticated, isTogglingFavorite, slug]);

  return { isFavorited, isTogglingFavorite, handleToggleFavorite };
}

function handleVttLogoError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.parentElement?.classList.add('hidden');
}

// Extraído pra achatar nesting (achado Sonar: >4 níveis no JSX principal
// por causa do ternário link-vs-span dentro do condicional de plataforma).
function VttPlatformBadge({ table }: { table: TableCard }) {
  const showBadge = (table.modality === 'online' || table.modality === 'hibrida') && table.vtt_platform?.logo_filename;
  if (!showBadge || !table.vtt_platform) return null;

  const logo = (
    <img
      src={`/vtt-logos/${table.vtt_platform.logo_filename}`}
      alt={table.vtt_platform.name}
      className="h-5 w-auto object-contain"
      onError={handleVttLogoError}
    />
  );

  if (table.vtt_platform.website_url) {
    return (
      <a
        href={table.vtt_platform.website_url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-3 h-9 min-w-9 px-2 rounded-lg bg-black/55 border border-white/20 backdrop-blur-sm inline-flex items-center justify-center hover:bg-black/70 hover:border-white/40 transition-colors"
        title={`${table.vtt_platform.name} - Abrir site oficial`}
        onClick={(e) => e.stopPropagation()}
      >
        {logo}
      </a>
    );
  }

  return (
    <span
      className="absolute bottom-3 right-3 h-9 min-w-9 px-2 rounded-lg bg-black/55 border border-white/20 backdrop-blur-sm inline-flex items-center justify-center"
      title={table.vtt_platform.name}
    >
      {logo}
    </span>
  );
}

// Bloco de mestre + rating (achado Sonar: reduz complexidade da função principal)
function TableCardMasterRow({ table }: { table: TableCard }) {
  if (!table.gm_display_name) return null;

  return (
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
      {/* T3.7 (spec 081): rating resumido do GM no card, depende de T8 (review) */}
      {typeof table.gm_reviews_count === 'number' && table.gm_reviews_count > 0 && (
        <GmReviewSummary
          avgRating={table.gm_avg_rating ?? null}
          reviewsCount={table.gm_reviews_count}
          className="shrink-0 ml-auto"
        />
      )}
    </div>
  );
}

// Preço em destaque (T3.3) — extraído pra reduzir complexidade da função principal
function TableCardPrice({ table }: { table: TableCard }) {
  if (table.price_type === 'gratuita') {
    return <span className="shrink-0 text-lg font-black text-green-400">Gratuito</span>;
  }
  if (table.price_value) {
    return (
      <span className="flex shrink-0 items-baseline gap-1 whitespace-nowrap text-lg font-black text-yellow-400">
        R$ {table.price_value}<span className="text-[10px] font-semibold text-white/50">/ sessão</span>
      </span>
    );
  }
  return null;
}

// Prefetch no hover (debounce) + tracking de clique
function useTableCardTracking(slug: string) {
  const queryClient = useQueryClient();

  const handleMouseEnter = useCallback(() => {
    const timer = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: ['table', slug],
        queryFn: () =>
          fetch(`/api/v1/tables/${slug}`).then((res) => res.json()),
        staleTime: 5 * 60 * 1000,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [queryClient, slug]);

  const handleClick = useCallback(() => {
    fetch(`/api/v1/tables/${slug}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant: 'refactored_v4' }),
      keepalive: true,
    }).catch(() => {});
  }, [slug]);

  return { handleMouseEnter, handleClick };
}

export function TableCardComponent({ table }: { table: TableCard }) {
  // Fonte única de verdade para vagas (lógica de badge e CTA)
  const { isFull, open: slotsLeft } = getSlotsVisualState(table);
  const { isFavorited, isTogglingFavorite, handleToggleFavorite } = useTableFavorite(table.slug);
  const { handleMouseEnter, handleClick } = useTableCardTracking(table.slug);

  // CTA principal único: varia entre entrar ou ver detalhes conforme status da mesa
  const canJoinDirectly = !isFull && table.status === 'active';
  const primaryCTA = canJoinDirectly
    ? { label: 'Entrar na mesa →', variant: 'primary' as const }
    : { label: 'Ver detalhes →', variant: 'secondary' as const };

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

        {/* Badges críticos + vagas (T3.1) */}
        <div className="absolute left-3 right-14 top-3 flex flex-wrap gap-2">
          <CertificationBadges is_covil={table.is_covil} is_ddal={table.is_ddal} />
          {/* T9.2 (spec 081): selo de mesa paga em destaque — cobrança é do GM, fora da plataforma */}
          {table.price_type === 'paga' && (
            <span className="rounded-md bg-yellow-500 px-2 py-1 text-[11px] font-black tracking-wide text-black">
              💰 Paga
            </span>
          )}
          {isFull ? (
            <span className="px-2 py-1 rounded-md text-[11px] font-black tracking-wide text-white bg-red-600 backdrop-blur-sm">
              Lotada
            </span>
          ) : (
            <span className="rounded-md bg-black/55 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
              {slotsLeft} {slotsLeft === 1 ? 'vaga' : 'vagas'}
            </span>
          )}
        </div>

        {/* Favoritar (T3.6) */}
        <button
          type="button"
          onClick={handleToggleFavorite}
          disabled={isTogglingFavorite}
          aria-pressed={isFavorited}
          aria-label={isFavorited ? 'Remover dos favoritos' : 'Favoritar mesa'}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/55 backdrop-blur-sm transition-colors hover:bg-black/70 hover:border-white/40 disabled:opacity-50"
        >
          <Bookmark className={`h-4 w-4 ${isFavorited ? 'fill-[var(--color-artificio-orange)] text-[var(--color-artificio-orange)]' : 'text-white'}`} />
        </button>

        {table.featured && (
          <span className="absolute top-14 right-3 max-w-[45%] truncate rounded-md bg-[var(--color-artificio-orange)] px-2 py-1 text-xs font-bold text-white">
            ★ Destaque
          </span>
        )}

        <VttPlatformBadge table={table} />
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
          <TableCardMasterRow table={table} />

          <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-3 gap-y-2">
            {/* Vagas — X/Y preenchidas (T3.2), badge de "N vagas" já sobre a imagem (T3.1).
                Achado Codex: usar getSlotsVisualState (mesma fonte do SlotsIndicator/badge)
                em vez de slots_filled/slots_total crus — evita números conflitantes quando
                o mestre fecha recrutamento manualmente (slots_open menor que o cálculo cru). */}
            <div className="flex flex-col gap-1">
              <SlotsIndicator table={table} variant="compact" />
              <span className="text-[11px] text-white/40">
                {getSlotsVisualState(table).filled}/{getSlotsVisualState(table).total} preenchidas
              </span>
            </div>

            {/* Preço — destaque de fonte maior (T3.3) */}
            <TableCardPrice table={table} />
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
