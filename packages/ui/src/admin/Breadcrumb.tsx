export interface BreadcrumbProps {
  path: string[];
  creating?: boolean;
}

export function Breadcrumb({ path, creating = false }: Readonly<BreadcrumbProps>) {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--admin-fg-low)]">
      {path.map((segment, index) => (
        <span key={path.slice(0, index + 1).join("/")} className="flex items-center gap-2">
          {index > 0 && <span aria-hidden>›</span>}
          <span className={creating && index === path.length - 1 ? "italic text-[var(--admin-fg-ghost)]" : ""}>
            {segment}
          </span>
        </span>
      ))}
    </div>
  );
}
