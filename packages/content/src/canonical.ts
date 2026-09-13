// Normalização do canonical editorial (spec 102 F3 / T3.1).
//
// Contexto medido (2026-09-11, site-prod-db): 125 dos 126 posts publicados tinham `canonical`
// preenchido e 105 apontavam para a URL do WordPress importado — resíduo do importador removido
// em 2026-07-27 (`apps/site/server/server.ts:167-169`), não override editorial. Nenhum apontava
// para domínio externo, ou seja, nunca houve sindicação legítima a preservar.
//
// A capacidade de override continua existindo de propósito: quando um texto é republicado em
// outro veículo, o canonical editorial é o que evita conteúdo duplicado. O que não pode voltar é
// o canonical preenchido "por completude", que foi o que tirou os 105 posts do índice.
//
// Regra: canonical vazio é o DEFAULT CORRETO — a página cai no fallback auto-referente. Só se
// preenche para sindicação real, e apenas com URL do próprio domínio canônico.

/** Host aceito em canonical persistido. Sindicação para fora exige decisão editorial explícita. */
const ALLOWED_HOST = "artificiorpg.com";

export interface CanonicalValidation {
  /** Valor a persistir. `null` = fallback auto-referente da página (o caso correto por padrão). */
  value: string | null;
  /** Motivo da rejeição, quando o valor informado não pode ser persistido. */
  error?: string;
}

function isAllowedHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === ALLOWED_HOST || h.endsWith(`.${ALLOWED_HOST}`);
}

/**
 * Normaliza o canonical vindo do editor/admin.
 *
 * - vazio/ausente → `null` (fallback auto-referente; é o default correto)
 * - URL do domínio canônico → mantida, normalizada com trailing slash
 * - qualquer outro host, ou URL inválida → rejeitada com motivo
 *
 * Rejeitar em vez de silenciosamente descartar é deliberado: descarte silencioso esconderia do
 * editor que o valor dele não foi gravado, e a página seguiria com canonical diferente do que ele
 * viu no formulário.
 */
export function normalizeCanonical(input: unknown): CanonicalValidation {
  // Só `string` é coerção segura aqui. `String(input)` sobre objeto devolve
  // "[object Object]", que chega ao `new URL()` como lixo e produz a mensagem de
  // "URL absoluta" — culpando o formato quando o problema é o tipo. O valor entra por
  // JSON do admin (`unknown` de verdade), então não-string é entrada malformada e
  // precisa dizer isso. Achado do Sonar na PR #316.
  if (input != null && typeof input !== "string") {
    return { value: null, error: "canonical deve ser texto" };
  }
  const raw = (input ?? "").trim();
  if (!raw) return { value: null };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return {
      value: null,
      error: "canonical deve ser uma URL absoluta (https://artificiorpg.com/...) ou ficar vazio",
    };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { value: null, error: `canonical com protocolo não suportado: ${url.protocol}` };
  }

  // Credencial embutida é rejeitada ANTES da validação de host, senão
  // `https://banco.example@evil.example/x` passaria: o `hostname` do WHATWG é
  // `evil.example` (o que vem antes do `@` é userinfo), mas o leitor humano lê o
  // primeiro nome como sendo o destino. E `https://user:senha@artificiorpg.com/x`
  // passava por host permitido e `url.toString()` gravava a senha no canonical —
  // credencial persistida em campo público. `commentLinks.test.ts:104-105` já
  // barra esta forma no outro caminho do monorepo; aqui era divergência.
  if (url.username !== "" || url.password !== "") {
    return { value: null, error: "canonical não pode conter credencial embutida (user:senha@)" };
  }

  if (!isAllowedHost(url.hostname)) {
    return {
      value: null,
      error: `canonical aponta para host externo (${url.hostname}); esperado ${ALLOWED_HOST}`,
    };
  }

  // Normaliza para https + trailing slash: canonical que difere da URL servida por barra ou
  // esquema conta como "Alternate page with proper canonical tag" no Search Console.
  url.protocol = "https:";
  if (!url.pathname.endsWith("/")) url.pathname = `${url.pathname}/`;
  return { value: url.toString() };
}

/** `true` quando o canonical persistido é seguro (vazio ou do domínio canônico). */
export function isCanonicalSafe(value: string | null | undefined): boolean {
  if (value == null || value.trim() === "") return true;
  return normalizeCanonical(value).error === undefined;
}
