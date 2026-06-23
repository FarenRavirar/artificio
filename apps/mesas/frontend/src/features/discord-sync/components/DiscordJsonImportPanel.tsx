import { useCallback, useEffect, useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { discordSyncApi } from '../api/discordSyncApi';

type ImportState = 'empty' | 'previewing' | 'preview_ok' | 'preview_error' | 'sending' | 'success' | 'error';

interface ImportResult {
  total: number;
  inserted: number;
  updated: number;
  ignored: number;
  failed: number;
}

interface PreviewResult {
  guild: { id: string; name: string };
  channel: { id: string; name: string };
  dateRange: { after?: string; before?: string } | null;
  exportedAt: string | null;
  messageCount: number;
  messagesWithAttachments: number;
  messagesWithEmbeds: number;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DiscordJsonImportPanelProps {
  onNavigateToDrafts?: () => void;
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    reader.readAsText(file);
  });
}

export function DiscordJsonImportPanel({ onNavigateToDrafts }: DiscordJsonImportPanelProps) {
  const [rawJson, setRawJson] = useState('');
  const [state, setState] = useState<ImportState>('empty');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPreview = useCallback(async (json: string) => {
    if (!json.trim()) {
      setState('empty');
      setPreview(null);
      return;
    }

    setState('previewing');
    setPreview(null);
    setErrorMessage('');

    try {
      const data = await discordSyncApi.previewJson({ json });
      setPreview(data);
      setState('preview_ok');
    } catch (err) {
      setPreview(null);
      setState('preview_error');
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao analisar JSON.');
    }
  }, []);

  const schedulePreview = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadPreview(value), 400);
    setRawJson(value);
  }, [loadPreview]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = useCallback((value: string) => {
    schedulePreview(value);
  }, [schedulePreview]);

  const handleSubmit = useCallback(async () => {
    if (!rawJson.trim()) return;

    setState('sending');
    setErrorMessage('');

    try {
      const data = await discordSyncApi.importJson({ json: rawJson });
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
    setPreview(null);
    setResult(null);
    setErrorMessage('');
  }, []);

  const handleFileSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setErrorMessage('Formato inválido. Selecione um arquivo .json.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`Arquivo muito grande (${formatFileSize(file.size)}). O limite é 10 MB.`);
      return;
    }

    readText(file)
      .then((content) => {
        schedulePreview(content);
      })
      .catch(() => {
        setErrorMessage('Erro ao ler o arquivo. Tente novamente.');
      });
  }, [schedulePreview]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setErrorMessage('Formato inválido. Solte apenas arquivos .json.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`Arquivo muito grande (${formatFileSize(file.size)}). O limite é 10 MB.`);
      return;
    }

    readText(file)
      .then((content) => {
        schedulePreview(content);
      })
      .catch(() => {
        setErrorMessage('Erro ao ler o arquivo. Tente novamente.');
      });
  }, [schedulePreview]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white/5 border border-white/10 p-4 space-y-3">
        <h3 className="text-white font-semibold">Importar JSON do DiscordChatExporter</h3>
        <p className="text-white/50 text-xs">
          Cole o conteúdo do arquivo JSON exportado pelo DiscordChatExporter,
          ou arraste e solte um arquivo .json para importar.
          O sistema vai importar as mensagens para revisão.
        </p>

        <div
          role="region"
          aria-label="Área de importação de JSON"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-lg border-2 border-dashed p-4 transition-colors ${
            isDragOver
              ? 'border-green-400 bg-green-900/20'
              : 'border-white/10 bg-transparent'
          }`}
        >
          {isDragOver && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-green-400 font-semibold text-sm">Solte o arquivo aqui</p>
            </div>
          )}

          <textarea
            id="discord-json-input"
            value={rawJson}
            onChange={(e) => handleChange(e.target.value)}
            placeholder='Cole o JSON aqui...'
            aria-label="JSON do DiscordChatExporter"
            className="w-full min-h-[280px] resize-y bg-[#0F1A2E] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none"
          />
        </div>

          <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileSelect}
          aria-label="Selecionar arquivo JSON do DiscordChatExporter"
          className="hidden"
        />

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={state !== 'preview_ok' && state !== 'success'}
            className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
          >
            {state === 'sending' ? 'Importando...' : 'Importar'}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Selecionar arquivo
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

      {state === 'previewing' && (
        <div className="rounded-lg bg-blue-900/20 border border-blue-600/30 p-3">
          <p className="text-blue-300 text-sm">Analisando JSON...</p>
        </div>
      )}

      {state === 'preview_ok' && preview && (
        <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-2">
          <p className="text-white font-semibold text-sm">Pré-visualização</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-white/40">Servidor</p>
              <p className="text-white">{preview.guild.name}</p>
            </div>
            <div>
              <p className="text-white/40">Canal</p>
              <p className="text-white">{preview.channel.name}</p>
            </div>
            <div>
              <p className="text-white/40">Mensagens</p>
              <p className="text-white">{preview.messageCount}</p>
            </div>
            <div>
              <p className="text-white/40">Com anexos</p>
              <p className="text-white">{preview.messagesWithAttachments}</p>
            </div>
            <div>
              <p className="text-white/40">Com embeds</p>
              <p className="text-white">{preview.messagesWithEmbeds}</p>
            </div>
            <div>
              <p className="text-white/40">Exportado em</p>
              <p className="text-white">{preview.exportedAt ?? 'N/A'}</p>
            </div>
            {preview.dateRange && (
              <>
                <div>
                  <p className="text-white/40">De</p>
                  <p className="text-white">{preview.dateRange.after ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="text-white/40">Até</p>
                  <p className="text-white">{preview.dateRange.before ?? 'N/A'}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {state === 'success' && result && (
        <div className="rounded-lg bg-green-900/20 border border-green-600/30 p-4 space-y-3">
          <p className="text-green-300 font-semibold">Importação concluída</p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
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
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <p className="text-white/40 text-xs">Falhas</p>
              <p className={`text-lg font-bold ${result.failed > 0 ? 'text-red-300' : 'text-white/70'}`}>{result.failed}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-white/50 text-xs">
              As mensagens importadas estão com status "Pendente".
              Apure-as para gerar drafts revisáveis.
            </p>
            {onNavigateToDrafts && (
              <button
                onClick={onNavigateToDrafts}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Ver drafts
              </button>
            )}
          </div>
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
