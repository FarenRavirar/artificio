import { Users, Dices, Tag } from 'lucide-react';

interface ClosedGroupInfo {
  enabled: boolean;
  systems: Array<{ id: string; name: string }>;
  description: string | null;
  min_price_cents: number | null;
}

interface Props {
  closedGroup: ClosedGroupInfo | null | undefined;
}

function formatPriceBRL(cents: number | null): string | null {
  if (cents == null) return null;
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function MestreClosedGroupSection({ closedGroup }: Props) {
  if (!closedGroup?.enabled) return null;

  const price = formatPriceBRL(closedGroup.min_price_cents);

  const handleScrollToContact = () => {
    const el = document.getElementById('contato');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      document.getElementById('mesas')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="closed-group-section" id="grupo-fechado">
      <div className="container">
        <div className="closed-group-badge">
          <Users className="w-4 h-4" />
          <span>Oferta especial</span>
        </div>

        <h2 className="section-title">Disponível para grupos fechados</h2>

        <p className="closed-group-description">
          {closedGroup.description ||
            'Tem um grupo fechado de amigos? Mestro campanhas exclusivas com horários flexíveis e experiência personalizada para o seu grupo.'}
        </p>

        {closedGroup.systems.length > 0 && (
          <div className="closed-group-systems">
            <h3 className="closed-group-subtitle">
              <Dices className="w-4 h-4" /> Sistemas aceitos
            </h3>
            <div className="closed-group-chips">
              {closedGroup.systems.map((s) => (
                <span key={s.id} className="closed-group-chip">
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {price && (
          <div className="closed-group-price">
            <Tag className="w-4 h-4" />
            <span>
              A partir de <strong>{price}</strong>
            </span>
          </div>
        )}

        <button
          type="button"
          className="cta-button cta-button-large"
          onClick={handleScrollToContact}
        >
          Solicitar orçamento
        </button>
      </div>
    </section>
  );
}
