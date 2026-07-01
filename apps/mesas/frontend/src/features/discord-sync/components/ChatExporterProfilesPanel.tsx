import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Play, RefreshCw, RadioTower, Save, TestTube2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminTable, StatusPill } from '../../admin/components/ui';
import { formatDateTime } from '../../admin/utils/format';
import { discordSyncApi } from '../api/discordSyncApi';
import type {
  ChatExporterAuthType,
  ChatExporterFrequency,
  ChatExporterGlobalAuthType,
  ChatExporterIncludeThreads,
  ChatExporterConfig,
  ChatExporterProfile,
  DiscordDiscoveredChannel,
  DiscordDiscoveredGuild,
} from '../types';

type WizardStep = 'conectar' | 'canais' | 'agenda';

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'conectar', label: 'Conectar' },
  { key: 'canais', label: 'Canais' },
  { key: 'agenda', label: 'Agenda' },
];

const BOT_TOKEN_GUIDE_URL = 'https://discord.com/developers/applications';
const USER_TOKEN_GUIDE_URL = 'https://github.com/Tyrrrz/DiscordChatExporter/blob/master/.docs/Token-and-IDs.md';
const DISCORD_ID_GUIDE_URL = 'https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID';

type ProfileForm = {
  id: string | null;
  label: string;
  guild_id: string;
  guild_name: string;
  channel_id: string;
  channel_name: string;
  auth_type: ChatExporterAuthType;
  token: string;
  clearToken: boolean;
  include_threads: ChatExporterIncludeThreads;
  after: string;
  media: boolean;
  schedule_enabled: boolean;
  frequency: ChatExporterFrequency;
  time: string;
  timezone: string;
  enabled: boolean;
};

const EMPTY_FORM: ProfileForm = {
  id: null,
  label: '',
  guild_id: '',
  guild_name: '',
  channel_id: '',
  channel_name: '',
  auth_type: 'global',
  token: '',
  clearToken: false,
  include_threads: 'active',
  after: '',
  media: false,
  schedule_enabled: false,
  frequency: 'daily',
  time: '03:20',
  timezone: 'America/Sao_Paulo',
  enabled: true,
};

function profileToForm(profile: ChatExporterProfile): ProfileForm {
  return {
    id: profile.id,
    label: profile.label,
    guild_id: profile.guild_id,
    guild_name: profile.guild_name ?? '',
    channel_id: profile.channel_id,
    channel_name: profile.channel_name ?? '',
    auth_type: profile.auth_type,
    token: '',
    clearToken: false,
    include_threads: profile.include_threads,
    after: profile.after ? toDateTimeLocal(profile.after) : '',
    media: profile.media,
    schedule_enabled: profile.schedule_enabled,
    frequency: profile.frequency,
    time: profile.time,
    timezone: profile.timezone,
    enabled: profile.enabled,
  };
}

function statusTone(status: string | null): 'neutral' | 'success' | 'danger' | 'warn' {
  if (status === 'success') return 'success';
  if (status === 'error') return 'danger';
  if (status === 'running') return 'warn';
  return 'neutral';
}

const STATUS_LABELS: Record<string, string> = {
  success: 'sucesso',
  error: 'erro',
  running: 'em execução',
};

function statusLabel(status: string | null): string {
  if (!status) return 'sem execução';
  return STATUS_LABELS[status] ?? status;
}

