import { brandLogoNavy, brandLogoNeg } from "./brand.js";
import { defaultNavItems, type NavItem } from "./modules.js";
import { BRAND_ORIGIN } from "@artificio/config";
import {
  FOOTER_TAGLINE,
  FOOTER_GIFT_TEXT,
  FOOTER_NAV_LABEL,
  FOOTER_NAV_ARIA,
  FOOTER_MODULE_LABEL,
  FOOTER_MODULE_ARIA,
  FOOTER_BRAND,
  FOOTER_COPYRIGHT,
  FOOTER_TERMS_LABEL,
  FOOTER_BASE_DOMAIN,
} from "./footer-content.js";

export interface FooterProps {
  /** "light" (padrão) ou "dark" (sobre navy/charcoal). */
  variant?: "light" | "dark";
  /** Itens de projeto listados no footer (padrão: projetos do hub). */
  navItems?: NavItem[];
  /** URL do logo ao clicar (padrão: portal). */
  brandHref?: string;
  /** URL dos termos de uso e direitos autorais. */
  copyrightHref?: string;
  /**
   * Links institucionais próprios do app consumidor (ex.: "Sobre e uso" do
   * Downloads, spec 086 T10.1) — opcional, sem default. Aditivo: consumidor
   * que não passar nada mantém o footer igual a antes desta prop existir.
   */
  moduleLinks?: NavItem[];
}

export function Footer({
  variant,
  navItems = defaultNavItems,
  brandHref = BRAND_ORIGIN,
  copyrightHref = `${BRAND_ORIGIN}/termos-de-uso-e-direitos-autorais/`,
  moduleLinks,
}: FooterProps) {
  const year = new Date().getFullYear();

  return (
    /* Mesma regra do `Header` (T7.4, spec 102): sem `variant` o atributo é OMITIDO,
       e o footer segue `:root[data-theme="dark"]`. Um `data-variant="light"` literal
       venceria o seletor de tema e travaria o footer claro no tema escuro. */
    <footer className="artificio-footer" data-variant={variant}>
      <div className="artificio-footer-inner">
        <div className="artificio-footer-brand-col">
          <a className="artificio-footer-brand-link" href={brandHref}>
            {/* As duas marcas no HTML, o CSS mostra uma — ver a nota em `Header.tsx`. */}
            <img
              alt={brandLogoNavy.alt}
              className="artificio-footer-logo logo-navy"
              height={brandLogoNavy.height}
              src={brandLogoNavy.src}
              width={brandLogoNavy.width}
            />
            <img
              alt={brandLogoNeg.alt}
              className="artificio-footer-logo logo-neg"
              height={brandLogoNeg.height}
              src={brandLogoNeg.src}
              width={brandLogoNeg.width}
            />
          </a>
          <p className="artificio-footer-tagline">{FOOTER_TAGLINE}</p>
        </div>

        <nav className="artificio-footer-nav" aria-label={FOOTER_NAV_ARIA}>
          <span className="artificio-footer-nav-title">{FOOTER_NAV_LABEL}</span>
          <ul className="artificio-footer-nav-list">
            {navItems.map((item) => (
              <li key={item.href}>
                <a className="artificio-footer-nav-link" href={item.href}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {moduleLinks && moduleLinks.length > 0 && (
          <nav className="artificio-footer-nav" aria-label={FOOTER_MODULE_ARIA}>
            <span className="artificio-footer-nav-title">{FOOTER_MODULE_LABEL}</span>
            <ul className="artificio-footer-nav-list">
              {moduleLinks.map((item) => (
                <li key={item.href}>
                  <a className="artificio-footer-nav-link" href={item.href}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      <p className="artificio-footer-gift">{FOOTER_GIFT_TEXT}</p>
      <p className="artificio-footer-copyright-summary">
        {FOOTER_COPYRIGHT.replace("{year}", String(year))}{" "}
        <a href={copyrightHref}>{FOOTER_TERMS_LABEL}</a>.
      </p>

      <div className="artificio-footer-base">
        <span className="artificio-footer-brand">{FOOTER_BRAND}</span>
        <span>© {year} · {FOOTER_BASE_DOMAIN}</span>
      </div>
    </footer>
  );
}
