import { User, Gamepad2 } from 'lucide-react';
import { GmReviewSummary } from '@artificio/ui';

interface MasterCardProps {
  readonly masterName?: string;
  readonly masterSlug?: string;
  readonly masterAvatar?: string;
  readonly masterBio?: string;
  readonly masterVttPlatforms?: ReadonlyArray<{
    id: string;
    name: string;
    slug: string;
    logo_filename: string | null;
    website_url: string | null;
  }>;
  readonly isCovilMember?: boolean;
  /** T6.2: quando a mesa é publicada por anunciante (não é o próprio mestre), não há masterSlug/perfil — mostra card sem link. */
  readonly isAnnouncer?: boolean;
  /** T8.6 (spec 081): rating resumido, depende de T8 (review) já ter dado. */
  readonly avgRating?: number | null;
  readonly reviewsCount?: number | null;
}

/**
 * Card do Mestre — unificado (T6.1, spec 081): substitui a duplicação antiga
 * de TableMaster (corpo) + MasterCard (sidebar), que mostravam a mesma
 * informação duas vezes na mesma página. Único card, na sidebar.
 * Exibe foto, nome, bio resumida, plataformas VTT, badge Covil do Lich e
 * link para perfil público — ou versão sem link quando a mesa é anunciada
 * por terceiro (T6.2).
 */
export function MasterCard({ masterName, masterSlug, masterAvatar, masterBio, masterVttPlatforms, isCovilMember, isAnnouncer, avgRating, reviewsCount }: MasterCardProps) {
  if (!masterName) {
    return null;
  }

  const content = (
    <div className="flex items-start gap-4">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {masterAvatar ? (
          <img
            src={masterAvatar}
            alt={masterName}
            className="w-16 h-16 rounded-full object-cover border-2 border-[rgba(168,85,247,0.30)] group-hover:border-[rgba(168,85,247,0.60)] transition"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[rgba(168,85,247,0.20)] border-2 border-[rgba(168,85,247,0.30)] group-hover:border-[rgba(168,85,247,0.60)] transition flex items-center justify-center">
            <User className="w-8 h-8 text-[var(--special)]" />
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h3 className="text-lg font-bold text-[var(--fg)] group-hover:text-[var(--special)] transition">
            {masterName}
          </h3>
          <span className="text-xs text-[var(--special)] uppercase tracking-wide">
            {isAnnouncer ? 'Mestre responsável' : 'Mestre'}
          </span>
          {typeof reviewsCount === 'number' && reviewsCount > 0 && (
            <GmReviewSummary avgRating={avgRating ?? null} reviewsCount={reviewsCount} />
          )}
          {isCovilMember && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[rgba(168,85,247,0.20)] border border-[rgba(168,85,247,0.30)]">
              <img
                src="https://covildolich.com/wp-content/uploads/2025/09/Mestres.webp"
                alt="Covil do Lich"
                className="w-4 h-4 rounded object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <span className="text-[var(--special)] text-xs font-semibold">Covil do Lich</span>
            </span>
          )}
        </div>

        {masterBio && (
          <p className="text-sm text-[var(--fg-muted)] line-clamp-2 mb-3 whitespace-pre-wrap">
            {masterBio}
          </p>
        )}

        {/* Plataformas VTT */}
        {masterVttPlatforms && masterVttPlatforms.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Gamepad2 className="w-3.5 h-3.5 text-[var(--special)]" />
              <span className="text-xs text-[var(--special)] font-semibold uppercase tracking-wide">
                Plataformas que uso
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {masterVttPlatforms.map((platform) => (
                <div
                  key={platform.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[rgba(168,85,247,0.10)] border border-[rgba(168,85,247,0.20)]"
                >
                  {platform.logo_filename && (
                    <img
                      src={`/vtt-logos/${platform.logo_filename}`}
                      alt={platform.name}
                      className="w-4 h-4 object-contain"
                    />
                  )}
                  <span className="text-xs text-[var(--fg-muted)]">{platform.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {masterSlug && (
          <div className="flex items-center gap-2 text-sm text-[var(--special)] group-hover:text-[var(--special)] transition">
            <span>Ver perfil completo</span>
            <svg
              className="w-4 h-4 group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );

  // Achado Codex: "group" só faz sentido no <a> (habilita group-hover:* interno);
  // na variante sem link (announcer sem masterSlug) fica sem função e engana
  // leitura de estado hover num elemento não clicável.
  const cardClassName = 'block p-6 rounded-xl bg-gradient-to-br from-[rgba(168,85,247,0.10)] to-[var(--state-info-bg)] border border-[rgba(168,85,247,0.20)] transition-all';

  if (!masterSlug) {
    return <div className={cardClassName}>{content}</div>;
  }

  return (
    <a
      href={`/mestre/${masterSlug}`}
      className={`${cardClassName} group hover:border-[rgba(168,85,247,0.40)] hover:scale-[1.02]`}
    >
      {content}
    </a>
  );
}
