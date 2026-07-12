import { Link } from 'react-router-dom';
import type { Material } from '../types/material';

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
// forcado que esconde parte do titulo).
export function MaterialCard({ material }: Readonly<MaterialCardProps>) {
  return (
    <article className="relative rounded-lg border border-white/10 bg-[var(--color-artificio-blue-light)] p-4 transition hover:border-artificio-orange focus-within:ring-2 focus-within:ring-artificio-orange">
      <div className="mb-3 flex h-32 items-center justify-center rounded bg-black/20 text-sm text-white/50">
        Sem capa
      </div>
      <h3 className="text-base font-semibold leading-snug text-white break-words">
        <Link
          to={`/materiais/${material.slug}`}
          className="before:absolute before:inset-0 focus:outline-none"
        >
          {material.title}
        </Link>
      </h3>
      {material.summary && (
        <p className="mt-1 text-sm text-white/70 line-clamp-2">{material.summary}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/60">
        <span className="rounded-full border border-white/20 px-2 py-0.5">{material.material_type}</span>
        <span className="rounded-full border border-white/20 px-2 py-0.5">{ACCESS_LABEL[material.access_kind]}</span>
      </div>
    </article>
  );
}
