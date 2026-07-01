import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Loader2, Play, RefreshCw, RadioTower, Save, TestTube2, Trash2, XCircle } from 'lucide-react';
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

type TokenStatus = { state: 'idle' | 'testing' | 'ok' | 'error'; message?: string };

// Indicador inline verde/vermelho da validação automática de token (sem botão).
function TokenStatusBadge({ status }: { status: TokenStatus }) {
  if (status.state === 'idle') return null;
  if (status.state === 'testing') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[var(--fg-faint)]">
        <Loader2 size={13} className="animate-spin" /> Validando...
      </span>
    );
  }
  if (status.state === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
        <CheckCircle2 size={13} /> {status.message ?? 'Token válido'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--danger-soft)]">
      <XCircle size={13} /> {status.message ?? 'Token inválido'}
    </span>
  );
}

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
    after: profile.after ? toDateTimeLocal(profile.after, profile.timezone) : '',
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

// Formata o instante UTC salvo como horário de parede no timezone do perfil,
// pra reexibir o mesmo valor que o backend gravou (E-tz-after) em vez do fuso do navegador.
function toDateTimeLocal(value: string, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(date);
    const map: Record<string, string> = {};
    for (const part of parts) map[part.type] = part.value;
    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
  } catch {
    const offsetMs = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  }
}

// Link do Discord (desktop/web): https://discord.com/channels/<guild>/<channel>[/<message>]
const DISCORD_CHANNEL_LINK_RE = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/(\d{5,30})\/(\d{5,30})(?:\/\d+)?\/?(?:\?.*)?$/;

