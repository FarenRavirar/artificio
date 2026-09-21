import { SORT_OPTIONS } from '../utils/catalogFilterOptions';

interface ResultsHeaderProps {
  count: number;
  sort: string;
  onSortChange: (value: string) => void;
  isLoading: boolean;
  hasMore: boolean;
}

export function ResultsHeader({ count, sort, onSortChange, isLoading, hasMore }: ResultsHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] py-4">
      {/* Contador.

          `<h2>` e não `<div>` (spec 103, T3.3): medido, o catálogo saltava de
          `<h1>` (`CatalogoPage.tsx:481`) direto para o `<h3>` do título da mesa
          (`TableCard.tsx:467`), sem `<h2>` nenhum na rota — o `<h2>Filtros</h2>`
          do `FilterDrawer` não conta, porque o drawer faz
          `if (!isOpen) return null` e nem entra no DOM no carregamento.

          O nível certo é 2: o título da mesa é subordinado à lista de
          resultados, então rebaixar o `<h3>` do card destruiria a hierarquia em
          vez de corrigi-la. Este texto já era o rótulo visível da seção de
          resultados; passa a nomeá-la também na árvore de acessibilidade.

          O TEXTO VISÍVEL não muda — nem as palavras, nem o tamanho, nem o
          peso. Alterar o que o visitante lê é decisão de produto; aqui só a
          tag muda.

          SEM `aria-label`: a primeira versão deste bloco punha um rótulo fixo
          para dar nome estável ao heading, e isso estava errado. A WAI-ARIA APG
          (§Names and Descriptions) diz que `aria-label` em papel que nomeia a
          partir do conteúdo "hides descendant content from assistive technology
          users and replaces it with the value of aria-label" — a contagem
          desapareceria para quem usa leitor de tela, que é justamente a
          informação da seção. A regra de lá é usar o texto visível. */}
      <h2 className="text-sm font-normal">
        {isLoading ? (
          <span className="text-[var(--fg-muted)]">Carregando...</span>
        ) : (
          <span className="font-semibold text-[var(--fg)]">
            {count}{hasMore ? '+' : ''} {count === 1 ? 'mesa encontrada' : 'mesas encontradas'}
          </span>
        )}
      </h2>

      {/* Ordenação — lista final de sorts vem da fonte única (D0.4/R6/R13). */}
      <div className="flex items-center gap-2">
        <label htmlFor="sort-select" className="text-sm whitespace-nowrap text-[var(--fg-muted)]">
          Ordenar por:
        </label>
        <select
          id="sort-select"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="app-select"
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
