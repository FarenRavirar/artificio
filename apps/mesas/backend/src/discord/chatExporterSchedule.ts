import type { DiscordChatExporterProfile } from '../db/types.js';

export type ChatExporterFrequency = 'hourly' | 'daily' | 'weekly';

/** Perfil no mínimo necessário para decidir agendamento (subset de DiscordChatExporterProfile). */
export interface SchedulableProfile {
  enabled: boolean;
  schedule_enabled: boolean;
  frequency: ChatExporterFrequency;
  time: string; // HH:MM
  timezone: string;
  last_run_at: Date | null;
}

const FREQUENCY_MIN_INTERVAL_MS: Record<ChatExporterFrequency, number> = {
  hourly: 55 * 60 * 1000, // margem para o tick de 5 min não pular a janela
  daily: 23 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

/** HH:MM local no timezone do perfil, via Intl (sem libs). Retorna null se inválido. */
function localHourMinute(now: Date, timezone: string): { hour: number; minute: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return { hour, minute };
  } catch {
    return null;
  }
}

function parseScheduleTime(time: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Decide se um perfil agendado deve rodar agora, num tick de granularidade `tickMinutes`.
 * Regras (uso pessoal, robusto a jitter do tick):
 *  - precisa `enabled` + `schedule_enabled`;
 *  - respeita intervalo mínimo desde `last_run_at` conforme a frequência (evita rodar 2×);
 *  - hourly: qualquer minuto serve (só o intervalo importa);
 *  - daily/weekly: o horário local (tz) precisa estar dentro da janela [time, time+tick).
 * Pura e determinística → testável sem relógio real.
 */
export function isProfileDue(
  profile: SchedulableProfile,
  now: Date,
  tickMinutes = 5,
): boolean {
  if (!profile.enabled || !profile.schedule_enabled) return false;

  const minInterval = FREQUENCY_MIN_INTERVAL_MS[profile.frequency];
  if (profile.last_run_at) {
    const elapsed = now.getTime() - profile.last_run_at.getTime();
    if (elapsed < minInterval) return false;
  }

  if (profile.frequency === 'hourly') return true;

  const scheduled = parseScheduleTime(profile.time);
  const local = localHourMinute(now, profile.timezone);
  if (!scheduled || !local) return false;

  const scheduledMinutes = scheduled.hour * 60 + scheduled.minute;
  const localMinutes = local.hour * 60 + local.minute;
  return localMinutes >= scheduledMinutes && localMinutes < scheduledMinutes + tickMinutes;
}

/** Filtra os perfis prontos para rodar agora. */
export function selectDueProfiles(
  profiles: readonly DiscordChatExporterProfile[],
  now: Date,
  tickMinutes = 5,
): DiscordChatExporterProfile[] {
  return profiles.filter((profile) => isProfileDue(profile, now, tickMinutes));
}
