import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { discordSyncApi } from '../api/discordSyncApi';
import type { DiscordSettings } from '../types';

const EMPTY_SETTINGS: DiscordSettings = {
  bot_token: {
    is_set: false,
    preview: null,
    updated_at: null,
  },
};

function validateToken(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Informe o token antes de salvar.';
  if (/\s/.test(trimmed)) return 'O token não pode conter espaços.';
  if (trimmed.length < 50) return 'O token precisa ter pelo menos 50 caracteres.';
  return null;
}

export function DiscordSettingsPanel() {
  const [settings, setSettings] = useState<DiscordSettings>(EMPTY_SETTINGS);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    try {
      setSettings(await discordSyncApi.getDiscordSettings());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar configuração do Discord.');
      setSettings(EMPTY_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => { await loadSettings(); })();
  }, []);

  const handleSave = async () => {
    const error = validateToken(token);
    setValidationMessage(error);
    if (error) return;

    setSaving(true);
    try {
      const nextSettings = await discordSyncApi.saveDiscordBotToken({ token: token.trim() });
      setSettings({ bot_token: nextSettings });
      setToken('');
      setConfirmRemove(false);
      toast.success('Token salvo.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar token.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await discordSyncApi.deleteDiscordBotToken();
      setSettings(EMPTY_SETTINGS);
      setConfirmRemove(false);
      toast.success('Token removido.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover token.');
    } finally {
      setRemoving(false);
    }
  };

  const status = settings.bot_token;

  if (loading) {
    return <p className="text-white/40 text-sm py-4 text-center">Carregando...</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {status.is_set ? (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-700/30 text-green-200 text-sm">
            <ShieldCheck size={16} />
            Bot configurado
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-700/30 text-yellow-200 text-sm">
            <AlertTriangle size={16} />
            Token não configurado
          </span>
        )}

        {status.preview && (
          <span className="font-mono text-sm text-white/70">{status.preview}</span>
        )}

        {status.updated_at && (
          <span className="text-xs text-white/40">
            Atualizado em {new Date(status.updated_at).toLocaleString('pt-BR')}
          </span>
        )}
      </div>

      <div className="max-w-xl space-y-3">
        <label className="block text-sm font-medium text-white/80" htmlFor="discord-bot-token">
          Token do bot Discord
        </label>
        <input
          id="discord-bot-token"
          type="password"
          value={token}
          onChange={(event) => {
            setToken(event.target.value);
            setValidationMessage(null);
          }}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-blue-500"
          autoComplete="new-password"
        />
        {validationMessage && <p className="text-sm text-red-300">{validationMessage}</p>}
        <p className="text-sm text-white/50">
          Se nenhum token estiver configurado aqui, o sistema usa a variável de ambiente `DISCORD_BOT_TOKEN`.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm rounded-lg transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar token
        </button>

        {status.is_set && !confirmRemove && (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
          >
            <Trash2 size={16} />
            Remover token
          </button>
        )}
      </div>

      {status.is_set && confirmRemove && (
        <div className="border border-red-400/30 bg-red-950/30 rounded-lg p-4 max-w-xl">
          <p className="text-sm text-red-100 mb-3">
            Remover o token salvo fará a sincronização usar apenas a variável de ambiente, se ela existir.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm rounded-lg transition-colors"
            >
              {removing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Confirmar remoção
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemove(false)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
            >
              <X size={16} />
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
