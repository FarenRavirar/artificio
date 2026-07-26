import { useCatalogSystems } from '../hooks/useCatalogSystems';
import { useMaterialFacets } from '../hooks/useMaterialFacets';

export interface CatalogFilterValues {
  material_type: string;
  system_id: string;
  edition_id: string;
}

export interface FilterControlsProps {
  values: CatalogFilterValues;
  onChange: (key: keyof CatalogFilterValues, value: string) => void;
  /**
   * Quais grupos renderizar. Omitido = todos (uso da sidebar/drawer). As pills
   * (T2.3) passam um grupo so, porque cada pill e um recorte do MESMO controle.
   */
  groups?: readonly FilterGroupKey[];
}

export type FilterGroupKey = keyof CatalogFilterValues;

const RADIO_CLASS =
  'flex min-h-11 items-center gap-2 rounded-lg px-2 py-1 text-sm text-[var(--admin-fg-low)] hover:bg-[var(--admin-hover)]';
const GROUP_TITLE_CLASS =
  'mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--admin-fg-faint)]';

// Spec 087 (T2.3) — extraido de CatalogFilterSidebar.tsx sem reescrita: a
// sidebar/drawer (D108) e as pills de vitrine consomem o MESMO controle, entao
// filtrar pela lateral ou pela pill nao pode divergir em comportamento nem em
// vocabulario. `groups` so recorta o que aparece; a logica de opcoes e unica.
export function FilterControls({ values, onChange, groups }: Readonly<FilterControlsProps>) {
  const { data: facets } = useMaterialFacets();
  const { data: systems } = useCatalogSystems();

  const shows = (group: FilterGroupKey) => !groups || groups.includes(group);

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
      {shows('material_type') && (
        <section>
          <h2 className={GROUP_TITLE_CLASS}>Tipo de material</h2>
          <div className="flex flex-col gap-1">
            <label className={RADIO_CLASS}>
              <input
                type="radio"
                name="material_type"
                checked={values.material_type === ''}
                onChange={() => onChange('material_type', '')}
              />
              Todos
            </label>
            {materialTypeOptions.map((option) => (
              <label key={option.id} className={RADIO_CLASS}>
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
      )}

      {shows('system_id') && systemOptions.length > 0 && (
        <section>
          <h2 className={GROUP_TITLE_CLASS}>Sistema</h2>
          <div className="flex flex-col gap-1">
            <label className={RADIO_CLASS}>
              <input
                type="radio"
                name="system_id"
                checked={values.system_id === ''}
                onChange={() => onChange('system_id', '')}
              />
              Todos
            </label>
            {systemOptions.map((system) => (
              <label key={system.id} className={RADIO_CLASS}>
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

      {shows('edition_id') && editionOptions.length > 0 && (
        <section>
          <h2 className={GROUP_TITLE_CLASS}>Edição</h2>
          <div className="flex flex-col gap-1">
            <label className={RADIO_CLASS}>
              <input
                type="radio"
                name="edition_id"
                checked={values.edition_id === ''}
                onChange={() => onChange('edition_id', '')}
              />
              Todas
            </label>
            {editionOptions.map((edition) => (
              <label key={edition.id} className={RADIO_CLASS}>
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
