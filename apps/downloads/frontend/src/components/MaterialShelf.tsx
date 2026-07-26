import { Link } from 'react-router-dom';
import { MaterialCard } from './MaterialCard';
import type { Material } from '../types/material';

interface MaterialShelfProps {
  /** Identificador estavel da prateleira; vira o `id` do titulo pro aria-labelledby. */
  shelfId: string;
  title: string;
  /** Destino do "Ver tudo" — leva ao modo resultado com o mesmo `sort`. */
  seeAllTo: string;
  items: readonly Material[];
  isLoading?: boolean;
}

// Spec 087 (T2.1/T2.4) — prateleira horizontal rolavel do modo vitrine.
//
// Decisoes que a direcao de design (plan.md §MaterialShelf) fixa:
//
// - `scroll-snap-type: x proximity`, NUNCA `mandatory`: mandatory briga com
//   trackpad e da sensacao de trava no meio do gesto.
// - Sem setas de navegacao na v1. Scroll nativo + Tab sequencial bastam — o
//   browser ja rola o card focado pra dentro da viewport sozinho, entao
//   teclado funciona sem codigo extra (T4.2).
// - Sem `scroll-behavior: smooth` forcado: deixa o browser honrar
//   `prefers-reduced-motion` em vez de impor animacao (T4.2).
// - Prateleira sem item NAO renderiza (Requisito 16). Titulo de secao seguido
//   de trilho vazio e pior que ausencia: promete conteudo que nao existe.
export function MaterialShelf({
  shelfId,
  title,
  seeAllTo,
  items,
  isLoading,
}: Readonly<MaterialShelfProps>) {
  if (!isLoading && items.length === 0) return null;

  const headingId = `shelf-${shelfId}`;

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2
          id={headingId}
          className="text-xl font-semibold uppercase tracking-[0.06em] text-[var(--fg)]"
          style={{ fontFamily: 'var(--artificio-font-display)' }}
        >
          {title}
        </h2>
        <Link
          to={seeAllTo}
          className="shrink-0 text-sm text-[var(--fg-muted)] transition hover:text-artificio-orange focus-visible:text-artificio-orange"
        >
          {/* Seta e decorativa (direcao visual do "Ver tudo" da direcao de
              design da Fase 1); fica fora do nome acessivel do link. */}
          Ver tudo <span aria-hidden="true">→</span>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-[var(--fg-muted)]">Carregando...</p>
      ) : (
        // `snap-proximity`, nao `snap-mandatory`: o trilho sugere parada nos
        // cards sem sequestrar o gesto de rolagem no meio do caminho.
        <ul className="flex touch-pan-x snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain pb-2">
          {items.map((material, index) => (
            <li
              key={material.id}
              className={[
                'w-[220px] shrink-0 lg:w-[240px]',
                // Ultimo card alinha pelo fim pra prateleira nao parar cortando
                // o item final no meio.
                index === items.length - 1 ? 'snap-end' : 'snap-start',
              ].join(' ')}
            >
              <MaterialCard material={material} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
