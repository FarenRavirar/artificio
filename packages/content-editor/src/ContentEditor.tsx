import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import { useId, useRef, useState, type ReactNode } from 'react';

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
});

export function renderMarkdown(value: string): string {
  // Em lista "solta" (itens separados por linha em branco) o markdown-it embrulha
  // o conteúdo do item em <p>, e o marcador vira `<li>\n<p>[x] …` — a versão
  // anterior só casava `<li>[x] ` e deixava esses itens sem checkbox
  // (review PR #227). O <p> de abertura é preservado quando existe.
  const rendered = markdown.render(value).replace(
    /<li>(\s*<p>)?\[([ xX])\]\s/g,
    (_match, paragraph: string | undefined, state: string) =>
      `<li class="task-list-item">${paragraph ?? ''}<input type="checkbox" disabled${state === ' ' ? '' : ' checked'}> `,
  );
  return DOMPurify.sanitize(rendered);
}

export interface MarkdownContentProps {
  value: string;
  className?: string;
}

export function MarkdownContent({ value, className = '' }: Readonly<MarkdownContentProps>) {
  return (
    <div
      className={`artificio-markdown-content ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
    />
  );
}

export interface ContentEditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  minHeight?: number;
  maxLength?: number;
  helpText?: ReactNode;
  /**
   * Quando o consumidor já renderiza um `<label htmlFor>` visível apontando para
   * `id`, o `aria-label` interno é omitido: `aria-label` vence o `<label>` e o
   * texto visível deixaria de ser o nome acessível do campo (review PR #227).
   * `label` continua obrigatório porque nomeia o tablist e a toolbar.
   */
  labelledByExternal?: boolean;
}

type WrapSelection = {
  before: string;
  after?: string;
  fallback: string;
};

interface ToolbarButtonProps {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}

function ToolbarButton({ label, disabled, onClick, children }: Readonly<ToolbarButtonProps>) {
  return (
    <button type="button" className="artificio-content-editor__tool" aria-label={label} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export function ContentEditor({
  value,
  onChange,
  label,
  id,
  placeholder = 'Escreva em Markdown…',
  disabled = false,
  required = false,
  minHeight = 192,
  maxLength,
  helpText,
  labelledByExternal = false,
}: Readonly<ContentEditorProps>) {
  const generatedId = useId();
  const editorId = id ?? `content-editor-${generatedId}`;
  const helpId = `${editorId}-help`;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');

  function replaceSelection({ before, after = before, fallback }: WrapSelection) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    if (maxLength !== undefined && next.length > maxLength) return;

    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function prefixLines(prefix: string, fallback: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Comandos de bloco (H2, citação, lista) valem para a linha inteira, então a
    // seleção é expandida até os limites das linhas tocadas antes de prefixar.
    // Sem isso, cursor no meio de uma linha e sem seleção inseria o prefixo na
    // posição exata do cursor e produzia `parágra## Títulofo`, que não é bloco
    // Markdown válido (achado de review PR #227).
    const lineStart = value.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
    const lineEndIndex = value.indexOf('\n', textarea.selectionEnd);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;

    const block = value.slice(lineStart, lineEnd);
    // Linha vazia não tem o que prefixar: usa o fallback como conteúdo inicial.
    const selected = block || fallback;
    const prefixed = selected.split('\n').map((line) => `${prefix}${line}`).join('\n');
    const next = `${value.slice(0, lineStart)}${prefixed}${value.slice(lineEnd)}`;
    if (maxLength !== undefined && next.length > maxLength) return;

    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart, lineStart + prefixed.length);
    });
  }

  return (
    <div className="artificio-content-editor">
      <div className="artificio-content-editor__header">
        <div role="tablist" aria-label={`Modo de ${label}`} className="artificio-content-editor__tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'write'}
            aria-controls={`${editorId}-write`}
            className="artificio-content-editor__tab"
            onClick={() => setActiveTab('write')}
          >
            Escrever
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'preview'}
            aria-controls={`${editorId}-preview`}
            className="artificio-content-editor__tab"
            onClick={() => setActiveTab('preview')}
          >
            Prévia
          </button>
        </div>
        {maxLength !== undefined && (
          <span className="artificio-content-editor__count" aria-live="polite">{value.length}/{maxLength}</span>
        )}
      </div>

      {/* O painel de escrita nunca é desmontado: com `required`, remover o
          <textarea> do DOM ao abrir a Prévia fazia o browser pular a validação
          nativa e o formulário submeter vazio (achado de review PR #227).
          A ocultação é visual (classe --hidden, fora da viewport), não `hidden`
          nem `display:none`, porque ambos tiram o campo da constraint validation. */}
      <div
        id={`${editorId}-write`}
        role="tabpanel"
        className={activeTab === 'write' ? undefined : 'artificio-content-editor__panel--hidden'}
        aria-hidden={activeTab === 'write' ? undefined : true}
      >
        <div role="toolbar" aria-label={`Formatação de ${label}`} className="artificio-content-editor__toolbar">
          <ToolbarButton label="Negrito" disabled={disabled} onClick={() => replaceSelection({ before: '**', fallback: 'texto em negrito' })}>B</ToolbarButton>
          <ToolbarButton label="Itálico" disabled={disabled} onClick={() => replaceSelection({ before: '_', fallback: 'texto em itálico' })}><em>I</em></ToolbarButton>
          <ToolbarButton label="Inserir título nível 2" disabled={disabled} onClick={() => prefixLines('## ', 'Título')}>H2</ToolbarButton>
          <ToolbarButton label="Citação" disabled={disabled} onClick={() => prefixLines('> ', 'Citação')}>❝</ToolbarButton>
          <ToolbarButton label="Lista com marcadores" disabled={disabled} onClick={() => prefixLines('- ', 'Item')}>•</ToolbarButton>
          <ToolbarButton label="Lista numerada" disabled={disabled} onClick={() => prefixLines('1. ', 'Item')}>1.</ToolbarButton>
          <ToolbarButton label="Código" disabled={disabled} onClick={() => replaceSelection({ before: '`', fallback: 'código' })}>{'<>'}</ToolbarButton>
          <ToolbarButton label="Link" disabled={disabled} onClick={() => replaceSelection({ before: '[', after: '](https://)', fallback: 'texto do link' })}>Link</ToolbarButton>
        </div>
        <textarea
          ref={textareaRef}
          id={editorId}
          className="artificio-content-editor__textarea"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={labelledByExternal ? undefined : label}
          aria-describedby={helpText ? helpId : undefined}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          style={{ minHeight }}
        />
      </div>

      {activeTab === 'preview' && (
        <div id={`${editorId}-preview`} role="tabpanel" aria-label={`Prévia de ${label}`} className="artificio-content-editor__preview" style={{ minHeight }}>
          {value.trim() ? <MarkdownContent value={value} /> : <p className="artificio-content-editor__empty">Nada para visualizar.</p>}
        </div>
      )}

      {helpText && <div id={helpId} className="artificio-content-editor__help">{helpText}</div>}
    </div>
  );
}
