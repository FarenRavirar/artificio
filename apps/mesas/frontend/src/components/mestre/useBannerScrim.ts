import { useEffect, useState } from 'react';

/**
 * Intensidade do véu (scrim) do hero, calculada da imagem que o mestre subiu.
 *
 * **Por que não um valor fixo.** O scrim era `rgba(15,24,48,.72→.88)` para
 * qualquer banner. Isso funciona enquanto as fotos são escuras — a deste perfil
 * mede luminância 0,118 —, e falha no dia em que alguém sobe uma imagem clara
 * ou branca: o texto branco cai para perto de 3:1 e some. O oposto também é
 * ruim: escurecer no talo uma foto já escura apaga a imagem que o mestre
 * escolheu, sem ganho de legibilidade.
 *
 * **Por que máximo/mínimo e não a média.** A fórmula de contraste do WCAG
 * assume UM fundo, mas a luminância de uma foto varia por pixel: texto branco
 * legível sobre o céu escuro some sobre uma nuvem clara na mesma imagem. A
 * prática recomendada é medir o ponto mais claro e o mais escuro sob o texto e
 * dimensionar pelo pior caso — que aqui é o trecho MAIS CLARO, porque o texto
 * do hero é claro. Usar a média deixaria passar exatamente a foto de céu
 * escuro com um sol estourado no meio.
 *
 * **Por que no cliente e a cada carga.** O banner muda quando o mestre quiser,
 * então o valor não pode ser decidido no build nem ficar gravado junto da
 * imagem: ele é recalculado toda vez que a foto carrega. O custo é uma leitura
 * de canvas 48×27 (1.296 pixels) numa imagem que o browser já baixou.
 *
 * Exige `crossOrigin="anonymous"` no `<img>`: sem isso o canvas fica *tainted*
 * e `getImageData` lança. Medido contra o Cloudinary (2026-09-04): com o
 * atributo, funciona; sem ele, `SecurityError`. Qualquer falha — CORS, imagem
 * fora do ar, browser sem canvas — cai no scrim padrão, que é o comportamento
 * de hoje.
 */
