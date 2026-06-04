import type { TableViewModel, TableHeroVariant } from '../types/tableView.types';
import { getTableBadges, getBadgeClasses } from '../../../utils/tableBadges';
import { getButtonStyle, handleCTA } from '../utils/uiHelpers';
import { SystemBadge } from '../../../components/SystemBadge';
import { applyTableImageFallback, resolveTableImageSource } from '../../../utils/tableImage';

interface TableHeroProps {
  vm: TableViewModel;
  variant?: TableHeroVariant;
  showOverlay?: boolean; // false = apenas imagem (MesaPage), true = com overlay e texto (catálogo, home)
}

/**
 * Hero da mesa
 * - showOverlay=false: Banner limpo (apenas imagem) - usado na MesaPage
 * - showOverlay=true: Banner com overlay e informações - usado em catálogo/home
 */
export function TableHero({ vm, variant = 'full', showOverlay = true }: TableHeroProps) {
  const badges = getTableBadges({
    is_ddal: vm.certifications.ddal !== undefined,
    is_covil: vm.certifications.covil !== undefined,
  });

  const cropStyle = vm.coverCropData
    ? {
        objectPosition: `${(vm.coverCropData.x / vm.coverCropData.width) * 100}% ${(vm.coverCropData.y / vm.coverCropData.height) * 100}%`,
      }
    : {};

  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Cover Image */}
      <img 
        src={resolveTableImageSource(vm.coverUrl)}
        alt={vm.title}
        className="w-full aspect-[1200/650] object-cover"
        style={cropStyle}
        onError={applyTableImageFallback}
      />
      
      {/* Gradient Overlay - Condicional */}
      {showOverlay && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
      )}

      {/* CORREÇÃO BUG-004: Badges sempre visíveis - posicionamento condicional */}
      {!showOverlay && badges.length > 0 && (
        <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
          {badges.map((badge) => {
            const BadgeIcon = badge.icon;
            return (
              <span
                key={badge.id}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getBadgeClasses(badge.color)}`}
              >
                <BadgeIcon className="w-3.5 h-3.5" />
                {badge.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Content - Condicional */}
      {showOverlay && (
        <div className="absolute bottom-0 left-0 p-6 w-full space-y-3">
          
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {/* Badges de certificação */}
            {badges.map((badge) => {
              const BadgeIcon = badge.icon;
              return (
                <span
                  key={badge.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getBadgeClasses(badge.color)}`}
                >
                  <BadgeIcon className="w-3.5 h-3.5" />
                  {badge.label}
                </span>
              );
            })}

            {/* Badge de status (desativada/encerrada) */}
            {vm.status === 'cancelled' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                ⏸️ Mesa desativada
              </span>
            )}
            {vm.status === 'ended' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
                🏁 Mesa encerrada
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl font-black text-white">
            {vm.title}
          </h1>

          {/* Subtitle */}
          {!vm.visibility.compact && vm.subtitle && (
            <p className="text-white/80 text-sm max-w-xl">
              {vm.subtitle}
            </p>
          )}

          {/* Quick Decision Info */}
          {variant === 'full' && (
            <div className="flex flex-wrap gap-3 text-sm mt-2">
              {vm.system && (
                <SystemBadge
                  name={vm.system}
                  logoFilename={vm.systemLogoFilename}
                  websiteUrl={vm.systemWebsiteUrl}
                  className="!text-sm !text-white/90"
                />
              )}
              <span className="text-white/90">🧠 {vm.experience}</span>
              {/* CORREÇÃO B01: Exibir logo VTT pequeno (20px) ao lado de modality */}
              {((vm.modality === 'online' || vm.modality === 'hibrida') && vm.vttPlatform) ? (
                vm.vttPlatform.website_url ? (
                  <a
                    href={vm.vttPlatform.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-white/90 hover:text-white transition-colors"
                    title={`${vm.vttPlatform.name} - Abrir site oficial`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {vm.vttPlatform.logo_filename && (
                      <img 
                        src={`/vtt-logos/${vm.vttPlatform.logo_filename}`} 
                        alt={vm.vttPlatform.name}
                        className="h-5 w-auto object-contain"
                        onError={(e) => {
                          // CORREÇÃO E02: Esconder imagem se falhar carregamento
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <span>{vm.vttPlatform.name}</span>
                  </a>
                ) : (
                  <span className="flex items-center gap-1.5 text-white/90" title={vm.vttPlatform.name}>
                    {vm.vttPlatform.logo_filename && (
                      <img 
                        src={`/vtt-logos/${vm.vttPlatform.logo_filename}`} 
                        alt={vm.vttPlatform.name}
                        className="h-5 w-auto object-contain"
                        onError={(e) => {
                          // CORREÇÃO E02: Esconder imagem se falhar carregamento
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <span>{vm.vttPlatform.name}</span>
                  </span>
                )
              ) : ((vm.modality === 'online' || vm.modality === 'hibrida') && vm.gamePlatformCustom) ? (
                <span className="text-white/90">🌐 {vm.gamePlatformCustom}</span>
              ) : (
                <span className="text-white/90">🌐 {vm.modality}</span>
              )}
            </div>
          )}

          {/* CTA (apenas em highlight) */}
          {variant === 'highlight' && !vm.cta.disabled && (
            <button
              onClick={() => handleCTA(vm.cta)}
              className={`mt-3 px-5 py-2 rounded-lg font-semibold ${getButtonStyle(vm.cta.variant)}`}
            >
              {vm.cta.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
