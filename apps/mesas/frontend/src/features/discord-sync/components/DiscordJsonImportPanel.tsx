import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { discordSyncApi } from '../api/discordSyncApi';

type ImportState = 'empty' | 'typing' | 'sending' | 'success' | 'error';

interface ImportResult {
  total: number;
  inserted: number;
  updated: number;
  ignored: number;
}

export function DiscordJsonImportPanel() {
  const [rawJson, setRawJson] = useState('');
  const [state, setState] = useState<ImportState>('empty');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = useCallback((value: string) => {
    setRawJson(value);
    setState(value ? 'typing' : 'empty');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!rawJson.trim()) return;

    setState('sending');
    setErrorMessage('');

    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        setState('error');
        setErrorMessage('JSON inválido. Verifique a formatação.');
        return;
      }

      const data = await discordSyncApi.importJson(parsed);
      setResult(data);
      setState('success');
      toast.success(`${data.inserted} mensagens importadas, ${data.updated} atualizadas.`);
    } catch (err) {
      setState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao importar JSON.');
    }
  }, [rawJson]);

  const handleClear = useCallback(() => {
    setRawJson('');
    setState('empty');
    setResult(null);
    setErrorMessage('');
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white/5 border border-white/10 p-4 space-y-3">
        <h3 className="text-white font-semibold">Importar JSON do DiscordChatExporter</h3>
        <p className="text-white/50 text-xs">
          Cole o conteúdo do arquivo JSON exportado pelo DiscordChatExporter.
          O sistema vai importar as mensagens para revisão.
        </p>

        <textarea
          value={rawJson}
          onChange={(e) => handleChange(e.target.value)}
          placeholder='Cole o JSON aqui...'
          className="w-full min-h-[280px] resize-y bg-[#0F1A2E] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none"
        />

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={state === 'sending' || state === 'empty'}
            className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
          >
            {state === 'sending' ? 'Importando...' : 'Importar'}
          </button>
          <button
            onClick={handleClear}
            disabled={state === 'sending'}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors disabled:opacity-40"
          >
            Limpar
          </button>
        </div>
      </div>

      {state === 'success' && result && (
        <div className="rounded-lg bg-green-900/20 border border-green-600/30 p-4 space-y-3">
          <p className="text-green-300 font-semibold">Importação concluída</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <p className="text-white/40 text-xs">Total</p>
              <p className="text-white text-lg font-bold">{result.total}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <p className="text-white/40 text-xs">Importadas</p>
              <p className="text-green-300 text-lg font-bold">{result.inserted}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <p className="text-white/40 text-xs">Atualizadas</p>
              <p className="text-blue-300 text-lg font-bold">{result.updated}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <p className="text-white/40 text-xs">Ignoradas</p>
              <p className="text-white/70 text-lg font-bold">{result.ignored}</p>
            </div>
          </div>
          <p className="text-white/50 text-xs">
            As mensagens importadas estão na aba <strong>Mensagens</strong> com status "Pendente".
            Use o botão "Apurar todas pendentes" para gerar drafts.
          </p>
        </div>
      )}

      {state === 'error' && errorMessage && (
        <div className="rounded-lg bg-red-900/20 border border-red-600/30 p-3">
          <p className="text-red-300 text-sm">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
