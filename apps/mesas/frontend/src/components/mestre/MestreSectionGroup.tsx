import { Children, type ReactNode } from 'react';

interface Props {
  id: string;
  title: string;
  children: ReactNode;
}

/**
 * Grupo de seções do perfil público (T3.1a / D5a): os 11 blocos empilhados
 * passam a três âncoras — Sobre, Mesas, Contato — mais hero e CTA final.
 *
 * **Estado vazio (D20).** O grupo some inteiro, título incluído, quando nenhum
 * filho renderiza. Não é detalhe estético: os quatro componentes do grupo Sobre
 * (`MestreBio`, `MestreHighlights`, `MestreSellingPoints`, `MestreVttPlatforms`)
 * retornam `null` quando não há dado, então um mestre recém-criado veria três
 * títulos de seção sobre corpo vazio.
 *
 * O teste é `Children.toArray`, que já descarta `null`, `undefined`, `false` e
 * `''` — exatamente o que os filhos condicionais produzem. Não se pode testar
 * o retorno de cada filho daqui (o React não renderiza filho para inspeção),
 * então a condição de cada um é resolvida pelo chamador, em `MestrePage`, que
 * passa `false` no lugar do elemento quando não há dado.
 */
export function MestreSectionGroup({ id, title, children }: Props) {
  const visibleChildren = Children.toArray(children);

  if (visibleChildren.length === 0) return null;

  return (
    <section className="mestre-group" id={id} aria-labelledby={`${id}-titulo`}>
      <div className="container">
        <h2 className="mestre-group-title" id={`${id}-titulo`}>
          {title}
        </h2>
      </div>

      <div className="mestre-group-body">{visibleChildren}</div>
    </section>
  );
}
