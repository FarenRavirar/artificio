import { deriveSchedule, normalizePriceType, parsePriceValue } from '../utils/editorMapping';
import { normalizeAgeRating } from '../../../utils/ageRating';
import type { TableEditorState } from '../types';
import type {
  TableCard,
  TableContact,
  TableStatus,
  ExperienceLevel,
  TableModality,
} from '../../../types/tables';

/**
 * Estado do editor → objeto `TableCard` de LEITURA para a prévia (spec 096
 * R22/A25, T4.2b).
 *
 * A prévia usa o `TableCardComponent` real — nunca um card desenhado à mão,
 * que divergiria do catálogo no primeiro ajuste de layout (R16). Para isso o
 * editor monta o `TableCard` reusando os MESMOS mappers do payload
 * (normalizePriceType/parsePriceValue do mapper antigo e deriveSchedule do
 * editorMapping) — preço, agenda, imagem e contatos nunca são reimplementados
 * aqui. As ÚNICAS traduções próprias são as de formato de leitura (contatos
 * com label null + sort_order; agenda da linha derivada → next_schedule).
 *
 * Campos que o estado do editor ainda não produz (vtt_platform, gm_slug,
 * gm_avatar_url, gm_bio_long, featured) ficam ausentes/nulos de propósito:
 * o card tem ramos default para todos eles — campo ausente cai no default,
 * sem erro (decisão da task T4.2b).
 *
 * Vive fora do CardPreview.tsx por causa do
 * `react-refresh/only-export-components` (arquivo de componente não exporta
 * função) — mesmo padrão do closedTable.ts do MesaPage.
 */

export interface CardPreviewOptions {
  /** Nome de exibição do sistema (catálogo — leitura, não estado do editor). */
  systemName?: string | null;
  systemLogoFilename?: string | null;
  systemWebsiteUrl?: string | null;
}

/** Status aceitos pelo contrato de leitura do catálogo. */
const TABLE_STATUSES: readonly string[] = [
  'draft',
  'active',
  'full',
  'cancelled',
  'ended',
  'pending_review',
];

export function editorStateToCardPreview(
  state: TableEditorState,
  options: CardPreviewOptions = {},
): TableCard {
  const priceType = normalizePriceType(state.priceType);

  // Agenda: o `next_schedule` do card é derivado exatamente como o payload
  // deriva as colunas de agenda (deriveSchedule — mesma função). Sem linha
  // derivada (dia/horário "a definir" sem texto personalizado) o card cai no
  // ramo default: sem bloco de horário.
  const schedule = deriveSchedule(state);
  const firstRow = schedule.schedules[0];

  // Contatos no shape de LEITURA do catálogo (TableContact: label/discord
  // como null, sort_order presente) — o estado usa o shape de edição
  // (ContactMethodInput), então esta é a única tradução de formato do mapper;
  // a regra de filtragem (vazio fora, trim) é a mesma do payload.
  const contacts: TableContact[] = state.contacts
    .filter((contact) => contact.value.trim().length > 0)
    .map((contact, index) => ({
      channel: contact.channel,
      value: contact.value.trim(),
      label: contact.label?.trim() ? contact.label.trim() : null,
      discord_server_url: contact.discord_server_url?.trim()
        ? contact.discord_server_url.trim()
        : null,
      sort_order: index,
    }));

  return {
    id: state.id ?? '',
    slug: state.slug ?? '',
    title: state.title,
    description: state.description || null,
    cover_url: state.bannerUrl?.trim() ? state.bannerUrl.trim() : null,
    cover_crop_data: state.bannerCropData ?? null,
    cover_width: state.bannerWidth ?? null,
    cover_height: state.bannerHeight ?? null,
    // O card só distingue 'active' das demais (CTA "Entrar"/"Ver detalhes");
    // valor fora do contrato cai em 'draft' — ramo seguro para a prévia.
    status: (TABLE_STATUSES.includes(state.status ?? '') ? state.status : 'draft') as TableStatus,
    type: state.type,
    audience: state.audience || 'livre',
    modality: (state.modality as TableModality) || 'online',
    price_type: priceType,
    // preço avulso numérico (parsePriceValue tem o guard NaN→undefined do
    // mapper antigo); gratuita nunca carrega preço — mesma regra do payload.
    price_value: priceType === 'paga' ? (parsePriceValue(state.priceValue) ?? null) : null,
    slots_total: Number.parseInt(state.slotsTotal, 10) || 0,
    // O editor não guarda vagas PREENCHIDAS (ninguém entrou em rascunho). O
    // visual do card prioriza slots_open (getSlotsVisualState deriva
    // filled = total - open), então este valor cru não aparece na tela.
    slots_filled: 0,
    slots_open: Number.parseInt(state.slotsOpen, 10) || 0,
    language: state.language,
    experience_level: (state.experienceLevel as ExperienceLevel) || 'todos',
    featured: false,
    publisher_role: state.publisherRole,
    actual_gm_name: state.publisherRole === 'announcer' ? state.actualGmName || null : null,
    contacts,
    system_name: options.systemName ?? null,
    system_slug: null,
    system_logo_filename: options.systemLogoFilename ?? null,
    system_website_url: options.systemWebsiteUrl ?? null,
    gm_slug: null,
    gm_avatar_url: null,
    gm_display_name: state.masterDisplayName || null,
    gm_bio_long: null,
    is_ddal: state.ddal.is_ddal,
    is_covil: state.isCovil,
    // Não lido pelo card; o tipo exige. A prévia não tem data de criação.
    created_at: '',
    age_rating: normalizeAgeRating(state.ageRating) ?? null,
    setting_name: state.settingName || null,
    setting_styles: state.settingStyles.length > 0 ? state.settingStyles : null,
    game_platform_custom:
      state.vttPlatformId === 'custom' && state.gamePlatformCustom
        ? state.gamePlatformCustom
        : null,
    // vtt_platform fica AUSENTE de propósito: o badge de VTT do card precisa
    // do catálogo de plataformas (logo/name/url), que hoje vive no WherePart
    // (useVttPlatforms). Sem ele o card cai no ramo default (sem badge) —
    // subir o catálogo ao topo do editor é custo que a prévia ainda não paga.
    next_schedule: firstRow
      ? {
          day_of_week: firstRow.day_of_week,
          start_time: firstRow.start_time,
          frequency: firstRow.frequency,
          schedule_day_status: schedule.schedule_day_status,
          notes: firstRow.notes ?? null,
        }
      : null,
  };
}
