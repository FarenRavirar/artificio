import { describe, expect, it } from "vitest";
import {
  enrichNotificationItem,
  formatNotificationText,
} from "./notificationFormatter.js";

/**
 * T3.3/T3.13 — formatação do texto de apresentação.
 *
 * O foco destes testes é a fronteira entre evento **nativo** (texto montado
 * aqui, a partir do `event_type`) e evento de **produtor externo** (texto já
 * congelado no snapshot por 24e, `spec.md:320`). Confundir as duas pontas foi
 * exatamente o defeito achado no review da PR #257: os cinco `downloads.*`
 * caíam no `default` e viravam "Notificação: downloads.material_approved".
 */

const LEGACY_SNAPSHOT = {
  legacy_kind: "material_approved",
  legacy_body: 'Seu material "Meu material" foi aprovado e publicado.',
  material_id: "material-1",
};

describe("formatNotificationText — evento nativo", () => {
  it("monta o texto pelo event_type, ignorando snapshot", () => {
    expect(formatNotificationText("comment.replied", 1, null)).toBe(
      "Alguém respondeu seu comentário",
    );
  });

  it("evento nativo não é sequestrado por legacy_body no snapshot", () => {
    // Um snapshot de comentário nunca traz `legacy_body`, mas se trouxesse o
    // texto canônico do produto tem que prevalecer — o corpo legado é exceção
    // para tipo externo, não um override geral.
    expect(
      formatNotificationText("comment.created", 1, { legacy_body: "texto arbitrário" }),
    ).toBe("Alguém comentou no seu conteúdo");
  });
});

describe("formatNotificationText — produtor externo (T3.13)", () => {
  it("usa o corpo legado gravado no snapshot", () => {
    // 24e congela o corpo: reescrevê-lo aqui inventaria uma redação que o
    // usuário nunca viu no aviso original.
    expect(
      formatNotificationText("downloads.material_approved", 1, LEGACY_SNAPSHOT),
    ).toBe('Seu material "Meu material" foi aprovado e publicado.');
  });

  it.each([
    "downloads.material_approved",
    "downloads.material_rejected",
    "downloads.report_resolved",
    "downloads.report_dismissed",
    "downloads.system_suggestion_resolved",
  ])("%s não cai no fallback de tipo desconhecido", (eventType) => {
    const text = formatNotificationText(eventType, 1, {
      legacy_body: "corpo real do aviso",
    });

    expect(text).toBe("corpo real do aviso");
    expect(text).not.toContain("Notificação:");
  });

  it("snapshot malformado degrada para o fallback, sem quebrar a listagem", () => {
    // Payload de banco é `unknown` até passar por checagem tipada. Um JSONB
    // corrompido não pode derrubar a página inteira de notificações.
    for (const malformed of [null, "string", [], { legacy_body: 42 }, { legacy_body: "  " }]) {
      expect(formatNotificationText("downloads.material_approved", 1, malformed)).toBe(
        "Notificação: downloads.material_approved",
      );
    }
  });
});

describe("enrichNotificationItem", () => {
  it("repassa o snapshot ao formatador", () => {
    // A regressão original não estava no formatador e sim aqui: `snapshot:
    // null` fixo fazia o corpo legado nunca chegar, mesmo com a query já
    // trazendo a coluna.
    const enriched = enrichNotificationItem({
      event_type: "downloads.material_approved",
      source_app: "downloads",
      canonical_path: "/materiais/meu-material",
      event_version: 1,
      snapshot: LEGACY_SNAPSHOT,
    });

    expect(enriched.text).toBe('Seu material "Meu material" foi aprovado e publicado.');
  });

  it("sem snapshot continua funcionando para evento nativo", () => {
    const enriched = enrichNotificationItem({
      event_type: "comment.replied",
      source_app: "accounts",
      canonical_path: "/materiais/x",
    });

    expect(enriched.text).toBe("Alguém respondeu seu comentário");
  });
});
