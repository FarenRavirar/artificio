// @vitest-environment jsdom
//
// jsdom neste arquivo (e não no pacote inteiro, conforme `vitest.config.ts`):
// desde a spec 100 o `GmReviewList` renderiza markdown via `MarkdownContent`, e
// o `renderMarkdown` sanitiza com DOMPurify, que precisa de `window`. Sob o
// ambiente `node` o erro é `default.sanitize is not a function` — vale como
// lembrete de que este componente exige DOM em runtime.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  GM_REVIEW_COMMENT_MAX,
  GmReviewForm,
  GmReviewList,
  GmReviewSummary,
  toFiniteNumber,
  type GmReviewItem,
} from "./GmReviewPanel.js";

const review = (over: Partial<GmReviewItem> = {}): GmReviewItem => ({
  id: "r1",
  rating: 4,
  tags: [],
  comment: null,
  created_at: "2026-09-03T00:00:00Z",
  author_name: "Fulano",
  author_avatar: null,
  ...over,
});

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

  // A estrela precisa vir de token que vira por tema: valor fixo reprova AA em um
  // dos dois (amber-300 mede 1,44 sobre branco; warningText mede 2,08 sobre navy).
  it("pinta a estrela com o token de tema, não com cor literal", () => {
    const html = renderToStaticMarkup(<GmReviewSummary avgRating={4} reviewsCount={2} />);
    expect(html).toContain("var(--state-warning-fg)");
    expect(html).not.toContain("amber");
  });
});

// Estes dois componentes ficaram sem teste algum até a spec 100 — e é neles que
// mora o markdown das avaliações já publicadas. Sem cobertura, trocar Textarea
// por ContentEditor apagaria formatação sem nada acusar.
describe("GmReviewList", () => {
  it("renderiza o comentário como markdown, não como texto cru", () => {
    const html = renderToStaticMarkup(<GmReviewList reviews={[review({ comment: "mestre **excelente**" })]} />);
    expect(html).toContain("<strong>excelente</strong>");
    expect(html).not.toContain("**excelente**");
  });

  it("mostra estado vazio sem avaliações", () => {
    const html = renderToStaticMarkup(<GmReviewList reviews={[]} />);
    expect(html).toContain("Ainda não há avaliações");
  });

  it("não renderiza bloco de comentário quando não há comentário", () => {
    const html = renderToStaticMarkup(<GmReviewList reviews={[review({ comment: null })]} />);
    expect(html).not.toContain("artificio-markdown-content");
  });

  it("usa tokens de tema, sem cor literal nem raio fora da escala", () => {
    const html = renderToStaticMarkup(<GmReviewList reviews={[review({ tags: ["pontual"] })]} />);
    expect(html).not.toMatch(/amber-|orange-|rounded-(xl|full)/);
    expect(html).toContain("var(--radius-lg)");
  });
});

describe("GmReviewForm", () => {
  const noop = async () => {};

  it("avisa o excedente sem impedir o envio (D16)", () => {
    const html = renderToStaticMarkup(<GmReviewForm onSubmit={noop} />);
    // Sem texto não há aviso...
    expect(html).not.toContain("acima do limite");
    // ...e o botão de envio nunca é escondido pelo tamanho do comentário.
    expect(html).toContain("Enviar avaliação");
  });

  it("passa o limite ao editor como aviso, não como corte", () => {
    expect(GM_REVIEW_COMMENT_MAX).toBe(2000);
    const html = renderToStaticMarkup(<GmReviewForm onSubmit={noop} />);
    // O campo é o editor de markdown do design system, não um textarea puro:
    // é o que preserva a formatação que o app já publica.
    expect(html).toContain("artificio-content-editor");
  });

  it("não usa cor literal de acento no estado das tags", () => {
    const html = renderToStaticMarkup(<GmReviewForm onSubmit={noop} />);
    expect(html).not.toMatch(/amber-|orange-/);
  });
});
