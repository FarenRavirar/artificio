import type { TableDetail } from '../../types/tables';
import { useTableViewModel } from './hooks/useTableViewModel';
import { DecisionBlock } from './blocks/DecisionBlock';
import { EngagementBlock } from './blocks/EngagementBlock';
import { TechnicalBlock } from './blocks/TechnicalBlock';
import { TableActionPanel } from './components/TableActionPanel';

interface TableViewProps {
  table: TableDetail;
  variant?: 'full' | 'preview';
}

/**
 * Container principal da feature Table
 * Compõe todos os blocos: Decision → Engagement → Technical
 * Reutilizável em: MesaPage, Catálogo, Busca, Painel
 */
export function TableView({ table, variant = 'full' }: TableViewProps) {
  const vm = useTableViewModel(table);

  // Se vm for null, não renderiza nada (não deveria acontecer pois table é obrigatório)
  if (!vm) return null;

  return (
    <div className="space-y-6">
      {/* Bloco de Decisão */}
      <DecisionBlock vm={vm} />

      {/* Grid: Engajamento + Action Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Engajamento (2 colunas) */}
        <div className="lg:col-span-2">
          <EngagementBlock vm={vm} />
        </div>
        
        {/* Action Panel (1 coluna, sticky) */}
        {variant === 'full' && (
          <TableActionPanel vm={vm} />
        )}
      </div>

      {/* Bloco Técnico */}
      <TechnicalBlock vm={vm} />
    </div>
  );
}