export interface BannerScrim {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

/** O scrim de hoje: continua valendo enquanto a medição não chega ou falha. */
export const SCRIM_PADRAO: BannerScrim = { top: 0.72, bottom: 0.88, left: 0.64, right: 0.36 };

/** Luminância relativa (WCAG 2.x, mesma fórmula usada no cálculo de contraste). */
function luminanciaRelativa(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Opacidade de navy necessária para o texto branco alcançar `alvo:1` sobre uma
 * região de luminância `L`.
 *
 * O véu compõe `navy` sobre a imagem: `L' = L·(1-a) + Lnavy·a`. Resolvendo para
 * o `a` que satisfaz `(1.05)/(L'+0.05) >= alvo` e limitando ao intervalo útil.
 */
const LUMINANCIA_NAVY = luminanciaRelativa(15, 24, 48);

function opacidadeNecessaria(luminanciaRegiao: number, alvoContraste: number): number {
  // Luminância máxima que o fundo pode ter para o branco atingir o alvo.
  const luminanciaMaxima = 1.05 / alvoContraste - 0.05;
  if (luminanciaRegiao <= luminanciaMaxima) return 0;

  const a = (luminanciaRegiao - luminanciaMaxima) / (luminanciaRegiao - LUMINANCIA_NAVY);
  return Math.min(0.94, Math.max(0, a));
}

/** Lê a imagem em baixa resolução e devolve a luminância do trecho mais claro. */
function medirPiorCaso(img: HTMLImageElement): { claro: number; escuro: number } | null {
  const LARGURA = 48;
  const ALTURA = 27;
  const canvas = document.createElement('canvas');
  canvas.width = LARGURA;
  canvas.height = ALTURA;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, LARGURA, ALTURA);

  let dados: Uint8ClampedArray;
  try {
    dados = ctx.getImageData(0, 0, LARGURA, ALTURA).data;
  } catch {
    // Canvas tainted (imagem sem CORS) — o chamador cai no scrim padrão.
    return null;
  }

  // Percentis em vez de min/max crus: um único pixel especular estouraria a
  // medida e escureceria o hero inteiro sem necessidade.
  const luminancias: number[] = [];
  for (let i = 0; i < dados.length; i += 4) {
    luminancias.push(luminanciaRelativa(dados[i], dados[i + 1], dados[i + 2]));
  }
  if (luminancias.length === 0) return null;

  luminancias.sort((a, b) => a - b);
  const percentil = (p: number) =>
    luminancias[Math.min(luminancias.length - 1, Math.floor(luminancias.length * p))];

  return { escuro: percentil(0.1), claro: percentil(0.9) };
}

/**
 * @param src URL do banner, ou `null`/vazio quando o mestre não tem foto.
 */
export function useBannerScrim(src: string | null | undefined): BannerScrim {
  // Guarda a MEDIÇÃO junto do `src` que a produziu, não o scrim final. Sem
  // banner não há o que medir, e o valor devolvido é derivado no return — assim
  // o efeito não precisa chamar `setState` de forma síncrona para "resetar"
  // quando o `src` some (`react-hooks/set-state-in-effect`).
  //
  // O `src` no estado é o que impede reusar a medida do banner ANTERIOR: sem
  // ele, trocar de foto mantinha o véu calculado para a antiga até o `onload`
  // da nova — uma foto clara herdando o véu leve de uma escura ficaria com o
  // texto ilegível na janela entre as duas (achado de review, PR #307).
  const [medido, setMedido] = useState<{ src: string; scrim: BannerScrim } | null>(null);

  useEffect(() => {
    if (!src) return;

    let cancelado = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (cancelado) return;
      const medida = medirPiorCaso(img);
      if (!medida) {
        setMedido(null);
        return;
      }

      // Alvo 6:1, não 4.5:1 — folga sobre o mínimo de AA, porque a medição é
      // uma amostra de 48×27 e o `object-position` pode revelar um trecho mais
      // claro do que o amostrado. Ainda assim fica MUITO abaixo do véu fixo
      // anterior nas fotos escuras.
      const base = opacidadeNecessaria(medida.claro, 6);
      // Topo carrega texto grande (título 28px): 3:1 é o mínimo de AA ali, e
      // 4.5 dá a mesma folga proporcional.
      const topo = opacidadeNecessaria(medida.claro, 4.5);

      // Piso mínimo: mesmo numa foto escuríssima o véu não some por completo.
      // Ele separa a imagem do texto e mantém a identidade visual do hero —
      // sem ele, a foto encostaria no título sem nenhuma camada de apoio.
      const PISO = 0.28;

      setMedido({
        src,
        scrim: {
          // SEM `Math.max(SCRIM_PADRAO)`: era exatamente isso que anulava a
          // medição. Medido nesta página (p90 ≈ 0,2): o véu necessário para
          // 4.5:1 é 0,09, e o fixo aplicava 0,88 — contraste de 12,72:1 onde
          // 4,5 bastava, ou seja, a foto que o mestre escolheu praticamente
          // desaparecia. O scrim fixo estava calibrado para o pior caso (banner
          // branco, que precisa de 0,82) e cobrava esse preço de todo mundo.
          bottom: Math.max(PISO, base),
          top: Math.max(PISO * 0.8, topo),
          left: Math.max(PISO * 0.72, base * 0.72),
          right: Math.max(PISO * 0.41, base * 0.41),
        },
      });
    };

    img.onerror = () => {
      if (!cancelado) setMedido(null);
    };

    img.src = src;

    // Só cancela a medição em voo. Zerar o estado aqui provocaria um render
    // extra a cada desmontagem sem mudar o que se vê — e a medida obsoleta já
    // é descartada no return, pela comparação de `src`.
    return () => {
      cancelado = true;
    };
  }, [src]);

  // Sem banner, sem medição, medição falhada (CORS/imagem fora do ar), ou
  // medição que pertence a OUTRO banner: o comportamento é o padrão
  // conservador — véu forte, que é seguro para qualquer imagem.
  return medido && medido.src === src ? medido.scrim : SCRIM_PADRAO;
}
