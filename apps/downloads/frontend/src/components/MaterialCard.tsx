import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Material } from '../types/material';
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
  const [coverFailed, setCoverFailed] = useState(false);
  const [lastCoverUrl, setLastCoverUrl] = useState(material.cover_image_url);
  if (material.cover_image_url !== lastCoverUrl) {
    setLastCoverUrl(material.cover_image_url);
    setCoverFailed(false);
  }
  const showCover = Boolean(material.cover_image_url) && !coverFailed;

  return (
    <article className="relative rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] p-4 transition hover:border-artificio-orange focus-within:ring-2 focus-within:ring-artificio-orange">
      {showCover ? (
        <img
          src={material.cover_image_url ?? undefined}
          alt={`Capa de ${material.title}`}
          className="mb-3 h-32 w-full rounded object-cover"
          onError={() => setCoverFailed(true)}
        />
      ) : (
        <div className="mb-3 flex h-32 items-center justify-center rounded bg-[var(--surface-strong)] text-sm text-[var(--fg-muted)]">
          Sem capa
        </div>
      )}
      <h3 className="text-base font-semibold leading-snug text-[var(--fg)] break-words">
        <Link
          to={`/materiais/${material.slug}`}
          className="before:absolute before:inset-0 focus:outline-none"
        >
          {material.title}
        </Link>
      </h3>
      {material.credits && (
        <p className="mt-1 text-xs text-[var(--fg-muted)]">Por {material.credits}</p>
      )}
      {material.scenario && (
        <p className="mt-0.5 text-xs text-[var(--fg-muted)]">Para {material.scenario}</p>
      )}
      {material.summary && (
        <p className="mt-1 text-sm text-[var(--fg-muted)] line-clamp-2">{material.summary}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--fg-muted)]">
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
    </article>
  );
}
