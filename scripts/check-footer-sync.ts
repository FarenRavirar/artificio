import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BRAND_NAME, BRAND_DOMAIN, BRAND_TAGLINE_FREE } from "../packages/config/src/brand.js";

const ROOT = process.cwd();
const SITE_FOOTER = join(ROOT, "apps/site/src/components/SiteFooter.astro");

const CANONICALS: Record<string, string> = {
  FOOTER_TAGLINE: `Hub de projetos de RPG em português. ${BRAND_TAGLINE_FREE}`,
  FOOTER_GIFT_TEXT: `Este é um presente da ${BRAND_NAME} para toda a comunidade brasileira de RPG. Compartilhe com seus grupos!`,
  FOOTER_NAV_LABEL: "Projetos",
  FOOTER_NAV_ARIA: `Projetos do ${BRAND_NAME}`,
  FOOTER_BRAND: BRAND_NAME,
  FOOTER_COPYRIGHT: `${BRAND_NAME} © {year}. Todos os direitos reservados. Leitura, citação curta e compartilhamento de links são permitidos com crédito e link para a fonte. Reprodução integral, espelhamento, raspagem e uso comercial dependem de autorização prévia.`,
  FOOTER_TERMS_LABEL: "Ver termos de uso e direitos autorais",
  FOOTER_BASE_DOMAIN: BRAND_DOMAIN,
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function autoFix(astroPath: string): number {
  let content = readFileSync(astroPath, "utf-8");
  let fixed = 0;

  for (const [constant, canonicalValue] of Object.entries(CANONICALS)) {
    const esc = escapeRe(canonicalValue);
    const patterns = [
      new RegExp(`"${esc}"`, "g"),
      new RegExp(`>${esc}<`, "g"),
      new RegExp(`>${esc}\\.?<`, "g"),
    ];

    for (const re of patterns) {
      const matches = content.match(re);
      if (matches && matches.length > 0) {
        content = content.replace(
          re,
          (full) => full.replace(canonicalValue, `{${constant}}`),
        );
        for (const _ of matches) {
          console.log(
            `  ❌ hardcoded "${canonicalValue.slice(0, 60)}..." → {${constant}}`,
          );
          fixed++;
        }
      }
    }
  }

  if (fixed > 0) {
    writeFileSync(astroPath, content, "utf-8");
    console.log(`  🔧 ${fixed} string(s) auto-corrigida(s)`);
  }

  return fixed;
}

const fixed = autoFix(SITE_FOOTER);

if (fixed > 0) {
  console.log(`✅ Footer auto-sincronizado (${fixed} correções)`);
} else {
  console.log("✅ Footer sincronizado — sem hardcoding detectado");
}
