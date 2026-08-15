import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationsView } from "./NotificationsView";

const ITEM_ID = "11111111-1111-4111-8111-111111111111";
const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

beforeAll(() => {
  reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
});

beforeEach(() => {
  vi.restoreAllMocks();
});

function pageResponse() {
  return new Response(JSON.stringify({
    items: [{
      id: ITEM_ID,
      event_type: "comment.replied",
      text: "Beto respondeu ao seu comentário.",
      link: "https://downloads.artificiorpg.com/material/teste",
      source_label: "Downloads",
      occurred_at: "2026-08-14T10:00:00.000Z",
      read_at: null,
    }],
    cursor: null,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("NotificationsView", () => {
  it("não marca ao abrir, mostra estado textual e anuncia a marcação explícita", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(pageResponse())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<NotificationsView />);
      await Promise.resolve();
    });

    const itemToggle = container.querySelector<HTMLButtonElement>(".notification-item-header");
    expect(container.textContent).toContain("Não lida");
    expect(container.querySelector("time")?.getAttribute("datetime"))
      .toBe("2026-08-14T10:00:00.000Z");

    await act(async () => itemToggle?.click());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const markRead = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.trim() === "Marcar como lida");
    await act(async () => {
      markRead?.click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/v1/notifications/${ITEM_ID}/read`,
      { method: "PUT", credentials: "include" },
    );
    expect(container.querySelector("output")?.textContent)
      .toBe("Notificação marcada como lida.");
    expect(container.textContent).not.toContain("Não lida");

    await act(async () => root.unmount());
    container.remove();
  });
});
