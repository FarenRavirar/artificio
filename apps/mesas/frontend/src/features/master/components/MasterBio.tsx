import type { MasterViewModel } from '../types/masterView.types';

interface MasterBioProps {
  vm: MasterViewModel;
}

/**
 * Bio do mestre
 * 
 * Responsabilidades:
 * - Mostrar descrição/apresentação do mestre
 * - Renderizar apenas se houver bio
 */
export function MasterBio({ vm }: MasterBioProps) {
  if (!vm.bio) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-lg font-bold mb-3">Sobre o Mestre</h3>
      <p className="text-white/80 leading-relaxed whitespace-pre-wrap">{vm.bio}</p>
    </section>
  );
}
