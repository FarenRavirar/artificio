import type { TableViewModel } from '../types/tableView.types';
import { Shield, AlertTriangle } from 'lucide-react';

interface TableSecurityProps {
  vm: TableViewModel;
}

/**
 * Segurança: Content Warnings + Safety Tools
 * Nunca mostra "Não informado" - render only if exists
 */
export function TableSecurity({ vm }: TableSecurityProps) {
  const hasContentWarnings = vm.contentWarnings.length > 0;
  const hasSafetyTools = vm.safetyTools.length > 0;

  // Não renderiza se não houver nenhuma informação de segurança
  if (!hasContentWarnings && !hasSafetyTools) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-lg font-bold mb-4">🛡️ Segurança e Conforto</h2>
      
      <div className="space-y-4">
        {/* Content Warnings */}
        {hasContentWarnings && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <h3 className="font-semibold text-white">Avisos de Conteúdo</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {vm.contentWarnings.map((warning, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 text-xs font-medium"
                >
                  {warning}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Safety Tools */}
        {hasSafetyTools && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-green-400" />
              <h3 className="font-semibold text-white">Ferramentas de Segurança</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {vm.safetyTools.map((tool, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full bg-green-500/20 text-green-300 text-xs font-medium"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
