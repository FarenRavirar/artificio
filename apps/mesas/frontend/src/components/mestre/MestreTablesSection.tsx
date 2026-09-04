import type { TableCard } from '../../types/tables';
import { MestreFeaturedTable } from './MestreFeaturedTable';
import { MestreTablesGrid } from './MestreTablesGrid';

interface Props {
  mappedTables: TableCard[];
}

export function MestreTablesSection({ mappedTables }: Props) {
  const featured = mappedTables.find((t) => t.featured);
  const others = mappedTables.filter((t) => !t.featured);

  const hasAny = mappedTables.length > 0;

  return (
    // Sem `id="mesas"`: a âncora passou ao grupo "Mesas e avaliações" (T3.1a),
    // que envolve esta seção e a de avaliações. Mantê-lo aqui duplicaria o id na
    // página, e `getElementById` devolveria o primeiro elemento — rolando para
    // dentro do grupo, abaixo do próprio título.
    <section className="tables-section">
      <div className="container">
        <h2 className="section-title">Mesas Disponíveis</h2>

        {hasAny && others.length > 0 && (
          <p className="tables-subtitle">
            Escolha a mesa perfeita para você e comece sua aventura hoje mesmo!
          </p>
        )}

        {featured && <MestreFeaturedTable table={featured} />}
        {others.length > 0 && <MestreTablesGrid tables={others} />}

        {!hasAny && (
          <div className="no-tables">
            <p>Este mestre ainda não possui mesas ativas.</p>
            <p className="no-tables-hint">Volte em breve para conferir novas aventuras!</p>
          </div>
        )}
      </div>
    </section>
  );
}
