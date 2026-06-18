import { brandLogoNavy, brandLogoNeg } from "./brand.js";
import { defaultNavItems, type NavItem } from "./modules.js";

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
  brandHref = "https://artificiorpg.com",
  copyrightHref = "https://artificiorpg.com/termos-de-uso-e-direitos-autorais/",
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
          <p className="artificio-footer-tagline">
            Hub de projetos de RPG em português. Gratuito, sem anúncios, sem coleta
            desnecessária.
          </p>
        </div>

        <nav className="artificio-footer-nav" aria-label="Projetos do Artifício">
          <span className="artificio-footer-nav-title">Projetos</span>
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

      <p className="artificio-footer-gift">
        Este é um presente da Artifício RPG para toda a comunidade brasileira de
        RPG. Compartilhe com seus grupos!
      </p>
      <p className="artificio-footer-copyright-summary">
        Artifício RPG © {year}. Todos os direitos reservados. Leitura, citação
        curta e compartilhamento de links são permitidos com crédito e link para a
        fonte. Reprodução integral, espelhamento, raspagem e uso comercial dependem
        de autorização prévia.{" "}
        <a href={copyrightHref}>Ver termos de uso e direitos autorais</a>.
      </p>

      <div className="artificio-footer-base">
        <span className="artificio-footer-brand">Artifício RPG</span>
        <span>© {year} · artificiorpg.com</span>
      </div>
    </footer>
  );
}
