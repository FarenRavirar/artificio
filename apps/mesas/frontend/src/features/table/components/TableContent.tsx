import type { TableViewModel } from '../types/tableView.types';

interface TableContentProps {
  vm: TableViewModel;
}

/**
 * Conteúdo narrativo (Engajamento)
 * Ordem: Sobre → Sinopse → Narrativa → Benefícios → Estilo
 */
export function TableContent({ vm }: TableContentProps) {
  return (
    <div className="space-y-6">
      
      {/* Sobre a Mesa */}
      {vm.description && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-bold mb-3">📖 Sobre a Mesa</h2>
          <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
            {vm.description}
          </p>
        </section>
      )}

      {/* Narrativa/Sinopse */}
      {vm.narrative && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-bold mb-3">🎭 História</h2>
          <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
            {vm.narrative}
          </p>
        </section>
      )}

      {/* O que esperar (Benefícios) */}
      {vm.benefits && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-bold mb-3">✨ O que esperar</h2>
          <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
            {vm.benefits}
          </p>
        </section>
      )}

      {/* Estilo de Jogo */}
      {vm.styleText && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-bold mb-3">🎲 Estilo de Jogo</h2>
          <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
            {vm.styleText}
          </p>
        </section>
      )}

      {/* Cenário */}
      {vm.settingName && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-bold mb-3">🗺️ Cenário</h2>
          <p className="text-white/80 font-semibold">{vm.settingName}</p>
          {vm.settingStyles && vm.settingStyles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {vm.settingStyles.map((style, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium"
                >
                  {style}
                </span>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
