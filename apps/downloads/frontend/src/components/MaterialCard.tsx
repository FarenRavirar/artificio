import { Link } from 'react-router-dom';
import type { Material } from '../types/material';
import { MaterialCover } from './MaterialCover';
import { MaterialRating } from './MaterialRating';
import { SystemChainBadge } from './SystemChainBadge';

interface MaterialCardProps {
  material: Material;
}

const ACCESS_LABEL: Record<Material['access_kind'], string> = {
  external_link: 'Link externo',
  managed_upload: 'Hospedado',
};

// T4.4 (spec 073) — card com alvo de clique unico (o <Link> cobre o card
// inteiro via before:absolute), sem truncamento cego de nome (licao de
// packages/catalog-ui: nome quebra em ate 2 linhas, nunca corta com ellipsis
// forcado que esconde parte do titulo). Fase 6 (spec 086, T6.3): capa real
// quando existe (onError cai pro placeholder), creditos ("Por <credits>" —
// string ja combinada pelo backend, ver types/material.ts), cenario e badge
// de cadeia de sistema/edicao/variante.
export function MaterialCard({ material }: Readonly<MaterialCardProps>) {
  // Spec 087 (T2.5, assinatura da direcao de design) — o credito sobe ACIMA do
  // titulo, em Oswald caixa-alta, porque o proposito do produto e mandar o
  // usuario pro site do autor (D107/D119), o oposto de uma loja que esconde
  // quem fez.
  //
  // Spec 088 (T1.5) — o fallback `'Acervo Artificio'` foi REMOVIDO: o
  // Artificio nao e autor de material importado de terceiro, e afirmar isso
  // contradiz frontalmente o proposito acima. Evitar um buraco visual nao
  // justifica uma afirmacao falsa de autoria.
  //
  // Editora e autoria sao campos DISTINTOS e nenhum e fallback do outro
  // (requisito 30): exibir a editora sob rotulo de autor repetiria o mesmo
  // erro com outro nome. Por isso cada um sai com seu proprio rotulo, e a
  // ordem e publicante primeiro, autor depois (decisao do mantenedor,
  // 2026-07-26).
  //
  // O `.trim()` e obrigatorio, nao estetico: os dois campos vem de scraper e
  // de formulario, entao `""` e `"   "` chegam ate aqui e passariam por um
  // null-check ingenuo, renderizando eyebrow em branco (achado de review da
  // PR #214, CodeRabbit).
  const publisher = material.publisher_name?.trim();
  const author = material.credits?.trim();
  const hasCredit = Boolean(publisher) || Boolean(author);

  return (
    <article className="relative overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] transition hover:border-artificio-orange focus-within:ring-2 focus-within:ring-artificio-orange">
      {/* Capa sangra ate as bordas laterais e o topo (sem padding em volta):
          card com capa e card sem capa passam a ter a MESMA silhueta, o que
          importa porque a maioria dos itens do acervo nao tem cover_image_url.
          Spec 088 (T1.4a): a regra de exibicao (contem sem cortar, piso/teto,
          placeholder desenhado e tratamento de `onError`) vive inteira em
          `MaterialCover` — mesma regra que a ficha usa. */}
      <MaterialCover
        src={material.cover_image_url}
        title={material.title}
        materialType={material.material_type}
        size="card"
      />
      <div className="p-[14px]">
        {/* Sem editora E sem autor, o eyebrow simplesmente nao existe — nenhum
            texto substituto ocupa o lugar (requisito 32). O `mt-1.5` do titulo
            vira `mt-0` nesse caso pra nao sobrar respiro de um elemento
            ausente. */}
        {hasCredit && (
          <p
            className="text-[11px] font-semibold uppercase leading-none tracking-[0.10em] text-[var(--fg)]"
            style={{ fontFamily: 'var(--artificio-font-display)' }}
          >
            {publisher && (
              <span>
                <span className="text-[var(--fg-muted)]">Editora </span>
                {publisher}
              </span>
            )}
            {publisher && author && <span className="text-[var(--fg-muted)]"> · </span>}
            {author && (
              <span>
                <span className="text-[var(--fg-muted)]">Por </span>
                {author}
              </span>
            )}
          </p>
        )}
        <h3
          className={`${hasCredit ? 'mt-1.5' : ''} text-[15px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--fg)] break-words`}
        >
          <Link
            to={`/materiais/${material.slug}`}
            className="before:absolute before:inset-0 focus:outline-none"
          >
            {material.title}
          </Link>
        </h3>
        {material.scenario && (
          <p className="mt-1 text-xs text-[var(--fg-muted)]">Para {material.scenario}</p>
        )}
        {material.summary && (
          <p className="mt-1 text-sm text-[var(--fg-muted)] line-clamp-2">{material.summary}</p>
        )}
        <div className="mt-2">
          <MaterialRating avgRating={material.avg_rating} ratingCount={material.rating_count} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold tracking-[0.02em] text-[var(--fg-muted)]">
          <span className="rounded-full border border-[var(--line)] px-2 py-0.5">{material.material_type}</span>
          <span className="rounded-full border border-[var(--line)] px-2 py-0.5">{ACCESS_LABEL[material.access_kind]}</span>
          {/* T9.4 (spec 084) — D119 garante que TODO material publicado e
              portugues; selo estatico, sem depender de campo dinamico (idioma
              vive em download_material_metadata, join separado nao presente
              nesta listagem). */}
          <span className="rounded-full border border-[var(--line)] px-2 py-0.5">Em português</span>
          <SystemChainBadge
            systemName={material.system_name}
            editionName={material.edition_name}
            variantName={material.variant_name}
          />
        </div>
      </div>
    </article>
  );
}
