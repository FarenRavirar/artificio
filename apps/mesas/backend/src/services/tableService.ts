import { db } from '../db/index.js';
import { CreateTableInput } from '../validators/tableValidators.js';
import { Insertable, sql } from 'kysely';
import { TablesTable } from '../db/types.js';
import { getSystemCatalogProvider } from './systemCatalogProvider.js';

const DDAL_ELIGIBLE_PATH = 'dungeons-dragons/5e/2024';

export class TableService {
    /**
     * Valida se o sistema é elegível para selo DDAL
     */
    static async isDdalEligibleSystem(systemId: string): Promise<boolean> {
        const system = (await getSystemCatalogProvider().loadFlat()).find((node) => node.id === systemId);

        const path = system?.path_slug ?? null;
        if (!path) return false;

        return path === DDAL_ELIGIBLE_PATH || path.startsWith(`${DDAL_ELIGIBLE_PATH}/`);
    }

    /**
     * Valida e retorna UUID da VTT platform
     */
    static async validateVttPlatform(vttPlatformId: string | null): Promise<string | null> {
        if (!vttPlatformId || vttPlatformId === 'custom') {
            return null;
        }

        const vttPlatform = await db
            .selectFrom('vtt_platforms')
            .select(['id'])
            .where('slug', '=', vttPlatformId)
            .where('is_active', '=', true)
            .executeTakeFirst();

        if (!vttPlatform) {
            throw new Error('Plataforma VTT inválida');
        }

        return vttPlatform.id;
    }

    /**
     * Valida/resolve plataforma de comunicação
     * - Se communicationPlatformId for informado, valida UUID existente
     * - Se vier apenas texto legado, tenta resolver por slug/nome
     */
    static async validateCommunicationPlatform(
        communicationPlatformId: string | null,
        communicationPlatformLegacy?: string | null
    ): Promise<{ id: string | null; legacy: string | null }> {
        const legacy = communicationPlatformLegacy?.trim() ? communicationPlatformLegacy.trim() : null;

        if (communicationPlatformId) {
            const platform = await db
                .selectFrom('communication_platforms')
                .select(['id'])
                .where('id', '=', communicationPlatformId)
                .executeTakeFirst();

            if (!platform) {
                throw new Error('Plataforma de comunicação inválida');
            }

            return { id: platform.id, legacy: legacy ?? null };
        }

        if (!legacy) {
            return { id: null, legacy: null };
        }

        const legacySlug = legacy
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 100);

        const platform = await db
            .selectFrom('communication_platforms')
            .select(['id'])
            .where((eb) =>
                eb.or([
                    eb('slug', '=', legacySlug),
                    eb(sql`LOWER(name)`, '=', legacy.toLowerCase()),
                ])
            )
            .executeTakeFirst();

        if (platform) {
            return { id: platform.id, legacy };
        }

        return { id: null, legacy };
    }

    /**
     * Gera slug único para mesa
     */
    static generateSlug(title: string): string {
        const baseSlug = title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .substring(0, 80);

        const slugSuffix = Date.now().toString(36);
        return `${baseSlug}-${slugSuffix}`;
    }

    /**
     * Prepara dados para inserção no banco
     */
    static prepareTableData(
        data: CreateTableInput,
        gmProfileId: string,
        vttPlatformUuid: string | null,
        communicationPlatformUuid: string | null,
        communicationPlatformLegacy: string | null,
        slug: string,
        userRole: string
    ): Insertable<TablesTable> {
        const safeIsCovil = (userRole === 'admin' && data.is_covil) ? true : false;

        return {
            slug,
            gm_id: gmProfileId,
            system_id: data.system_id,
            scenario_id: data.scenario_id ?? null,
            title: data.title,
            description: data.description ?? null,
            type: data.type,
            audience: data.audience,
            modality: data.modality,
            price_type: data.price_type,
            price_value: data.price_value ?? null,
            price_frequency: data.price_frequency ?? null,
            slots_total: data.slots_total,
            slots_filled: data.slots_filled,
            slots_open: data.slots_open ?? data.slots_total,
            language: data.language,
            experience_level: data.experience_level,
            starts_at: data.starts_at ? new Date(data.starts_at) : null,
            schedule_day_status: data.schedule_day_status,
            schedule_time_status: data.schedule_time_status,
            schedule_day_hint: data.schedule_day_status === 'defined' ? (data.schedule_day_hint ?? null) : null,
            schedule_time_hint: data.schedule_time_status === 'defined' ? (data.schedule_time_hint ?? null) : null,
            city: data.city ?? null,
            state: data.state ?? null,
            content_warnings: data.content_warnings,
            safety_tools: data.safety_tools,
            publisher_role: data.publisher_role,
            actual_gm_name: data.publisher_role === 'announcer' ? data.actual_gm_name : null,
            is_ddal: data.is_ddal,
            ddal_code: data.is_ddal ? data.ddal_code : null,
            ddal_name: data.is_ddal ? data.ddal_name : null,
            ddal_tier: data.is_ddal ? data.ddal_tier : null,
            ddal_season: data.is_ddal ? data.ddal_season : null,
            ddal_duration: data.is_ddal ? data.ddal_duration : null,
            ddal_format: data.is_ddal ? data.ddal_format : null,
            ddal_org_code: data.is_ddal ? data.ddal_org_code : null,
            ddal_setting: data.is_ddal ? data.ddal_setting : null,
            ddal_rules_notes: data.is_ddal ? data.ddal_rules_notes : null,
            vtt_platform_id: vttPlatformUuid,
            game_platform_custom: data.vtt_platform_id === 'custom' ? data.game_platform_custom : null,
            communication_platform_id: communicationPlatformUuid,
            communication_platform: communicationPlatformLegacy,
            rules_notes: data.rules_notes ?? null,
            banner_url: data.banner_url ?? null,
            banner_crop_data: data.banner_crop_data ?? null,
            is_covil: safeIsCovil,
            master_display_name: data.master_display_name ?? null,
            campaign_length: data.campaign_length ?? null,
            level_range: data.level_range ?? null,
            billing_text: data.billing_text ?? null,
            session_zero_free: data.session_zero_free,
            synopsis: data.synopsis ?? null,
            style_text: data.style_text ?? null,
            listing_excerpt: data.listing_excerpt ?? null,
            technical_requirements: data.technical_requirements ?? null,
            requires_pc: data.requires_pc,
            requires_camera: data.requires_camera,
            requires_microphone: data.requires_microphone,
            setting_name: data.setting_name ?? null,
            setting_styles: data.setting_styles ?? null,
            synopsis_narrative: data.synopsis_narrative ?? null,
            benefits_text: data.benefits_text ?? null,
            table_gm_bio: data.table_gm_bio ?? null,
            status: 'active',
        };
    }
}
