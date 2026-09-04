import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { LinksDisplay } from '../components/LinksDisplay';
import { MestreBio } from '../components/mestre/MestreBio';
import { MestreClosedGroupSection } from '../components/mestre/MestreClosedGroupSection';
import { MestreError } from '../components/mestre/MestreError';
import { MestreFinalCta } from '../components/mestre/MestreFinalCta';
import { MestreHero } from '../components/mestre/MestreHero';
import { MestreHighlights } from '../components/mestre/MestreHighlights';
import { MestreNotFound } from '../components/mestre/MestreNotFound';
import { MestreSectionGroup } from '../components/mestre/MestreSectionGroup';
import { MestreSellingPoints } from '../components/mestre/MestreSellingPoints';
import { MestreSkeleton } from '../components/mestre/MestreSkeleton';
import { MestreTablesSection } from '../components/mestre/MestreTablesSection';
import { MestreVttPlatforms } from '../components/mestre/MestreVttPlatforms';
import { MestreContactMethods } from '../components/mestre/MestreContactMethods';
import { MestreContactForm } from '../components/mestre/MestreContactForm';
import { MestreReviewsSection } from '../components/mestre/MestreReviewsSection';
import { applySeo } from '../utils/seo';
import { useMestre } from '../hooks/useMestre';
import './MestrePage.css';

import { authPost } from '../services/apiClient';

export const MestrePage = () => {
  const { slug } = useParams<{ slug: string }>();

  const {
    profile,
    links,
    mappedTables,
    totalOpenSlots,
    loading,
    error,
  } = useMestre(slug);

  useEffect(() => {
    applySeo(
      profile
        ? `${profile.display_name} | Mestre | Artifício Mesas`
        : 'Mestre | Artifício Mesas',
      // Seleção não-branca (classe: cadeia `a || b || fallback` trata só-whitespace
      // como conteúdo); write path normaliza, a leitura é defensiva.
      [profile?.tagline, profile?.bio_long?.slice(0, 150)].find(
        (candidate) => candidate != null && candidate.trim() !== ''
      ) ?? 'Landing pública de mestre com mesas ativas e especialidades.'
    );
  }, [profile]);

  useEffect(() => {
    if (!slug || loading || !profile) return;

    const sessionKey = 'gm-profile-view-session-id';
    const slugKey = `gm-profile-view:${slug}`;

    if (sessionStorage.getItem(slugKey) === '1') {
      return;
    }

    let sessionId = sessionStorage.getItem(sessionKey);

    if (!sessionId) {
      // Usar crypto.randomUUID() se disponível, caso contrário usar timestamp + performance.now()
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        sessionId = crypto.randomUUID();
      } else {
        // Fallback seguro: timestamp + performance counter (não é criptograficamente seguro, mas suficiente para deduplicação)
        sessionId = `${Date.now()}-${performance.now().toString(36).replace('.', '')}`;
      }
      sessionStorage.setItem(sessionKey, sessionId);
    }

    sessionStorage.setItem(slugKey, '1');

    authPost(`/api/v1/gm/perfis/${slug}/view`, undefined, { headers: { 'x-session-id': sessionId } }).catch(() => {
      // Não bloquear renderização por falha de telemetria
    });
  }, [slug, loading, profile]);

  if (loading) return <MestreSkeleton />;
  if (error === 'Mestre não encontrado.') return <MestreNotFound />;
  if (error || !profile) {
    return <MestreError message={error ?? 'Não foi possível carregar este perfil.'} />;
  }

  // Condição de conteúdo por grupo (D20). Espelha o que cada filho verifica
  // internamente: `MestreBio` exige tagline OU bio; `MestreHighlights`, um dos
  // três arrays; `MestreSellingPoints`, a lista; `MestreClosedGroupSection`,
  // o `enabled`. O grupo não consegue perguntar isso aos filhos — ver a nota
  // em `MestreSectionGroup` sobre `Children.toArray`.
  const temSobre =
    !!profile.tagline?.trim() ||
    !!profile.bio_long?.trim() ||
    (profile.specialties?.length ?? 0) > 0 ||
    (profile.languages?.length ?? 0) > 0 ||
    (profile.badges?.length ?? 0) > 0 ||
    (profile.selling_points?.length ?? 0) > 0 ||
    (profile.preferred_vtt_platforms?.length ?? 0) > 0;

  // `MestreTablesSection` renderiza SEMPRE — inclusive o estado "sem mesas
  // ativas", que é informação para o visitante, não vazio. Logo o grupo Mesas
  // não some; a condição existe para não mentir sobre isso.
  const temMesas = true;

  const temContato =
    (profile.contact_methods?.length ?? 0) > 0 ||
    links.length > 0 ||
    !!profile.closed_group?.enabled;

  return (
    <main className="mestre-page">
      <MestreHero
        profile={profile}
        mappedTables={mappedTables}
        totalOpenSlots={totalOpenSlots}
      />

      <div className="mestre-section-flow">
        {/* Três grupos (D5a/T3.1a), não onze blocos empilhados. Cada filho
            recebe a MESMA condição que tinha quando era irmão direto do fluxo —
            o que muda é a agregação, não o que se mostra (requisito 11a).
            A condição é resolvida aqui, e não dentro do grupo, porque o grupo
            só consegue descartar filho que já chega como `false`/`null`
            (D20: grupo sem filho visível some com o título junto). */}
        <MestreSectionGroup
          id="sobre"
          title={`Sobre ${profile.display_name}`}
          hasContent={temSobre}
        >
          <MestreBio profile={profile} />

          {/* Spec 099 B3/C2: specialties/languages/badges — antes órfãos de
              exibição (`badges` nunca renderizou). Só renderiza quando há dado. */}
          <MestreHighlights profile={profile} />

          <MestreSellingPoints sellingPoints={profile.selling_points ?? []} />

          {profile.preferred_vtt_platforms &&
            profile.preferred_vtt_platforms.length > 0 && (
              <section className="container">
                <MestreVttPlatforms platforms={profile.preferred_vtt_platforms} />
              </section>
            )}
        </MestreSectionGroup>

        <MestreSectionGroup id="mesas" title="Mesas e avaliações" hasContent={temMesas}>
          <MestreTablesSection mappedTables={mappedTables} />

          {slug && <MestreReviewsSection slug={slug} />}
        </MestreSectionGroup>

        <MestreSectionGroup id="contato" title="Contato" hasContent={temContato}>
          {profile.contact_methods && profile.contact_methods.length > 0 && (
            <section className="container">
              <MestreContactMethods
                contacts={profile.contact_methods}
                gmSlug={slug || ''}
              />
            </section>
          )}

          {profile.contact_methods?.some((c) => c.channel === 'form') && slug && (
            <section className="container">
              <MestreContactForm mestreSlug={slug} />
            </section>
          )}

          {links.length > 0 && (
            <section className="links-section">
              <div className="container">
                <LinksDisplay links={links} headingLevel="h3" />
              </div>
            </section>
          )}

          <MestreClosedGroupSection closedGroup={profile.closed_group} />
        </MestreSectionGroup>

        {mappedTables.length > 0 && (
          <MestreFinalCta
            totalOpenSlots={totalOpenSlots}
            tablesCount={mappedTables.length}
            mappedTables={mappedTables}
          />
        )}
      </div>
    </main>
  );
};
