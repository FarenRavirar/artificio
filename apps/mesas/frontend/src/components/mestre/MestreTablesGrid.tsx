import { TableCardComponent } from '../TableCard';
import type { TableCard } from '../../types/tables';

interface Props {
  tables: TableCard[];
}

export function MestreTablesGrid({ tables }: Props) {
  if (tables.length === 0) return null;

  return (
    <div className="tables-grid">
      {tables.map((t) => (
        <TableCardComponent key={t.id} table={t} />
      ))}
    </div>
  );
}
