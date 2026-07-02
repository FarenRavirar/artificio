export type AiAutomationMode = 'off' | 'suggest' | 'shadow' | 'auto';
export type AiAutonomyAction = 'draft_ready' | 'discard' | 'duplicate';

export interface AiAutonomyThresholds {
  draft_ready: number;
  discard: number;
  duplicate: number;
}

export interface AiAutomationConfig {
  mode: AiAutomationMode;
  killSwitch: boolean;
  lowConfidenceThreshold: number;
  autonomyThresholds: AiAutonomyThresholds;
  autonomyGateEnabled: boolean;
  provider: 'deepseek';
  model: string;
  autoApprovalEnabled: boolean;
}

export interface AiAutonomyGateInput {
  action: AiAutonomyAction;
  confidence: number | null | undefined;
  shadowApproved?: boolean;
  humanGateApproved?: boolean;
}

export interface AiAutonomyGateResult {
  allowed: boolean;
  threshold: number;
  reasons: string[];
}

export interface AiAutomationRollbackPlan {
  killSwitchEnv: 'MESAS_AI_KILL_SWITCH=true';
  safeModeEnv: 'MESAS_AI_AUTOMATION_MODE=off';
  disableRules: 'set discord_learning_rules.status = suppressed';
  clearPendingSuggestions: 'remove _ai_suggestions from draft normalized_payload';
}

function readBool(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

function readMode(value: string | undefined): AiAutomationMode {
  if (value === 'suggest' || value === 'shadow' || value === 'auto') return value;
  return 'off';
}

function readThreshold(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) return 0.5;
  return parsed;
}

function readAutonomyThreshold(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) return fallback;
  return parsed;
}

function readAutonomyThresholds(env: NodeJS.ProcessEnv): AiAutonomyThresholds {
  return {
    draft_ready: readAutonomyThreshold(env.MESAS_AI_AUTONOMY_THRESHOLD_DRAFT_READY, 0.98),
    discard: readAutonomyThreshold(env.MESAS_AI_AUTONOMY_THRESHOLD_DISCARD, 0.995),
    duplicate: readAutonomyThreshold(env.MESAS_AI_AUTONOMY_THRESHOLD_DUPLICATE, 0.99),
  };
}

export function getAiAutomationConfig(env: NodeJS.ProcessEnv = process.env): AiAutomationConfig {
  const killSwitch = readBool(env.MESAS_AI_KILL_SWITCH);
  const requestedMode = readMode(env.MESAS_AI_AUTOMATION_MODE);
  return {
    mode: killSwitch ? 'off' : requestedMode,
    killSwitch,
    lowConfidenceThreshold: readThreshold(env.MESAS_AI_LOW_CONFIDENCE_THRESHOLD),
    autonomyThresholds: readAutonomyThresholds(env),
    autonomyGateEnabled: false,
    provider: 'deepseek',
    model: env.MESAS_AI_MODEL?.trim() || 'deepseek-chat',
    autoApprovalEnabled: false,
  };
}

export function isAiAssistEnabled(config = getAiAutomationConfig()): boolean {
  return !config.killSwitch && (config.mode === 'suggest' || config.mode === 'shadow' || config.mode === 'auto');
}

export function assertAutoApprovalAllowed(config = getAiAutomationConfig()): never {
  throw new Error(`Auto-aprovação bloqueada. Modo=${config.mode}; exige shadow aprovado e autorização nominal.`);
}

export function evaluateAutonomyGate(
  input: AiAutonomyGateInput,
  config = getAiAutomationConfig(),
): AiAutonomyGateResult {
  const threshold = config.autonomyThresholds[input.action];
  const reasons: string[] = [];

  if (config.killSwitch) reasons.push('kill_switch');
  if (!config.autonomyGateEnabled) reasons.push('nominal_gate_required');
  if (!config.autoApprovalEnabled) reasons.push('auto_approval_disabled');
  if (config.mode !== 'auto') reasons.push('mode_not_auto');
  if (!input.shadowApproved) reasons.push('shadow_not_approved');
  if (!input.humanGateApproved) reasons.push('human_gate_not_approved');
  if (typeof input.confidence !== 'number' || input.confidence < threshold) reasons.push('confidence_below_threshold');

  return {
    allowed: reasons.length === 0,
    threshold,
    reasons,
  };
}

export function getAiAutomationRollbackPlan(): AiAutomationRollbackPlan {
  return {
    killSwitchEnv: 'MESAS_AI_KILL_SWITCH=true',
    safeModeEnv: 'MESAS_AI_AUTOMATION_MODE=off',
    disableRules: 'set discord_learning_rules.status = suppressed',
    clearPendingSuggestions: 'remove _ai_suggestions from draft normalized_payload',
  };
}
