import { useEffect } from 'react';
import { Link, useLoaderData, useParams } from 'react-router';
import { Compass, Megaphone } from 'lucide-react';
import type { TableDetail } from '../types/tables';
import { useTableViewModel } from '../features/table/hooks/useTableViewModel';
import { TableActionPanel } from '../features/table/components/TableActionPanel';
import { TableHero } from '../features/table/components/TableHero';
import { TableSchedules } from '../features/table/components/TableSchedules';
import { TableContent } from '../features/table/components/TableContent';
import { TableSecurity } from '../features/table/components/TableSecurity';
import { TableTechnical } from '../features/table/components/TableTechnical';
import { MasterCard } from '../features/table/components/MasterCard';
import { ReportTableButton } from '../features/table/components/ReportTableButton';
import { useAuth } from '../contexts/useAuth'; // CORREÇÃO DT-026: Importar useAuth
import { handleCTA, getButtonStyle } from '../features/table/utils/uiHelpers';
import { trackSelectMesa } from '@artificio/analytics';
import { TableConversation } from '../components/TableConversation';
// Tipo, normalizador e frase do encerramento vivem em arquivo próprio desde
// 2026-08-16: `react-refresh/only-export-components` recusa arquivo de
// componente que também exporta função, e a separação deixa o normalizador
// testável sem router nem API mockada.
import { describeClosure, type ClosedTable } from './closedTable';
import type { MesaLoaderData } from '../routes/mesa';

