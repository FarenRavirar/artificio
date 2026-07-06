import { useMemo } from 'react';
import type { SystemTreeNode } from '../../../types/systems';
import { SearchSelect, type SearchSelectOption } from './SearchSelect';

interface SystemSearchSelectProps {
  systems: SystemTreeNode[];
  value: string;
  loading: boolean;
  onChange: (systemId: string) => void;
}

export function SystemSearchSelect({ systems, value, loading, onChange }: Readonly<SystemSearchSelectProps>) {
  const options = useMemo<SearchSelectOption[]>(
    () => systems.map((system) => {
      const label = system.name_pt || system.name;
      return {
        id: system.id,
        label,
        searchText: [system.name, system.name_pt, ...(system.aliases ?? [])].filter(Boolean).join(' '),
      };
    }),
    [systems],
  );

  return (
    <SearchSelect
      options={options}
      value={value}
      loading={loading}
      placeholder="Buscar sistema..."
      emptyLabel="Nenhum sistema encontrado."
      onChange={onChange}
    />
  );
}
