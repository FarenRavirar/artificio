import type { TableViewModel } from '../types/tableView.types';
import { Shield, AlertTriangle } from 'lucide-react';
import { getContentWarningDescription, getSafetyToolDescription } from '../../../utils/safetyToolsGlossary';

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
              {vm.contentWarnings.map((warning) => {
                const description = getContentWarningDescription(warning);
                return (
                  <span
                    key={warning}
                    className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 text-xs font-medium"
                    title={description ?? undefined}
                  >
                    {warning}
                  </span>
                );
              })}
            </div>
            {/* Descrições completas abaixo (title de span não é acessível/visível no mobile) */}
            {vm.contentWarnings.some((w) => getContentWarningDescription(w)) && (
              <ul className="mt-2 space-y-1 text-xs text-white/50">
                {vm.contentWarnings.map((warning) => {
                  const description = getContentWarningDescription(warning);
                  return description ? <li key={warning}><strong className="text-white/70">{warning}:</strong> {description}</li> : null;
                })}
              </ul>
            )}
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
              {vm.safetyTools.map((tool) => {
                const description = getSafetyToolDescription(tool);
                return (
                  <span
                    key={tool}
                    className="px-3 py-1 rounded-full bg-green-500/20 text-green-300 text-xs font-medium"
                    title={description ?? undefined}
                  >
                    {tool}
                  </span>
                );
              })}
            </div>
            {vm.safetyTools.some((t) => getSafetyToolDescription(t)) && (
              <ul className="mt-2 space-y-1 text-xs text-white/50">
                {vm.safetyTools.map((tool) => {
                  const description = getSafetyToolDescription(tool);
                  return description ? <li key={tool}><strong className="text-white/70">{tool}:</strong> {description}</li> : null;
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
