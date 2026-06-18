import { describe, expect, it } from "vitest";
import {
  gtagSrc,
  gtagInlineConfig,
  initGtag,
  ANALYTICS_DEFAULTS,
  trackSearch,
  trackViewTermo,
  trackSelectMesa,
  trackFilterSistema,
  trackFilterApply,
} from "./index.js";

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

describe("initGtag", () => {
  const GA_ID = "G-ABC123";

  it("injeta o script do gtag com o src correto", () => {
    initGtag(GA_ID);
    const script = document.querySelector(
      `script[src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"]`,
    );
    expect(script).not.toBeNull();
    expect((script as HTMLScriptElement).async).toBe(true);
  });

  it("é idempotente: 2 chamadas = 1 só <script>", () => {
    initGtag(GA_ID);
    const count = document.querySelectorAll(
      `script[src*="googletagmanager.com/gtag/js"]`,
    ).length;
    initGtag(GA_ID);
    initGtag(GA_ID);
    const countAfter = document.querySelectorAll(
      `script[src*="googletagmanager.com/gtag/js"]`,
    ).length;
    expect(countAfter).toBe(count);
  });

  it("configura com send_page_view:false", () => {
    initGtag(GA_ID);
    const dl = window.dataLayer as unknown[];
    const configCall = dl.find(
      (entry) => Array.isArray(entry) && entry[0] === "config",
    ) as unknown[];
    expect(configCall).toBeDefined();
    const cfg = configCall[2] as Record<string, unknown>;
    expect(cfg.send_page_view).toBe(false);
  });

  it("anonymize_ip:true por padrão", () => {
    initGtag("G-XYZ");
    const dl = window.dataLayer as unknown[];
    const configCall = dl.find(
      (entry) => Array.isArray(entry) && entry[0] === "config",
    ) as unknown[];
    const cfg = configCall[2] as Record<string, unknown>;
    expect(cfg.anonymize_ip).toBe(true);
  });

  it("anonymize_ip pode ser desligado via opts", () => {
    window.dataLayer = [];
    (window as unknown as Record<string, unknown>).gtag = undefined;
    initGtag("G-OFF", { anonymizeIp: false });
    const dl = window.dataLayer as unknown[];
    const configCall = dl.find(
      (entry) => Array.isArray(entry) && entry[0] === "config",
    ) as unknown[];
    const cfg = configCall[2] as Record<string, unknown>;
    expect(cfg.anonymize_ip).toBeUndefined();
  });

  it("usa cookie_domain raiz dos ANALYTICS_DEFAULTS", () => {
    window.dataLayer = [];
    (window as unknown as Record<string, unknown>).gtag = undefined;
    initGtag("G-DOM");
    const dl = window.dataLayer as unknown[];
    const configCall = dl.find(
      (entry) => Array.isArray(entry) && entry[0] === "config",
    ) as unknown[];
    const cfg = configCall[2] as Record<string, unknown>;
    expect(cfg.cookie_domain).toBe(".artificiorpg.com");
  });
});

describe("events catalog", () => {
  it("trackSearch só envia com >=2 caracteres", () => {
    const calls: unknown[] = [];
    window.gtag = (...args: unknown[]) => calls.push(args);

    trackSearch("a");
    expect(calls.length).toBe(0);

    trackSearch("ab");
    expect(calls.length).toBe(1);
    const [call] = calls as [string, string, Record<string, unknown>][];
    expect(call[0]).toBe("event");
    expect(call[1]).toBe("search");
    expect(call[2]).toEqual({ search_term: "ab" });
  });

  it("trackViewTermo envia event com params", () => {
    const calls: unknown[] = [];
    window.gtag = (...args: unknown[]) => calls.push(args);

    trackViewTermo({ termo_id: "42", termo: "Fireball", sistema: "D&D 2024" });
    expect(calls.length).toBe(1);
    const [call] = calls as [string, string, Record<string, unknown>][];
    expect(call[0]).toBe("event");
    expect(call[1]).toBe("view_termo");
    expect(call[2]).toEqual({ termo_id: "42", termo: "Fireball", sistema: "D&D 2024" });
  });

  it("trackSelectMesa envia event com params", () => {
    const calls: unknown[] = [];
    window.gtag = (...args: unknown[]) => calls.push(args);

    trackSelectMesa({ mesa_id: "7", mesa_nome: "Mesa do Dragão" });
    expect(calls.length).toBe(1);
    const [call] = calls as [string, string, Record<string, unknown>][];
    expect(call[0]).toBe("event");
    expect(call[1]).toBe("select_mesa");
    expect(call[2]).toEqual({ mesa_id: "7", mesa_nome: "Mesa do Dragão" });
  });

  it("trackFilterSistema envia event com params", () => {
    const calls: unknown[] = [];
    window.gtag = (...args: unknown[]) => calls.push(args);

    trackFilterSistema({ sistema: "D&D 2014" });
    expect(calls.length).toBe(1);
    const [call] = calls as [string, string, Record<string, unknown>][];
    expect(call[0]).toBe("event");
    expect(call[1]).toBe("filter_sistema");
    expect(call[2]).toEqual({ sistema: "D&D 2014" });
  });

  it("trackFilterApply envia event com params", () => {
    const calls: unknown[] = [];
    window.gtag = (...args: unknown[]) => calls.push(args);

    trackFilterApply({ filter_type: "vagas", filter_value: "com_vaga" });
    expect(calls.length).toBe(1);
    const [call] = calls as [string, string, Record<string, unknown>][];
    expect(call[0]).toBe("event");
    expect(call[1]).toBe("filter_apply");
    expect(call[2]).toEqual({ filter_type: "vagas", filter_value: "com_vaga" });
  });

  it("event params excluem undefined", () => {
    const calls: unknown[] = [];
    window.gtag = (...args: unknown[]) => calls.push(args);

    trackViewTermo({ termo_id: "1", termo: "Test" });
    const [call] = calls as [string, string, Record<string, unknown>][];
    expect(call[2]).not.toHaveProperty("sistema");
  });
});
