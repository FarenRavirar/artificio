import type { RefObject, ChangeEvent, DragEvent } from 'react';

interface FileDropzoneProps {
  readonly rawJson: string;
  readonly isDragOver: boolean;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly onTextChange: (value: string) => void;
  readonly onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  readonly onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  readonly onDrop: (event: DragEvent<HTMLDivElement>) => void;
}

export function FileDropzone({ rawJson, isDragOver, fileInputRef, onTextChange, onFileSelect, onDragOver, onDragLeave, onDrop }: FileDropzoneProps) {
  return (
    <section
      aria-label="Área de importação de JSON"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
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
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Cole o JSON aqui..."
        aria-label="JSON do DiscordChatExporter"
        className="w-full min-h-[280px] resize-y bg-[#0F1A2E] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={onFileSelect}
        aria-label="Selecionar arquivo JSON do DiscordChatExporter"
        className="hidden"
      />
    </section>
  );
}