function parseDiscordChannelLink(value: string): { guildId: string; channelId: string } | null {
  const match = DISCORD_CHANNEL_LINK_RE.exec(value.trim());
  if (!match) return null;
  return { guildId: match[1], channelId: match[2] };
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
  const [channelLink, setChannelLink] = useState('');
  const [step, setStep] = useState<WizardStep>('conectar');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [globalTokenStatus, setGlobalTokenStatus] = useState<TokenStatus>({ state: 'idle' });
  const [profileTokenStatus, setProfileTokenStatus] = useState<TokenStatus>({ state: 'idle' });
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

  // Validação automática: dispara no onBlur do campo de token (sem botão).
  // Testa o token cru (user/session "cookie" ou bot) contra o Discord de verdade
  // (GET /users/@me) e loga o erro real no console do navegador (rastreio).
  const testTokenOnBlur = async (token: string, authType: 'user' | 'bot', scope: 'global' | 'profile') => {
    const setStatus = scope === 'global' ? setGlobalTokenStatus : setProfileTokenStatus;
    if (!token.trim()) {
      setStatus({ state: 'idle' });
      return;
    }
    setStatus({ state: 'testing' });
    try {
      const result = await discordSyncApi.validateChatExporterToken(token, authType);
      setStatus({ state: 'ok', message: `Conectado como ${result.username}` });
    } catch (error) {
      console.error('[ChatExporterProfilesPanel] validação de token falhou', { scope, authType, error });
      setStatus({ state: 'error', message: error instanceof Error ? error.message : 'Erro ao validar token.' });
    }
  };

  // Token bot próprio do perfil (ainda não salvo) tem prioridade sobre o bot token
  // global salvo — sem isso, um perfil novo com "Token de bot" próprio não listava
  // nada até salvar (a descoberta usava sempre o bot token global das settings).
  const discoverGuilds = async (authTypeOverride?: 'user' | 'bot') => {
    if ((authTypeOverride ?? selectedAuthType) !== 'bot') {
      toast.error('A listagem automática de servidores usa token de bot. Para usuário/session, informe o ID do canal.');
      return;
    }
    setConnecting(true);
    try {
      const next = await discordSyncApi.discoverGuilds(form.token.trim() || undefined);
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
      setChannels(await discordSyncApi.discoverChannels(guildId, form.token.trim() || undefined));
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

  const applyChannelLink = () => {
    const parsed = parseDiscordChannelLink(channelLink);
    if (!parsed) {
      toast.error('Link inválido. Copie o link do canal no Discord (botão direito → Copiar link).');
      return;
    }
    setForm((current) => ({ ...current, guild_id: parsed.guildId, channel_id: parsed.channelId }));
    setChannelLink('');
    toast.success('Servidor e canal preenchidos a partir do link.');
    if (selectedAuthType === 'bot') void loadChannels(parsed.guildId);
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
    // Usa o authType do próprio profile (não o closure de `form`, que só atualiza no próximo render).
    if (effectiveAuthType(profile, config) === 'bot') {
      if (guilds.length === 0) void discoverGuilds('bot');
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
              onChange={(event) => {
                setGlobalUserToken(event.target.value);
                setGlobalTokenStatus({ state: 'idle' });
              }}
              onBlur={(event) => void testTokenOnBlur(event.target.value, 'user', 'global')}
            />
            <TokenStatusBadge status={globalTokenStatus} />
          </label>
          <label className="flex items-center gap-2 pt-7 text-sm text-[var(--fg-muted)]">
            <input
              type="checkbox"
              checked={clearGlobalUserToken}
              onChange={(event) => {
                setClearGlobalUserToken(event.target.checked);
                if (event.target.checked) setGlobalUserToken('');
              }}
            />
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
          // Enter em qualquer campo dispara submit nativo do <form> — só salva de
          // fato no passo final; nos passos anteriores, Enter avança (como "Próximo").
          if (step !== 'agenda') {
            if (canAdvanceCanais || step === 'conectar') setStep(step === 'conectar' ? 'canais' : 'agenda');
            return;
          }
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
                  onChange={(event) => {
                    setForm({ ...form, token: event.target.value });
                    setProfileTokenStatus({ state: 'idle' });
                  }}
                  onBlur={(event) => { if (!form.clearToken) void testTokenOnBlur(event.target.value, selectedAuthType, 'profile'); }}
                />
                <TokenStatusBadge status={profileTokenStatus} />
              </label>
              {form.id && (
                <label className="flex items-center gap-2 pt-7 text-sm text-[var(--fg-muted)]">
                  <input type="checkbox" checked={form.clearToken} onChange={(event) => setForm({ ...form, clearToken: event.target.checked, token: event.target.checked ? '' : form.token })} />
                  Remover token próprio
                </label>
              )}
            </div>
            <p className="text-sm text-[var(--fg-muted)]">
              <strong>Token de usuário/session</strong> é como um "cookie de login" da sua própria conta do Discord — com ele o importador enxerga só o que a sua conta já vê, sem precisar convidar bot nenhum, mas é uma credencial sensível: não compartilhe. <strong>Token de bot</strong> é do aplicativo Discord que você criou e convidou ao servidor; com ele dá para listar servidores e canais automaticamente aqui no painel.
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
            <div className="rounded-lg border border-dashed border-[var(--border)] p-3">
              <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                <span>Colar link do canal (opcional — preenche servidor e canal sozinho)</span>
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="https://discord.com/channels/1012.../1012..."
                    value={channelLink}
                    onChange={(event) => setChannelLink(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        applyChannelLink();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={applyChannelLink}
                    disabled={!channelLink.trim()}
                    className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-[var(--admin-hover)] disabled:opacity-50"
                  >
                    Usar link
                  </button>
                </div>
              </label>
              <p className="mt-1 text-xs text-[var(--fg-faint)]">
                No Discord (app ou web), clique com o botão direito no canal → "Copiar link" e cole aqui. Extraímos o servidor e o canal automaticamente.
              </p>
            </div>
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
              O <strong>servidor</strong> é a comunidade do Discord (aparece na barra lateral esquerda); o <strong>canal</strong> é a conversa dentro dela (barra do meio, ex.: #geral). Prefira colar o link do canal acima — ele já traz os dois. Se preferir IDs manuais, ative o modo desenvolvedor no Discord e use "Copiar ID" no servidor ou canal.
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
          {step === 'conectar' && (
            <button
              type="button"
              onClick={() => setStep('canais')}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-artificio-orange)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Próximo <ArrowRight size={15} />
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
