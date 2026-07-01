import { useCallback, useEffect, useMemo, useState } from 'react';
import { Play, RefreshCw, Save, TestTube2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminTable, StatusPill } from '../../admin/components/ui';
import { discordSyncApi } from '../api/discordSyncApi';
import type {
  ChatExporterFrequency,
  ChatExporterIncludeThreads,
  ChatExporterProfile,
  DiscordDiscoveredChannel,
  DiscordDiscoveredGuild,
} from '../types';

type ProfileForm = {
  id: string | null;
  label: string;
  guild_id: string;
  guild_name: string;
  channel_id: string;
  channel_name: string;
  token: string;
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
  token: '',
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
    token: '',
    include_threads: profile.include_threads,
    after: profile.after ? profile.after.slice(0, 10) : '',
    media: profile.media,
    schedule_enabled: profile.schedule_enabled,
    frequency: profile.frequency,
    time: profile.time,
    timezone: profile.timezone,
    enabled: profile.enabled,
  };
}

function formatDate(value: string | null): string {
  if (!value) return 'Nunca';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Nunca' : date.toLocaleString('pt-BR');
}

function statusTone(status: string | null): 'neutral' | 'success' | 'danger' | 'warn' {
  if (status === 'success') return 'success';
  if (status === 'error') return 'danger';
  if (status === 'running') return 'warn';
  return 'neutral';
}

export function ChatExporterProfilesPanel() {
  const [profiles, setProfiles] = useState<ChatExporterProfile[]>([]);
  const [guilds, setGuilds] = useState<DiscordDiscoveredGuild[]>([]);
  const [channels, setChannels] = useState<DiscordDiscoveredChannel[]>([]);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      setProfiles(await discordSyncApi.getChatExporterProfiles());
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

  const discoverGuilds = async () => {
    try {
      const next = await discordSyncApi.discoverGuilds();
      setGuilds(next);
      toast.success(`${next.length} servidor(es) encontrados.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao validar token/listar servidores.');
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
    setSaving(true);
    try {
      const payload = {
        label: form.label,
        guild_id: form.guild_id,
        guild_name: form.guild_name || null,
        channel_id: form.channel_id,
        channel_name: form.channel_name || null,
        token: form.token.trim() || undefined,
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
      setForm(EMPTY_FORM);
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

  const runProfile = async (profile: ChatExporterProfile) => {
    setBusyProfileId(profile.id);
    try {
      const result = await discordSyncApi.runChatExporterProfile(profile.id);
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
    await discordSyncApi.deleteChatExporterProfile(profile.id);
    await loadProfiles();
    toast.success('Perfil apagado.');
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
      key: 'status',
      header: 'Saúde',
      render: (profile: ChatExporterProfile) => (
        <div className="flex flex-col gap-1">
          <StatusPill tone={profile.enabled ? statusTone(profile.last_status) : 'neutral'}>
            {profile.enabled ? profile.last_status ?? 'sem run' : 'desativado'}
          </StatusPill>
          {profile.last_error && <span className="text-xs text-[var(--danger-soft)]">{profile.last_error}</span>}
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
      header: 'Última run',
      render: (profile: ChatExporterProfile) => formatDate(profile.last_run_at),
    },
  ], []);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--admin-surface)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void discoverGuilds()}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-[var(--admin-hover)]"
          >
            <RefreshCw size={15} /> Validar token e listar servidores
          </button>
          <span className="text-xs text-[var(--fg-faint)]">Use o token global salvo em Bot de Discord. Token por perfil é opcional.</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm text-[var(--fg-muted)]">
            <span>Servidor</span>
            <select className="app-select w-full rounded-lg border border-[var(--border)] bg-[var(--surface-input)] px-3 py-2 text-[var(--fg)]" value={form.guild_id} onChange={(event) => selectGuild(event.target.value)}>
              <option value="">Selecionar servidor</option>
              {guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm text-[var(--fg-muted)]">
            <span>Canal</span>
            <select className="app-select w-full rounded-lg border border-[var(--border)] bg-[var(--surface-input)] px-3 py-2 text-[var(--fg)]" value={form.channel_id} onChange={(event) => selectChannel(event.target.value)}>
              <option value="">Selecionar canal</option>
              {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.parent_name ? `${channel.parent_name} / ` : ''}{channel.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm text-[var(--fg-muted)]">
            <span>Nome do perfil</span>
            <input className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-input)] px-3 py-2 text-[var(--fg)]" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} />
          </label>
          <label className="space-y-1 text-sm text-[var(--fg-muted)]">
            <span>Depois de</span>
            <input type="date" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-input)] px-3 py-2 text-[var(--fg)]" value={form.after} onChange={(event) => setForm({ ...form, after: event.target.value })} />
          </label>
          <label className="space-y-1 text-sm text-[var(--fg-muted)]">
            <span>Frequência</span>
            <select className="app-select w-full rounded-lg border border-[var(--border)] bg-[var(--surface-input)] px-3 py-2 text-[var(--fg)]" value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value as ChatExporterFrequency })}>
              <option value="hourly">A cada hora</option>
              <option value="daily">Diário</option>
              <option value="weekly">Semanal</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-[var(--fg-muted)]">
            <span>Horário</span>
            <input type="time" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-input)] px-3 py-2 text-[var(--fg)]" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
          </label>
          <label className="space-y-1 text-sm text-[var(--fg-muted)]">
            <span>Token do perfil</span>
            <input type="password" autoComplete="new-password" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-input)] px-3 py-2 text-[var(--fg)]" value={form.token} onChange={(event) => setForm({ ...form, token: event.target.value })} />
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

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => void save()} disabled={saving || !form.guild_id || !form.channel_id || !form.label} className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-artificio-orange)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            <Save size={15} /> {form.id ? 'Salvar alterações' : 'Adicionar canal'}
          </button>
          {form.id && (
            <button type="button" onClick={() => setForm(EMPTY_FORM)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-[var(--admin-hover)]">
              Novo perfil
            </button>
          )}
        </div>
      </div>

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
        onEdit={(profile) => {
          setForm(profileToForm(profile));
          void loadChannels(profile.guild_id);
        }}
        rowActions={[
          { key: 'test', label: 'Testar', icon: <TestTube2 size={15} />, hidden: (profile) => busyProfileId === profile.id, onRun: testProfile },
          { key: 'run', label: 'Importar agora', icon: <Play size={15} />, hidden: (profile) => busyProfileId === profile.id, onRun: runProfile },
          { key: 'delete', label: 'Apagar', icon: <Trash2 size={15} />, tone: 'danger', onRun: deleteProfile },
        ]}
      />
    </div>
  );
}
