// Sub-abas de /gestao/mesas. Vive fora de `ModeracaoSection.tsx` porque aquele
// arquivo só pode exportar componentes (react-refresh/only-export-components), e
// esta lógica precisa ser testável sem montar a árvore inteira de moderação.
export type ModSubTab = 'mensagens' | 'rascunhos' | 'duplicatas' | 'descartados' | 'mesas';

export const SUB_TAB_CONTENT: Record<ModSubTab, { title: string; description: string }> = {
  rascunhos: {
    title: 'Rascunhos de mesas',
    description: 'Revisão unificada de entradas do Bot, Exporter e texto colado antes de publicar mesas reais.',
  },
  mensagens: {
    title: 'Mensagens capturadas',
    description: 'Apuração das mensagens brutas antes de gerar ou ignorar rascunhos.',
  },
  duplicatas: {
    title: 'Possíveis duplicatas',
    description: 'Pares mesa×mesa e draft×mesa para decisão manual do administrador.',
  },
  descartados: {
    title: 'Descartados',
    description: 'Rascunhos rejeitados. Ver, restaurar (volta ao fluxo de revisão) ou apagar definitivamente.',
  },
  // R5/R6 (spec 093): aba migrada da de catálogo. A referência fica no comentário —
  // "R5/R6" e "migrada da aba do catálogo" não dizem nada ao admin que lê a tela.
  // Achado real (review PR #280, coderabbit, nitpick).
  mesas: {
    title: 'Mesas',
    description: 'Todas as mesas, em qualquer status — busca, filtros e ações em lote ou por linha.',
  },
};

// Valores válidos derivados de SUB_TAB_CONTENT, não de lista paralela: as duas
// cadeias de `if` anteriores repetiam os mesmos 5 nomes, e acrescentar a aba
// "mesas" (R5/R6) exigiu editar as duas — esquecer uma daria deep-link mudo.
// Achado real (review PR #280, coderabbit, nitpick).
const SUB_TAB_VALUES = new Set(Object.keys(SUB_TAB_CONTENT) as ModSubTab[]);

export function resolveSubTab(sub: string | undefined): ModSubTab {
  return sub && SUB_TAB_VALUES.has(sub as ModSubTab) ? (sub as ModSubTab) : 'rascunhos';
}
