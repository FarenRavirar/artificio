import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Play, RefreshCw, RadioTower, Save, TestTube2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminTable, StatusPill } from '../../admin/components/ui';
import { formatDateTime } from '../../admin/utils/format';
import { discordSyncApi } from '../api/discordSyncApi';
import type {
  ChatExporterFrequency,
  ChatExporterIncludeThreads,
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

const TOKEN_GUIDE_URL = 'https://discord.com/developers/applications';

type ProfileForm = {
  id: string | null;
  label: string;
  guild_id: string;
  guild_name: string;
  channel_id: string;
  channel_name: string;
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
    token: '',
    clearToken: false,
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

const inputClass = 'w-full rounded-lg border border-[var(--border)] bg-[var(--surface-input)] px-3 py-2 text-[var(--fg)]';
const selectClass = `app-select ${inputClass}`;

export function ChatExporterProfilesPanel() {
  const [profiles, setProfiles] = useState<ChatExporterProfile[]>([]);
  const [guilds, setGuilds] = useState<DiscordDiscoveredGuild[]>([]);
  const [channels, setChannels] = useState<DiscordDiscoveredChannel[]>([]);
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

  const resetWizard = () => {
    setForm(EMPTY_FORM);
    setStep('conectar');
    setChannels([]);
  };

  const discoverGuilds = async () => {
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
    if (guilds.length === 0) void discoverGuilds();
    void loadChannels(profile.guild_id);
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
  ], [deltas]);

  const canAdvanceCanais = Boolean(form.guild_id && form.channel_id && form.label);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--admin-surface)] p-4">
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
            <p className="text-sm text-[var(--fg-muted)]">
              O bot usa o <strong>token global</strong> salvo em Bot de Discord. Valide-o para listar seus servidores.
            </p>
            <button
              type="button"
              onClick={() => void discoverGuilds()}
              disabled={connecting}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-[var(--admin-hover)] disabled:opacity-50"
            >
              <RefreshCw size={15} className={connecting ? 'animate-spin' : ''} /> {connecting ? 'Validando...' : 'Validar token e listar servidores'}
            </button>
            {connected && guilds.length === 0 && (
              <p className="text-sm text-[var(--danger-soft)]">
                Nenhum servidor: o bot precisa estar adicionado ao servidor do Discord. Convide o bot e valide de novo.
              </p>
            )}
            <a
              href={TOKEN_GUIDE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[var(--fg-faint)] hover:text-[var(--fg)]"
            >
              <ExternalLink size={12} /> Como obter o token do bot (Discord Developer Portal)
            </a>
          </div>
        )}

        {step === 'canais' && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                <span>Servidor</span>
                <select className={selectClass} value={form.guild_id} onChange={(event) => selectGuild(event.target.value)}>
                  <option value="">Selecionar servidor</option>
                  {guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm text-[var(--fg-muted)]">
                <span>Canal</span>
                <select className={selectClass} value={form.channel_id} onChange={(event) => selectChannel(event.target.value)}>
                  <option value="">Selecionar canal</option>
                  {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.parent_name ? `${channel.parent_name} / ` : ''}{channel.name}</option>)}
                </select>
              </label>
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
                <span>Importar depois de</span>
                <input type="date" className={inputClass} value={form.after} onChange={(event) => setForm({ ...form, after: event.target.value })} />
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
                <span>Token do perfil (opcional)</span>
                <input type="password" autoComplete="new-password" className={inputClass} value={form.token} disabled={form.clearToken} onChange={(event) => setForm({ ...form, token: event.target.value })} />
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
              {form.id && (
                <label className="flex items-center gap-2 pt-7 text-sm text-[var(--fg-muted)]">
                  <input type="checkbox" checked={form.clearToken} onChange={(event) => setForm({ ...form, clearToken: event.target.checked, token: event.target.checked ? '' : form.token })} />
                  Remover token salvo
                </label>
              )}
            </div>
            <p className="text-xs text-[var(--fg-faint)]">
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
              type="button"
              onClick={() => void save()}
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
        onEdit={editProfile}
        rowActions={[
          { key: 'delta', label: 'Ver novidades', icon: <RadioTower size={15} />, hidden: (profile) => busyProfileId === profile.id, onRun: checkDelta },
          { key: 'test', label: 'Testar', icon: <TestTube2 size={15} />, hidden: (profile) => busyProfileId === profile.id, onRun: testProfile },
          { key: 'run', label: 'Importar agora', icon: <Play size={15} />, hidden: (profile) => busyProfileId === profile.id, onRun: runProfile },
          { key: 'delete', label: 'Apagar', icon: <Trash2 size={15} />, tone: 'danger', onRun: deleteProfile },
        ]}
      />
    </div>
  );
}
