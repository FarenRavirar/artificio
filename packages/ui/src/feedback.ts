/**
 * Contrato compartilhado do widget "Reportar problema / sugerir melhoria" (Spec 021).
 *
 * DATA-ONLY: sem React, sem auth, sem efeitos. Importável tanto por SPAs React
 * (glossario/mesas) quanto pela island vanilla do site Astro (zero-JS shell, D048)
 * — mesmo molde dos subpaths `@artificio/ui/brand` e `@artificio/ui/modules` (B13).
 *
 * Fonte única de LINGUAGEM/UX e do CONTRATO do payload. O runtime (componente
 * React ou script vanilla) e a persistência ficam por app; só a copy e os tipos
 * são únicos, para garantir experiência e linguagem iguais entre projetos.
 *
 * As strings espelham exatamente as usadas hoje no `apps/mesas` (paridade literal).
 */

export type FeedbackKind = 'bug' | 'suggestion';

export type FeedbackStatus =
  | 'new' | 'triaged' | 'in_progress' | 'resolved' | 'wont_fix' | 'duplicate';

/** Limite de campos do payload — espelho de `DEV_FEEDBACK_LIMITS` do mesas. */
export const FEEDBACK_LIMITS = {
  title: 160,
  description: 4000,
  url: 2000,
  routePath: 500,
  pageTitle: 300,
  environment: 40,
  userAgent: 500,
  viewport: 24,
  email: 254,
  message: 500,
  arrayCap: 30,
  // ~5MB de imagem em base64 (5 * 1024 * 1024 * 4/3 ~ 7M chars)
  screenshotChars: 7_000_000,
} as const;

export interface FeedbackConsoleEntry {
  level: string;
  message: string;
  ts: string | null;
}

export interface FeedbackNetworkEntry {
  url: string;
  method: string;
  status: number;
  ts: string | null;
}

/** Payload de envio público — mesmo shape que o mesas posta hoje (paridade total de dados). */
export interface SubmitFeedbackPayload {
  kind: FeedbackKind;
  title: string;
  description: string;
  contact_email?: string | null;
  page_url: string;
  route_path: string;
  page_title: string;
  environment: string;
  user_agent: string;
  viewport: string;
  console_errors: FeedbackConsoleEntry[];
  network_errors: FeedbackNetworkEntry[];
  screenshot?: string | null;
}

/**
 * Copy PT canônica. Mantém a grafia exata do mesas (alguns termos sem acento,
 * ex.: "Titulo", "Descricao", "Sugestao") para garantir paridade literal entre os
 * três projetos. Trocar aqui propaga para todos os consumidores de uma vez.
 */
export const FEEDBACK_COPY = {
  /** aria-label/title do botão flutuante e título do modal. */
  trigger: {
    ariaLabel: 'Reportar problema ou sugerir melhoria',
    label: 'Reportar / Sugerir',
    icon: '💬',
  },
  modal: {
    title: 'Reportar problema ou sugerir melhoria',
    subtitle:
      'Ajude a melhorar a plataforma. Coletamos o contexto da pagina para acelerar a correcao.',
    closeAria: 'Fechar',
  },
  kinds: {
    groupAria: 'Tipo de feedback',
    bug: { label: '🐞 Problema' },
    suggestion: { label: '💡 Sugestao' },
  },
  fields: {
    titleLabel: 'Titulo',
    titlePlaceholder: { bug: 'O que deu errado?', suggestion: 'O que voce sugere?' },
    descriptionLabel: 'Descricao',
    descriptionPlaceholder: {
      bug: 'Descreva o passo a passo que levou ao problema.',
      suggestion: 'Descreva sua ideia com detalhes.',
    },
    emailLabel: 'E-mail para retorno',
    emailOptional: '(opcional)',
    emailPlaceholder: 'voce@exemplo.com',
  },
  context: {
    heading: 'Informacoes coletadas para ajudar a equipe',
    page: 'Pagina:',
    viewport: 'Tela:',
    errors: 'Erros tecnicos capturados:',
    includeScreenshot: 'Incluir captura da tela visivel',
    includeDiagnostics: 'Incluir erros tecnicos',
  },
  actions: {
    cancel: 'Cancelar',
    submit: 'Enviar',
    submitting: 'Enviando...',
  },
  toasts: {
    missingFields: 'Preencha titulo e descricao.',
    success: 'Obrigado! Seu relato foi enviado para a equipe.',
    error: 'Nao foi possivel enviar. Tente novamente em instantes.',
  },
} as const;
