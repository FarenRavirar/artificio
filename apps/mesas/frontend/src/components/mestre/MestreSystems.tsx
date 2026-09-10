import { Dices } from 'lucide-react';
import { Badge } from '@artificio/ui';

interface MestreSystemsProps {
  readonly systems: Array<{ id: string; name: string }>;
}

/**
 * Sistemas que o mestre mestra, no perfil público (spec 100 F6.3c/D25).
 *
 * O campo existe no editor desde sempre ("Sistemas que Mestra",
 * `UserSystemsSelector type="gm"`, gravando em `user_systems`), mas a rota
 * pública nunca consultou a tabela — o mestre preenchia e o visitante não via.
 *
 * **Posição (D25): antes dos VTTs.** A ordem em que o jogador decide é
 * sistema → VTT → plataforma de comunicação; a seção segue essa sequência, e é
 * por isso que ela é montada em `MestrePage` antes de `MestreVttPlatforms`.
 *
 * A moldura é a mesma de `MestreVttPlatforms` (fundo `--fill-5`, borda,
 * `--radius-lg`, título em `--text-title`) para as duas lerem como o mesmo tipo
 * de resposta ao visitante, e não como duas invenções de seção.
 */
export function MestreSystems({ systems }: MestreSystemsProps) {
  if (!systems || systems.length === 0) {
    return null;
  }

  return (
    <section
      id="sistemas"
      className="p-6 rounded-[var(--radius-lg)] bg-[var(--fill-5)] border border-[var(--border)]"
    >
      <h3 className="flex items-center gap-2 text-[length:var(--text-title)] leading-[var(--leading-title)] font-[var(--weight-strong)] text-[var(--fg)] mb-4">
        <Dices className="w-5 h-5" aria-hidden="true" /> Sistemas que eu mestro
      </h3>

      <div className="flex flex-wrap gap-2">
        {systems.map((system) => (
          // `neutral`, não `brand`: `brand` pinta `--state-brand-*`, que é o
          // laranja de marca (`rgba(255, 87, 34, …)`), e D6/requisito 10
          // reservam o laranja para AÇÃO — botão primário, link, anel de foco.
          // Estes chips são texto informativo, sem destino nenhum (achado de
          // review, PR #310). O `brand` que sobrevive no hero está num chip que
          // É ação: leva à descrição do destaque.
          <Badge key={system.id} variant="neutral">
            {system.name}
          </Badge>
        ))}
      </div>
    </section>
  );
}
