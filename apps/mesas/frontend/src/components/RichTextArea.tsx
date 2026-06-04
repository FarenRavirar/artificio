import { useState } from 'react';

interface RichTextAreaProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}

/**
 * Editor de texto rico simplificado (REQ-21 Lacuna 9)
 * Fornece formatação básica sem dependências externas
 */
export function RichTextArea({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 6,
  maxLength = 2000,
}: RichTextAreaProps) {
  const [showPreview, setShowPreview] = useState(false);

  const insertFormatting = (before: string, after: string = '') => {
    const textarea = document.getElementById(id) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);

    onChange(newText);

    // Restaurar foco e seleção
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const formatMarkdown = (text: string): string => {
    // Converter markdown básico para HTML
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // **negrito**
      .replace(/\*(.+?)\*/g, '<em>$1</em>') // *itálico*
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-3 mb-2">$1</h3>') // ### Título
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>') // ## Título
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>') // # Título
      .replace(/\n\n/g, '</p><p class="mb-2">') // Parágrafos
      .replace(/\n/g, '<br/>'); // Quebras de linha
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-white/70">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">
            {value.length}/{maxLength}
          </span>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            {showPreview ? 'Editar' : 'Visualizar'}
          </button>
        </div>
      </div>

      {!showPreview ? (
        <>
          {/* Barra de ferramentas */}
          <div className="flex flex-wrap gap-1 p-2 bg-white/5 border border-white/10 rounded-t-xl">
            <button
              type="button"
              onClick={() => insertFormatting('**', '**')}
              className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors"
              title="Negrito"
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('*', '*')}
              className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors italic"
              title="Itálico"
            >
              I
            </button>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <button
              type="button"
              onClick={() => insertFormatting('# ', '')}
              className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors"
              title="Título 1"
            >
              H1
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('## ', '')}
              className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors"
              title="Título 2"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('### ', '')}
              className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors"
              title="Título 3"
            >
              H3
            </button>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <button
              type="button"
              onClick={() => insertFormatting('\n\n', '')}
              className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors"
              title="Novo parágrafo"
            >
              ¶
            </button>
          </div>

          {/* Textarea */}
          <textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
            rows={rows}
            placeholder={placeholder}
            className="w-full bg-white/5 border border-white/10 border-t-0 rounded-b-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[var(--color-artificio-orange)]/60 transition-all resize-none font-mono text-sm"
          />

          {/* Dica de formatação */}
          <p className="text-xs text-white/40">
            Use **negrito**, *itálico*, # Título para formatar o texto
          </p>
        </>
      ) : (
        /* Preview */
        <div
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white min-h-[150px]"
          dangerouslySetInnerHTML={{ __html: `<p class="mb-2">${formatMarkdown(value)}</p>` }}
        />
      )}
    </div>
  );
}
