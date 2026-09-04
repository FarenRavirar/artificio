import type { ReactNode } from 'react';

interface Props {
  readonly id: string;
  readonly title: string;
  /**
   * O grupo renderiza? Decidido pelo CHAMADOR, com os mesmos dados que decidem
   * cada filho — ver a nota sobre `Children.toArray` abaixo.
   */
  readonly hasContent: boolean;
  readonly children: ReactNode;
}

/**
 * Grupo de seções do perfil público (T3.1a / D5a): os 11 blocos empilhados
 * passam a três âncoras — Sobre, Mesas, Contato — mais hero e CTA final.
 *
 * **Estado vazio (D20).** O grupo some inteiro, título incluído, quando não há
 * conteúdo. Um mestre recém-criado veria três títulos de seção sobre corpo
 * vazio sem esta regra.
 *
 * **Por que `hasContent` vem de fora, e não de `Children.toArray(children)`.**
 * A primeira versão deste componente contava os filhos com `Children.toArray`,
 * que descarta `null`/`false`/`undefined` — e estaria certa se todo filho
 * chegasse já resolvido. Não é o caso: `MestreBio`, `MestreHighlights`,
 * `MestreSellingPoints` e `MestreClosedGroupSection` decidem lá dentro e
 * retornam `null` quando não têm dado. O que chega aqui é o ELEMENTO React
 * deles, que `Children.toArray` conta como filho presente — o grupo nunca
 * sumiria, e D20 passaria a valer só no papel. React não permite perguntar a um
 * elemento o que ele vai renderizar; então quem sabe é o chamador, que tem os
 * dados na mão.
 */
export function MestreSectionGroup({ id, title, hasContent, children }: Props) {
  if (!hasContent) return null;

  return (
    <section className="mestre-group" id={id} aria-labelledby={`${id}-titulo`}>
      <div className="container">
        <h2 className="mestre-group-title" id={`${id}-titulo`}>
          {title}
        </h2>
      </div>

      <div className="mestre-group-body">{children}</div>
    </section>
  );
}
