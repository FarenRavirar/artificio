// O CSS do editor NÃO é importado aqui (spec 103 T2.3). Importar `.css` num módulo
// JS faz todo app que alcança este módulo levar um `<link rel="stylesheet">` extra
// no `<head>` — e o alcance era amplo: `@artificio/ui` reexporta `GmReviewPanel`,
// que importa daqui, então TODO app que importa o barrel do `ui` levava o
// `dist-*.css` do editor, renderizando o editor ou não. Medido em produção no
// `mesas` (2026-09-23): era o único recurso bloqueando o primeiro paint, 811 ms.
//
// Quem renderiza `ContentEditor`/`MarkdownContent` traz o estilo por
// `@artificio/content-editor/styles.css`. Hoje isso chega pelo
// `@artificio/comments/styles.css`, que o importa e que os três apps que renderizam
// o editor (`mesas`, `downloads`, `site`) já carregam.
export { ContentEditor, MarkdownContent, contentCountLabel, contentOverflow, renderMarkdown } from './ContentEditor.js';
export type { ContentEditorProps, MarkdownContentProps } from './ContentEditor.js';
