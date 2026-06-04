import type { TableViewModel } from '../types/tableView.types';
import { TableContent } from '../components/TableContent';
import { TableMaster } from '../components/TableMaster';
import { TableSecurity } from '../components/TableSecurity';

interface EngagementBlockProps {
  vm: TableViewModel;
}

/**
 * Bloco de Engajamento - Usuário quer jogar
 * Compõe: Conteúdo + Mestre + Segurança
 */
export function EngagementBlock({ vm }: EngagementBlockProps) {
  return (
    <div className="space-y-6">
      <TableContent vm={vm} />
      <TableMaster vm={vm} />
      <TableSecurity vm={vm} />
    </div>
  );
}
