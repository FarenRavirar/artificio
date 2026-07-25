import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusPill } from "./StatusPill.js";

describe("StatusPill", () => {
  it.each(["neutral", "brand", "success", "warn", "danger", "info"] as const)("renderiza tom %s", (tone) => {
    expect(renderToStaticMarkup(<StatusPill tone={tone}>Estado</StatusPill>)).toContain("Estado");
  });
});
