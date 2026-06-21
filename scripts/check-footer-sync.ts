import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SITE_FOOTER = join(ROOT, "apps/site/src/components/SiteFooter.astro");

const CANONICALS: Record<string, string> = {
  FOOTER_TAGLINE:
    "Hub de projetos de RPG em português. Gratuito, sem anúncios, sem coleta desnecessária.",
  FOOTER_GIFT_TEXT:
    "Este é um presente da Artifício RPG para toda a comunidade brasileira de RPG. Compartilhe com seus grupos!",
  FOOTER_NAV_LABEL: "Projetos",
  FOOTER_NAV_ARIA: "Projetos do Artifício",
  FOOTER_BRAND: "Artifício RPG",
  FOOTER_COPYRIGHT:
    "Artifício RPG © {year}. Todos os direitos reservados. Leitura, citação curta e compartilhamento de links são permitidos com crédito e link para a fonte. Reprodução integral, espelhamento, raspagem e uso comercial dependem de autorização prévia.",
  FOOTER_TERMS_LABEL: "Ver termos de uso e direitos autorais",
  FOOTER_BASE_DOMAIN: "artificiorpg.com",
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
