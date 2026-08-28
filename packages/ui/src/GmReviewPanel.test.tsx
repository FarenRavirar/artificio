import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GmReviewSummary, toFiniteNumber } from "./GmReviewPanel.js";

describe("toFiniteNumber", () => {
  it("converte string numérica do driver pg", () => {
    expect(toFiniteNumber("5.00")).toBe(5);
    expect(toFiniteNumber("4.25")).toBe(4.25);
  });

  it("mantém number válido", () => {
    expect(toFiniteNumber(4.5)).toBe(4.5);
    expect(toFiniteNumber(0)).toBe(0);
  });

  it("devolve null para valor inutilizável", () => {
    expect(toFiniteNumber(null)).toBeNull();
    expect(toFiniteNumber(undefined)).toBeNull();
    expect(toFiniteNumber("")).toBeNull();
    expect(toFiniteNumber("   ")).toBeNull();
    expect(toFiniteNumber("abc")).toBeNull();
    expect(toFiniteNumber(NaN)).toBeNull();
    expect(toFiniteNumber(Infinity)).toBeNull();
    expect(toFiniteNumber({})).toBeNull();
  });
});

describe("GmReviewSummary", () => {
  // Regressão real (2026-08-28): `avg_rating` é NUMERIC(3,2) e o parser default
  // do `pg` entrega string. Enquanto a tabela de reviews esteve vazia o valor
  // era null e o early-return escondia o problema; o primeiro review real
  // mandou "5.00" e `.toFixed()` derrubou a árvore React inteira em produção.
  it("renderiza rating vindo como string sem quebrar", () => {
    const html = renderToStaticMarkup(<GmReviewSummary avgRating="5.00" reviewsCount={1} />);
    expect(html).toContain("5.0");
    expect(html).toContain("(1)");
  });

  it("renderiza rating vindo como number", () => {
    const html = renderToStaticMarkup(<GmReviewSummary avgRating={4.25} reviewsCount={8} />);
    expect(html).toContain("4.3");
  });

  it("mostra estado vazio sem avaliações", () => {
    const html = renderToStaticMarkup(<GmReviewSummary avgRating={null} reviewsCount={0} />);
    expect(html).toContain("Sem avaliações ainda");
  });

  it('mostra estado vazio quando reviewsCount chega como string "0"', () => {
    const html = renderToStaticMarkup(<GmReviewSummary avgRating={null} reviewsCount="0" />);
    expect(html).toContain("Sem avaliações ainda");
  });

  it("não quebra com rating inválido", () => {
    const html = renderToStaticMarkup(<GmReviewSummary avgRating="abc" reviewsCount={3} />);
    expect(html).toContain("Sem avaliações ainda");
  });
});
