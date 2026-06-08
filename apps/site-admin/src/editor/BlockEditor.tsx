// Editor de blocos estilo Gutenberg (BlockNote, D051). UX de blocos pronta: "/", arrastar, barra por bloco.
// Entrada: block_doc (JSON, fonte da verdade) OU HTML (posts importados do WP). Saída: { html, blockDoc }.
import { useEffect, useRef } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { BlockNoteEditor } from "@blocknote/core";

export interface EditorHandle {
  getContent: () => Promise<{ html: string; blockDoc: unknown }>;
}

interface Props {
  initialHtml?: string;
  initialBlockDoc?: unknown | null;
  handleRef: { current: EditorHandle | null };
}

export function BlockEditor({ initialHtml, initialBlockDoc, handleRef }: Props) {
  const editor = useCreateBlockNote();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    (async () => {
      try {
        if (initialBlockDoc && Array.isArray(initialBlockDoc) && initialBlockDoc.length) {
          editor.replaceBlocks(editor.document, initialBlockDoc as Parameters<typeof editor.replaceBlocks>[1]);
        } else if (initialHtml && initialHtml.trim()) {
          const blocks = await editor.tryParseHTMLToBlocks(initialHtml);
          editor.replaceBlocks(editor.document, blocks);
        }
      } catch (e) {
        console.error("[editor] load falhou", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  handleRef.current = {
    getContent: async () => {
      const html = await editor.blocksToHTMLLossy(editor.document);
      return { html, blockDoc: editor.document };
    },
  };

  // theme fixo light: o admin é claro; sem isso o BlockNote herda dark do SO e fica ilegível.
  return <BlockNoteView editor={editor as unknown as BlockNoteEditor} theme="light" />;
}
