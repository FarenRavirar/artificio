import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Compass, Megaphone } from 'lucide-react';
import type { TableDetail } from '../types/tables';
import { applySeo } from '../utils/seo';
import { useTableViewModel } from '../features/table/hooks/useTableViewModel';
import { TableActionPanel } from '../features/table/components/TableActionPanel';
import { TableHero } from '../features/table/components/TableHero';
import { TableSchedules } from '../features/table/components/TableSchedules';
import { TableContent } from '../features/table/components/TableContent';
import { TableMaster } from '../features/table/components/TableMaster';
import { TableSecurity } from '../features/table/components/TableSecurity';
import { TableTechnical } from '../features/table/components/TableTechnical';
import { MasterCard } from '../features/table/components/MasterCard';
import { useAuth } from '../contexts/useAuth'; // CORREÇÃO DT-026: Importar useAuth
import { handleCTA, getButtonStyle } from '../features/table/utils/uiHelpers';
import { trackSelectMesa } from '@artificio/analytics';

export const MesaPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth(); // CORREÇÃO DT-026: Obter usuário autenticado
  const [table, setTable] = useState<TableDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadTable = async () => {
      if (!slug) {
        setError('Mesa inválida.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/v1/tables/${slug}`, { signal: controller.signal });

        if (res.status === 404) {
          setError('Mesa não encontrada.');
          setTable(null);
          setLoading(false);
          return;
        }

        // CORREÇÃO B-CRIT-01: Tratamento específico para erros de servidor
        if (res.status === 500) {
          setError('Serviço temporariamente indisponível. Nossa equipe já foi notificada. Tente novamente em alguns minutos.');
          setTable(null);
          setLoading(false);
          return;
        }

        if (res.status === 503) {
          setError('Sistema em manutenção. Voltaremos em breve.');
          setTable(null);
          setLoading(false);
          return;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        setTable(json.data ?? null);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('Não foi possível carregar esta mesa no momento.');
      } finally {
        setLoading(false);
      }
    };

    loadTable();
    return () => controller.abort();
  }, [slug]);

  useEffect(() => {
    if (!table) {
      applySeo('Mesa | Artifício Mesas', 'Detalhes de uma mesa de RPG no portal Artifício Mesas.');
      return;
    }

    applySeo(
      `${table.title} | Artifício Mesas`,
      table.description?.slice(0, 150) || `Conheça os detalhes da mesa ${table.title} no Artifício Mesas.`
    );
  }, [table]);

  // Tracking: incrementar visualizações
  useEffect(() => {
    if (!table?.id || !slug) return;

    trackSelectMesa({
      mesa_id: table.id,
      mesa_nome: table.title,
      sistema: table.system_name || undefined,
    });

    const trackView = async () => {
      try {
        // NOTA: Backend usa POST /tables/:slug/view (não :id)
        // Ver backend/src/routes/gmPanel.ts linha 1620
        await fetch(`/api/v1/tables/${slug}/view`, { method: 'POST' });
      } catch {
        // Silencioso - tracking não deve quebrar a UX
      }
    };

    trackView();
  }, [table?.id, table?.title, table?.system_name, slug]);


  // Fase 1: ViewModel (isola lógica, UI ainda usa table)
  // IMPORTANTE: Hooks devem ser chamados incondicionalmente (regra do React)
  const vm = useTableViewModel(table);

  // CORREÇÃO DT-026: Calcular ownership e admin
  const isOwner = !!(user && table && table.gm_user_id === user.id);
  const isAdmin = user?.role === 'admin';
  const canManage = isOwner || isAdmin;
  const showMasterCard = table?.publisher_role === 'gm';

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--color-artificio-blue)] text-white flex items-center justify-center">
        <p className="animate-pulse text-white/70">Carregando aventura...</p>
      </main>
    );
  }

  if (error || !table) {
    return (
      <main className="min-h-screen bg-[var(--color-artificio-blue)] text-white flex items-center justify-center px-6">
        <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h1 className="text-2xl font-bold mb-2">Ops!</h1>
          <p className="text-white/70 mb-5">{error ?? 'Mesa não encontrada.'}</p>
          <Link
            to="/catalogo"
            id="mesa-link-voltar-catalogo"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] transition-colors"
          >
            <Compass className="w-4 h-4" /> Voltar ao catálogo
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-artificio-blue)] text-white pb-16">
      <header className="container mx-auto px-6 py-6 text-sm text-white/60">
        <nav aria-label="breadcrumb" className="flex items-center gap-2">
          <Link to="/" className="hover:text-white transition-colors" id="mesa-breadcrumb-home">Home</Link>
          <span>/</span>
          <Link to="/catalogo" className="hover:text-white transition-colors" id="mesa-breadcrumb-catalogo">Catálogo</Link>
          <span>/</span>
          <span className="text-white/85">{table.title}</span>
        </nav>
      </header>

      <section className="container mx-auto px-6">
        <article className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="space-y-5">
            {/* Fase 2.2: TableHero (substituindo hero section de 74 linhas) */}
            {/* showOverlay={false} = banner limpo (apenas imagem), informações estão na sidebar */}
            {vm && <TableHero vm={vm} variant="full" showOverlay={false} />}

            {/* Fase 2.3: TableSchedules (substituindo schedules section de 68 linhas) */}
            {vm && <TableSchedules vm={vm} />}

            {/* Fase 2.4: TableContent (substituindo seções de conteúdo narrativo) */}
            {vm && <TableContent vm={vm} />}

            {/* Fase 2.5: TableMaster (substituindo seção do mestre) */}
            {vm && <TableMaster vm={vm} />}

            {/* Fase 2.6: TableSecurity (substituindo seção de segurança) */}
            {vm && <TableSecurity vm={vm} />}

            {/* Fase 2.7: TableTechnical (substituindo seções técnicas) */}
            {vm && <TableTechnical vm={vm} />}

            {/* Announcer Note (mantido fora dos componentes por ser condicional específica) */}
            {table.publisher_role === 'announcer' && (
              <section className="rounded-2xl border border-slate-300/25 bg-slate-500/10 p-5" id="mesa-announcer-note">
                <h2 className="text-lg font-bold mb-2 inline-flex items-center gap-2 text-slate-100">
                  <Megaphone className="w-5 h-5" /> Publicado por anunciante
                </h2>
                <p className="text-sm text-slate-100/85 leading-relaxed">
                  Esta mesa foi publicada por um anunciante.
                  {table.actual_gm_name ? ` Mestre responsável: ${table.actual_gm_name}.` : ''}
                </p>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 z-10">
            {/* Fase 2: TableActionPanel (substituindo aside de 72 linhas) */}
            {/* CORREÇÃO DT-026: Passar variant baseado em canManage (owner OU admin) */}
            {vm && (
              <TableActionPanel
                vm={vm}
                variant={canManage ? 'owner' : 'full'}
                deleteEndpointScope={isAdmin ? 'admin' : 'gm'}
              />
            )}

            {/* Card do Mestre */}
            {vm && showMasterCard && (
              <MasterCard
                masterName={vm.masterName}
                masterSlug={vm.masterSlug}
                masterAvatar={vm.masterAvatar}
                masterBio={vm.masterBio}
                masterVttPlatforms={vm.masterVttPlatforms}
              />
            )}
          </aside>
        </article>
      </section>

      {/* Mobile: CTA Sticky (apenas modo público) */}
      {!canManage && vm && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 p-4 bg-gradient-to-t from-[var(--color-artificio-blue)] via-[var(--color-artificio-blue)] to-transparent">
          <button
            disabled={vm.cta.disabled}
            onClick={() => handleCTA(vm.cta)}
            className={`w-full py-3 rounded-xl font-semibold shadow-2xl ${getButtonStyle(vm.cta.variant)}`}
          >
            {vm.cta.label}
          </button>
        </div>
      )}
    </main>
  );
};
