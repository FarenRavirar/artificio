import type { MasterViewModel } from '../types/masterView.types';
import { TableHero } from '../../table/components/TableHero';
import { TableActionPanel } from '../../table/components/TableActionPanel';

interface MasterTablesProps {
  vm: MasterViewModel;
}

/**
 * Lista de mesas do mestre
 * 
 * Responsabilidades:
 * - Mostrar portfólio de mesas
 * - REUSO MASSIVO: TableHero + TableActionPanel
 * - Ordenação: mesas com vagas primeiro (já vem do mapper)
 * - Highlight na primeira mesa (mais relevante)
 * - Badge "Disponível" nas mesas com vagas
 */
export function MasterTables({ vm }: MasterTablesProps) {
  if (vm.tables.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-white/60">Este mestre ainda não publicou mesas.</p>
      </section>
    );
  }

  const availableTables = vm.tables.filter(t => t.slotsLeft > 0).length;

  return (
    <section className="space-y-4" id="mesas-section">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">
          Mesas deste mestre ({vm.tables.length})
        </h2>
        
        {availableTables > 0 && (
          <span className="text-sm text-green-400 font-medium">
            {availableTables} {availableTables === 1 ? 'mesa disponível' : 'mesas disponíveis'}
          </span>
        )}
      </div>
      
      {vm.tables.map((table, index) => (
        <div 
          key={table.id} 
          className={`rounded-2xl border bg-white/5 p-5 space-y-4 ${
            index === 0 
              ? 'border-purple-500/50 ring-2 ring-purple-500/30' 
              : 'border-white/10'
          }`}
        >
          {/* Badge de disponibilidade */}
          {table.slotsLeft > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-green-300 text-xs font-semibold">
              ✓ Disponível ({table.slotsLeft} {table.slotsLeft === 1 ? 'vaga' : 'vagas'})
            </div>
          )}
          
          {/* REUSO: TableHero em modo compacto */}
          <TableHero vm={table} variant="compact" />
          
          {/* REUSO: TableActionPanel em modo compacto */}
          <TableActionPanel vm={table} variant="compact" />
        </div>
      ))}
    </section>
  );
}
