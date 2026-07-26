import { useState } from 'react';
import { Drawer } from '@artificio/ui';
import { useCatalogSystems } from '../hooks/useCatalogSystems';
import { useMaterialFacets } from '../hooks/useMaterialFacets';

export interface CatalogFilterValues {
  material_type: string;
  system_id: string;
  edition_id: string;
}

interface CatalogFilterSidebarProps {
  values: CatalogFilterValues;
  onChange: (key: keyof CatalogFilterValues, value: string) => void;
}

function FilterControls({ values, onChange }: Readonly<CatalogFilterSidebarProps>) {
  const { data: facets } = useMaterialFacets();
  const { data: systems } = useCatalogSystems();

  // T8.1 — material_type NAO e enum: opcoes vem sempre da faceta (so
  // material publicado conta, nunca lista hardcoda); nenhuma opcao com
  // contagem zero e oferecida (ja garantido pelo backend, que so agrega
  // linhas publicadas de fato).
  const materialTypeOptions = facets?.material_types ?? [];

  const systemsById = new Map((systems ?? []).map((system) => [system.id, system]));

  const systemOptions = (facets?.systems ?? []).flatMap((facet) => {
    const system = systemsById.get(facet.id);
    return system && system.node_type === 'system' ? [system] : [];
  });

  // Achado real (review PR #208, CodeRabbit): sem filtrar por parent_id do
  // sistema selecionado, a lista mostrava edicoes de todos os sistemas ao
  // mesmo tempo. Sem sistema selecionado, mantem todas (D073 nao restringe
  // filtro incompleto).
  const editionOptions = (facets?.editions ?? []).flatMap((facet) => {
    const edition = systemsById.get(facet.id);
    if (!edition || edition.node_type !== 'edition') return [];
    if (values.system_id && edition.parent_id !== values.system_id) return [];
    return [edition];
  });

  return (
    <div className="flex flex-col gap-5 p-3">
      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--admin-fg-faint)]">
          Tipo de material
        </h2>
        <div className="flex flex-col gap-1">
          <label className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-1 text-sm text-[var(--admin-fg-low)] hover:bg-[var(--admin-hover)]">
            <input
              type="radio"
              name="material_type"
              checked={values.material_type === ''}
              onChange={() => onChange('material_type', '')}
            />
            Todos
          </label>
          {materialTypeOptions.map((option) => (
            <label
              key={option.id}
              className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-1 text-sm text-[var(--admin-fg-low)] hover:bg-[var(--admin-hover)]"
            >
              <input
                type="radio"
                name="material_type"
                checked={values.material_type === option.id}
                onChange={() => onChange('material_type', option.id)}
              />
              {option.name} ({option.count})
            </label>
          ))}
        </div>
      </section>

      {systemOptions.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--admin-fg-faint)]">
            Sistema
          </h2>
          <div className="flex flex-col gap-1">
            <label className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-1 text-sm text-[var(--admin-fg-low)] hover:bg-[var(--admin-hover)]">
              <input
                type="radio"
                name="system_id"
                checked={values.system_id === ''}
                onChange={() => onChange('system_id', '')}
              />
              Todos
            </label>
            {systemOptions.map((system) => (
              <label
                key={system.id}
                className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-1 text-sm text-[var(--admin-fg-low)] hover:bg-[var(--admin-hover)]"
              >
                <input
                  type="radio"
                  name="system_id"
                  checked={values.system_id === system.id}
                  onChange={() => onChange('system_id', system.id)}
                />
                {system.name}
              </label>
            ))}
          </div>
        </section>
      )}

      {editionOptions.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--admin-fg-faint)]">
            Edição
          </h2>
          <div className="flex flex-col gap-1">
            <label className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-1 text-sm text-[var(--admin-fg-low)] hover:bg-[var(--admin-hover)]">
              <input
                type="radio"
                name="edition_id"
                checked={values.edition_id === ''}
                onChange={() => onChange('edition_id', '')}
              />
              Todas
            </label>
            {editionOptions.map((edition) => (
                <label
                  key={edition.id}
                  className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-1 text-sm text-[var(--admin-fg-low)] hover:bg-[var(--admin-hover)]"
                >
                  <input
                    type="radio"
                    name="edition_id"
                    checked={values.edition_id === edition.id}
                    onChange={() => onChange('edition_id', edition.id)}
                  />
                  {edition.name}
                </label>
              ))}
          </div>
        </section>
      )}
    </div>
  );
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
