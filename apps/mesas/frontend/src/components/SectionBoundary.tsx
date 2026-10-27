import type { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface Props {
  /** Nome da seção, só para a mensagem ("Não foi possível exibir {nome}."). */
  readonly name: string;
  readonly children: ReactNode;
}

/**
 * Contenção por seção (spec 106 R18). O `ErrorBoundary` de rota derruba a pagina
 * inteira por um componente so; foi o que o `redfallen` viu em 2026-09-30 (aba
 * Mestre inteira fora do ar por 13 dias). Aqui o erro fica na secao: o resto da
 * pagina segue, e o `ErrorBoundary` ja relata o erro ao servidor (R19).
 */
export function SectionBoundary({ name, children }: Props) {
  return (
    <ErrorBoundary
      fallback={
        <p role="alert" className="text-[var(--fg-soft)]">
          Não foi possível exibir {name}. O restante da página continua disponível.
        </p>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
