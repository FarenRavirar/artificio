import { describe, expect, it } from "vitest";
import {
  IMAGE_KINDS,
  IMAGE_KIND_LIST,
  cropToObjectPosition,
  imageKindSpec,
  isCropRect,
  isGoogleUserContentUrl,
  isImageKind,
  normalizeImageFrame,
  normalizeImageFramePatch,
  storageTransformation,
  upgradeGoogleImageQuality,
} from "./imageKinds.js";

describe("imageKindSpec", () => {
  it("avatar é sempre 1:1", () => {
    expect(IMAGE_KINDS.profile_avatar.aspect).toBe(1);
  });

  it("banner de mesa mantém a proporção histórica 1200x650", () => {
    expect(IMAGE_KINDS.table_banner.aspect).toBe(1200 / 650);
  });

  it("aspectRatioCss é fração exata, não decimal truncável", () => {
    expect(IMAGE_KINDS.profile_avatar.aspectRatioCss).toBe("1 / 1");
    expect(IMAGE_KINDS.table_banner.aspectRatioCss).toBe("1200 / 650");
    // Nenhum valor pode ser a forma decimal: `1200/650` produz
    // `1.8461538461538463`, que navegador e jsdom truncam ou rejeitam.
    for (const kind of IMAGE_KIND_LIST) {
      expect(IMAGE_KINDS[kind].aspectRatioCss).toContain("/");
    }
  });

  it("aspectRatioCss e aspect descrevem a mesma proporção", () => {
    for (const kind of IMAGE_KIND_LIST) {
      const [w, h] = IMAGE_KINDS[kind].aspectRatioCss.split("/").map((part) => Number(part.trim()));
      expect(w / h).toBeCloseTo(IMAGE_KINDS[kind].aspect, 10);
    }
  });

  it("avatar não divide pasta com banner de mesa", () => {
    expect(IMAGE_KINDS.profile_avatar.folder).not.toBe(IMAGE_KINDS.table_banner.folder);
  });

  it("cai em table_banner quando o valor não é um tipo conhecido", () => {
    expect(imageKindSpec("inexistente")).toBe(IMAGE_KINDS.table_banner);
    expect(imageKindSpec(undefined)).toBe(IMAGE_KINDS.table_banner);
    expect(imageKindSpec(null)).toBe(IMAGE_KINDS.table_banner);
  });

  it("isImageKind narrowa só os três tipos", () => {
    expect(isImageKind("profile_avatar")).toBe(true);
    expect(isImageKind("table_banner")).toBe(true);
    expect(isImageKind("profile_banner")).toBe(true);
    expect(isImageKind("avatar")).toBe(false);
    expect(isImageKind(42)).toBe(false);
  });
});

describe("storageTransformation", () => {
  // Regressão do defeito medido em produção (2026-08-18): o avatar do mestre
  // estava gravado 1200x650 porque o upload aplicava `crop: 'fill'` a tudo.
  it("nunca usa crop destrutivo, em nenhum tipo", () => {
    for (const kind of Object.keys(IMAGE_KINDS)) {
      const crops = storageTransformation(kind).map((step) => step.crop).filter(Boolean);
      expect(crops).toEqual(["limit"]);
    }
  });

  it("não força altura fixa no avatar", () => {
    const [resize] = storageTransformation("profile_avatar");
    expect(resize.width).toBe(1024);
    expect(resize.height).toBe(1024);
    expect(resize.crop).toBe("limit");
  });

  it("mantém quality/fetch_format automáticos", () => {
    const steps = storageTransformation("table_banner");
    expect(steps[1]).toEqual({ quality: "auto", fetch_format: "auto" });
  });
});

describe("isCropRect", () => {
  it("aceita retângulo completo", () => {
    expect(isCropRect({ x: 0, y: 10, width: 100, height: 50 })).toBe(true);
  });

  it("recusa dimensão zero ou negativa", () => {
    expect(isCropRect({ x: 0, y: 0, width: 0, height: 50 })).toBe(false);
    expect(isCropRect({ x: 0, y: 0, width: 100, height: -1 })).toBe(false);
  });

  it("recusa origem negativa", () => {
    expect(isCropRect({ x: -1, y: 0, width: 100, height: 50 })).toBe(false);
    expect(isCropRect({ x: 0, y: -1, width: 100, height: 50 })).toBe(false);
    expect(isCropRect({ x: 0, y: 0, width: 100, height: 50 })).toBe(true);
  });

  it("recusa campo ausente, NaN e não-objeto", () => {
    expect(isCropRect({ x: 0, y: 0, width: 100 })).toBe(false);
    expect(isCropRect({ x: Number.NaN, y: 0, width: 100, height: 50 })).toBe(false);
    expect(isCropRect(null)).toBe(false);
    expect(isCropRect("0,0,100,50")).toBe(false);
  });
});

