import { Edit, Trash2 } from 'lucide-react';
import type { System } from './types';

interface SystemsListProps {
  systems: System[];
  onEdit: (system: System) => void;
  onDelete: (id: string, name: string) => void;
}

export function SystemsList({ systems, onEdit, onDelete }: SystemsListProps) {
  if (systems.length === 0) {
    return (
      <div className="text-center py-12 text-white/50">
        Nenhum sistema encontrado
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {systems.map((sys) => (
        <div
          key={sys.id}
          className="bg-[#1B2A4A]/50 border border-white/10 rounded-lg p-4 hover:border-white/20 transition-colors flex items-center justify-between"
        >
          <div>
            <h3 className="text-lg font-bold text-white">{sys.name}</h3>
            <p className="text-sm text-white/60">
              Slug: {sys.slug} | Tipo: {sys.node_type}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(sys)}
              className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              title="Editar"
            >
              <Edit className="w-5 h-5" />
            </button>
            <button
              onClick={() => onDelete(sys.id, sys.name)}
              className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              title="Deletar"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
