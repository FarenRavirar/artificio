import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { DiscordSettingsPanel } from '../../../features/discord-sync/components/DiscordSettingsPanel';
import { DiscordSourceList } from '../../../features/discord-sync/components/DiscordSourceList';
import { DiscordJsonImportPanel } from '../../../features/discord-sync/components/DiscordJsonImportPanel';
import { IntegrationLogsView } from '../../../features/discord-sync/components/IntegrationLogsView';
import { EnrichmentAdminPanel } from '../hydration/EnrichmentAdminPanel';
import { TextPasteArea } from '../../../features/inbox/components/TextPasteArea';
import { useDiscordSync } from '../../../features/discord-sync/hooks/useDiscordSync';

type IntSubTab = 'discord-config' | 'discord-canais' | 'discord-mensagens' | 'discord-rascunhos' | 'discord-import' | 'importacao' | 'enriquecimento' | 'logs';

/**
 * DiscordSourceListWrapper — instancia useDiscordSync() para alimentar DiscordSourceList.
 * Aceitável: hook instanciado independentemente do ModeracaoSection (sources buscado 2x).
 */
function DiscordSourceListWrapper() {
  const {
    sources,
    loadingSources,
    fetchingSourceId, reingestingSourceId,
    loadSources,
    handleFetchMessages,
    handleReingestForce,
  } = useDiscordSync();

  if (loadingSources) {
    return <p className="text-white/40 text-sm py-4 text-center">Carregando...</p>;
  }

  return (
    <DiscordSourceList
      sources={sources}
      onRefresh={loadSources}
      onFetchMessages={handleFetchMessages}
      fetchingSourceId={fetchingSourceId}
      onReingestForce={handleReingestForce}
      reingestingSourceId={reingestingSourceId}
    />
  );
}

/**
 * Links contextuais para Moderação (T2.7 — Decisão 1).
 * Mensagens capturadas e Rascunhos são links, não re-render do painel.
 */
function ModeracaoLinks({ target }: { target: 'mensagens' | 'rascunhos' }) {
  const items = [
    { slug: 'mensagens', label: 'Mensagens capturadas', desc: 'Visualizar e revisar mensagens do Discord — ir para Moderação' },
    { slug: 'rascunhos', label: 'Rascunhos', desc: 'Gerenciar rascunhos unificados (Discord + Inbox) — ir para Moderação' },
  ];

  return (
    <div className="flex flex-col gap-3">
      {items.map(item => (
        <NavLink
          key={item.slug}
          to={`/gestao/mesas/${item.slug}`}
          className={`block rounded-lg border px-4 py-3 transition-colors hover:bg-white/[0.08] ${
            item.slug === target ? 'border-blue-400/40' : ''
          }`}
          style={{ backgroundColor: 'var(--admin-surface, #16223E)', borderColor: item.slug === target ? undefined : 'var(--border)' }}
        >
          <span className="text-white font-medium text-sm">{item.label}</span>
          <p className="text-white/50 text-xs mt-1">{item.desc}</p>
        </NavLink>
      ))}
    </div>
  );
}

export function IntegracoesSection() {
  const [subTab, setSubTab] = useState<IntSubTab>('discord-config');
  const navigate = useNavigate();

  const subTabClass = (tab: IntSubTab) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      subTab === tab
        ? 'bg-blue-600 text-white'
        : 'bg-white/5 text-white/60 hover:bg-white/10'
    }`;

  return (
    <div>
      {/* Subnav local */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={() => setSubTab('discord-config')} className={subTabClass('discord-config')} aria-pressed={subTab === 'discord-config'}>
          Discord
        </button>
        <button onClick={() => setSubTab('discord-canais')} className={subTabClass('discord-canais')} aria-pressed={subTab === 'discord-canais'}>
          Canais monitorados
        </button>
        <button onClick={() => setSubTab('discord-mensagens')} className={subTabClass('discord-mensagens')} aria-pressed={subTab === 'discord-mensagens'}>
          Mensagens capturadas
        </button>
        <button onClick={() => setSubTab('discord-rascunhos')} className={subTabClass('discord-rascunhos')} aria-pressed={subTab === 'discord-rascunhos'}>
          Rascunhos
        </button>
        <button onClick={() => setSubTab('discord-import')} className={subTabClass('discord-import')} aria-pressed={subTab === 'discord-import'}>
          Importar histórico
        </button>
        <button onClick={() => setSubTab('importacao')} className={subTabClass('importacao')} aria-pressed={subTab === 'importacao'}>
          Importação de dados
        </button>
        <button onClick={() => setSubTab('enriquecimento')} className={subTabClass('enriquecimento')} aria-pressed={subTab === 'enriquecimento'}>
          Enriquecimento de dados
        </button>
        <button onClick={() => setSubTab('logs')} className={subTabClass('logs')} aria-pressed={subTab === 'logs'}>
          Logs de integração
        </button>
      </div>

      {subTab === 'discord-config' && <DiscordSettingsPanel />}
      {subTab === 'discord-canais' && <DiscordSourceListWrapper />}
      {subTab === 'discord-mensagens' && <ModeracaoLinks target="mensagens" />}
      {subTab === 'discord-rascunhos' && <ModeracaoLinks target="rascunhos" />}
      {subTab === 'discord-import' && <DiscordJsonImportPanel onNavigateToDrafts={() => navigate('/gestao/mesas/rascunhos')} />}
      {subTab === 'importacao' && (
        <div>
          <p className="text-sm mb-4" style={{ color: 'var(--fg-muted)' }}>
            Cole o texto de uma mesa para criar um rascunho. O draft aparecerá em Moderação › Rascunhos.
          </p>
          <TextPasteArea onImportSuccess={() => {}} />
        </div>
      )}
      {subTab === 'enriquecimento' && <EnrichmentAdminPanel />}
      {subTab === 'logs' && <IntegrationLogsView />}
    </div>
  );
}

export { ModeracaoLinks };
