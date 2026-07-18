import type { TableViewModel } from '../types/tableView.types';
import { MetaField } from '../../../components/MetaField';
import { Sparkles, Monitor, Video, Mic } from 'lucide-react';

interface TableTechnicalProps {
  vm: TableViewModel;
}

/**
 * Detalhes técnicos da mesa
 * DDAL entra AQUI (certificação da mesa, não do mestre)
 * Covil NÃO entra aqui (Covil = mestre, vai no TableMaster)
 */
export function TableTechnical({ vm }: TableTechnicalProps) {
  const hasCampaignDetails = vm.campaignLength || vm.levelRange;
  const hasBillingDetails = vm.billingText || vm.sessionZeroFree;
  const hasTechnicalRequirements = vm.technicalRequirements || vm.requiresPC || vm.requiresCamera || vm.requiresMicrophone;
  const hasDDAL = vm.certifications.ddal !== undefined;

  // Não renderiza se não houver detalhes técnicos
  if (!hasCampaignDetails && !hasBillingDetails && !hasTechnicalRequirements && !hasDDAL) {
    return null;
  }

  return (
    <div className="space-y-6">
      
      {/* Detalhes da Campanha */}
      {hasCampaignDetails && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-bold mb-4">📊 Detalhes da Campanha</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {vm.campaignLength && (
              <div className="rounded-xl border border-white/10 bg-[#13213f] p-3">
                <p className="text-white/60 text-xs uppercase tracking-wide">Duração</p>
                <p className="font-semibold text-white mt-1">{vm.campaignLength}</p>
              </div>
            )}
            {vm.levelRange && (
              <div className="rounded-xl border border-white/10 bg-[#13213f] p-3">
                <p className="text-white/60 text-xs uppercase tracking-wide">Níveis</p>
                <p className="font-semibold text-white mt-1">{vm.levelRange}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Cobrança */}
      {hasBillingDetails && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-bold mb-4">💰 Sobre a Cobrança</h2>
          {vm.billingText && (
            <p className="text-white/80 leading-relaxed mb-3">{vm.billingText}</p>
          )}
          {vm.sessionZeroFree && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 text-green-300 text-sm font-medium">
              ✓ Sessão zero gratuita
            </div>
          )}
        </section>
      )}

      {/* Requisitos Técnicos */}
      {hasTechnicalRequirements && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-bold mb-4">💻 Requisitos Técnicos</h2>
          {vm.technicalRequirements && (
            <p className="text-white/80 leading-relaxed mb-3">{vm.technicalRequirements}</p>
          )}
          <div className="flex flex-wrap gap-3">
            {vm.requiresPC && (
              <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 text-sm font-semibold">
                <Monitor className="w-5 h-5" /> PC necessário
              </span>
            )}
            {vm.requiresCamera && (
              <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 text-sm font-semibold">
                <Video className="w-5 h-5" /> Câmera necessária
              </span>
            )}
            {vm.requiresMicrophone && (
              <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 text-sm font-semibold">
                <Mic className="w-5 h-5" /> Microfone necessário
              </span>
            )}
          </div>
        </section>
      )}

      {/* DDAL (Certificação da Mesa) */}
      {hasDDAL && vm.certifications.ddal && (
        <section className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-5">
          <h2 className="text-lg font-bold mb-3 inline-flex items-center gap-2 text-amber-100">
            <Sparkles className="w-5 h-5" /> 📜 Detalhes da aventura (DDAL)
          </h2>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <MetaField 
              label="Código da aventura" 
              value={vm.certifications.ddal.code} 
            />
            <MetaField 
              label="Tier" 
              value={vm.certifications.ddal.tier ? `Tier ${vm.certifications.ddal.tier}` : undefined} 
            />
            <MetaField 
              label="Nome da aventura" 
              value={vm.certifications.ddal.name}
              className="md:col-span-2"
            />
            <MetaField 
              label="Season" 
              value={vm.certifications.ddal.season} 
            />
            <MetaField 
              label="Duração esperada" 
              value={vm.certifications.ddal.duration} 
            />
            <MetaField 
              label="Formato" 
              value={vm.certifications.ddal.format} 
            />
            <MetaField 
              label="Organização / Código expandido" 
              value={vm.certifications.ddal.orgCode} 
            />
            <MetaField 
              label="Ambientação" 
              value={vm.certifications.ddal.setting}
              className="md:col-span-2"
            />
            {vm.certifications.ddal.rulesNotes && (
              <div className="rounded-xl border border-amber-200/15 bg-[#13213f]/70 p-3 md:col-span-2">
                <p className="text-amber-100/80 text-xs uppercase tracking-wide">Notas de regras da temporada</p>
                <p className="text-white/85 mt-1 leading-relaxed">{vm.certifications.ddal.rulesNotes}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
