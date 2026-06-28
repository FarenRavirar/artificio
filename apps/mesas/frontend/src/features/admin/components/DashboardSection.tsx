import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ActivityPanel } from '../../../modules/admin/activity/components/ActivityPanel';
import { authGet } from '../../../services/apiClient';
import { discordSyncApi } from '../../../features/discord-sync/api/discordSyncApi';

type DashSubTab = 'visao-geral' | 'pendencias' | 'atividades' | 'alertas' | 'atalhos';

export function DashboardSection() {
  const [subTab, setSubTab] = useState<DashSubTab>('visao-geral');
  const [pendenciaSugestoes, setPendenciaSugestoes] = useState(0);
  const [temPendenciaRascunhos, setTemPendenciaRascunhos] = useState(false);
  const [loadingPendencias, setLoadingPendencias] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoadingPendencias(true);
      try {
        const [sysRes, sceRes] = await Promise.all([
          authGet('/api/v1/admin/system-suggestions?status=pending'),
          authGet('/api/v1/admin/scenario-suggestions?status=pending'),
        ]);
        let sugCount = 0;
        for (const res of [sysRes, sceRes]) {
          if (res.ok) {
            const data: unknown = await res.json();
            const rows = data && typeof data === 'object' ? (data as Record<string, unknown>).data : [];
            sugCount += Array.isArray(rows) ? rows.length : 0;
          }
        }
        if (!active) return;
        setPendenciaSugestoes(sugCount);
      } catch {
        // silêncio — erro de rede não quebra o dashboard
      }
      try {
        // ⚠️ limit:1 — backend não expõe total; usamos só para detectar ≥1 pendência
        const drafts = await discordSyncApi.getDrafts({ origin: 'all', status: 'needs_review', limit: 1 });
        if (active) setTemPendenciaRascunhos(Array.isArray(drafts) && drafts.length > 0);
      } catch {
        // silêncio
      }
      if (active) setLoadingPendencias(false);
    })();
    return () => { active = false; };
  }, []);

  const subTabClass = (tab: DashSubTab) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      subTab === tab
        ? 'bg-blue-600 text-white'
        : 'bg-white/5 text-white/60 hover:bg-white/10'
    }`;

  const stub = (label: string) => (
    <div
      className="rounded-lg p-6 border"
      style={{
        backgroundColor: 'var(--admin-surface, #16223E)',
        borderColor: 'var(--border)',
      }}
    >
      <p className="text-sm" style={{ color: 'var(--fg-faint)' }}>
        {label} — em breve.
      </p>
    </div>
  );

  const totalPendencias = pendenciaSugestoes + (temPendenciaRascunhos ? 1 : 0);

  return (
    <div>
      {/* Subnav local */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={() => setSubTab('visao-geral')} className={subTabClass('visao-geral')} aria-pressed={subTab === 'visao-geral'}>
          Visão geral
        </button>
        <button onClick={() => setSubTab('pendencias')} className={subTabClass('pendencias')} aria-pressed={subTab === 'pendencias'}>
          Pendências
          {totalPendencias > 0 && (
            <span className="ml-2 tabular-nums text-xs font-semibold px-1.5 py-0.5 rounded-full bg-orange-600 text-white">
              {totalPendencias}
            </span>
          )}
        </button>
        <button onClick={() => setSubTab('atividades')} className={subTabClass('atividades')} aria-pressed={subTab === 'atividades'}>
          Últimas atividades
        </button>
        <button onClick={() => setSubTab('alertas')} className={subTabClass('alertas')} aria-pressed={subTab === 'alertas'}>
          Alertas
        </button>
        <button onClick={() => setSubTab('atalhos')} className={subTabClass('atalhos')} aria-pressed={subTab === 'atalhos'}>
          Atalhos rápidos
        </button>
      </div>

      {/* Visão geral — stub */}
      {subTab === 'visao-geral' && (
        <div className="space-y-6">
          <div
            className="rounded-lg p-6 border"
            style={{
              backgroundColor: 'var(--admin-surface, #16223E)',
              borderColor: 'var(--border)',
            }}
          >
            <h2 className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>
              Visão geral
            </h2>
            <p className="text-sm mt-2" style={{ color: 'var(--fg-faint)' }}>
              Em breve — resumo do estado da plataforma.
            </p>
          </div>
          <ActivityPanel />
        </div>
      )}

      {/* Pendências — dado real */}
      {subTab === 'pendencias' && (
        <div
          className="rounded-lg p-6 border"
          style={{
            backgroundColor: 'var(--admin-surface, #16223E)',
            borderColor: 'var(--border)',
          }}
        >
          <h3 className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>
            Pendências
          </h3>
          {loadingPendencias ? (
            <p className="text-sm mt-3" style={{ color: 'var(--fg-faint)' }}>Carregando...</p>
          ) : totalPendencias === 0 ? (
            <p className="text-sm mt-3" style={{ color: 'var(--fg-faint)' }}>
              Nenhuma pendência no momento.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {pendenciaSugestoes > 0 && (
                <li>
                  <NavLink
                    to="/gestao/comunidade"
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                  >
                    <span className="tabular-nums font-semibold">{pendenciaSugestoes}</span>
                    sugestão{pendenciaSugestoes !== 1 ? 'ões' : ''} pendente{pendenciaSugestoes !== 1 ? 's' : ''}
                    <span className="text-white/40 text-xs">— Ir para Comunidade</span>
                  </NavLink>
                </li>
              )}
              {temPendenciaRascunhos && (
                <li>
                  <NavLink
                    to="/gestao/moderacao/rascunhos"
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                  >
                    Há rascunhos a revisar
                    <span className="text-white/40 text-xs">— Ir para Moderação</span>
                  </NavLink>
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* Últimas atividades — ActivityPanel real */}
      {subTab === 'atividades' && <ActivityPanel />}

      {/* Alertas — stub */}
      {subTab === 'alertas' && stub('Alertas')}

      {/* Atalhos rápidos — NavLinks reais */}
      {subTab === 'atalhos' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NavLink
            to="/gestao/moderacao/rascunhos"
            className="rounded-lg p-4 border transition-colors hover:bg-white/[0.08]"
            style={{ backgroundColor: 'var(--admin-surface, #16223E)', borderColor: 'var(--border)' }}
          >
            <span className="block text-sm font-medium" style={{ color: 'var(--fg)' }}>Moderação › Rascunhos</span>
            <span className="block text-xs mt-1" style={{ color: 'var(--fg-faint)' }}>Revisar e sincronizar rascunhos unificados</span>
          </NavLink>
          <NavLink
            to="/gestao/comunidade"
            className="rounded-lg p-4 border transition-colors hover:bg-white/[0.08]"
            style={{ backgroundColor: 'var(--admin-surface, #16223E)', borderColor: 'var(--border)' }}
          >
            <span className="block text-sm font-medium" style={{ color: 'var(--fg)' }}>Comunidade</span>
            <span className="block text-xs mt-1" style={{ color: 'var(--fg-faint)' }}>Sugestões da comunidade</span>
          </NavLink>
          <NavLink
            to="/gestao/conteudo"
            className="rounded-lg p-4 border transition-colors hover:bg-white/[0.08]"
            style={{ backgroundColor: 'var(--admin-surface, #16223E)', borderColor: 'var(--border)' }}
          >
            <span className="block text-sm font-medium" style={{ color: 'var(--fg)' }}>Conteúdo</span>
            <span className="block text-xs mt-1" style={{ color: 'var(--fg-faint)' }}>Sistemas, plataformas, cenários e mesas</span>
          </NavLink>
          <NavLink
            to="/gestao/integracoes"
            className="rounded-lg p-4 border transition-colors hover:bg-white/[0.08]"
            style={{ backgroundColor: 'var(--admin-surface, #16223E)', borderColor: 'var(--border)' }}
          >
            <span className="block text-sm font-medium" style={{ color: 'var(--fg)' }}>Integrações</span>
            <span className="block text-xs mt-1" style={{ color: 'var(--fg-faint)' }}>Discord, importação e enriquecimento</span>
          </NavLink>
        </div>
      )}
    </div>
  );
}
