// Sub-abas de /gestao/mesas. Vive fora de `ModeracaoSection.tsx` porque aquele
// arquivo só pode exportar componentes (react-refresh/only-export-components), e
// esta lógica precisa ser testável sem montar a árvore inteira de moderação.
export type ModSubTab = 'mensagens' | 'rascunhos' | 'duplicatas' | 'descartados' | 'ignoradas' | 'mesas';

// `tab` é o rótulo curto da fileira de botões; `title` é o cabeçalho do card e
// difere de propósito ("Rascunhos" vs "Rascunhos de mesas"). Ficam juntos para a
// fileira ser derivada daqui em vez de ser uma terceira lista dos mesmos nomes.
export const SUB_TAB_CONTENT: Record<ModSubTab, { tab: string; title: string; description: string }> = {
  rascunhos: {
    tab: 'Rascunhos',
    title: 'Rascunhos de mesas',
    description: 'Revisão unificada de entradas do Bot, Exporter e texto colado antes de publicar mesas reais.',
  },
  mensagens: {
    tab: 'Mensagens',
    title: 'Mensagens capturadas',
    description: 'Apuração das mensagens brutas antes de gerar ou ignorar rascunhos.',
  },
  duplicatas: {
    tab: 'Duplicatas',
    title: 'Possíveis duplicatas',
    description: 'Pares mesa×mesa e draft×mesa para decisão manual do administrador.',
  },
  descartados: {
    tab: 'Descartados',
    title: 'Descartados',
    description: 'Rascunhos rejeitados. Ver, restaurar (volta ao fluxo de revisão) ou apagar definitivamente.',
  },
  // A ORDEM desta lista é a ordem da fileira de botões (derivada por
  // `Object.keys`), então "ignoradas" fica entre "descartados" e "mesas" de
  // propósito: as duas primeiras são fila de trabalho, "mesas" é o resultado.
  ignoradas: {
    tab: 'Ignoradas',
    title: 'Mensagens ignoradas',
    description:
      'Mensagens que o parser não reconheceu como mesa. Reprocessar (após melhorar o parser) ou apagar para poder reimportar o mesmo arquivo.',
  },
  // R5/R6 (spec 093): aba migrada da de catálogo. A referência fica no comentário —
  // "R5/R6" e "migrada da aba do catálogo" não dizem nada ao admin que lê a tela.
  // Achado real (review PR #280, coderabbit, nitpick).
  mesas: {
    tab: 'Mesas',
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
