import { useState } from 'react';
import { Drawer } from '@artificio/ui';
import { FilterControls, type CatalogFilterValues } from './FilterControls';

export type { CatalogFilterValues };

interface CatalogFilterSidebarProps {
  values: CatalogFilterValues;
  onChange: (key: keyof CatalogFilterValues, value: string) => void;
}

// T8.2 (spec 086) — sidebar ≥ 1024px / drawer abaixo (D108, firme), usando o
// Drawer de packages/ui (backdrop/Escape/foco preso ja resolvidos, T5C.4) e
// os tokens do kit administrativo (--admin-*, Fase 5B) — mesmo vocabulario
// visual de rail/agrupamento do GestaoShell, sem inventar aparencia propria
// (requisito 22). NAO e o AdminSidebar (semantica diferente: filtro, nao
// navegacao), mas le como o mesmo sistema.
export function CatalogFilterSidebar({ values, onChange }: Readonly<CatalogFilterSidebarProps>) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <div className="hidden lg:block lg:w-64 lg:shrink-0">
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-rail)]">
          <FilterControls values={values} onChange={onChange} />
        </div>
      </div>

      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
          className="min-h-[44px] min-w-[44px] rounded-md border border-[var(--admin-border)] px-4 py-2 text-sm text-[var(--fg)]"
        >
          Filtros
        </button>

        <Drawer open={drawerOpen} title="Filtros" side="left" onClose={() => setDrawerOpen(false)}>
          <FilterControls values={values} onChange={onChange} />
        </Drawer>
      </div>
    </>
  );
}
