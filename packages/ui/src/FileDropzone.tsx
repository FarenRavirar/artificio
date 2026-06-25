import type { RefObject, ChangeEvent, DragEvent, TextareaHTMLAttributes } from "react";

export interface FileDropzoneProps {
  /** Accepted file types for the hidden input (e.g. ".json", ".xlsx,.csv") */
  readonly accept?: string;
  /** Placeholder text for the textarea (when showTextarea=true) */
  readonly placeholder?: string;
  /** Aria label for the textarea (when showTextarea=true) */
  readonly label?: string;
  /** Aria label for the hidden file input. Falls back to label ?? "Selecionar arquivo" */
  readonly fileLabel?: string;
  /** Current textarea value (controlled) */
  readonly value?: string;
  /** Textarea change handler */
  readonly onTextChange?: (value: string) => void;
  /** Whether to show a textarea for pasting content. Default true. */
  readonly showTextarea?: boolean;
  /** Extra props forwarded to the textarea element */
  readonly textareaProps?: TextareaHTMLAttributes<HTMLTextAreaElement>;
  /** Ref to the hidden file input */
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  /** Whether the drop zone is in drag-over state */
  readonly isDragOver: boolean;
  /** File input change handler */
  readonly onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Drag over handler */
  readonly onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  /** Drag leave handler */
  readonly onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  /** Drop handler */
  readonly onDrop: (event: DragEvent<HTMLDivElement>) => void;
  /** Additional class name for the outer section */
  readonly className?: string;
}

function openFilePicker(fileInputRef: RefObject<HTMLInputElement | null>) {
  fileInputRef.current?.click();
}

export function FileDropzone({
  accept,
  placeholder = "",
  label,
  fileLabel,
  value,
  onTextChange,
  showTextarea = true,
  textareaProps,
  fileInputRef,
  isDragOver,
  onFileSelect,
  onDragOver,
  onDragLeave,
  onDrop,
  className,
}: FileDropzoneProps) {
  const dropzoneClass = [
    "artificio-dropzone",
    isDragOver && "artificio-dropzone-active",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const resolvedFileLabel = fileLabel ?? label ?? "Selecionar arquivo";
  const sectionLabel = showTextarea ? "Área de importação" : "Área de envio de arquivo";

  return (
    <section
      aria-label={sectionLabel}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={dropzoneClass}
    >
      {isDragOver && (
        <div className="artificio-dropzone-overlay">
          <p className="artificio-dropzone-overlay-text">Solte o arquivo aqui</p>
        </div>
      )}

      {showTextarea && (
        <textarea
          id={textareaProps?.id}
          value={value}
          onChange={(e) => onTextChange?.(e.target.value)}
          placeholder={placeholder}
          aria-label={label ?? placeholder}
          className="artificio-dropzone-textarea"
          {...textareaProps}
        />
      )}

      {!showTextarea && (
        <button
          type="button"
          className="artificio-dropzone-clickarea"
          aria-label={resolvedFileLabel}
          onClick={() => openFilePicker(fileInputRef)}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
          <p className="artificio-dropzone-clickarea-title">{placeholder || "Arraste seu arquivo aqui"}</p>
          <p className="artificio-dropzone-clickarea-hint">ou clique para selecionar</p>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={onFileSelect}
        aria-label={resolvedFileLabel}
        className="artificio-dropzone-file-input"
      />
    </section>
  );
}

export default FileDropzone;
