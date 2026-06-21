import { Header } from "@artificio/ui";
import type { UserMenuItem } from "@artificio/ui";

const userMenu: UserMenuItem[] = [
  { label: "Painel admin", href: "/admin", adminOnly: true },
];

export function LinksHeader() {
  return (
    <Header
      currentHref="https://links.artificiorpg.com"
      loginLabel="Entrar"
      userMenu={userMenu}
      showThemeToggle
      showSearch
      onSearch={() => {
        globalThis.location.href = "/busca";
      }}
    />
  );
}
