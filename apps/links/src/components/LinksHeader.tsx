import { useEffect, useState } from "react";
import { Header, useChangelogBadge, type Theme } from "@artificio/ui";
import type { UserMenuItem } from "@artificio/ui";
import { LinksChangelogModal } from "./LinksChangelogModal";

const UPDATE_MARKER = "2026-06-21-shell-unificado";

const userMenu: UserMenuItem[] = [
  { label: "Painel admin", href: "/admin", adminOnly: true },
];

export function LinksHeader() {
  const [changelogOpen, setChangelogOpen] = useState(false);
  const { hasNewUpdate, markSeen } = useChangelogBadge("links_last_seen_update", UPDATE_MARKER);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const html = document.documentElement;
    const read = () => {
      const t = html.dataset.theme;
      if (t === "light" || t === "dark") setTheme(t);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(html, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const openChangelog = () => {
    setChangelogOpen(true);
    markSeen();
  };

  return (
    <>
      <Header
        currentHref="https://links.artificiorpg.com"
        variant={theme === "dark" ? "dark" : "light"}
        loginLabel="Entrar"
        userMenu={userMenu}
        showThemeToggle
        showSearch
        showChangelog
        onOpenChangelog={openChangelog}
        changelogHasBadge={hasNewUpdate}
        onSearch={() => {
          globalThis.location.href = "/busca";
        }}
      />
      <LinksChangelogModal isOpen={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </>
  );
}
