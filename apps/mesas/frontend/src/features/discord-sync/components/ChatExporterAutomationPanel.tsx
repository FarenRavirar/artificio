import { useEffect, useState } from 'react';
import { Clock, Loader2, Play, Save, ShieldCheck, TestTube2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { discordSyncApi } from '../api/discordSyncApi';
import type { ChatExporterConfig, ChatExporterFrequency, ChatExporterRunResult, ChatExporterTestResult } from '../types';

const DEFAULT_FORM = {
  enabled: false,
  frequency: 'daily' as ChatExporterFrequency,
  time: '03:20',
  timezone: 'America/Sao_Paulo',
  importDir: '',
  channelId: '',
  after: '',
};

function toForm(config: ChatExporterConfig) {
  return {
    enabled: Boolean(config.enabled),
    frequency: config.frequency ?? DEFAULT_FORM.frequency,
    time: config.time ?? DEFAULT_FORM.time,
    timezone: config.timezone ?? DEFAULT_FORM.timezone,
    importDir: config.importDir ?? '',
    channelId: config.channelId ?? '',
    after: config.after ?? '',
  };
}

function statusLabel(config: ChatExporterConfig | null): string {
  if (!config) return 'Carregando';
  if (!config.enabled) return 'Agenda desativada';
  return `Agenda ativa: ${config.frequency ?? 'daily'} ${config.time ?? '03:20'} ${config.timezone ?? 'America/Sao_Paulo'}`;
}

export function ChatExporterAutomationPanel() {
  const [config, setConfig] = useState<ChatExporterConfig | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [token, setToken] = useState('');
  const [cookies, setCookies] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [running, setRunning] = useState(false);
  const [testResult, setTestResult] = useState<ChatExporterTestResult | null>(null);
  const [runResult, setRunResult] = useState<ChatExporterRunResult | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const next = await discordSyncApi.getChatExporterConfig();
        if (!active) return;
        setConfig(next);
        setForm(toForm(next));
      } catch (err) {
        if (!active) return;
        toast.error(err instanceof Error ? err.message : 'Erro ao carregar ChatExporter.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const next = await discordSyncApi.saveChatExporterConfig({
        ...form,
        after: form.after || undefined,
        token: token.trim() || undefined,
        cookies: cookies.trim() || undefined,
      });
      setConfig(next);
      setForm(toForm(next));
      setToken('');
      setCookies('');
      setTestResult(null);
      toast.success('ChatExporter salvo.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar ChatExporter.');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const result = await discordSyncApi.testChatExporterConfig();
      setTestResult(result);
      toast[result.ok ? 'success' : 'error'](result.ok ? 'Simulação OK.' : 'Simulação falhou.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao testar ChatExporter.');
    } finally {
      setTesting(false);
    }
  };

  const run = async () => {
    setRunning(true);
    try {
      const result = await discordSyncApi.runChatExporterNow();
      setRunResult(result);
      toast.success('Execução manual concluída.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao executar ChatExporter.');
    } finally {
      setRunning(false);
    }
  };

  const clearSecret = async (which: 'token' | 'cookies') => {
    setSaving(true);
    try {
      const next = await discordSyncApi.saveChatExporterConfig({
        clearToken: which === 'token',
        clearCookies: which === 'cookies',
      });
      setConfig(next);
      setForm(toForm(next));
      if (which === 'token') setToken('');
      else setCookies('');
      toast.success(which === 'token' ? 'Token removido.' : 'Cookies removidos.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover segredo.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-white/40 text-sm py-4 text-center">Carregando...</p>;

  return (
    <div className="space-y-5 border-t border-white/10 pt-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${form.enabled ? 'bg-green-700/30 text-green-200' : 'bg-white/10 text-white/70'}`}>
          {form.enabled ? <ShieldCheck size={16} /> : <Clock size={16} />}
          {statusLabel(config)}
        </span>
        {config?.token.is_set && (
          <span className="inline-flex items-center gap-2 font-mono text-sm text-white/60">
            token {config.token.preview}
            <button type="button" onClick={() => clearSecret('token')} disabled={saving} className="font-sans text-xs text-red-300 hover:text-red-200 disabled:opacity-60 underline">remover</button>
          </span>
        )}
        {config?.cookies.is_set && (
          <span className="inline-flex items-center gap-2 font-mono text-sm text-white/60">
            cookies {config.cookies.preview}
            <button type="button" onClick={() => clearSecret('cookies')} disabled={saving} className="font-sans text-xs text-red-300 hover:text-red-200 disabled:opacity-60 underline">remover</button>
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-white/80">
          <span>Canal Discord</span>
          <input className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white outline-none focus:border-blue-500" value={form.channelId} onChange={(event) => setForm({ ...form, channelId: event.target.value })} />
        </label>
        <label className="space-y-2 text-sm text-white/80">
          <span>Pasta de importação</span>
          <input className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white outline-none focus:border-blue-500" value={form.importDir} onChange={(event) => setForm({ ...form, importDir: event.target.value })} />
        </label>
        <label className="space-y-2 text-sm text-white/80">
          <span>Depois de</span>
          <input className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white outline-none focus:border-blue-500" value={form.after} onChange={(event) => setForm({ ...form, after: event.target.value })} placeholder="2026-06-01" />
        </label>
        <label className="space-y-2 text-sm text-white/80">
          <span>Frequência</span>
          <select className="w-full px-3 py-2 bg-[#101a33] border border-white/10 rounded-lg text-white outline-none focus:border-blue-500" value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value as ChatExporterFrequency })}>
            <option value="hourly">A cada hora</option>
            <option value="daily">Diário</option>
            <option value="weekly">Semanal</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-white/80">
          <span>Horário</span>
          <input type="time" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white outline-none focus:border-blue-500" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
        </label>
        <label className="space-y-2 text-sm text-white/80">
          <span>Timezone</span>
          <input className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white outline-none focus:border-blue-500" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} />
        </label>
        <label className="flex items-center gap-3 text-sm text-white/80 pt-7">
          <input type="checkbox" className="h-4 w-4" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
          Habilitar agenda em beta
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-white/80">
          <span>Token DiscordChatExporter</span>
          <input type="password" autoComplete="new-password" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white outline-none focus:border-blue-500" value={token} onChange={(event) => setToken(event.target.value)} />
        </label>
        <label className="space-y-2 text-sm text-white/80">
          <span>Cookies</span>
          <input type="password" autoComplete="new-password" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white outline-none focus:border-blue-500" value={cookies} onChange={(event) => setCookies(event.target.value)} />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm rounded-lg transition-colors">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar
        </button>
        <button type="button" onClick={test} disabled={testing} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-60 text-white text-sm rounded-lg transition-colors">
          {testing ? <Loader2 size={16} className="animate-spin" /> : <TestTube2 size={16} />}
          Testar
        </button>
        <button type="button" onClick={run} disabled={running} className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-sm rounded-lg transition-colors">
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Executar agora
        </button>
      </div>

      {testResult && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-white/70">
          <p className={testResult.ok ? 'text-green-200' : 'text-red-200'}>{testResult.ok ? 'OK' : testResult.errors.join(' | ')}</p>
          {testResult.command && <p className="mt-2 font-mono text-xs break-all">{testResult.command}</p>}
        </div>
      )}

      {runResult && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-white/70">
          <p>Arquivo: <span className="font-mono text-xs">{runResult.exported.outputPath}</span></p>
          <p>Importação: {runResult.imported.processed} processados, {runResult.imported.errors} erros.</p>
        </div>
      )}
    </div>
  );
}
