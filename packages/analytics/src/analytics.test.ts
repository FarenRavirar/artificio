import { describe, expect, it } from "vitest";
import { gtagSrc, gtagInlineConfig, ANALYTICS_DEFAULTS } from "./index.js";

describe("gtag", () => {
  it("gtagSrc inclui o id", () => {
    expect(gtagSrc("G-ABC123")).toBe("https://www.googletagmanager.com/gtag/js?id=G-ABC123");
  });
  it("config usa cookie_domain raiz (cross-subdomínio)", () => {
    const js = gtagInlineConfig("G-ABC123");
    expect(js).toContain('"cookie_domain":".artificiorpg.com"');
    expect(js).toContain("gtag('config', \"G-ABC123\"");
    expect(ANALYTICS_DEFAULTS.cookieDomain).toBe(".artificiorpg.com");
  });
  it("respeita opts (anonymizeIp/debug)", () => {
    const js = gtagInlineConfig("G-X", { anonymizeIp: true, debug: true, cookieDomain: ".x.com" });
    expect(js).toContain('"anonymize_ip":true');
    expect(js).toContain('"debug_mode":true');
    expect(js).toContain('"cookie_domain":".x.com"');
  });
});
