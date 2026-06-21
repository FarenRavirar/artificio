import { useState } from "react";
import { Header, useChangelogBadge, useTheme, type UserMenuItem } from "@artificio/ui";
import { LinksChangelogModal } from "./LinksChangelogModal";

const UPDATE_MARKER = "2026-06-21-shell-unificado";

const userMenu: UserMenuItem[] = [
  { label: "Painel admin", href: "/admin", adminOnly: true },
];

export function LinksHeader() {
  const [changelogOpen, setChangelogOpen] = useState(false);
  const { hasNewUpdate, markSeen } = useChangelogBadge("links_last_seen_update", UPDATE_MARKER);
  const { theme } = useTheme();

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
