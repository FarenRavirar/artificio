import { useJsonImport } from '../hooks/useJsonImport';
import { formatFileSize } from '../draftFormUtils';
import { ImportResultGrid } from './ImportResultGrid';
import { JsonPreviewCard } from './JsonPreviewCard';
import { FileDropzone } from "@artificio/ui";

interface DiscordJsonImportPanelProps {
  readonly onNavigateToDrafts?: () => void;
}

export function DiscordJsonImportPanel({ onNavigateToDrafts }: DiscordJsonImportPanelProps) {
  const {
    rawJson, selectedFile, state, preview, result, errorMessage, isDragOver,
    fileInputRef,
    handleChange, handleSubmit, handleClear,
    handleFileSelect, handleDragOver, handleDragLeave, handleDrop,
  } = useJsonImport();

  // Codex P3: input fica sempre montado p/ "Trocar arquivo" achar a ref (FileDropzone
  // some quando selectedFile setado, levando junto o input que ele renderiza).
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".json,application/json"
      onChange={handleFileSelect}
      className="hidden"
      aria-label="Selecionar arquivo JSON do DiscordChatExporter"
    />
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white/5 border border-white/10 p-4 space-y-3">
        <h3 className="text-white font-semibold">Importar JSON do DiscordChatExporter</h3>
        <p className="text-white/50 text-xs">
          Cole o conteúdo do arquivo JSON exportado pelo DiscordChatExporter,
          ou arraste e solte um arquivo .json para importar.
          O sistema vai importar as mensagens para revisão.
        </p>

        {selectedFile ? (
          <div className="flex items-center gap-2 bg-blue-900/30 border border-blue-600/30 rounded-lg px-3 py-2">
            <span className="text-blue-300 text-sm">📄</span>
            <span className="text-white text-sm font-medium">{selectedFile.name}</span>
            <span className="text-white/50 text-xs">{formatFileSize(selectedFile.size)}</span>
            {preview && <span className="text-white/30 text-xs">· {preview.messageCount} mensagens</span>}
            {fileInput}
          </div>
        ) : (
          <FileDropzone
            value={rawJson}
            isDragOver={isDragOver}
            fileInputRef={fileInputRef}
            onTextChange={handleChange}
            onFileSelect={handleFileSelect}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            accept=".json,application/json"
            placeholder="Cole o JSON aqui..."
            label="JSON do DiscordChatExporter"
            fileLabel="Selecionar arquivo JSON do DiscordChatExporter"
            textareaProps={{ id: "discord-json-input" }}
          />
        )}

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
            {selectedFile ? 'Trocar arquivo' : 'Selecionar arquivo'}
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
        <JsonPreviewCard preview={preview} />
      )}

      {state === 'preview_error' && errorMessage && (
        <div className="rounded-lg bg-red-900/20 border border-red-600/30 p-3">
          <p className="text-red-300 text-sm">{errorMessage}</p>
        </div>
      )}

      {state === 'success' && result && (
        <ImportResultGrid result={result} onNavigateToDrafts={onNavigateToDrafts} />
      )}

      {state === 'error' && errorMessage && (
        <div className="rounded-lg bg-red-900/20 border border-red-600/30 p-3">
          <p className="text-red-300 text-sm">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
