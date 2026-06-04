import type { TableSchedule, TableContact } from '../../../types/tables';

/**
 * Variantes de renderização para componentes de mesa
 */
export type TableHeroVariant = 'full' | 'card' | 'compact' | 'highlight' | 'panel';
export type TableActionPanelVariant = 'full' | 'compact' | 'owner';

/**
 * Configuração de CTA (Call-to-Action)
 * Controla comportamento do botão primário
 */
export interface CTAConfig {
  label: string;
  disabled: boolean;
  variant: 'primary' | 'secondary' | 'disabled';
  action: 'scroll-contact' | 'external-link' | 'none';
  actionUrl?: string;
}

/**
 * Configuração de urgência (vagas)
 * Controla tom e mensagem de urgência
 */
export interface UrgencyConfig {
  label: string;
  tone: 'critical' | 'high' | 'medium' | 'low' | 'none';
  icon: string;
}

/**
 * Configuração de visibilidade
 * Controla quais seções renderizar
 */
export interface VisibilityConfig {
  showPrice: boolean;
  showSchedules: boolean;
  showMaster: boolean;
  showFullDetails: boolean;
  compact: boolean;
}

/**
 * Estrutura de certificações (DDAL, Covil do Lich, etc.)
 * Permite filtros e renderização contextual
 */
export interface TableCertifications {
  ddal?: {
    code?: string;
    name?: string;
    tier?: number;
    season?: string;
    duration?: string;
    format?: string;
    orgCode?: string;
    setting?: string;
    rulesNotes?: string;
  };
  covil?: {
    isMember: boolean;
  };
}

/**
 * ViewModel para renderização de mesa
 * Desacopla API (TableDetail) da UI
 * Ponto único de transformação de dados
 */
export interface TableViewModel {
  // =============================
  // DECISION ENGINE (configs)
  // =============================
  cta: CTAConfig;
  urgency: UrgencyConfig;
  visibility: VisibilityConfig;

  // =============================
  // DADOS
  // =============================
  
  // Identificação
  id: string;
  slug: string;
  title: string;
  subtitle?: string;

  // Decisão rápida (Hero)
  system: string;
  systemLogoFilename?: string | null;
  systemWebsiteUrl?: string | null;
  experience: string;
  modality: string;

  // Vagas
  slotsLeft: number;
  slotsTotal: number;
  slotsFilled: number;
  slotsOpen?: number; // CORREÇÃO DT-09: Vagas abertas para recrutamento
  isFull: boolean;

  // Preço
  price?: number;
  priceFrequency?: string;

  // Badges/Certificações
  certifications: TableCertifications;
  scenario?: string;

  // Mestre
  masterName?: string;
  masterSlug?: string;
  masterAvatar?: string;
  masterBio?: string;
  masterVttPlatforms?: Array<{
    id: string;
    name: string;
    slug: string;
    logo_filename: string | null;
    website_url: string | null;
  }>;

  // Horários
  schedules: TableSchedule[];
  scheduleDayStatus?: 'defined' | 'to_define';
  scheduleTimeStatus?: 'defined' | 'to_define';
  scheduleDayHint?: string | null;
  scheduleTimeHint?: string | null;

  // Plataformas (online/híbrida)
  vttPlatform?: {
    id: string;
    name: string;
    slug: string;
    logo_filename: string | null;
    website_url: string | null;
  };
  gamePlatformCustom?: string; // Quando mestre escolhe "Personalizado"
  communicationPlatform?: string; // CORREÇÃO C06: Plataforma de comunicação (Discord, Zoom, etc)

  // Conteúdo (Engagement)
  description?: string;
  narrative?: string;
  benefits?: string;
  styleText?: string;

  // Segurança
  contentWarnings: string[];
  safetyTools: string[];

  // Técnico
  campaignLength?: string;
  levelRange?: string;
  billingText?: string;
  sessionZeroFree?: boolean;
  technicalRequirements?: string;
  requiresPC?: boolean;
  requiresCamera?: boolean;
  requiresMicrophone?: boolean;

  // Cenário e estilos
  settingName?: string;
  settingStyles?: string[];

  // Metadados
  coverUrl?: string;
  coverCropData?: { x: number; y: number; width: number; height: number };
  status: string;
  origin?: 'manual' | 'imported';
  publisherRole: string;
  actualGmName?: string;

  // Contatos
  contacts: TableContact[];

  // Localização
  city?: string;
  state?: string;
  language: string;
  startsAt?: string;
}
