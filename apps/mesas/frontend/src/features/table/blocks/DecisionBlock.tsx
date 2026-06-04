import type { TableViewModel } from '../types/tableView.types';
import { TableHero } from '../components/TableHero';
import { TableSchedules } from '../components/TableSchedules';

interface DecisionBlockProps {
  vm: TableViewModel;
}

/**
 * Bloco de Decisão - Usuário decide em 3 segundos
 * Compõe: Hero + Horários
 */
export function DecisionBlock({ vm }: DecisionBlockProps) {
  return (
    <div className="space-y-6">
      <TableHero vm={vm} variant="full" />
      <TableSchedules vm={vm} />
    </div>
  );
}
