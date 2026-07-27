import { useState } from 'react';
import { CoverPlaceholder } from './CoverPlaceholder';

interface MaterialCoverProps {
  /** URL da capa. `null`/vazio cai direto no placeholder. */
  src?: string | null;
  /** Titulo do material — compoe o texto alternativo da capa real. */
  title: string;
  /** Tipo do material: escolhe a variacao do placeholder. */
  materialType?: string | null;
  /**
   * Faixa vertical que a capa pode ocupar. `card` e a prateleira (silhueta
   * compativel entre cards vizinhos); `detail` e a ficha, onde a capa e o
   * elemento visual principal e pode respirar mais.
   */
  size?: 'card' | 'detail';
  className?: string;
}

// Spec 088 (T1.1) — REGRA UNICA de exibicao de capa, consumida por todo ponto
// que mostra capa. Antes havia duas implementacoes divergentes: o card usava
// `h-32 w-full object-cover` (altura fixa que RECORTA) e a ficha `w-full
// object-cover` sem trava nenhuma — e o placeholder da ficha ja usava
// `aspect-[3/4]` enquanto a imagem real ao lado nao tinha limite.
//
// O ponto central e `object-contain` no lugar de `object-cover`: capa de RPG e
// caracteristicamente vertical (3:4, 2:3, A4) e o recorte come justamente topo
// e base, que e onde vive o titulo do material. Contem, nunca corta.
//
// Piso e teto verticais fazem o resto: dentro dessa faixa a altura acompanha a
// proporcao real do arquivo, a largura se ajusta e as laterais absorvem a
// diferenca entre capas de proporcoes distintas. Capa mais alta que o teto
// reduz proporcionalmente ate caber; capa mais baixa que o piso NAO e
// esticada — o espaco restante fica no container, nao na imagem.
// O PISO vive no frame (`min-h`): garante que card com capa e card sem capa
// nao desalinhem na prateleira, e absorve no container o espaco que sobra
// quando a capa e mais baixa que ele — a imagem nunca e esticada pra
// preencher (requisito 22).
const FRAME_FLOOR = {
  card: 'min-h-32',
  detail: 'min-h-64',
} as const;

// O TETO vive na IMAGEM (`max-h`), nao no frame. Se ficasse no frame, o
// `overflow-hidden` CORTARIA a capa alta em vez de reduzi-la — e cortar e
// exatamente o que esta regra existe pra impedir. Com `max-height` na propria
// imagem + `w-auto`, o navegador reduz proporcionalmente ate caber: sem corte
// e sem distorcao.
const IMAGE_CEILING = {
  card: 'max-h-44',
  detail: 'max-h-[28rem]',
} as const;

export function MaterialCover({
  src,
  title,
  materialType,
  size = 'card',
  className = '',
}: Readonly<MaterialCoverProps>) {
  const [failed, setFailed] = useState(false);
  // Trocar de material sem resetar o estado manteria o placeholder de um item
  // anterior que falhou (o React reaproveita a instancia do componente).
  const [lastSrc, setLastSrc] = useState(src);
  if (src !== lastSrc) {
    setLastSrc(src);
    setFailed(false);
  }

  const showCover = Boolean(src) && !failed;
  const frame = `flex w-full items-center justify-center bg-[var(--surface-strong)] ${FRAME_FLOOR[size]} ${className}`;

  if (!showCover) {
    return (
      <div className={frame}>
        <CoverPlaceholder materialType={materialType} size={size} />
      </div>
    );
  }

  return (
    <div className={frame}>
      <img
        src={src ?? undefined}
        alt={`Capa de ${title}`}
        // `object-contain` preserva a proporcao; `w-auto` deixa a largura
        // derivar da altura e `max-w-full` impede que ultrapasse o card (capa
        // horizontal/quadrada cai na mesma regra, sem caso especial). O
        // `justify-center` do frame centraliza, entao as laterais absorvem a
        // diferenca entre capas de proporcoes distintas.
        className={`${IMAGE_CEILING[size]} h-auto w-auto max-w-full object-contain`}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
