import { attachAiSuggestions, buildAiSuggestionFields } from '../aiSuggestions';
import { evaluatePredictions } from '../aiEval';
import {
  assertAutoApprovalAllowed,
  evaluateAutonomyGate,
  getAiAutomationConfig,
  getAiAutomationRollbackPlan,
  isAiAssistEnabled,
} from '../aiAutomationConfig';
import { minimizeAnnouncementForLlm } from '../llmAssist';
import type { ImportTableDraft } from '../types';

function makeDraft(): ImportTableDraft {
  return {
    source: {
      guild_id: 'g',
      channel_id: 'c',
      message_id: 'm',
      message_url: 'https://discord.com/channels/g/c/m',
    },
    confidence: 0.3,
    confidence_tier: 'baixa',
    missing_fields: ['system_name', 'slots_total'],
    table: {
      title: 'Mesa',
      system_name: null,
      system_id: null,
      raw_system_hint: null,
      type: 'campanha',
      modality: 'online',
      price_type: 'gratuita',
      price_value: null,
      slots_total: null,
      slots_filled: null,
      slots_open: null,
      day_of_week: null,
      start_time: null,
      frequency: null,
      description: 'Texto',
      rules_notes: null,
      contact_discord: null,
      contact_discord_explicit: false,
      contact_url: null,
      host_discord_id: null,
      raw_gm_name: null,
      scenario_id: null,
      raw_scenario_hint: null,
      vtt_platform_id: null,
      communication_platform_id: null,
      age_rating: null,
      setting_name: null,
      setting_styles: null,
      experience_level: null,
      table_level: null,
      requires_pc: null,
      requires_camera: null,
      requires_microphone: null,
      session_zero_free: null,
      cover_url: null,
      cover_url_source: null,
      cover_quality: null,
      _slots_ambiguity: null,
      _homebrew_suspect: null,
      _notes: [],
    },
  };
}

describe('Spec 052 Bloco B automation guardrails', () => {
  it('kill switch desliga qualquer modo de IA', () => {
    const config = getAiAutomationConfig({
      MESAS_AI_AUTOMATION_MODE: 'suggest',
      MESAS_AI_KILL_SWITCH: 'true',
    } as NodeJS.ProcessEnv);

    expect(config.mode).toBe('off');
    expect(isAiAssistEnabled(config)).toBe(false);
  });

  it('IA gera sugestões separadas sem sobrescrever o determinístico', () => {
    const draft = makeDraft();
    const fields = buildAiSuggestionFields(
      { system_hint: 'Dungeons & Dragons', slots_total: 4, day_of_week: 'sexta' },
      draft.table,
    );
    const withSuggestion = attachAiSuggestions(draft, fields, 'deepseek', 'deepseek-chat');

    expect(withSuggestion.table.system_name).toBeNull();
    expect(withSuggestion.table.slots_total).toBeNull();
    expect(withSuggestion.table._ai_suggestions?.fields).toEqual({
      system_name: 'Dungeons & Dragons',
      slots_total: 4,
      day_of_week: 'sexta',
    });
    expect(withSuggestion.missing_fields).toEqual(['system_name', 'slots_total']);
  });

  it('eval offline mede acurácia por campo contra correção humana', () => {
    const result = evaluatePredictions(
      [
        {
          id: '1',
          parsed_before: { table: { system_name: 'D&D', slots_total: 3 } },
          human_corrected: { table: { system_name: 'Dungeons & Dragons', slots_total: 4 } },
        },
      ],
      [
        { id: '1', predicted: { table: { system_name: 'Dungeons & Dragons', slots_total: 3 } } },
      ],
    );

    expect(result.find((field) => field.field === 'system_name')?.accuracy).toBe(1);
    expect(result.find((field) => field.field === 'slots_total')?.accuracy).toBe(0);
  });

  it('eval offline conta predição ausente como erro', () => {
    const result = evaluatePredictions(
      [
        {
          id: '1',
          parsed_before: { table: { system_name: 'D&D' } },
          human_corrected: { table: { system_name: 'Dungeons & Dragons' } },
        },
      ],
      [],
    );

    expect(result.find((field) => field.field === 'system_name')).toMatchObject({
      total: 1,
      correct: 0,
      accuracy: 0,
    });
  });

  it('eval offline preserva casing do path em contact_url', () => {
    const result = evaluatePredictions(
      [
        {
          id: '1',
          parsed_before: { table: { contact_url: 'https://example.com/mesa' } },
          human_corrected: { table: { contact_url: 'https://example.com/Mesa' } },
        },
      ],
      [{ id: '1', predicted: { table: { contact_url: 'HTTPS://EXAMPLE.COM/mesa' } } }],
    );

    expect(result.find((field) => field.field === 'contact_url')?.accuracy).toBe(0);
  });

  it('auto-aprovação permanece bloqueada por gate nominal', () => {
    expect(() => assertAutoApprovalAllowed(getAiAutomationConfig({ MESAS_AI_AUTOMATION_MODE: 'auto' } as NodeJS.ProcessEnv))).toThrow(
      /Auto-aprovação bloqueada/,
    );
  });

  it('fase 8 define thresholds separados por ação e mantém autonomia bloqueada', () => {
    const config = getAiAutomationConfig({
      MESAS_AI_AUTOMATION_MODE: 'auto',
      MESAS_AI_AUTONOMY_THRESHOLD_DRAFT_READY: '0.97',
      MESAS_AI_AUTONOMY_THRESHOLD_DISCARD: '0.99',
      MESAS_AI_AUTONOMY_THRESHOLD_DUPLICATE: '0.98',
    } as NodeJS.ProcessEnv);

    expect(config.autonomyThresholds).toEqual({
      draft_ready: 0.97,
      discard: 0.99,
      duplicate: 0.98,
    });

    const gate = evaluateAutonomyGate({
      action: 'draft_ready',
      confidence: 1,
      shadowApproved: true,
      humanGateApproved: true,
    }, config);

    expect(gate.allowed).toBe(false);
    expect(gate.threshold).toBe(0.97);
    expect(gate.reasons).toContain('nominal_gate_required');
    expect(gate.reasons).toContain('auto_approval_disabled');
  });

  it('fase 8 expõe rollback operacional explícito', () => {
    expect(getAiAutomationRollbackPlan()).toEqual({
      killSwitchEnv: 'MESAS_AI_KILL_SWITCH=true',
      safeModeEnv: 'MESAS_AI_AUTOMATION_MODE=off',
      disableRules: 'set discord_learning_rules.status = suppressed',
      clearPendingSuggestions: 'remove _ai_suggestions from draft normalized_payload',
    });
  });

  it('minimiza payload antes de enviar para IA externa', () => {
    const prompt = minimizeAnnouncementForLlm('Mestre <@123456789> canal <#987> site https://bit.ly/x forms https://forms.gle/abc');

    expect(prompt).not.toContain('123456789');
    expect(prompt).not.toContain('987');
    expect(prompt).not.toContain('https://bit.ly/x');
    expect(prompt).toContain('<@user>');
    expect(prompt).toContain('<#channel>');
    expect(prompt).toContain('[form-url]');
    expect(prompt).not.toContain('https://forms.gle/abc');
  });
});
