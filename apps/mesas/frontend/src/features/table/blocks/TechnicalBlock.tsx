import type { TableViewModel } from '../types/tableView.types';
import { TableTechnical } from '../components/TableTechnical';

interface TechnicalBlockProps {
  vm: TableViewModel;
}

/**
 * Bloco Técnico - Detalhes finais
 * Compõe: Detalhes técnicos + Certificações (DDAL)
 */
export function TechnicalBlock({ vm }: TechnicalBlockProps) {
  return (
    <div className="space-y-6">
      <TableTechnical vm={vm} />
    </div>
  );
}
