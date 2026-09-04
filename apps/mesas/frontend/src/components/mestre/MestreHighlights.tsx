import { Award, Globe, Languages, Sparkles } from 'lucide-react';
import { Badge } from '@artificio/ui';
import type { MestrePublicData } from '../../hooks/useMestre';

interface MestreHighlightsProps {
  profile: MestrePublicData;
}

/**
 * Exibição de `specialties`, `languages` e `badges` na página pública
 * (spec 099, B3/C2 — os três eram órfãos de exibição; `badges` nunca
 * renderizou em lugar nenhum).
 *
 * Só renderiza quando há dado. Os chips usam o `Badge` do pacote (pill de
 * 999px com os mesmos tokens que os chips antigos da bio — warning para
 * especialidades, neutral para idiomas/selos); a composição da seção
 * (`mestre-highlights-*`) vive em MestrePage.css, como os vizinhos da página.
 */
export function MestreHighlights({ profile }: MestreHighlightsProps) {
  const specialties = Array.isArray(profile.specialties) ? profile.specialties : [];
  const languages = Array.isArray(profile.languages) ? profile.languages : [];
  const badges = Array.isArray(profile.badges) ? profile.badges : [];

  if (specialties.length === 0 && languages.length === 0 && badges.length === 0) {
    return null;
  }

  return (
    <section className="mestre-highlights-section">
      <div className="container">
        <h3 className="section-title">Em resumo</h3>
        <div className="mestre-highlights-groups">
          {specialties.length > 0 && (
            <div className="mestre-highlights-group">
              <span className="mestre-highlights-label">
                <Sparkles className="w-4 h-4" /> Especialidades
              </span>
              <div className="mestre-highlights-chips">
                {specialties.map((specialty, index) => (
                  <Badge key={`specialty-${index}`} variant="warning">
                    {specialty}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {languages.length > 0 && (
            <div className="mestre-highlights-group">
              <span className="mestre-highlights-label">
                <Languages className="w-4 h-4" /> Idiomas
              </span>
              <div className="mestre-highlights-chips">
                {languages.map((language, index) => (
                  // `gap-1` (0.25rem, na régua) — o Badge não declara gap interno
                  // e o chip de idioma leva o Globe dentro (padrão do MestreBio).
                  <Badge key={`language-${index}`} variant="neutral" className="gap-1">
                    <Globe className="w-3 h-3" /> {language}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {badges.length > 0 && (
            <div className="mestre-highlights-group">
              <span className="mestre-highlights-label">
                <Award className="w-4 h-4" /> Selos
              </span>
              <div className="mestre-highlights-chips">
                {badges.map((badge, index) => (
                  <Badge key={`badge-${index}`} variant="neutral">
                    {badge}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
