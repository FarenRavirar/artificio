import { useState } from 'react';
import type { MestrePublicData } from '../../hooks/useMestre';
import { MarkdownContent } from '@artificio/content-editor';

interface Props {
  profile: MestrePublicData;
}

export function MestreBio({ profile }: Props) {
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const hasTagline = !!profile.tagline?.trim();
  const hasBio = !!profile.bio_long?.trim();

  if (!hasTagline && !hasBio) return null;

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
            {hasBio && (
              <div className="mestre-bio-text">
                <MarkdownContent value={profile.bio_long!} />
              </div>
            )}

            {/* Os chips de especialidades e idiomas saíram daqui em 2026-08-31
                (spec 099 B3/C2): a exibição dos três grupos (especialidades,
                idiomas, selos) vive agora em `MestreHighlights`, seção própria
                logo depois desta — aqui os dois ficariam duplicados na página. */}

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