describe("cropToObjectPosition", () => {
  it("centro quando não há recorte válido", () => {
    expect(cropToObjectPosition(null, 1000, 1000)).toBe("50% 50%");
    expect(cropToObjectPosition({ x: 0 }, 1000, 1000)).toBe("50% 50%");
  });

  it("centro quando as dimensões originais são desconhecidas", () => {
    const crop = { x: 0, y: 0, width: 100, height: 100 };
    expect(cropToObjectPosition(crop, null, null)).toBe("50% 50%");
    expect(cropToObjectPosition(crop, 0, 0)).toBe("50% 50%");
  });

  it("recorte no topo esquerdo vira 0% 0%", () => {
    expect(cropToObjectPosition({ x: 0, y: 0, width: 400, height: 400 }, 800, 800)).toBe("0% 0%");
  });

  it("recorte no canto inferior direito vira 100% 100%", () => {
    expect(cropToObjectPosition({ x: 400, y: 400, width: 400, height: 400 }, 800, 800)).toBe("100% 100%");
  });

  it("recorte centralizado vira 50% 50%", () => {
    expect(cropToObjectPosition({ x: 200, y: 200, width: 400, height: 400 }, 800, 800)).toBe("50% 50%");
  });

  it("eixo sem sobra fica em 50% sem dividir por zero", () => {
    // Recorte ocupa a largura inteira: só o eixo Y é ajustável.
    expect(cropToObjectPosition({ x: 0, y: 0, width: 800, height: 400 }, 800, 800)).toBe("50% 0%");
  });

  it("limita a 0-100 quando o recorte extrapola a imagem", () => {
    // `x: 0` fica no inicio; `y` alem da altura satura em 100% em vez de
    // produzir posicao fora da faixa que o CSS aceita.
    expect(cropToObjectPosition({ x: 0, y: 9000, width: 400, height: 400 }, 800, 800)).toBe("0% 100%");
  });

  it("origem negativa nao e recorte valido, entao cai no centro", () => {
    // `isCropRect` recusa coordenada negativa: ela nao descreve area dentro da
    // imagem, e persistir o valor guardaria um retangulo nunca respeitado.
    expect(isCropRect({ x: -50, y: 0, width: 400, height: 400 })).toBe(false);
    expect(cropToObjectPosition({ x: -50, y: 0, width: 400, height: 400 }, 800, 800)).toBe("50% 50%");
  });
});

describe("upgradeGoogleImageQuality", () => {
  const BLOGGER =
    "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiT3swHs6DkoY3daw/w199-h200/Brasao_circular.png";
  const LOGIN = "https://lh3.googleusercontent.com/a/ACg8ocKabc=s96-c";

  it("não toca em URL que não é do Google", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/v1/foto.png";
    expect(upgradeGoogleImageQuality(url)).toBe(url);
  });

  it("não aceita hostname que apenas contém o domínio", () => {
    expect(isGoogleUserContentUrl("https://googleusercontent.com.invasor.tld/a=s96-c")).toBe(false);
    expect(isGoogleUserContentUrl("https://lh3.googleusercontent.com/a=s96-c")).toBe(true);
  });

  it("amplia a foto de perfil do login (sufixo =s96-c)", () => {
    expect(upgradeGoogleImageQuality(LOGIN, 400)).toBe(
      "https://lh3.googleusercontent.com/a/ACg8ocKabc=s400-c",
    );
  });

  // Regressão do defeito medido em 2026-08-18: a URL real do avatar de um
  // mestre usava segmento de caminho, o regex antigo não casava e a imagem era
  // servida em 199px, ampliada e borrada pelo navegador.
  it("amplia imagem do Blogger (segmento /w199-h200/)", () => {
    const upgraded = upgradeGoogleImageQuality(BLOGGER, 400);
    expect(upgraded).not.toBe(BLOGGER);
    expect(upgraded).toContain("/s400/");
    expect(upgraded).not.toContain("w199-h200");
    expect(upgraded.endsWith("Brasao_circular.png")).toBe(true);
  });

  it("preserva o nome do arquivo ao trocar o segmento", () => {
    const url = "https://lh3.googleusercontent.com/pw/abc/w200-h150-p-k-no-nu/imagem.jpg";
    expect(upgradeGoogleImageQuality(url, 800)).toBe(
      "https://lh3.googleusercontent.com/pw/abc/s800/imagem.jpg",
    );
  });

  it("devolve intacta quando não há marcador de tamanho reconhecível", () => {
    const url = "https://lh3.googleusercontent.com/proxy/algumhashsemtamanho";
    expect(upgradeGoogleImageQuality(url)).toBe(url);
  });
});

