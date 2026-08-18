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
  focusable: boolean;
  onClick: () => void;
  children: ReactNode;
}

function ToolbarButton({ label, disabled, focusable, onClick, children }: Readonly<ToolbarButtonProps>) {
  return (
    <button
      type="button"
      className="artificio-content-editor__tool"
      aria-label={label}
      disabled={disabled}
      // Fora da ordem de tabulação junto com o painel oculto: o container segue
      // no DOM por causa da validação nativa, mas nada dentro dele pode receber
      // foco por teclado enquanto a Prévia está ativa (review PR #227).
      tabIndex={focusable ? undefined : -1}
      onClick={onClick}
    >
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

  // O limite passou a ser AVISO, não trava (pedido do mantenedor, 2026-08-18,
  // modelo Twitter). O comportamento anterior — `maxLength` nativo no textarea
  // mais `return` mudo nos comandos da toolbar — descartava silenciosamente o
  // fim de um texto colado: o mestre colava um anúncio de 3.779 caracteres num
  // campo de 2.000 e não havia nada na tela dizendo que 1.779 tinham sumido.
  // Deixar o excesso entrar e marcá-lo em vermelho preserva o texto do usuário
  // e mostra exatamente quanto precisa cortar.
  //
  // Consequência que o consumidor PRECISA cobrir: o campo agora aceita valor
  // acima do limite, então quem monta o formulário valida antes de enviar
  // (caso contrário o excesso só apareceria como 400 genérico do backend).
  const overflow = maxLength === undefined ? 0 : Math.max(0, value.length - maxLength);
  const remaining = maxLength === undefined ? 0 : Math.max(0, maxLength - value.length);

  function replaceSelection({ before, after = before, fallback }: WrapSelection) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;

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
          <span
            className={`artificio-content-editor__count${overflow > 0 ? ' artificio-content-editor__count--over' : ''}`}
            aria-live="polite"
          >
            {overflow > 0
              ? `${overflow} ${overflow === 1 ? 'caractere' : 'caracteres'} acima do limite`
              : `Faltam ${remaining} de ${maxLength}`}
          </span>
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
          <ToolbarButton focusable={activeTab === 'write'} label="Negrito" disabled={disabled} onClick={() => replaceSelection({ before: '**', fallback: 'texto em negrito' })}>B</ToolbarButton>
          <ToolbarButton focusable={activeTab === 'write'} label="Itálico" disabled={disabled} onClick={() => replaceSelection({ before: '_', fallback: 'texto em itálico' })}><em>I</em></ToolbarButton>
          <ToolbarButton focusable={activeTab === 'write'} label="Inserir título nível 2" disabled={disabled} onClick={() => prefixLines('## ', 'Título')}>H2</ToolbarButton>
          <ToolbarButton focusable={activeTab === 'write'} label="Citação" disabled={disabled} onClick={() => prefixLines('> ', 'Citação')}>❝</ToolbarButton>
          <ToolbarButton focusable={activeTab === 'write'} label="Lista com marcadores" disabled={disabled} onClick={() => prefixLines('- ', 'Item')}>•</ToolbarButton>
          <ToolbarButton focusable={activeTab === 'write'} label="Lista numerada" disabled={disabled} onClick={() => prefixLines('1. ', 'Item')}>1.</ToolbarButton>
          <ToolbarButton focusable={activeTab === 'write'} label="Código" disabled={disabled} onClick={() => replaceSelection({ before: '`', fallback: 'código' })}>{'<>'}</ToolbarButton>
          <ToolbarButton focusable={activeTab === 'write'} label="Link" disabled={disabled} onClick={() => replaceSelection({ before: '[', after: '](https://)', fallback: 'texto do link' })}>Link</ToolbarButton>
        </div>
        {/* O destaque do excesso é um espelho renderizado ATRÁS do textarea:
            um <textarea> não estiliza parte do próprio conteúdo. O espelho
            repete o mesmo texto com a mesma métrica tipográfica (a classe
            compartilha padding/fonte/line-height via CSS) e pinta só o que
            passou do limite; o textarea real fica por cima, com fundo
            transparente, e continua sendo quem recebe foco, digitação e
            seleção. `aria-hidden` porque é decoração pura — o número de
            caracteres em excesso já é anunciado pelo contador aria-live. */}
        <div className="artificio-content-editor__input-stack">
          {overflow > 0 && (
            <div className="artificio-content-editor__mirror" aria-hidden="true" style={{ minHeight }}>
              {value.slice(0, maxLength)}
              <mark className="artificio-content-editor__overflow">{value.slice(maxLength)}</mark>
            </div>
          )}
          <textarea
            ref={textareaRef}
            id={editorId}
            className={`artificio-content-editor__textarea${overflow > 0 ? ' artificio-content-editor__textarea--mirrored' : ''}`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-label={labelledByExternal ? undefined : label}
            aria-describedby={helpText ? helpId : undefined}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            // Continua montado e `required` na Prévia (a validação nativa depende
            // disso), mas sai da ordem de tabulação: campo fora da viewport dentro
            // de aria-hidden não pode receber foco por teclado (review PR #227).
            tabIndex={activeTab === 'write' ? undefined : -1}
            // Sem `maxLength` nativo de propósito: o browser recusaria a tecla e
            // truncaria a colagem sem aviso. Ver o bloco de comentário no cálculo
            // de `overflow` acima.
            style={{ minHeight }}
          />
        </div>
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
