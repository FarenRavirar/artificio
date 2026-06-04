import { useNavigate } from 'react-router-dom';
import type { MasterViewModel } from '../types/masterView.types';

interface MasterActionsProps {
  vm: MasterViewModel;
}

/**
 * Ações contextuais do perfil
 * 
 * Responsabilidades:
 * - Mostrar ações apenas para o dono (isOwner)
 * - Enviar edições para o fluxo canônico da aba Mestre
 */
export function MasterActions({ vm }: MasterActionsProps) {
  const navigate = useNavigate();

  if (!vm.isOwner) return null;

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <button
          onClick={() => navigate('/perfil?tab=mestre')}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors font-medium"
        >
          ✏️ Editar perfil
        </button>
        
        <button
          onClick={() => navigate('/perfil?tab=mestre')}
          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors font-medium"
        >
          🖼️ Trocar foto
        </button>
      </div>
    </div>
  );
}