describe("normalizeImageFrame", () => {
  it("aceita enquadramento completo e válido", () => {
    const frame = normalizeImageFrame(
      { avatar_crop_data: { x: 10, y: 20, width: 400, height: 400 }, avatar_width: 800, avatar_height: 800 },
      "avatar",
    );
    expect(frame).toEqual({ crop: { x: 10, y: 20, width: 400, height: 400 }, width: 800, height: 800 });
  });

  // JSONB aceita qualquer forma; o tipo declarado é promessa, não garantia.
  it("descarta retângulo malformado vindo do banco", () => {
    for (const crop of [
      { x: 0, y: 0, width: 0, height: 10 },
      { x: -1, y: 0, width: 10, height: 10 },
      { x: 0, y: 0, width: 10 },
      { x: "0", y: 0, width: 10, height: 10 },
      "0,0,10,10",
      [],
      null,
    ]) {
      const frame = normalizeImageFrame({ avatar_crop_data: crop, avatar_width: 100, avatar_height: 100 }, "avatar");
      expect(frame.crop).toBeNull();
    }
  });

  it("recorte sem dimensões vira null, porque a conversão divide por elas", () => {
    const crop = { x: 0, y: 0, width: 50, height: 50 };
    expect(normalizeImageFrame({ avatar_crop_data: crop }, "avatar").crop).toBeNull();
    expect(normalizeImageFrame({ avatar_crop_data: crop, avatar_width: 100 }, "avatar").crop).toBeNull();
  });

  it("dimensão só passa como inteiro positivo seguro", () => {
    for (const value of [0, -5, 12.5, Number.NaN, Number.POSITIVE_INFINITY, "800", null]) {
      expect(normalizeImageFrame({ banner_width: value }, "banner").width).toBeNull();
    }
    expect(normalizeImageFrame({ banner_width: 1600 }, "banner").width).toBe(1600);
  });

  it("avatar e banner não se misturam", () => {
    const source = { avatar_width: 800, avatar_height: 800, banner_width: 1600, banner_height: 900 };
    expect(normalizeImageFrame(source, "avatar").width).toBe(800);
    expect(normalizeImageFrame(source, "banner").width).toBe(1600);
  });

  it("origem ausente ou nula não quebra", () => {
    expect(normalizeImageFrame(undefined, "avatar")).toEqual({ crop: null, width: null, height: null });
    expect(normalizeImageFrame(null, "banner")).toEqual({ crop: null, width: null, height: null });
  });

  it("o resultado é seguro para cropToObjectPosition", () => {
    const frame = normalizeImageFrame({ avatar_crop_data: { x: 1 }, avatar_width: 800, avatar_height: 800 }, "avatar");
    expect(cropToObjectPosition(frame.crop, frame.width, frame.height)).toBe("50% 50%");
  });
});

/**
 * Contrato dos TRÊS estados na escrita. Distinguir `null` de ausente é o que
 * separa "o dono trocou a imagem e quer zerar o recorte" de "esta requisição
 * não fala de imagem" — confundir os dois apagaria o enquadramento salvo em
 * qualquer PATCH parcial.
 */
describe("normalizeImageFramePatch", () => {
  it("valor válido é persistido", () => {
    const patch = normalizeImageFramePatch(
      { avatar_crop_data: { x: 10, y: 20, width: 400, height: 400 }, avatar_width: 800, avatar_height: 800 },
      "avatar",
    );
    expect(patch).toEqual({ crop: { x: 10, y: 20, width: 400, height: 400 }, width: 800, height: 800 });
  });

  it("null zera o enquadramento de propósito", () => {
    const patch = normalizeImageFramePatch(
      { banner_crop_data: null, banner_width: null, banner_height: null },
      "banner",
    );
    expect(patch).toEqual({ crop: null, width: null, height: null });
  });

  it("ausência vira undefined, que o Kysely lê como 'não mexe'", () => {
    const patch = normalizeImageFramePatch({ nickname: "Mago" }, "avatar");
    expect(patch.crop).toBeUndefined();
    expect(patch.width).toBeUndefined();
    expect(patch.height).toBeUndefined();
  });

  // Valor inválido NÃO pode virar `null`: apagaria o enquadramento salvo por
  // causa de um payload malformado, em vez de simplesmente ignorá-lo.
  it("valor inválido é ignorado, nunca apaga o que está salvo", () => {
    for (const crop of [{ x: -1, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 0, height: 10 }, "texto", 42]) {
      expect(normalizeImageFramePatch({ avatar_crop_data: crop }, "avatar").crop).toBeUndefined();
    }
    for (const width of [0, -5, 12.5, Number.NaN, "800", Number.MAX_SAFE_INTEGER + 2]) {
      expect(normalizeImageFramePatch({ avatar_width: width }, "avatar").width).toBeUndefined();
    }
  });

  it("avatar e banner não se misturam", () => {
    const body = { avatar_width: 800, banner_width: 1600 };
    expect(normalizeImageFramePatch(body, "avatar").width).toBe(800);
    expect(normalizeImageFramePatch(body, "banner").width).toBe(1600);
  });

  it("corpo ausente não quebra", () => {
    expect(normalizeImageFramePatch(undefined, "avatar").crop).toBeUndefined();
    expect(normalizeImageFramePatch(null, "banner").width).toBeUndefined();
  });
});