function deltaLabel(delta: { newCount: number; capped: boolean }): string {
  if (delta.newCount === 0) return 'Nada a atualizar';
  const count = delta.capped ? `${delta.newCount}+` : String(delta.newCount);
  return `${count} nova(s) a importar`;
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function effectiveAuthType(profile: ChatExporterProfile, config: ChatExporterConfig | null): 'user' | 'bot' {
  if (profile.auth_type === 'user' || profile.auth_type === 'bot') return profile.auth_type;
  return config?.authType ?? 'user';
}

function authLabel(type: ChatExporterAuthType, config: ChatExporterConfig | null): string {
  if (type === 'global') return `Padrão (${config?.authType === 'bot' ? 'bot' : 'usuário/session'})`;
  return type === 'bot' ? 'Bot' : 'Usuário/session';
}

const inputClass = 'w-full rounded-lg border border-[var(--border)] bg-[var(--surface-input)] px-3 py-2 text-[var(--fg)]';
const selectClass = `app-select ${inputClass}`;

export function ChatExporterProfilesPanel() {
  const [profiles, setProfiles] = useState<ChatExporterProfile[]>([]);
  const [config, setConfig] = useState<ChatExporterConfig | null>(null);
  const [guilds, setGuilds] = useState<DiscordDiscoveredGuild[]>([]);
  const [channels, setChannels] = useState<DiscordDiscoveredChannel[]>([]);
  const [globalAuthType, setGlobalAuthType] = useState<ChatExporterGlobalAuthType>('user');
  const [globalUserToken, setGlobalUserToken] = useState('');
  const [clearGlobalUserToken, setClearGlobalUserToken] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [step, setStep] = useState<WizardStep>('conectar');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [deltas, setDeltas] = useState<Record<string, string>>({});

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const [nextProfiles, nextConfig] = await Promise.all([
        discordSyncApi.getChatExporterProfiles(),
        discordSyncApi.getChatExporterConfig(),
      ]);
      setProfiles(nextProfiles);
      setConfig(nextConfig);
      setGlobalAuthType(nextConfig.authType ?? 'user');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar perfis.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadProfiles();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadProfiles]);

  const resetWizard = () => {
    setForm(EMPTY_FORM);
    setStep('conectar');
    setChannels([]);
  };

  const selectedAuthType = form.auth_type === 'global' ? globalAuthType : form.auth_type;

  const saveGlobalDefaults = async () => {
    setSavingGlobal(true);
    try {
      const next = await discordSyncApi.saveChatExporterConfig({
        authType: globalAuthType,
        token: globalUserToken.trim() || undefined,
        clearToken: clearGlobalUserToken || undefined,
      });
      setConfig(next);
      setGlobalAuthType(next.authType ?? globalAuthType);
      setGlobalUserToken('');
      setClearGlobalUserToken(false);
      toast.success('Padrão de autenticação salvo.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar padrão de autenticação.');
    } finally {
      setSavingGlobal(false);
    }
  };

  const discoverGuilds = async () => {
    if (selectedAuthType !== 'bot') {
      toast.error('A listagem automática de servidores usa token de bot. Para usuário/session, informe o ID do canal.');
      return;
    }
    setConnecting(true);
    try {
      const next = await discordSyncApi.discoverGuilds();
      setGuilds(next);
      setConnected(true);
      toast.success(`${next.length} servidor(es) encontrados.`);
      if (next.length > 0) setStep('canais');
    } catch (error) {
      setConnected(false);
      toast.error(error instanceof Error ? error.message : 'Erro ao validar token/listar servidores.');
    } finally {
      setConnecting(false);
    }
  };

  const loadChannels = async (guildId: string) => {
    if (!guildId) {
      setChannels([]);
      return;
    }
    try {
      setChannels(await discordSyncApi.discoverChannels(guildId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao listar canais.');
    }
  };

  const selectGuild = (guildId: string) => {
    const guild = guilds.find((item) => item.id === guildId);
    setForm((current) => ({
      ...current,
      guild_id: guildId,
      guild_name: guild?.name ?? current.guild_name,
      channel_id: '',
      channel_name: '',
    }));
    void loadChannels(guildId);
  };

  const setManualGuildId = (guildId: string) => {
    setForm((current) => ({
      ...current,
      guild_id: guildId,
      guild_name: current.guild_name,
      channel_id: '',
      channel_name: '',
    }));
    setChannels([]);
  };

  const selectChannel = (channelId: string) => {
    const channel = channels.find((item) => item.id === channelId);
    setForm((current) => ({
      ...current,
      channel_id: channelId,
      channel_name: channel?.name ?? current.channel_name,
      label: current.label || channel?.name || current.label,
    }));
  };

  const save = async () => {
    if (!form.label.trim() || !form.channel_id.trim()) {
      toast.error('Informe nome do perfil e canal.');
      return;
    }
    if (selectedAuthType === 'bot' && !form.guild_id.trim()) {
      toast.error('Escolha o servidor do bot.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        label: form.label,
        guild_id: form.guild_id || '0',
        guild_name: form.guild_name || (selectedAuthType === 'user' ? 'Token de usuário' : null),
        channel_id: form.channel_id,
        channel_name: form.channel_name || null,
        auth_type: form.auth_type,
        token: form.token.trim() || undefined,
        clearToken: form.clearToken || undefined,
        include_threads: form.include_threads,
        after: form.after || undefined,
        media: form.media,
        schedule_enabled: form.schedule_enabled,
        frequency: form.frequency,
        time: form.time,
        timezone: form.timezone,
        enabled: form.enabled,
      };
      if (form.id) await discordSyncApi.updateChatExporterProfile(form.id, payload);
      else await discordSyncApi.createChatExporterProfile(payload);
      resetWizard();
      await loadProfiles();
      toast.success('Perfil salvo.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const testProfile = async (profile: ChatExporterProfile) => {
    setBusyProfileId(profile.id);
    try {
      const result = await discordSyncApi.testChatExporterProfile(profile.id);
      toast[result.ok ? 'success' : 'error'](result.ok ? 'Perfil pronto para importar.' : result.errors.join(' | '));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao testar perfil.');
    } finally {
      setBusyProfileId(null);
    }
  };

  const checkDelta = async (profile: ChatExporterProfile) => {
    setBusyProfileId(profile.id);
    try {
      const delta = await discordSyncApi.getChatExporterProfileDelta(profile.id);
      const label = deltaLabel(delta);
      setDeltas((current) => ({ ...current, [profile.id]: label }));
      toast.success(`${profile.label}: ${label}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao verificar novidades.');
    } finally {
      setBusyProfileId(null);
    }
  };

  const runProfile = async (profile: ChatExporterProfile) => {
    setBusyProfileId(profile.id);
    try {
      const result = await discordSyncApi.runChatExporterProfile(profile.id);
      setDeltas((current) => {
        const next = { ...current };
        delete next[profile.id];
        return next;
      });
      await loadProfiles();
      toast.success(`Importação: ${result.imported.processed} arquivo(s), ${result.imported.errors} erro(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao importar agora.');
    } finally {
      setBusyProfileId(null);
    }
  };

  const deleteProfile = async (profile: ChatExporterProfile) => {
    if (!globalThis.confirm(`Apagar o perfil "${profile.label}"?`)) return;
    setBusyProfileId(profile.id);
    try {
      await discordSyncApi.deleteChatExporterProfile(profile.id);
      await loadProfiles();
      toast.success('Perfil apagado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao apagar perfil.');
    } finally {
      setBusyProfileId(null);
    }
  };

  const editProfile = (profile: ChatExporterProfile) => {
    setForm(profileToForm(profile));
    setStep('canais');
    setConnected(true);
    // Popular a lista de servidores para o <select> de guild refletir o valor salvo.
    if (effectiveAuthType(profile, config) === 'bot') {
      if (guilds.length === 0) void discoverGuilds();
      void loadChannels(profile.guild_id);
    }
  };

  const columns = useMemo(() => [
    {
      key: 'label',
      header: 'Perfil',
      render: (profile: ChatExporterProfile) => (
        <div>
          <div className="font-medium text-[var(--fg)]">{profile.label}</div>
          <div className="text-xs text-[var(--fg-faint)]">{profile.guild_name ?? profile.guild_id} · #{profile.channel_name ?? profile.channel_id}</div>
        </div>
      ),
    },
    {
      key: 'auth_type',
      header: 'Acesso',
      render: (profile: ChatExporterProfile) => authLabel(profile.auth_type, config),
    },
    {
      key: 'status',
      header: 'Saúde',
      render: (profile: ChatExporterProfile) => (
        <div className="flex flex-col gap-1">
          <StatusPill tone={profile.enabled ? statusTone(profile.last_status) : 'neutral'}>
            {profile.enabled ? statusLabel(profile.last_status) : 'desativado'}
          </StatusPill>
          {profile.last_error && <span className="text-xs text-[var(--danger-soft)]">{profile.last_error}</span>}
          {deltas[profile.id] && <span className="text-xs text-[var(--color-artificio-orange)]">{deltas[profile.id]}</span>}
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'Agenda',
      render: (profile: ChatExporterProfile) => profile.schedule_enabled
        ? `${profile.frequency} ${profile.time} ${profile.timezone}`
        : 'manual',
    },
    {
      key: 'last_run_at',
      header: 'Última execução',
      render: (profile: ChatExporterProfile) => formatDateTime(profile.last_run_at),
    },
  ], [config, deltas]);

  const canAdvanceCanais = Boolean(form.channel_id && form.label && (selectedAuthType === 'user' || form.guild_id));

  return (
    <div className="space-y-5">
      <form
        className="rounded-lg border border-[var(--border)] bg-[var(--admin-surface)] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void saveGlobalDefaults();
        }}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm text-[var(--fg-muted)]">
            <span>Padrão global dos perfis</span>
            <select className={selectClass} value={globalAuthType} onChange={(event) => setGlobalAuthType(event.target.value as ChatExporterGlobalAuthType)}>
              <option value="user">Token de usuário/session</option>
              <option value="bot">Token de bot</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-[var(--fg-muted)]">
            <span>Token de usuário global</span>
            <input
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={globalUserToken}
              disabled={clearGlobalUserToken}
              onChange={(event) => setGlobalUserToken(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 pt-7 text-sm text-[var(--fg-muted)]">
            <input type="checkbox" checked={clearGlobalUserToken} onChange={(event) => setClearGlobalUserToken(event.target.checked)} />
            Remover token de usuário global
          </label>
        </div>
        <p className="mt-3 text-sm text-[var(--fg-muted)]">
          Padrão global é usado por perfis marcados como "Usar padrão global". Token de usuário/session é o valor `authorization` copiado do Discord web. Token de bot é salvo no bloco "Token do bot Discord" acima.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={savingGlobal}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-artificio-orange)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Save size={15} /> Salvar padrão
          </button>
          {config?.token.is_set && <StatusPill tone="success">token de usuário global salvo</StatusPill>}
          <a href={USER_TOKEN_GUIDE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--fg-faint)] hover:text-[var(--fg)]">
            <ExternalLink size={12} /> Como obter token de usuário/session
          </a>
        </div>
      </form>

      <form
        className="rounded-lg border border-[var(--border)] bg-[var(--admin-surface)] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {/* Passos do wizard */}
        <ol className="mb-4 flex items-center gap-2 text-sm">
          {STEPS.map((item, index) => {
            const active = item.key === step;
            const done = STEPS.findIndex((s) => s.key === step) > index;
            return (
              <li key={item.key} className="flex items-center gap-2">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    active
                      ? 'bg-[var(--color-artificio-orange)] text-white'
                      : done
                        ? 'bg-[var(--admin-hover)] text-[var(--fg)]'
                        : 'border border-[var(--border)] text-[var(--fg-faint)]'
                  }`}
                >
                  {index + 1}
                </span>
                <span className={active ? 'text-[var(--fg)]' : 'text-[var(--fg-faint)]'}>{item.label}</span>
                {index < STEPS.length - 1 && <span className="text-[var(--fg-faint)]">›</span>}
              </li>
            );
          })}
        </ol>

        {step === 'conectar' && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                <span>Como este perfil acessa o Discord</span>
                <select
                  className={selectClass}
                  value={form.auth_type}
                  onChange={(event) => setForm({ ...form, auth_type: event.target.value as ChatExporterAuthType })}
                >
                  <option value="global">Usar padrão global</option>
                  <option value="user">Token de usuário/session</option>
                  <option value="bot">Token de bot</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                <span>Token deste perfil (opcional)</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={inputClass}
                  value={form.token}
                  disabled={form.clearToken}
                  onChange={(event) => setForm({ ...form, token: event.target.value })}
                />
              </label>
              {form.id && (
                <label className="flex items-center gap-2 pt-7 text-sm text-[var(--fg-muted)]">
                  <input type="checkbox" checked={form.clearToken} onChange={(event) => setForm({ ...form, clearToken: event.target.checked, token: event.target.checked ? '' : form.token })} />
                  Remover token próprio
                </label>
              )}
            </div>
            <p className="text-sm text-[var(--fg-muted)]">
              Token de usuário/session é o valor `authorization` copiado do Discord web; ele acessa o que sua conta vê. Token de bot é o token do aplicativo convidado ao servidor; com ele dá para listar servidores e canais automaticamente.
            </p>
            {selectedAuthType === 'bot' && (
              <button
                type="button"
                onClick={() => void discoverGuilds()}
                disabled={connecting}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-[var(--admin-hover)] disabled:opacity-50"
              >
                <RefreshCw size={15} className={connecting ? 'animate-spin' : ''} /> {connecting ? 'Validando...' : 'Validar bot e listar servidores'}
              </button>
            )}
            {connected && guilds.length === 0 && (
              <p className="text-sm text-[var(--danger-soft)]">
                Nenhum servidor: o bot precisa estar adicionado ao servidor do Discord. Convide o bot e valide de novo.
              </p>
            )}
            <a
              href={selectedAuthType === 'bot' ? BOT_TOKEN_GUIDE_URL : USER_TOKEN_GUIDE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[var(--fg-faint)] hover:text-[var(--fg)]"
            >
              <ExternalLink size={12} /> {selectedAuthType === 'bot' ? 'Como obter token de bot' : 'Como obter token de usuário/session'}
            </a>
          </div>
        )}

        {step === 'canais' && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {selectedAuthType === 'bot' ? (
                <>
                  <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                    <span>Servidor listado pelo bot</span>
                    <select className={selectClass} value={form.guild_id} onChange={(event) => selectGuild(event.target.value)}>
                      <option value="">Selecionar servidor</option>
                      {guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                    <span>ID do servidor manual</span>
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      value={form.guild_id}
                      onChange={(event) => setManualGuildId(event.target.value.trim())}
                    />
                  </label>
                  <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                    <span>Canal listado pelo bot</span>
                    <select className={selectClass} value={form.channel_id} onChange={(event) => selectChannel(event.target.value)}>
                      <option value="">Selecionar canal</option>
                      {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.parent_name ? `${channel.parent_name} / ` : ''}{channel.name}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                    <span>ID do canal manual</span>
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      value={form.channel_id}
                      onChange={(event) => setForm({ ...form, channel_id: event.target.value.trim() })}
                    />
                  </label>
                  <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                    <span>Nome do canal</span>
                    <input className={inputClass} value={form.channel_name} onChange={(event) => setForm({ ...form, channel_name: event.target.value })} />
                  </label>
                </>
              ) : (
                <>
                  <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                    <span>ID do servidor</span>
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      value={form.guild_id}
                      onChange={(event) => setForm({ ...form, guild_id: event.target.value.trim() })}
                    />
                  </label>
                  <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                    <span>ID do canal</span>
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      value={form.channel_id}
                      onChange={(event) => setForm({ ...form, channel_id: event.target.value.trim() })}
                    />
                  </label>
                  <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                    <span>Nome do canal</span>
                    <input className={inputClass} value={form.channel_name} onChange={(event) => setForm({ ...form, channel_name: event.target.value })} />
                  </label>
                </>
              )}
              <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                <span>Nome do perfil</span>
                <input className={inputClass} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} />
              </label>
            </div>
            {form.guild_id && channels.length === 0 && (
              <p className="text-xs text-[var(--fg-faint)]">
                Sem canais legíveis: o bot precisa de permissão de leitura no servidor escolhido.
              </p>
            )}
            <p className="text-xs text-[var(--fg-faint)]">
              IDs manuais servem quando você já sabe o servidor/canal ou quando está usando token de usuário/session. No Discord, ative o modo desenvolvedor e use "Copiar ID" no servidor ou canal.
              {' '}
              <a href={DISCORD_ID_GUIDE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--color-artificio-orange)] hover:underline">
                <ExternalLink size={12} /> Onde achar IDs
              </a>
            </p>
          </div>
        )}

        {step === 'agenda' && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                <span>Frequência</span>
                <select className={selectClass} value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value as ChatExporterFrequency })}>
                  <option value="hourly">A cada hora</option>
                  <option value="daily">Diário</option>
                  <option value="weekly">Semanal</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                <span>Horário</span>
                <input type="time" className={inputClass} value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
              </label>
              <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                <span>Importar mensagens depois de</span>
                <input type="datetime-local" className={inputClass} value={form.after} onChange={(event) => setForm({ ...form, after: event.target.value })} />
              </label>
              <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                <span>Tópicos</span>
                <select className={selectClass} value={form.include_threads} onChange={(event) => setForm({ ...form, include_threads: event.target.value as ChatExporterIncludeThreads })}>
                  <option value="none">Sem tópicos</option>
                  <option value="active">Tópicos ativos</option>
                  <option value="all">Todos os tópicos</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                <span>Timezone</span>
                <input className={inputClass} value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} />
              </label>
              <label className="flex items-center gap-2 pt-7 text-sm text-[var(--fg-muted)]">
                <input type="checkbox" checked={form.media} onChange={(event) => setForm({ ...form, media: event.target.checked })} />
                Baixar mídia
              </label>
              <label className="flex items-center gap-2 pt-7 text-sm text-[var(--fg-muted)]">
                <input type="checkbox" checked={form.schedule_enabled} onChange={(event) => setForm({ ...form, schedule_enabled: event.target.checked })} />
                Rodar na agenda
              </label>
              <label className="flex items-center gap-2 pt-7 text-sm text-[var(--fg-muted)]">
                <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
                Perfil ativo
              </label>
            </div>
            <p className="text-xs text-[var(--fg-faint)]">
              Ao importar, o backend roda o DiscordChatExporter em JSON, guarda o arquivo numa pasta interna do servidor e chama o mesmo parser do upload manual. O campo "Importar mensagens depois de" vira `--after` na CLI oficial.
              Sem "Rodar na agenda" o perfil só importa quando você clicar em Importar agora.
            </p>
          </div>
        )}

        {/* Navegação do wizard */}
        <div className="mt-5 flex items-center gap-2">
          {step !== 'conectar' && (
            <button
              type="button"
              onClick={() => setStep(step === 'agenda' ? 'canais' : 'conectar')}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-[var(--admin-hover)]"
            >
              <ArrowLeft size={15} /> Voltar
            </button>
          )}
          {step === 'canais' && (
            <button
              type="button"
              onClick={() => setStep('agenda')}
              disabled={!canAdvanceCanais}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-artificio-orange)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Próximo <ArrowRight size={15} />
            </button>
          )}
          {step === 'agenda' && (
            <button
              type="submit"
              disabled={saving || !canAdvanceCanais}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-artificio-orange)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Save size={15} /> {form.id ? 'Salvar alterações' : 'Adicionar canal'}
            </button>
          )}
          {form.id && (
            <button
              type="button"
              onClick={resetWizard}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-[var(--admin-hover)]"
            >
              Novo perfil
            </button>
          )}
        </div>
      </form>

      <AdminTable
        tableId="dce-profiles"
        rows={profiles}
        getRowId={(profile) => profile.id}
        columns={columns}
        searchKeys={[(profile) => `${profile.label} ${profile.guild_name ?? ''} ${profile.channel_name ?? ''}`]}
        searchPlaceholder="Buscar perfil..."
        facets={[
          { key: 'enabled', label: 'Status', options: [{ value: 'true', label: 'Ativo' }, { value: 'false', label: 'Inativo' }], getValue: (profile) => String(profile.enabled) },
          { key: 'schedule', label: 'Agenda', options: [{ value: 'true', label: 'Com agenda' }, { value: 'false', label: 'Manual' }], getValue: (profile) => String(profile.schedule_enabled) },
        ]}
        loading={loading}
        emptyTitle="Nenhum canal configurado"
        emptyHint="Valide o token, escolha servidor/canal e adicione o primeiro perfil."
        onEdit={editProfile}
        rowActions={[
          { key: 'delta', label: 'Ver novidades', icon: <RadioTower size={15} />, hidden: (profile) => busyProfileId === profile.id || effectiveAuthType(profile, config) === 'user', onRun: checkDelta },
          { key: 'test', label: 'Testar', icon: <TestTube2 size={15} />, hidden: (profile) => busyProfileId === profile.id, onRun: testProfile },
          { key: 'run', label: 'Importar agora', icon: <Play size={15} />, hidden: (profile) => busyProfileId === profile.id, onRun: runProfile },
          { key: 'delete', label: 'Apagar', icon: <Trash2 size={15} />, tone: 'danger', onRun: deleteProfile },
        ]}
      />
    </div>
  );
}
