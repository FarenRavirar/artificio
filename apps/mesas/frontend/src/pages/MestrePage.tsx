import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { LinksDisplay } from '../components/LinksDisplay';
import { MestreBio } from '../components/mestre/MestreBio';
import { MestreClosedGroupSection } from '../components/mestre/MestreClosedGroupSection';
import { MestreError } from '../components/mestre/MestreError';
import { MestreFinalCta } from '../components/mestre/MestreFinalCta';
import { MestreHero } from '../components/mestre/MestreHero';
import { MestreInsightsSection } from '../components/mestre/MestreInsightsSection';
import { MestreNotFound } from '../components/mestre/MestreNotFound';
import { MestreRecommendationsSection } from '../components/mestre/MestreRecommendationsSection';
import { MestreSellingPoints } from '../components/mestre/MestreSellingPoints';
import { MestreSkeleton } from '../components/mestre/MestreSkeleton';
import { MestreTablesSection } from '../components/mestre/MestreTablesSection';
import { MestreVttPlatforms } from '../components/mestre/MestreVttPlatforms';
import { MestreContactMethods } from '../components/mestre/MestreContactMethods';
import { MestreContactForm } from '../components/mestre/MestreContactForm';
import { MestreReviewsSection } from '../components/mestre/MestreReviewsSection';
import { applySeo } from '../utils/seo';
import { useMestre } from '../hooks/useMestre';
import { useMestreInsights } from '../hooks/useMestreInsights';
import './MestrePage.css';

import { authPost } from '../services/apiClient';

export const MestrePage = () => {
  const { slug } = useParams<{ slug: string }>();

  const {
    profile,
    links,
    mappedTables,
    totalOpenSlots,
    canSeeInsights,
    loading,
    error,
  } = useMestre(slug);

  const { metrics, recommendations, insightsLoading } = useMestreInsights({
    slug,
    canSeeInsights,
  });

  useEffect(() => {
    applySeo(
      profile
        ? `${profile.display_name} | Mestre | Artifício Mesas`
        : 'Mestre | Artifício Mesas',
      profile?.tagline ||
        profile?.bio_long?.slice(0, 150) ||
        'Landing pública de mestre com mesas ativas e especialidades.'
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

    authPost(`/api/v1/gm/${slug}/view`, undefined, { headers: { 'x-session-id': sessionId } }).catch(() => {
      // Não bloquear renderização por falha de telemetria
    });
  }, [slug, loading, profile]);

  if (loading) return <MestreSkeleton />;
  if (error === 'Mestre não encontrado.') return <MestreNotFound />;
  if (error || !profile) {
    return <MestreError message={error ?? 'Não foi possível carregar este perfil.'} />;
  }

  return (
    <main className="mestre-page">
      <MestreHero
        profile={profile}
        mappedTables={mappedTables}
        totalOpenSlots={totalOpenSlots}
      />

      <MestreBio profile={profile} />

      <MestreSellingPoints sellingPoints={profile.selling_points ?? []} />

      {/* PRIORIDADE: Contato é o principal - ANTES de Mesas Disponíveis */}
      
      {/* Contact Methods */}
      {profile.contact_methods && profile.contact_methods.length > 0 && (
        <section className="container" style={{ marginTop: '3rem' }}>
          <MestreContactMethods contacts={profile.contact_methods} gmSlug={slug || ''} />
        </section>
      )}

      {/* VTT Platforms */}
      {profile.preferred_vtt_platforms && profile.preferred_vtt_platforms.length > 0 && (
        <section className="container" style={{ marginTop: '3rem' }}>
          <MestreVttPlatforms platforms={profile.preferred_vtt_platforms} />
        </section>
      )}

      {/* Contact Form */}
      {profile.contact_methods && profile.contact_methods.some(c => c.channel === 'form') && slug && (
        <section className="container" style={{ marginTop: '3rem' }}>
          <MestreContactForm mestreSlug={slug} />
        </section>
      )}

      <MestreTablesSection mappedTables={mappedTables} />

      {slug && <MestreReviewsSection slug={slug} />}

      <MestreClosedGroupSection closedGroup={profile.closed_group} />

      {canSeeInsights && (insightsLoading || metrics.length > 0) && (
        <MestreInsightsSection insightsLoading={insightsLoading} metrics={metrics} />
      )}

      {canSeeInsights && recommendations.length > 0 && (
        <MestreRecommendationsSection recommendations={recommendations} />
      )}

      {/* Links - Após contatos */}
      {links.length > 0 && (
        <section id="contato" className="links-section">
          <div className="container">
            <LinksDisplay links={links} />
          </div>
        </section>
      )}

      {mappedTables.length > 0 && (
        <MestreFinalCta
          totalOpenSlots={totalOpenSlots}
          tablesCount={mappedTables.length}
          mappedTables={mappedTables}
        />
      )}
    </main>
  );
};
