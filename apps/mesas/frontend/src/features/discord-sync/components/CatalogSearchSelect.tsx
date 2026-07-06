import { useMemo } from 'react';
import type { SimpleCatalogEntry } from '../draftFormUtils';
import { SearchSelect, type SearchSelectOption } from './SearchSelect';

interface CatalogSearchSelectProps {
  items: SimpleCatalogEntry[];
  value: string;
  loading: boolean;
  placeholder: string;
  onChange: (id: string) => void;
}

export function CatalogSearchSelect({ items, value, loading, placeholder, onChange }: Readonly<CatalogSearchSelectProps>) {
  const options = useMemo<SearchSelectOption[]>(
    () => items.map((item) => ({ id: item.id, label: item.name, searchText: item.name })),
    [items],
  );

  return (
    <SearchSelect
      options={options}
      value={value}
      loading={loading}
      placeholder={placeholder}
      emptyLabel="Nenhum resultado encontrado."
      clearLabel="Limpar seleção"
      onChange={onChange}
    />
  );
}
