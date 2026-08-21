import type { TableViewModel } from '../types/tableView.types';
import { MarkdownContent } from '@artificio/content-editor';

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
          <MarkdownContent value={vm.description} className="text-white/80 leading-relaxed" />
        </section>
      )}

      {/* Narrativa/Sinopse */}
      {vm.narrative && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-bold mb-3">🎭 História</h2>
          <MarkdownContent value={vm.narrative} className="text-white/80 leading-relaxed" />
        </section>
      )}

      {/* O que esperar (Benefícios) */}
      {vm.benefits && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-bold mb-3">✨ O que esperar</h2>
          <MarkdownContent value={vm.benefits} className="text-white/80 leading-relaxed" />
        </section>
      )}

      {/* Estilo de Jogo */}
      {vm.styleText && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-bold mb-3">🎲 Estilo de Jogo</h2>
          <MarkdownContent value={vm.styleText} className="text-white/80 leading-relaxed" />
        </section>
      )}

      {/* Cenário (R24, spec 093): cenário do catálogo + ambientação livre.
          Antes só `settingName` era exibido; `scenario` (selecionado no catálogo)
          ficava fora da página mesmo preenchido. */}
      {(vm.scenario || vm.settingName) && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-bold mb-3">🗺️ Cenário</h2>
          {vm.scenario && (
            <p className="text-white/80 font-semibold">{vm.scenario}</p>
          )}
          {vm.settingName && (
            <p className="text-white/80 leading-relaxed">{vm.settingName}</p>
          )}
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
