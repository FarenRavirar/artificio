import { useState } from 'react';
import type { MestrePublicData } from '../../hooks/useMestre';
import { MarkdownContent } from '@artificio/content-editor';

interface Props {
  profile: MestrePublicData;
}

export function MestreBio({ profile }: Props) {
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const hasBio = !!profile.bio_long?.trim();

  // Sem a `tagline` (spec 100, medido em beta 2026-09-04): ela já é o `<h1>` do
  // hero, e repeti-la aqui mostrava a MESMA frase duas vezes na página, 665px
  // abaixo da primeira. O slogan é promessa de identidade e pertence ao topo,
  // junto do nome — é o que a prática do mercado faz. Mesmo motivo que tirou os
  // chips de especialidades/idiomas daqui em 2026-08-31 (spec 099 B3/C2).
  //
  // A condição de render passa a depender SÓ da bio: com `hasTagline` no lugar,
  // um mestre com slogan e sem bio renderizaria esta seção vazia.
  if (!hasBio) return null;

  return (
    <section className="mestre-bio-section">
      <div className="container">
        {/* Sem título próprio (spec 100, T3.1a): o grupo que envolve esta seção
            já é "Sobre {nome}", e repetir a mesma frase logo abaixo duplicava o
            cabeçalho na navegação por leitor de tela e na tela (achado de
            review, PR #306). Os irmãos deste grupo mantêm os seus, porque são
            frases distintas ("Em resumo", "O que eu ofereço") e funcionam como
            subtítulo — este era literalmente o mesmo texto. */}
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

          </div>
        </div>
      </div>
    </section>
  );
}
