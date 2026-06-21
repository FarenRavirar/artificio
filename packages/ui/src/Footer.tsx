import { brandLogoNavy, brandLogoNeg } from "./brand.js";
import { defaultNavItems, type NavItem } from "./modules.js";
import { BRAND_ORIGIN } from "@artificio/config";
import {
  FOOTER_TAGLINE,
  FOOTER_GIFT_TEXT,
  FOOTER_NAV_LABEL,
  FOOTER_NAV_ARIA,
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
}

export function Footer({
  variant = "light",
  navItems = defaultNavItems,
  brandHref = BRAND_ORIGIN,
  copyrightHref = `${BRAND_ORIGIN}/termos-de-uso-e-direitos-autorais/`,
}: FooterProps) {
  const logo = variant === "dark" ? brandLogoNeg : brandLogoNavy;
  const year = new Date().getFullYear();

  return (
    <footer className="artificio-footer" data-variant={variant}>
      <div className="artificio-footer-inner">
        <div className="artificio-footer-brand-col">
          <a className="artificio-footer-brand-link" href={brandHref}>
            <img
              alt={logo.alt}
              className="artificio-footer-logo"
              height={logo.height}
              src={logo.src}
              width={logo.width}
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
