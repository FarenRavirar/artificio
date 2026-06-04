import { Crown, Sparkles } from 'lucide-react';
import { MetaField } from './MetaField';
import type { TableDetail } from '../types/tables';

interface CertificationsSectionProps {
  table: TableDetail;
}

/**
 * Seção unificada de certificações (DDAL + Covil do Lich)
 * Aparece no final da página como detalhe técnico
 */
export function CertificationsSection({ table }: CertificationsSectionProps) {
  const hasCertifications = table.is_ddal || table.is_covil;

  if (!hasCertifications) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-lg font-bold mb-4">📜 Certificações e Detalhes Técnicos</h2>

      <div className="space-y-5">
        {/* Covil do Lich */}
        {table.is_covil && (
          <div className="rounded-xl border border-purple-400/30 bg-purple-500/10 p-4">
            <div className="flex items-start gap-4">
              <img
                src="https://covildolich.com/wp-content/uploads/2025/09/Mestres.webp"
                alt="Selo Covil do Lich"
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                onError={(e) => {
                  // Fallback para ícone se imagem falhar
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="flex-1">
                <h3 className="font-bold text-purple-200 flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5" />
                  Mestre do Covil do Lich
                </h3>
                <p className="text-sm text-white/80 leading-relaxed">
                  Este mestre faz parte do Covil do Lich — mesas com curadoria e padrão elevado de qualidade.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* DDAL */}
        {table.is_ddal && (
          <div className="rounded-xl border border-amber-300/25 bg-amber-400/10 p-4">
            <h3 className="font-bold text-amber-100 flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5" />
              Detalhes da aventura DDAL
            </h3>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <MetaField label="Código da aventura" value={table.ddal_code} />
              <MetaField label="Tier" value={table.ddal_tier ? `Tier ${table.ddal_tier}` : null} />
              <MetaField label="Nome da aventura" value={table.ddal_name} className="md:col-span-2" />
              <MetaField label="Season" value={table.ddal_season} />
              <MetaField label="Duração esperada" value={table.ddal_duration} />
              <MetaField label="Formato" value={table.ddal_format} />
              <MetaField label="Organização / Código expandido" value={table.ddal_org_code} />
              <MetaField label="Ambientação" value={table.ddal_setting} className="md:col-span-2" />
              {table.ddal_rules_notes && (
                <div className="rounded-xl border border-amber-200/15 bg-[#13213f]/70 p-3 md:col-span-2">
                  <p className="text-amber-100/80 text-xs uppercase tracking-wide">Notas de regras da temporada</p>
                  <p className="text-white/85 mt-1 leading-relaxed">{table.ddal_rules_notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
