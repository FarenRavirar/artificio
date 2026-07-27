interface CoverPlaceholderProps {
  /** Tipo do material (rotulo da taxonomia central, ex.: "Aventura"). */
  materialType?: string | null;
  /** Mesma faixa piso-teto que a capa real usa no contexto correspondente. */
  size?: 'card' | 'detail';
}

// O desenho ocupa altura DENTRO da mesma faixa da capa real (requisito 24):
// e isso que impede a altura variavel de quebrar o alinhamento horizontal
// entre cards vizinhos na prateleira.
const PLACEHOLDER_HEIGHT = {
  card: 'h-40',
  detail: 'h-[26rem]',
} as const;

// Spec 088 (T1.2/T1.3/T1.4) — placeholder DESENHADO para as capas ausentes.
//
// Contexto: capa existe em 21 de 103 materiais. Numa pagina cujo modo padrao e
// vitrine (prateleiras de cards), quatro em cada cinco cards caiam no mesmo
// retangulo cinza com o texto "Sem capa" — uma fileira de placeholders
// identicos anunciando o que falta.
//
// Tres travas de desenho:
//  1. CSS/SVG inline, sem requisicao de rede e sem arquivo de imagem novo.
//     Este componente E o tratamento de falha da capa (`onError` cai aqui);
//     um placeholder que pudesse falhar ao carregar seria pior que o cinza.
//  2. So tokens semanticos (`--surface-*`, `--line`, `--fg-muted`), nunca cor
//     crua: vira com o tema claro/escuro sozinho.
//  3. `aria-hidden`: e decoracao. O titulo do material ja esta no card, ao
//     lado; anunciar "sem capa" ao leitor de tela so competiria com ele.
//
// A variacao por tipo usa o campo que JA vem no payload da listagem — nenhuma
// consulta nova ao backend.

interface PlaceholderShape {
  /** Desenho de traco, sobre a moldura. `currentColor` herda `--fg-muted`. */
  path: string;
  /** Inclinacao sutil, pra prateleira nao virar uma fileira de iguais. */
  rotate: number;
}

// Chaves normalizadas (minusculas, sem acento) — o payload traz o rotulo da
// taxonomia central em portugues ("Aventura"), mas scraper e formulario ja
// gravaram variacoes, entao a comparacao nao pode depender de caixa/acento.
const SHAPES: Record<string, PlaceholderShape> = {
  // Aventura: bussola — material que leva a algum lugar.
  aventura: { path: 'M32 12 L38 30 L56 36 L38 42 L32 60 L26 42 L8 36 L26 30 Z', rotate: -4 },
  // Suplemento: livro aberto.
  suplemento: { path: 'M10 20 Q32 14 32 22 L32 52 Q32 44 10 50 Z M54 20 Q32 14 32 22 L32 52 Q32 44 54 50 Z', rotate: 3 },
  // Cenario: horizonte com montanha.
  cenario: { path: 'M8 50 L24 26 L36 42 L44 32 L56 50 Z', rotate: 0 },
  // Ficha/planilha: folha pautada.
  ficha: { path: 'M16 12 H48 V60 H16 Z M24 24 H40 M24 34 H40 M24 44 H34', rotate: -3 },
  // Mapa: caminho sinuoso com marcador.
  mapa: { path: 'M12 52 Q26 40 22 28 Q18 16 34 14 Q50 12 48 26 M48 34 A4 4 0 1 1 48 42 A4 4 0 1 1 48 34', rotate: 4 },
  // Regra/sistema: dado de vinte faces (silhueta).
  regras: { path: 'M32 10 L54 24 L54 48 L32 62 L10 48 L10 24 Z M32 10 L32 34 M32 34 L54 24 M32 34 L10 24 M32 34 L32 62', rotate: -2 },
};

// Tipo desconhecido cai aqui em vez de quebrar: forma neutra, mesmo peso
// visual das outras.
const FALLBACK: PlaceholderShape = {
  path: 'M16 14 H48 V58 L32 48 L16 58 Z',
  rotate: 2,
};

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function pickShape(materialType?: string | null): PlaceholderShape {
  if (!materialType) return FALLBACK;
  const key = normalize(materialType);
  if (SHAPES[key]) return SHAPES[key];
  // Casamento por prefixo cobre plural e variacao ("aventuras", "cenarios",
  // "livro de regras") sem precisar enumerar cada forma que o scraper grava.
  const partial = Object.keys(SHAPES).find((candidate) => key.includes(candidate));
  return partial ? SHAPES[partial] : FALLBACK;
}

export function CoverPlaceholder({ materialType, size = 'card' }: Readonly<CoverPlaceholderProps>) {
  const shape = pickShape(materialType);

  return (
    <svg
      viewBox="0 0 64 72"
      // Altura fixa dentro da faixa piso-teto da capa real, com `w-auto` pra
      // manter a proporcao vertical de uma capa. Altura explicita (nao
      // `h-full`) porque o frame nao tem altura definida — `height: 100%`
      // contra pai de altura automatica nao teria base pra computar.
      className={`${PLACEHOLDER_HEIGHT[size]} w-auto max-w-full text-[var(--fg-muted)]`}
      aria-hidden="true"
      focusable="false"
    >
      {/* Moldura: sugere o formato de uma capa sem fingir ser uma. */}
      <rect
        x="6"
        y="4"
        width="52"
        height="64"
        rx="3"
        fill="var(--surface-subtle)"
        stroke="var(--line)"
        strokeWidth="1.5"
      />
      <g
        transform={`rotate(${shape.rotate} 32 36)`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        // Traco discreto: o placeholder marca ausencia, nao disputa atencao
        // com o titulo e o credito do material.
        opacity="0.55"
      >
        <path d={shape.path} />
      </g>
    </svg>
  );
}
