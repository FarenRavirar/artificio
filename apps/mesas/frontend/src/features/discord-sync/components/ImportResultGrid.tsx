import type { ImportResult } from '../hooks/useJsonImport';
import { StatCard } from './StatCard';

interface ImportResultGridProps {
  readonly result: ImportResult;
  readonly onNavigateToDrafts?: () => void;
}

export function ImportResultGrid({ result, onNavigateToDrafts }: ImportResultGridProps) {
  return (
    <div className="rounded-lg bg-green-900/20 border border-green-600/30 p-4 space-y-3">
      <p className="text-green-300 font-semibold">Importação concluída</p>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <StatCard label="Total" value={result.total} />
        <StatCard label="Importadas" value={result.inserted} valueClassName="text-green-300 text-lg font-bold" />
        <StatCard label="Atualizadas" value={result.updated} valueClassName="text-blue-300 text-lg font-bold" />
        <StatCard label="Ignoradas" value={result.ignored} valueClassName="text-white/70 text-lg font-bold" />
        <StatCard label="Falhas" value={result.failed} valueClassName={`text-lg font-bold ${result.failed > 0 ? 'text-red-300' : 'text-white/70'}`} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-xs">
          As mensagens importadas estão com status "Pendente".
          Apure-as para gerar drafts revisáveis.
        </p>
        {onNavigateToDrafts && (
          <button
            onClick={onNavigateToDrafts}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Ver drafts
          </button>
        )}
      </div>
    </div>
  );
}
