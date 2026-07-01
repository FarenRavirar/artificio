import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Bot, FileJson, FileText, Sparkles } from 'lucide-react';
import { DiscordSettingsPanel } from '../../../features/discord-sync/components/DiscordSettingsPanel';
import { DiscordSourceList } from '../../../features/discord-sync/components/DiscordSourceList';
import { DiscordJsonImportPanel } from '../../../features/discord-sync/components/DiscordJsonImportPanel';
import { IntegrationLogsView } from '../../../features/discord-sync/components/IntegrationLogsView';
import { ChatExporterProfilesPanel } from '../../../features/discord-sync/components/ChatExporterProfilesPanel';
import { EnrichmentAdminPanel } from '../hydration/EnrichmentAdminPanel';
import { TextPasteArea } from '../../../features/inbox/components/TextPasteArea';
import { useDiscordSync } from '../../../features/discord-sync/hooks/useDiscordSync';
import { PageHeader, SectionCard, tabButtonClass } from './ui';

type IntSubTab = 'bot' | 'arquivo' | 'texto' | 'enriquecimento';
type BotTab = 'configuracao' | 'importacao' | 'relatorios';

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
  const [subTab, setSubTab] = useState<IntSubTab>('bot');
  const [botTab, setBotTab] = useState<BotTab>('configuracao');
  const navigate = useNavigate();

  const subTabClass = (tab: IntSubTab) => tabButtonClass(subTab === tab, 'inline-flex items-center gap-2');
  const botTabClass = (tab: BotTab) => tabButtonClass(botTab === tab);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={['Gestão', 'Importação']}
        title="Importação"
        description="Entrada operacional de mesas por Bot de Discord, arquivo do ChatExporter, texto colado e enriquecimento."
      />

      <div className="inline-flex flex-wrap rounded-lg border border-[var(--border)] bg-[var(--admin-surface)] p-1">
        <button onClick={() => setSubTab('bot')} className={subTabClass('bot')} aria-pressed={subTab === 'bot'}>
          <Bot size={15} /> Bot de Discord
        </button>
        <button onClick={() => setSubTab('arquivo')} className={subTabClass('arquivo')} aria-pressed={subTab === 'arquivo'}>
          <FileJson size={15} /> Importar arquivo
        </button>
        <button onClick={() => setSubTab('texto')} className={subTabClass('texto')} aria-pressed={subTab === 'texto'}>
          <FileText size={15} /> Importar texto
        </button>
        <button onClick={() => setSubTab('enriquecimento')} className={subTabClass('enriquecimento')} aria-pressed={subTab === 'enriquecimento'}>
          <Sparkles size={15} /> Enriquecimento
        </button>
      </div>

      {subTab === 'bot' && (
        <SectionCard
          title="Bot de Discord"
          description="Configuração, canais, execução e relatórios do pipeline automático do Discord."
          bodyClassName="p-5"
        >
          <div className="mb-5 inline-flex rounded-lg border border-[var(--border)] bg-[var(--admin-surface)] p-1">
            <button onClick={() => setBotTab('configuracao')} className={botTabClass('configuracao')} aria-pressed={botTab === 'configuracao'}>
              Configuração
            </button>
            <button onClick={() => setBotTab('importacao')} className={botTabClass('importacao')} aria-pressed={botTab === 'importacao'}>
              Importação
            </button>
            <button onClick={() => setBotTab('relatorios')} className={botTabClass('relatorios')} aria-pressed={botTab === 'relatorios'}>
              Relatórios
            </button>
          </div>
          {botTab === 'configuracao' && (
            <div className="space-y-5">
              <DiscordSettingsPanel />
              <ChatExporterProfilesPanel />
            </div>
          )}
          {botTab === 'importacao' && (
            <div className="space-y-5">
              <DiscordSourceListWrapper />
              <DiscordJsonImportPanel onNavigateToDrafts={() => navigate('/gestao/mesas/rascunhos')} />
            </div>
          )}
          {botTab === 'relatorios' && <IntegrationLogsView />}
        </SectionCard>
      )}

      {subTab === 'arquivo' && (
        <SectionCard title="Importar arquivo" description="Upload manual de JSON do DiscordChatExporter." bodyClassName="p-5">
          <DiscordJsonImportPanel onNavigateToDrafts={() => navigate('/gestao/mesas/rascunhos')} />
        </SectionCard>
      )}

      {subTab === 'texto' && (
        <SectionCard title="Importar texto" description="Colagem manual de anúncio para gerar rascunho revisável." bodyClassName="p-5">
          <TextPasteArea onImportSuccess={() => navigate('/gestao/mesas/rascunhos')} />
        </SectionCard>
      )}

      {subTab === 'enriquecimento' && (
        <SectionCard title="Enriquecimento" description="Sincronização e saneamento de dados auxiliares do mesas." bodyClassName="p-5">
          <EnrichmentAdminPanel />
        </SectionCard>
      )}
    </div>
  );
}

export { ModeracaoLinks };
