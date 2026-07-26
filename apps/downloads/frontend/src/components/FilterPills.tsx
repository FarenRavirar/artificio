import { useEffect, useId, useRef, useState } from 'react';
import { FilterControls, type CatalogFilterValues, type FilterGroupKey } from './FilterControls';

interface FilterPillsProps {
  values: CatalogFilterValues;
  onChange: (key: keyof CatalogFilterValues, value: string) => void;
  /** Rotulo legivel do valor ativo, quando houver (ex.: "D&D 5e"). */
  activeLabels: Partial<Record<FilterGroupKey, string>>;
}

const PILLS: readonly { key: FilterGroupKey; label: string }[] = [
  { key: 'material_type', label: 'Tipo' },
  { key: 'system_id', label: 'Sistema' },
  { key: 'edition_id', label: 'Edição' },
];

// Spec 087 (T2.3) — pills de filtro do modo vitrine.
//
// Pill ativa mostra o VALOR no lugar do rotulo ("Sistema: D&D 5e"), mesmo
// vocabulario do chip de busca: filtro e busca sao a mesma operacao pro
// usuario, entao nao podem ter duas gramaticas visuais diferentes. O ⊗ limpa
// o filtro sem abrir o popover.
export function FilterPills({ values, onChange, activeLabels }: Readonly<FilterPillsProps>) {
  const [openPill, setOpenPill] = useState<FilterGroupKey | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  // Escape e clique-fora fecham o popover — mesmas affordances do
  // .artificio-usermenu-dropdown de packages/ui, pra que o comportamento de
  // "camada flutuante" seja um so no produto inteiro.
  useEffect(() => {
    if (!openPill) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPill(null);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenPill(null);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [openPill]);

  return (
    <div ref={containerRef} className="flex flex-wrap gap-2">
      {PILLS.map(({ key, label }) => {
        const activeLabel = values[key] ? activeLabels[key] ?? values[key] : null;
        const isOpen = openPill === key;

        return (
          <div key={key} className="relative">
            <span
              className={[
                'inline-flex h-9 items-center gap-1 rounded-full border px-3 text-sm font-semibold transition',
                activeLabel
                  ? 'border-artificio-orange bg-[rgba(255,87,34,0.10)] text-[var(--artificio-brand-deep)]'
                  : 'border-[var(--line)] bg-[var(--fill-subtle)] text-[var(--fg)] hover:border-[var(--line-strong)] hover:bg-[var(--fill)]',
              ].join(' ')}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={isOpen ? `${popoverId}-${key}` : undefined}
                onClick={() => setOpenPill(isOpen ? null : key)}
                className="focus:outline-none focus-visible:underline"
              >
                {activeLabel ? `${label}: ${activeLabel}` : label}
              </button>
              {activeLabel && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(key, '');
                    setOpenPill(null);
                  }}
                  className="text-base leading-none focus:outline-none focus-visible:underline"
                >
                  <span aria-hidden="true">⊗</span>
                  <span className="sr-only">Remover filtro {label}</span>
                </button>
              )}
            </span>

            {isOpen && (
              <div
                id={`${popoverId}-${key}`}
                className="absolute left-0 top-full z-20 mt-2 max-h-80 w-64 overflow-y-auto rounded-lg border border-[var(--admin-border)] bg-[var(--admin-rail)] shadow-lg"
              >
                <FilterControls
                  values={values}
                  groups={[key]}
                  onChange={(changedKey, value) => {
                    onChange(changedKey, value);
                    setOpenPill(null);
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
