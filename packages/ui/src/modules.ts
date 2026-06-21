import { BRAND_ORIGIN } from "@artificio/config";

export interface NavItem {
  label: string;
  href: string;
}

export const defaultNavItems: NavItem[] = [
  { label: "Portal", href: BRAND_ORIGIN },
  { label: "Glossário", href: "https://glossario.artificiorpg.com" },
  { label: "Mesas", href: "https://mesas.artificiorpg.com" },
  { label: "Downloads", href: "https://downloads.artificiorpg.com" },
  { label: "Esferas", href: "https://esferas.artificiorpg.com" },
  { label: "SRD", href: "https://srd.artificiorpg.com" },
  { label: "WhatsApps", href: "https://links.artificiorpg.com" },
];
