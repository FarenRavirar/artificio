import { useEffect } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Link from '@tiptap/extension-link';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Image from '@tiptap/extension-image';
import Heading from '@tiptap/extension-heading';
import Blockquote from '@tiptap/extension-blockquote';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import History from '@tiptap/extension-history';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  label?: string;
  disabled?: boolean;
}

interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: string;
}

function ToolbarButton({ label, active = false, disabled, onClick, children }: Readonly<ToolbarButtonProps>) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className="min-h-11 min-w-11 rounded-md border border-[var(--line)] px-2 text-sm font-semibold text-[var(--fg)] hover:border-artificio-orange disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-artificio-orange aria-pressed:bg-artificio-orange/10"
    >
      {children}
    </button>
  );
}

function setLink(editor: Editor) {
  const previous = editor.getAttributes('link').href as string | undefined;
  const href = window.prompt('URL do link', previous ?? 'https://');
  if (href === null) return;
  if (!href.trim()) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run();
}

function addImage(editor: Editor) {
  const src = window.prompt('URL da imagem', 'https://');
  if (!src?.trim()) return;
  const alt = window.prompt('Texto alternativo da imagem', '') ?? '';
  editor.chain().focus().setImage({ src: src.trim(), alt: alt.trim() }).run();
}

// Spec 086, Fase 9: editor headless. CSS fica no design system/Tailwind;
// nenhuma sanitização de segurança acontece aqui. Todo HTML emitido continua
// hostil até passar por sanitizeRichHtml no backend (PUT material-metadata).
export function RichTextEditor({ value, onChange, label = 'Descrição rica', disabled = false }: Readonly<RichTextEditorProps>) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Underline,
      Strike,
      Link.configure({ openOnClick: false, protocols: ['http', 'https'] }),
      BulletList,
      OrderedList,
      ListItem,
      Image.configure({ allowBase64: false }),
      Heading.configure({ levels: [2, 3, 4] }),
      Blockquote,
      HorizontalRule,
      History,
    ],
    content: value,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        class:
          'min-h-48 px-4 py-3 text-[var(--fg)] outline-none [&_a]:text-artificio-orange [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--line)] [&_blockquote]:pl-4 [&_h2]:text-2xl [&_h3]:text-xl [&_h4]:text-lg [&_img]:max-w-full [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc',
      },
    },
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML()),
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return <div className="min-h-48 rounded-md border border-[var(--line)] p-4 text-sm text-[var(--fg-muted)]">Carregando editor…</div>;
  }

  const unavailable = disabled;

  return (
    <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
      <div role="toolbar" aria-label={`Formatação de ${label}`} className="flex flex-wrap gap-1 border-b border-[var(--line)] p-2">
        <ToolbarButton label="Negrito" active={editor.isActive('bold')} disabled={unavailable} onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolbarButton>
        <ToolbarButton label="Itálico" active={editor.isActive('italic')} disabled={unavailable} onClick={() => editor.chain().focus().toggleItalic().run()}>I</ToolbarButton>
        <ToolbarButton label="Sublinhado" active={editor.isActive('underline')} disabled={unavailable} onClick={() => editor.chain().focus().toggleUnderline().run()}>U</ToolbarButton>
        <ToolbarButton label="Tachado" active={editor.isActive('strike')} disabled={unavailable} onClick={() => editor.chain().focus().toggleStrike().run()}>S</ToolbarButton>
        {[2, 3, 4].map((level) => (
          <ToolbarButton key={level} label={`Título ${level}`} active={editor.isActive('heading', { level })} disabled={unavailable} onClick={() => editor.chain().focus().toggleHeading({ level: level as 2 | 3 | 4 }).run()}>{`H${level}`}</ToolbarButton>
        ))}
        <ToolbarButton label="Lista com marcadores" active={editor.isActive('bulletList')} disabled={unavailable} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</ToolbarButton>
        <ToolbarButton label="Lista numerada" active={editor.isActive('orderedList')} disabled={unavailable} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</ToolbarButton>
        <ToolbarButton label="Citação" active={editor.isActive('blockquote')} disabled={unavailable} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</ToolbarButton>
        <ToolbarButton label="Link" active={editor.isActive('link')} disabled={unavailable} onClick={() => setLink(editor)}>Link</ToolbarButton>
        <ToolbarButton label="Imagem" disabled={unavailable} onClick={() => addImage(editor)}>Img</ToolbarButton>
        <ToolbarButton label="Linha horizontal" disabled={unavailable} onClick={() => editor.chain().focus().setHorizontalRule().run()}>—</ToolbarButton>
        <ToolbarButton label="Desfazer" disabled={unavailable || !editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()}>↶</ToolbarButton>
        <ToolbarButton label="Refazer" disabled={unavailable || !editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()}>↷</ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
