import { useId, useMemo, useState, type ReactNode } from "react";
import { cn } from "./cn.js";
import type { AdminLinkComponent } from "./MetricCard.js";

export interface AdminSidebarItem {
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: number | string;
  badgeLabel?: string;
  external?: boolean;
}

export interface AdminSidebarGroup {
  label: string;
  items: AdminSidebarItem[];
}

export interface AdminSidebarProps {
  groups: AdminSidebarGroup[];
  currentHref: string;
  LinkComponent?: AdminLinkComponent;
  ariaLabel?: string;
  eyebrow?: string;
  pendingCount?: number;
  pendingLabel?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptySearchLabel?: string;
  onItemSelect?: (item: AdminSidebarItem) => void;
  className?: string;
}

function isItemActive(currentHref: string, href: string): boolean {
  return currentHref === href || currentHref.startsWith(`${href}/`);
}

function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function AdminSidebar({
  groups,
  currentHref,
  LinkComponent,
  ariaLabel = "Gestão administrativa",
  eyebrow = "Gestão",
  pendingCount,
  pendingLabel = "pendente",
  searchable = true,
  searchPlaceholder = "Pesquisar na gestão",
  emptySearchLabel = "Nenhum item encontrado",
  onItemSelect,
  className,
}: Readonly<AdminSidebarProps>) {
  const [query, setQuery] = useState("");
  const groupIdPrefix = useId();
  const normalizedQuery = normalizeSearch(query);
  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return groups;
    return groups
      .map((group) => {
        const groupMatches = normalizeSearch(group.label).includes(normalizedQuery);
        const items = groupMatches
          ? group.items
          : group.items.filter((item) => normalizeSearch(item.label).includes(normalizedQuery));
        return { ...group, items };
      })
      .filter((group) => group.items.length > 0);
  }, [groups, normalizedQuery]);

  return (
    <nav aria-label={ariaLabel} className={cn("flex w-60 shrink-0 flex-col overflow-y-auto border-r border-[var(--admin-border)] bg-[var(--admin-rail)]", className)}>
      <div className="border-b border-[var(--admin-border)] px-5 py-4">
        <span className="eyebrow block text-[var(--admin-fg-low)]">{eyebrow}</span>
        {searchable && (
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="mt-3 h-11 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-fg)] outline-none placeholder:text-[var(--admin-fg-ghost)] focus:border-[var(--admin-border-strong)]"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-5 p-3">
        {filteredGroups.map((group, groupIndex) => {
          const groupLabelId = `${groupIdPrefix}-group-${groupIndex}`;
          return (
          <section key={group.label} aria-labelledby={groupLabelId}>
            <h2 id={groupLabelId} className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--admin-fg-faint)]">
              {group.label}
            </h2>
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => {
                const active = !item.external && isItemActive(currentHref, item.href);
                const linkClass = cn(
                  "flex min-h-11 items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-[var(--artificio-brand)] bg-[color-mix(in_srgb,var(--artificio-brand)_12%,transparent)] text-[var(--artificio-brand)]"
                    : "border-transparent text-[var(--admin-fg-low)] hover:bg-[var(--admin-hover)] hover:text-[var(--admin-fg-muted)]",
                );
                const content = (
                  <>
                    {item.icon && <span className="shrink-0 opacity-80">{item.icon}</span>}
                    <span className="truncate">{item.label}</span>
                    {item.badge !== undefined && item.badge !== 0 && (
                      <span title={item.badgeLabel} aria-label={item.badgeLabel} className="ml-auto min-w-5 rounded-full bg-[var(--artificio-brand)] px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums text-white">
                        {item.badge}
                      </span>
                    )}
                  </>
                );

                return (
                  <li key={item.href}>
                    {item.external || !LinkComponent ? (
                      <a href={item.href} onClick={() => onItemSelect?.(item)} className={linkClass} aria-current={active ? "page" : undefined} target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer" : undefined}>
                        {content}
                      </a>
                    ) : (
                      <LinkComponent
                        to={item.href}
                        className={linkClass}
                        onClick={() => onItemSelect?.(item)}
                        aria-current={active ? "page" : undefined}
                      >
                        {content}
                      </LinkComponent>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
          );
        })}
        {filteredGroups.length === 0 && (
          <p role="status" className="px-3 text-sm text-[var(--admin-fg-faint)]">{emptySearchLabel}</p>
        )}
      </div>

      {pendingCount !== undefined && pendingCount > 0 && (
        <div className="border-t border-[var(--admin-border)] px-5 py-3 text-xs tabular-nums text-[var(--admin-fg-faint)]">
          {pendingCount} {pendingLabel}{pendingCount === 1 ? "" : "s"}
        </div>
      )}
    </nav>
  );
}
