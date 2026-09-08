import { resolveSellingPointIcon, type SellingPoint } from './sellingPointIcons';

interface Props {
  sellingPoints: SellingPoint[] | null | undefined;
}

/**
 * Exibição de `selling_points` na página pública ("O que eu ofereço").
 *
 * O dicionário de ícones vive no módulo `sellingPointIcons.ts` — fonte única
 * com o editor (spec 099 B4/A7); aqui só a resolução com fallback `Sparkles`.
 * Defesa contra JSONB sujo (`{}` do achado A1) fica no hook (`useMestre`),
 * que já normaliza antes de chegar a este componente — o `Array.isArray`
 * é a segunda linha, barata e sem comportamento.
 */
export function MestreSellingPoints({ sellingPoints }: Props) {
  if (!Array.isArray(sellingPoints) || sellingPoints.length === 0) return null;

  // `id="destaques"`: alvo do indicador de continuação do hero (spec 100
  // F6.1d2/D28). O "+N" dos destaques leva a ESTA seção, não à "Em resumo" —
  // são listas diferentes, sob títulos diferentes.
  return (
    <section className="why-section" id="destaques">
      <div className="container">
        <h3 className="section-title">O que eu ofereço</h3>
        <div className="benefits-grid">
          {sellingPoints.map((sp, idx) => {
            const Icon = resolveSellingPointIcon(sp.icon);
            return (
              <div key={idx} className="benefit-card">
                <Icon className="benefit-icon" />
                <h3>{sp.title}</h3>
                <p>{sp.description}</p>
                {sp.highlight && (
                  <span className="benefit-highlight">{sp.highlight}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
