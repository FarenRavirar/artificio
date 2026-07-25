import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MetricCard, type AdminLinkProps } from "./MetricCard.js";

function TestLink({ to, className, children }: Readonly<AdminLinkProps>) {
  return <a href={to} className={className}>{children as ReactNode}</a>;
}

describe("MetricCard", () => {
  it("fica div sem LinkComponent", () => expect(renderToStaticMarkup(<MetricCard label="Total" value={3} to="/x" />)).not.toContain("<a"));
  it("usa LinkComponent quando fornecido", () => expect(renderToStaticMarkup(<MetricCard label="Total" value={3} to="/x" LinkComponent={TestLink} />)).toContain('href="/x"'));
});
