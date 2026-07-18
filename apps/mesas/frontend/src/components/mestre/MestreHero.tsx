import { useState } from 'react';
import { CheckCircle2, Sparkles, Crown, Award, Users, Star, MessageSquare } from 'lucide-react';
import type { TableCard } from '../../types/tables';
import type { MestrePublicData } from '../../hooks/useMestre';
import { isUsableImageSrc } from '../../utils/imageSource';

interface MestreHeroProps {
  profile: MestrePublicData;
  mappedTables: TableCard[];
  totalOpenSlots: number;
}

export function MestreHero({ profile, mappedTables }: MestreHeroProps) {
  const hasAnyStat =
    (profile.tables_count ?? 0) > 0 ||
    (profile.avg_rating ?? 0) > 0 ||
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
              <span className="trust-item">
                <CheckCircle2 className="w-4 h-4" />
                Verificado no Covil
              </span>
            )}
            {(profile.experience_years ?? 0) >= 3 && (
              <span className="trust-item">
                <CheckCircle2 className="w-4 h-4" />
                {profile.experience_years}+ anos de experiência
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
            {(profile.avg_rating ?? 0) > 0 && (
              <div className="stat">
                <Star className="stat-icon" />
                <span className="stat-value">{profile.avg_rating!.toFixed(1)}★</span>
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
