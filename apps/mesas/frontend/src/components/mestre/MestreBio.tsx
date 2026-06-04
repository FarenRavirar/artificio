import { useState } from 'react';
import { Sparkles, Globe, Languages } from 'lucide-react';
import type { MestrePublicData } from '../../hooks/useMestre';

interface Props {
  profile: MestrePublicData;
}

export function MestreBio({ profile }: Props) {
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const hasSpecialties = (profile.specialties?.length ?? 0) > 0;
  const hasLanguages = (profile.languages?.length ?? 0) > 0;
  const hasTagline = !!profile.tagline?.trim();
  const hasBio = !!profile.bio_long?.trim();

  if (!hasSpecialties && !hasLanguages && !hasTagline && !hasBio) return null;

  // Split bio em parágrafos para preservar quebras
  const bioParagraphs = hasBio
    ? profile.bio_long!.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean)
    : [];

  return (
    <section className="mestre-bio-section">
      <div className="container">
        <h2 className="section-title">Sobre {profile.display_name}</h2>

        <div className="mestre-bio-grid">
          {profile.avatar_url && !avatarLoadFailed && (
            <div className="mestre-bio-photo">
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                onError={() => setAvatarLoadFailed(true)}
              />
            </div>
          )}

          <div className="mestre-bio-content">
            {bioParagraphs.length > 0 && (
              <div className="mestre-bio-text">
                {bioParagraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            )}

            {hasSpecialties && (
              <div className="mestre-bio-chips">
                <span className="mestre-bio-chips-label">
                  <Sparkles className="w-4 h-4" /> Especialidades
                </span>
                <div className="mestre-bio-chips-list">
                  {profile.specialties!.map((s, i) => (
                    <span key={i} className="mestre-bio-chip">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {hasLanguages && (
              <div className="mestre-bio-chips">
                <span className="mestre-bio-chips-label">
                  <Languages className="w-4 h-4" /> Idiomas
                </span>
                <div className="mestre-bio-chips-list">
                  {profile.languages!.map((l, i) => (
                    <span key={i} className="mestre-bio-chip mestre-bio-chip--outline">
                      <Globe className="w-3 h-3" /> {l}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {hasTagline && (
              <blockquote className="mestre-bio-tagline">
                "{profile.tagline}"
              </blockquote>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
