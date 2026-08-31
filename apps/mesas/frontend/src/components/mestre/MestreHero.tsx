import { useState } from 'react';
import { CheckCircle2, Medal, Sparkles, Crown, Award, Users, Star, MessageSquare } from 'lucide-react';
import type { TableCard } from '../../types/tables';
import type { MestrePublicData } from '../../hooks/useMestre';
import { isUsableImageSrc } from '../../utils/imageSource';
import { cropToObjectPosition } from '@artificio/media/image-kinds';
import { toFiniteNumber } from '@artificio/ui';
// Spec 099 B10: o hero carrega o PRÓPRIO CSS (movido de MestrePage.css) para
// que a prévia dos editores (MestreProfilePreview) consuma o componente real
// com os mesmos estilos — sem importar a página pública inteira, cujas classes
// (.container, .section-title) colidem com os editores.
import './MestreHero.css';

interface MestreHeroProps {
  profile: MestrePublicData;
  mappedTables: TableCard[];
  totalOpenSlots: number;
}

export function MestreHero({ profile, mappedTables }: MestreHeroProps) {
  // Defesa secundária: a normalização primária de `avg_rating` vive em
  // `normalizeMestreProfile` (useMestre.ts), na entrada do estado. Mantida aqui
  // porque o componente aceita `MestrePublicData` de qualquer origem, e o campo
  // é NUMERIC(3,2) — o parser default do `pg` entrega string, que já derrubou o
  // catálogo em produção via `.toFixed()`.
  const avgRating = toFiniteNumber(profile.avg_rating);

  const hasAnyStat =
    (profile.tables_count ?? 0) > 0 ||
    (avgRating ?? 0) > 0 ||
    (profile.reviews_count ?? 0) > 0;

  const hasAnyTrust =
    (profile.tables_count ?? 0) > 0 ||
    profile.covil_verified ||
    (profile.experience_years ?? 0) >= 3 ||
    (profile.years_on_platform ?? 0) >= 1 ||
    (profile.tables_hosted_count ?? 0) > 0;

  const scrollTo = (id: string) => () => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const [bannerLoadFailed, setBannerLoadFailed] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  return (
    <section className="hero-section">
      {isUsableImageSrc(profile.banner_url) && !bannerLoadFailed ? (
        <img
          src={profile.banner_url}
          alt=""
          className="hero-banner"
          // Enquadramento escolhido pelo mestre. Sem `object-position` o
          // `object-fit: cover` do CSS recorta sempre pelo centro geometrico,
          // sem que ninguem possa escolher o que fica visivel.
          style={{
            objectPosition: cropToObjectPosition(
              profile.banner_crop_data,
              profile.banner_width,
              profile.banner_height,
            ),
          }}
          onError={() => setBannerLoadFailed(true)}
        />
      ) : (
        <div className="hero-banner-gradient" />
      )}
      <div className="hero-overlay" />

      <div className="hero-content">
        {profile.promo_badge_text && (
          <div className="hero-promo-badge">
            <Sparkles className="w-4 h-4" />
            <span>{profile.promo_badge_text}</span>
          </div>
        )}

        <div className="hero-avatar">
          {isUsableImageSrc(profile.avatar_url) && !avatarLoadFailed ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              style={{
                objectPosition: cropToObjectPosition(
                  profile.avatar_crop_data,
                  profile.avatar_width,
                  profile.avatar_height,
                ),
              }}
              onError={() => setAvatarLoadFailed(true)}
            />
          ) : (
            <div className="hero-avatar-placeholder">
              {profile.display_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="hero-badges">
          <span className="badge badge-mestre">
            <Crown className="w-4 h-4" /> Mestre
          </span>
          {profile.covil_verified && (
            <span className="badge badge-covil">
              <Award className="w-4 h-4" /> Mestre do Covil
            </span>
          )}
        </div>

        <h1 className="hero-title">
          Viva aventuras com{' '}
          <span className="hero-title-accent">{profile.display_name}</span>
        </h1>

        {(() => {
          if (profile.tagline) {
            return <p className="hero-bio">{profile.tagline}</p>;
          }
          if (profile.bio_long) {
            const firstSentence = profile.bio_long.split(/[.!?]\s+/)[0];
            const truncated = firstSentence.length > 140 
              ? firstSentence.slice(0, 140) + '…' 
              : firstSentence + (profile.bio_long.includes('.') ? '.' : '');
            return <p className="hero-bio">{truncated}</p>;
          }
          return null;
        })()}

        <div className="hero-ctas">
          <button
            type="button"
            className="cta-button cta-primary"
            onClick={scrollTo('contato')}
          >
            Entrar em contato
          </button>
          {mappedTables.length > 0 && (
            <button
              type="button"
              className="cta-button cta-secondary"
              onClick={scrollTo('mesas')}
            >
              Ver mesas disponíveis
            </button>
          )}
        </div>

        {hasAnyTrust && (
          <div className="hero-trust-row">
            {(profile.tables_count ?? 0) > 0 && (
              <span className="trust-item">
                <CheckCircle2 className="w-4 h-4" />
                {profile.tables_count} {profile.tables_count === 1 ? 'mesa ativa' : 'mesas ativas'}
              </span>
            )}
            {profile.covil_verified && (
              <span className="trust-item" data-testid="trust-covil">
                <CheckCircle2 className="w-4 h-4" />
                Verificado no Covil
              </span>
            )}
            {/* Spec 099: `experience_years` é autodeclarado pelo mestre — ícone
                Medal e rótulo "Declara N+ anos" para não parecer verificado
                pela plataforma (só `covil_verified` usa CheckCircle2). */}
            {(profile.experience_years ?? 0) >= 3 && (
              <span className="trust-item" data-testid="trust-experience">
                <Medal className="w-4 h-4" />
                Declara {profile.experience_years}+ anos de experiência
              </span>
            )}
            {/* T9.1 (spec 081): calculado (created_at), rótulo distinto do
                autodeclarado acima para não confundir os dois dados (achado D2). */}
            {(profile.years_on_platform ?? 0) >= 1 && (
              <span className="trust-item">
                <CheckCircle2 className="w-4 h-4" />
                Na plataforma desde {new Date(profile.created_at).getFullYear()}
              </span>
            )}
            {(profile.tables_hosted_count ?? 0) > 0 && (
              <span className="trust-item">
                <CheckCircle2 className="w-4 h-4" />
                {profile.tables_hosted_count} {profile.tables_hosted_count === 1 ? 'mesa hospedada' : 'mesas hospedadas'}
              </span>
            )}
          </div>
        )}

        {hasAnyStat && (
          <div className="hero-stats">
            {(profile.tables_count ?? 0) > 0 && (
              <div className="stat">
                <Users className="stat-icon" />
                <span className="stat-value">{profile.tables_count}</span>
                <span className="stat-label">
                  {profile.tables_count === 1 ? 'Mesa' : 'Mesas'}
                </span>
              </div>
            )}
            {(avgRating ?? 0) > 0 && (
              <div className="stat">
                <Star className="stat-icon" />
                <span className="stat-value">{avgRating!.toFixed(1)}★</span>
                <span className="stat-label">Avaliação</span>
              </div>
            )}
            {(profile.reviews_count ?? 0) > 0 && (
              <div className="stat">
                <MessageSquare className="stat-icon" />
                <span className="stat-value">{profile.reviews_count}</span>
                <span className="stat-label">
                  {profile.reviews_count === 1 ? 'Avaliação' : 'Avaliações'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
