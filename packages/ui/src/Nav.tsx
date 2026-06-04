import type { NavItem } from "./modules.js";

export interface NavProps {
  items: NavItem[];
  currentHref?: string;
}

export function Nav({ items, currentHref }: NavProps) {
  return (
    <nav aria-label="Modulos do Artificio">
      <ul className="artificio-nav-list">
        {items.map((item) => {
          const isCurrent = item.href === currentHref;

          return (
            <li key={item.href}>
              <a
                aria-current={isCurrent ? "page" : undefined}
                className="artificio-nav-link"
                href={item.href}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
