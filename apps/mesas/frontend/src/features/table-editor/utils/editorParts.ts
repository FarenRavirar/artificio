import type { EditorPartId } from '../types';

/**
 * Chrome do editor: as 7 partes na ordem aprovada + rótulos.
 *
 * Vive fora do TableEditor.tsx por causa do `react-refresh/only-export-components`
 * (recusa arquivo de componente que também exporta função/constante) — mesmo
 * padrão do closedTable.ts do MesaPage.
 */

export interface EditorPartMeta {
  id: EditorPartId;
  label: string;
}

/**
 * As 7 partes na ordem aprovada pelo mantenedor (2026-08-24, spec 096):
 * Identidade · Quando joga · Onde joga · Valores · Para quem é ·
 * Mestre e contato · Regras e extras.
 *
 * Fonte única da ordem da lateral do editor — a lateral itera sobre esta
 * lista constante (botões criados UMA vez, com `key` estável; recriar a
 * lista a cada tecla mata o clique junto com o nó — bug medido no protótipo
 * da Fase 2, T2.5).
 */
export const EDITOR_PARTS: readonly EditorPartMeta[] = [
  { id: 'identity', label: 'Identidade' },
  { id: 'when', label: 'Quando joga' },
  { id: 'where', label: 'Onde joga' },
  { id: 'values', label: 'Valores' },
  { id: 'audience', label: 'Para quem é' },
  { id: 'master', label: 'Mestre e contato' },
  { id: 'extras', label: 'Regras e extras' },
];

export function getPartLabel(partId: EditorPartId): string {
  return EDITOR_PARTS.find((part) => part.id === partId)?.label ?? partId;
}
