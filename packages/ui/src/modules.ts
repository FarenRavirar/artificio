import { BRAND_ORIGIN, MODULE_ORIGINS } from "@artificio/config";

export interface NavItem {
  label: string;
  href: string;
}

export const defaultNavItems: NavItem[] = [
  { label: "Portal", href: BRAND_ORIGIN },
  { label: "Glossário", href: MODULE_ORIGINS.glossario },
  { label: "Mesas", href: MODULE_ORIGINS.mesas },
  { label: "Downloads", href: MODULE_ORIGINS.downloads },
  { label: "Esferas", href: MODULE_ORIGINS.esferas },
  { label: "SRD", href: MODULE_ORIGINS.srd },
  { label: "WhatsApps", href: MODULE_ORIGINS.links },
];
