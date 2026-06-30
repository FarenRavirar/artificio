export type AiAutomationMode = 'off' | 'suggest' | 'shadow' | 'auto';

export interface AiAutomationConfig {
  mode: AiAutomationMode;
  killSwitch: boolean;
  lowConfidenceThreshold: number;
  provider: 'deepseek';
  model: string;
  autoApprovalEnabled: boolean;
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

export function getAiAutomationConfig(env: NodeJS.ProcessEnv = process.env): AiAutomationConfig {
  const killSwitch = readBool(env.MESAS_AI_KILL_SWITCH);
  const requestedMode = readMode(env.MESAS_AI_AUTOMATION_MODE);
  return {
    mode: killSwitch ? 'off' : requestedMode,
    killSwitch,
    lowConfidenceThreshold: readThreshold(env.MESAS_AI_LOW_CONFIDENCE_THRESHOLD),
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
