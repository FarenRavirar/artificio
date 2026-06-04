import type { TableCard } from '../../types/tables';
import { getSlotsVisualState } from '../../utils/slots';

interface Props {
  totalOpenSlots: number;
  tablesCount: number;
  mappedTables: TableCard[];
}

export function MestreFinalCta({ totalOpenSlots, tablesCount, mappedTables }: Props) {
  // Calcular métricas reais do portfólio
  const totalSlots = mappedTables.reduce((acc, t) => acc + t.slots_total, 0);
  const occupancyRate = totalSlots > 0 ? (totalSlots - totalOpenSlots) / totalSlots : 0;

  // Detectar mesas urgentes (≤2 vagas e não lotadas)
  const hasUrgentTable = mappedTables.some((t) => {
    const { isUrgent, isFull } = getSlotsVisualState(t);
    return isUrgent && !isFull;
  });

  // Definir cenário baseado em dados reais
  let ctaData: { emoji: string; title: string; subtitle: string; cta: string; hint: string | null };

  if (totalOpenSlots === 0) {
    // Cenário 1: Totalmente lotado
    ctaData = {
      emoji: '📋',
      title: 'Lista de espera disponível',
      subtitle: 'Entre em contato para ser avisado quando abrirem novas vagas',
      cta: 'Entrar na lista de espera',
      hint: 'Vamos te avisar assim que uma vaga abrir.'
    };
  } else if (hasUrgentTable || occupancyRate >= 0.75) {
    // Cenário 2: Urgente (mesa crítica OU 75%+ ocupado)
    ctaData = {
      emoji: '🔥',
      title: 'Últimas vagas disponíveis',
      subtitle: `${totalOpenSlots} ${totalOpenSlots === 1 ? 'vaga restante' : 'vagas restantes'} em ${tablesCount} ${tablesCount === 1 ? 'mesa' : 'mesas'}`,
      cta: 'Ver mesas e garantir vaga',
      hint: '⏰ As vagas preenchem rápido. Não perca sua chance!'
    };
  } else if (occupancyRate >= 0.5) {
    // Cenário 3: Preenchendo (50-74% ocupado)
    ctaData = {
      emoji: '⚡',
      title: 'Vagas preenchendo rápido',
      subtitle: `${totalOpenSlots} vagas disponíveis — garanta a sua antes que acabem`,
      cta: 'Ver mesas disponíveis',
      hint: 'A maioria das mesas já tem jogadores confirmados.'
    };
  } else {
    // Cenário 4: Disponível (< 50% ocupado)
    ctaData = {
      emoji: '✨',
      title: 'Vagas abertas para novas aventuras',
      subtitle: `${totalOpenSlots} vagas disponíveis em ${tablesCount} ${tablesCount === 1 ? 'mesa ativa' : 'mesas ativas'}`,
      cta: 'Explorar mesas',
      hint: null
    };
  }

  return (
    <section className="final-cta-section">
      <div className="container">
        <div className="final-cta-card">
          <h2>{ctaData.emoji} {ctaData.title}</h2>
          <p className="final-cta-subtitle">
            {ctaData.subtitle}
          </p>
          <a href="#mesas" className="cta-button cta-button-large">
            {ctaData.cta}
          </a>
          {ctaData.hint && (
            <p className="final-cta-hint">
              {ctaData.hint}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
