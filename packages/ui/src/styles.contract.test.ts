import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

function cssRule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("shared target-size contracts", () => {
  it("keeps the checkbox itself at least 24 by 24 pixels", () => {
    const rule = cssRule(".artificio-checkbox");

    expect(rule).toContain("min-height: 24px");
    expect(rule).toContain("min-width: 24px");
    // `min-width` sozinho nao segura o alvo: os dois consumidores da F1 poem o
    // checkbox num `inline-flex` ao lado do rotulo, e sem `flex-shrink: 0` o
    // flex encolhe a caixa quando o texto disputa a linha — perdendo os 24px
    // no mobile, que e onde o SC 2.5.8 importa.
    expect(rule).toContain("flex-shrink: 0");
  });

  it("keeps both footer link families at least 24 pixels high", () => {
    expect(cssRule(".artificio-footer-nav-link")).toContain("min-height: 24px");
    expect(cssRule(".artificio-footer-copyright-summary a")).toContain("min-height: 24px");
  });
});
