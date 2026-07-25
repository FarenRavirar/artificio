import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminSidebar } from "./AdminSidebar.js";
import type { AdminLinkProps } from "./MetricCard.js";

function TestLink({ to, className, children }: Readonly<AdminLinkProps>) {
  return <a data-router-link href={to} className={className}>{children}</a>;
}

const groups = [{ label: "Conteúdo", items: [{ label: "Materiais", href: "/gestao/materiais", badge: 2, badgeLabel: "2 pendentes" }] }];

describe("AdminSidebar", () => {
  it("renderiza grupos, ativo, badge e LinkComponent", () => {
    const html = renderToStaticMarkup(<AdminSidebar groups={groups} currentHref="/gestao/materiais/1" LinkComponent={TestLink} pendingCount={2} />);
    expect(html).toContain("Conteúdo");
    expect(html).toContain("Materiais");
    expect(html).toContain("data-router-link");
    expect(html).toContain('aria-label="Pesquisar na gestão"');
    expect(html).toContain("border-[var(--artificio-brand)]");
    expect(html).toContain("2 pendentes");
    expect(html).not.toContain('id="admin-group-Conteúdo"');
  });

  it("omite badge e rodapé zerados", () => {
    const html = renderToStaticMarkup(<AdminSidebar groups={[{ label: "X", items: [{ label: "Y", href: "/y", badge: 0 }] }]} currentHref="/x" pendingCount={0} />);
    expect(html).not.toContain("min-w-5");
    expect(html).not.toContain("0 pendente");
  });
});