export const MesaPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth(); // CORREÇÃO DT-026: Obter usuário autenticado

  // T4.2 (spec 102): o dado vem do `loader`, não mais de `useEffect`.
  //
  // O fetch em efeito não roda no servidor: o HTML saía com "Carregando
  // aventura..." e era isso que Googlebot e os crawlers de IA — que não executam
  // JS — recebiam no lugar da mesa. Com o `loader`, título, preço e vagas já
  // estão no HTML do primeiro byte, que é o que a regra pétrea de T4.3 exige.
  //
  // Os estados 404/410/500 deixaram de virar `useState` aqui porque agora são
  // status HTTP da própria página (ver `routes/mesa.tsx`) — o crawler precisa do
  // status, não de um `200` com texto de erro, que é exatamente o soft-404 que
  // abriu esta spec.
  const loaderData = useLoaderData() as MesaLoaderData;
  const table: TableDetail | null = loaderData.kind === 'ok' ? loaderData.table : null;
  const closed: ClosedTable | null = loaderData.kind === 'gone' ? loaderData.closed : null;

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
  const isAnnouncerTable = table?.publisher_role === 'announcer';
  // T6.2: card do mestre aparece também para mesa anunciada por terceiro,
  // usando o que houver disponível (nome do mestre responsável, sem perfil/slug).
  const masterCardName = isAnnouncerTable ? (vm?.actualGmName ?? vm?.masterName) : vm?.masterName;
  const showMasterCard = Boolean(masterCardName);

  // Mesa encerrada: estado próprio, antes do erro genérico. Diz o que
  // aconteceu, quando e por quem — em vez de "Ops! Mesa não encontrada", que
  // era o que o visitante via e não distinguia mesa encerrada de link errado.
  if (closed) {
    // `flex-col items-center`, e não `items-center justify-center`: com a
    // conversa abaixo (T7.8) o conteúdo pode passar da altura da viewport, e a
    // centralização vertical do layout original cortaria o topo do card em vez
    // de rolar. O respiro vem de `py-10`.
    return (
      <main className="min-h-screen bg-[var(--color-artificio-blue)] text-white flex flex-col items-center px-6 py-10">
        <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h1 className="text-2xl font-bold mb-2">Mesa encerrada</h1>
          <p className="text-white/90 mb-1 font-medium">{closed.title}</p>
          <p className="text-white/70 mb-2">{describeClosure(closed)}</p>
          {closed.closedAt && (
            <p className="text-white/50 text-sm mb-5">
              Encerrada em{' '}
              <time dateTime={closed.closedAt.toISOString()}>
                {closed.closedAt.toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </time>
            </p>
          )}
          <Link
            to="/catalogo"
            id="mesa-encerrada-link-catalogo"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] transition-colors"
          >
            <Compass className="w-4 h-4" /> Clique aqui para ver novas mesas
          </Link>
        </div>

        {/* T7.8 (spec 090, requisito 26a) — "encerrada ou arquivada: leitura
            preservada, escrita nova bloqueada". A conversa que aconteceu
            enquanto a mesa existia continua legível; `canComment={false}`
            fecha resposta, edição e voto (voto é ranking e congela junto com a
            conversa), preservando a denúncia. O backend concorda por conta
            própria: o guard devolve `not_commentable`, não `not_visible`, e a
            fachada aceita esse motivo na leitura.
            `closed.id` pode ser nulo enquanto a API não envia o campo — nesse
            caso a tela de encerramento aparece sozinha, sem quebrar. */}
        {closed.id && (
          <div className="max-w-lg w-full mt-6">
            <TableConversation tableId={closed.id} canComment={false} />
          </div>
        )}
      </main>
    );
  }

  if (!table) {
    return (
      <main className="min-h-screen bg-[var(--color-artificio-blue)] text-white flex items-center justify-center px-6">
        <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h1 className="text-2xl font-bold mb-2">Ops!</h1>
          <p className="text-white/70 mb-5">Mesa não encontrada.</p>
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
      <section className="container mx-auto px-6">
        <article className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="space-y-5">
            {/* Breadcrumb 3 níveis (Home já é o catálogo pós-fusão T1) rente ao título (T4.1) */}
            <nav aria-label="breadcrumb" className="flex items-center gap-2 text-sm text-white/60">
              <Link to="/" className="hover:text-white transition-colors" id="mesa-breadcrumb-home">Home</Link>
              <span>›</span>
              {table.system_name ? (
                <Link
                  to={`/?system=${encodeURIComponent(table.system_slug ?? '')}`}
                  className="hover:text-white transition-colors"
                  id="mesa-breadcrumb-sistema"
                >
                  {table.system_name}
                </Link>
              ) : (
                <span className="text-white/60">Sistema</span>
              )}
              <span>›</span>
              <span className="text-white/85">{table.title}</span>
            </nav>

            {/* Título ANTES da imagem de capa (T4.2) */}
            {vm && <h1 className="text-3xl font-black text-white">{vm.title}</h1>}

            {/* Fase 2.2: TableHero (substituindo hero section de 74 linhas) */}
            {/* showOverlay={false} = banner limpo (apenas imagem), informações estão na sidebar */}
            {vm && <TableHero vm={vm} variant="full" showOverlay={false} />}

            {/* Fase 2.3: TableSchedules (substituindo schedules section de 68 linhas) */}
            {vm && <TableSchedules vm={vm} />}

            {/* Fase 2.4: TableContent (substituindo seções de conteúdo narrativo) */}
            {vm && <TableContent vm={vm} />}

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
                announcementTable={table}
              />
            )}

            {/* Card do Mestre — unificado (T6.1/T6.2), aparece também em mesa de anunciante */}
            {vm && showMasterCard && (
              <MasterCard
                masterName={masterCardName}
                masterSlug={isAnnouncerTable ? undefined : vm.masterSlug}
                masterAvatar={isAnnouncerTable ? undefined : vm.masterAvatar}
                masterBio={isAnnouncerTable ? undefined : vm.masterBio}
                masterVttPlatforms={isAnnouncerTable ? undefined : vm.masterVttPlatforms}
                isCovilMember={vm.certifications.covil?.isMember}
                isAnnouncer={isAnnouncerTable}
                avgRating={isAnnouncerTable ? undefined : table.gm_avg_rating}
                reviewsCount={isAnnouncerTable ? undefined : table.gm_reviews_count}
              />
            )}

            {/* Denunciar mesa (T6.6) — separado do FAB de feedback do sistema */}
            <div className="flex justify-center pt-1">
              <ReportTableButton slug={table.slug} />
            </div>
          </aside>
        </article>
      </section>

      {/* T7.4/T7.8 (spec 090) — conversa pública da mesa.
          Fica FORA do <section> do anúncio de propósito: é conteúdo de terceiros
          sobre a mesa, não parte da divulgação dela. Separada do review de
          mestre (`gm_reviews.comment`), que tem nota e contrato próprios e não
          foi migrado (requisito 26).
          `canComment` reflete o mesmo conjunto que o backend aceita: aqui só
          chega mesa que o detalhe devolveu 200, e mesa encerrada não chega
          (ver o ramo `closed` acima) — o valor fica true e o servidor
          continua sendo a autoridade. */}
      {/* Mesmo contêiner da `<section>` do anúncio (`:243`). Sem ele a conversa
          era a única faixa da página a ocupar a viewport inteira — medido em
          1841px contra 900px das irmãs, com o texto colado na borda esquerda em
          telas estreitas (auditoria de 2026-08-17). */}
      {table && (
        <div className="container mx-auto px-6">
          <TableConversation tableId={table.id} />
        </div>
      )}

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
