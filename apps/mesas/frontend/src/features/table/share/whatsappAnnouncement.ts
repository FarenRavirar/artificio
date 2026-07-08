import type { TableDetail, TableSchedule } from '../../../types/tables';

export type WhatsAppAnnouncementOptions = {
  publicOrigin?: string;
};

/**
 * Normaliza payload externo (API) para TableDetail antes de usar em spread/.length.
 * Achado CodeRabbit (PR #138, 2026-07-08): cast direto `as TableDetail` não garante
 * shape de array em campos como schedules/content_warnings/safety_tools.
 */
export function normalizeTableDetailPayload(payload: unknown): TableDetail | null {
  if (!payload || typeof payload !== 'object') return null;

  const raw = payload as Record<string, unknown>;
  if (typeof raw.slug !== 'string' || typeof raw.title !== 'string') return null;

  return {
    ...raw,
    schedules: Array.isArray(raw.schedules) ? (raw.schedules as TableSchedule[]) : undefined,
    content_warnings: Array.isArray(raw.content_warnings) ? (raw.content_warnings as string[]) : [],
    safety_tools: Array.isArray(raw.safety_tools) ? (raw.safety_tools as string[]) : [],
    setting_styles: Array.isArray(raw.setting_styles) ? (raw.setting_styles as string[]) : null,
  } as TableDetail;
}

