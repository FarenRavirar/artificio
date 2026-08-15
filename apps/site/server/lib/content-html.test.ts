import { describe, expect, it } from "vitest";

import { readingTime, stripTags, withToc } from "./content-html.js";

describe("stripTags — decode de entidades", () => {
  it("decodifica cada entidade da tabela uma única vez", () => {
    const casos: Array<[string, string]> = [
      ["&amp;", "&"],
      ["&#038;", "&"],
      ["&lt;", "<"],
      ["&gt;", ">"],
      ["&quot;", '"'],
      ["&#39;", "'"],
      // Forma acolchoada do WordPress. O regex casa `#0?39` desde 4d15b01, mas
      // a chave só entrou no mapa depois — sem este caso a entidade voltava
      // literal para o excerpt (achado de review da PR #262).
      ["&#039;", "'"],
      ["&#8217;", "’"],
      ["&#8216;", "‘"],
      ["&#8220;", "“"],
      ["&#8221;", "”"],
      ["&#8211;", "–"],
      ["&#8212;", "—"],
      ["&#8230;", "…"],
      ["&#8594;", "→"],
    ];
    for (const [entrada, esperado] of casos) {
      expect(stripTags(entrada)).toBe(esperado);
    }
    // `&nbsp;` vira espaço e o `.trim()` do `stripTags` o remove: asserção
    // separada para não parecer que a entidade foi ignorada.
    expect(stripTags(`a&nbsp;b`)).toBe("a b");
  });

  // Regressão do achado `js/double-escaping` do CodeQL (alertas 258/259,
  // 2026-08-14). A cadeia de `.replace()` anterior desescapava `&` primeiro, e a
  // saída realimentava as regras seguintes: o texto literal `&lt;script&gt;`
  // digitado por um autor chegava ao excerpt como `<script>`.
  it("não desescapa duas vezes: entidade escapada continua sendo texto", () => {
    expect(stripTags("&amp;lt;script&amp;gt;")).toBe("&lt;script&gt;");
    expect(stripTags("&amp;quot;")).toBe("&quot;");
    expect(stripTags("&amp;amp;")).toBe("&amp;");
    expect(stripTags("&amp;#39;")).toBe("&#39;");
    expect(stripTags("&amp;#039;")).toBe("&#039;");
    expect(stripTags("&amp;#038;")).toBe("&#038;");
  });

  it("preserva entidade fora da tabela e `&` solto", () => {
    expect(stripTags("&copy; a&b &#8221;")).toBe("&copy; a&b ”");
  });

  it("remove tags e colapsa espaço antes de decodificar", () => {
    expect(stripTags("<p>oi   <strong>mundo</strong></p>")).toBe("oi mundo");
  });
});

describe("readingTime", () => {
  it("nunca devolve menos de um minuto", () => {
    expect(readingTime("<p>curto</p>")).toBe(1);
  });

  it("conta palavras do texto, não da marcação", () => {
    const corpo = `<p>${"palavra ".repeat(400)}</p>`;
    expect(readingTime(corpo)).toBe(2);
  });
});

describe("withToc", () => {
  it("injeta id em h2/h3 e devolve o índice na ordem do documento", () => {
    const { html, toc } = withToc("<h2>Primeiro Título</h2><p>x</p><h3>Sub Ção</h3>");

    expect(toc).toEqual([
      { id: "sec-0-primeiro-titulo", text: "Primeiro Título", level: 2 },
      { id: "sec-1-sub-cao", text: "Sub Ção", level: 3 },
    ]);
    expect(html).toContain('<h2 id="sec-0-primeiro-titulo">');
    expect(html).toContain('<h3 id="sec-1-sub-cao">');
  });

  it("escapa o id no atributo", () => {
    const { html } = withToc('<h2>a"b</h2>');
    expect(html).not.toContain('id="sec-0-a"b"');
  });
});