const COMMUNITY_LINK = 'https://chat.whatsapp.com/CZZJy5XOYhxAC8pXXOJM7m';
const GUIDE_LINK = 'https://artificiorpg.com/blog/como-anunciar-mesa-de-rpg/';

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';

  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1: $2')
    .replace(/`{1,3}/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function joinNonEmpty(values: Array<string | null | undefined>, separator = ' · '): string {
  return values.map(cleanText).filter(Boolean).join(separator);
}

function formatType(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    campanha: 'Campanha',
    'one-shot': 'One-shot',
    'oneshot-serie': 'Série de one-shots',
    aberta: 'Mesa aberta',
  };

  return value ? (labels[value] ?? cleanText(value)) : '';
}

function formatPriceType(value: TableDetail['price_type'] | null | undefined): string {
  if (value === 'gratuita') return 'Gratuita';
  if (value === 'paga') return 'Comissionada';
  return '';
}

function formatAgeRating(value: TableDetail['age_rating']): string {
  if (value === 'livre') return 'Livre';
  return value ?? '';
}

function formatModality(table: TableDetail): string {
  if (table.modality === 'online') return 'Online';

  const location = joinNonEmpty([table.city, table.state], '/');
  if (table.modality === 'presencial') return joinNonEmpty(['Presencial', location]);
  if (table.modality === 'hibrida') return joinNonEmpty(['Híbrida', location]);
  return '';
}

function formatScheduleTime(schedule: TableSchedule): string {
  const start = schedule.start_time?.slice(0, 5) ?? '';
  const end = schedule.end_time?.slice(0, 5) ?? '';
  if (start && end) return `${start}-${end}`;
  return start || end;
}

function formatSchedules(table: TableDetail): string {
  const schedules = [...(table.schedules ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  if (schedules.length > 0) {
    return schedules
      .map((schedule) => joinNonEmpty([
        schedule.day_of_week,
        formatScheduleTime(schedule),
        schedule.frequency,
        schedule.notes,
      ]))
      .filter(Boolean)
      .join('; ');
  }

  const day = table.schedule_day_status === 'defined' ? table.schedule_day_hint : '';
  const time = table.schedule_time_status === 'defined' ? table.schedule_time_hint : '';
  return joinNonEmpty([day, time]);
}

function formatSlots(table: TableDetail): string {
  if (typeof table.slots_open === 'number') return String(table.slots_open);
  const available = table.slots_total - table.slots_filled;
  return Number.isFinite(available) ? String(Math.max(available, 0)) : '';
}

function formatPlatforms(table: TableDetail): string {
  return joinNonEmpty([
    table.vtt_platform?.name,
    table.game_platform_custom,
    table.communication_platform,
  ]);
}

function formatDuration(table: TableDetail): string {
  return joinNonEmpty([
    table.campaign_length,
    formatType(table.type),
    table.ddal_duration,
  ]);
}

function buildPublicTableUrl(table: TableDetail, publicOrigin?: string): string {
  const origin = (publicOrigin ?? '').replace(/\/+$/, '');
  const path = `/mesas/${encodeURIComponent(table.slug)}`;
  return origin ? `${origin}${path}` : path;
}

function buildAboutTable(table: TableDetail, synopsisSource: string): string {
  const blocks: string[] = [];

  if (table.description && cleanText(table.description) !== synopsisSource) {
    blocks.push(cleanText(table.description));
  }

  const setting = joinNonEmpty([
    table.setting_name,
    table.scenario_name,
    ...(table.setting_styles ?? []),
  ]);

  const ddal = [
    ['Código DDAL', table.ddal_code],
    ['Nome DDAL', table.ddal_name],
    ['Tier DDAL', table.ddal_tier == null ? '' : String(table.ddal_tier)],
    ['Temporada DDAL', table.ddal_season],
    ['Duração DDAL', table.ddal_duration],
    ['Formato DDAL', table.ddal_format],
    ['Organização DDAL', table.ddal_org_code],
    ['Cenário DDAL', table.ddal_setting],
    ['Regras DDAL', table.ddal_rules_notes],
  ]
    .map(([label, value]) => {
      const cleaned = cleanText(value);
      return cleaned ? `${label}: ${cleaned}` : '';
    })
    .filter(Boolean)
    .join('\n');

  const price = joinNonEmpty([
    table.billing_text,
    table.price_value == null ? '' : `Valor: R$ ${table.price_value}`,
    table.price_frequency ? `Frequência: ${table.price_frequency}` : '',
    table.session_zero_free ? 'Sessão zero gratuita' : '',
  ], '\n');

  const requirements = joinNonEmpty([
    table.technical_requirements,
    table.requires_pc ? 'Requer PC' : '',
    table.requires_camera ? 'Requer câmera' : '',
    table.requires_microphone ? 'Requer microfone' : '',
  ], '\n');

  const safety = joinNonEmpty([
    table.content_warnings?.length ? `Avisos: ${table.content_warnings.join(', ')}` : '',
    table.safety_tools?.length ? `Ferramentas de segurança: ${table.safety_tools.join(', ')}` : '',
  ], '\n');

  blocks.push(
    cleanText(table.benefits_text),
    cleanText(table.style_text),
    setting ? `Cenário e estilo: ${setting}` : '',
    joinNonEmpty([table.level_range, table.experience_level], '\n'),
    ddal,
    price,
    requirements,
    safety,
  );

  return blocks.filter(Boolean).join('\n\n');
}

export function buildWhatsAppTableAnnouncement(
  table: TableDetail,
  options: WhatsAppAnnouncementOptions = {},
): string {
  const title = cleanText(table.title);
  const systemName = cleanText(table.system_name);
  const tableType = formatType(table.type);
  const priceType = formatPriceType(table.price_type);
  const header = joinNonEmpty([systemName, title, tableType, priceType], ' - ');
  const synopsis = cleanText(table.synopsis_narrative) || cleanText(table.synopsis) || cleanText(table.description);
  const aboutMaster = cleanText(table.table_gm_bio) || cleanText(table.gm_bio_long);
  const publicUrl = buildPublicTableUrl(table, options.publicOrigin);

  const lines = [
    `📢${header}📢`,
    '',
    `▬ Título: ${title}`,
    `▬ Sistema: ${systemName}`,
    `▬ Data e Hora: ${formatSchedules(table)}`,
    `▬ Nº de Vagas: ${formatSlots(table)}`,
    `▬ Faixa Etária: ${formatAgeRating(table.age_rating)}`,
    `▬ Local do Jogo: ${formatModality(table)}`,
    `▬ Plataformas: ${formatPlatforms(table)}`,
    `▬ Mestre: ${cleanText(table.master_display_name) || cleanText(table.gm_display_name) || cleanText(table.actual_gm_name)}`,
    `▬ Estilo: ${joinNonEmpty([table.style_text, table.setting_name, ...(table.setting_styles ?? [])])}`,
    `▬ Duração: ${formatDuration(table)}`,
    `▬ Mesa: ${priceType}`,
    '',
    '📖 Sinopse:',
    synopsis,
    '',
    '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
    '',
    '🎭 Sobre o Mestre:',
    aboutMaster,
    '',
    '⚔️ Sobre a Mesa:',
    buildAboutTable(table, synopsis),
    '',
    '📌 Inscrições:',
    publicUrl,
    '',
    'Anúncios de Mesas de RPG:',
    `Para mais anúncios de vagas em mesas, acesse: ${COMMUNITY_LINK}`,
    '',
    'Temos um Post para aprofundar os mestres a realizar uma excelente de sua mesa e ajudar a filtrar e recrutar jogadores:',
    GUIDE_LINK,
  ];

  return lines.join('\n').replace(/\b(undefined|null|NaN)\b/g, '').replace(/[ \t]+\n/g, '\n').trim();
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fallback below keeps copy working when browser denies Clipboard API.
    }
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard unavailable');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand('copy');
    if (!copied) throw new Error('Clipboard fallback failed');
  } finally {
    document.body.removeChild(textarea);
  }
}
