import { describe, it, expect } from 'vitest';
import { isProfileDue, selectDueProfiles, type SchedulableProfile } from '../chatExporterSchedule';

function profile(overrides: Partial<SchedulableProfile> = {}): SchedulableProfile {
  return {
    enabled: true,
    schedule_enabled: true,
    frequency: 'daily',
    time: '03:20',
    timezone: 'America/Sao_Paulo',
    last_run_at: null,
    ...overrides,
  };
}

// 03:20 America/Sao_Paulo (UTC-3) === 06:20 UTC
const AT_0320_SP = new Date('2026-06-30T06:20:00Z');
const AT_1000_SP = new Date('2026-06-30T13:00:00Z');

describe('isProfileDue', () => {
  it('não roda perfil desativado', () => {
    expect(isProfileDue(profile({ enabled: false }), AT_0320_SP)).toBe(false);
  });

  it('não roda sem schedule_enabled', () => {
    expect(isProfileDue(profile({ schedule_enabled: false }), AT_0320_SP)).toBe(false);
  });

  it('daily: roda dentro da janela do horário local', () => {
    expect(isProfileDue(profile(), AT_0320_SP)).toBe(true);
  });

  it('daily: não roda fora da janela', () => {
    expect(isProfileDue(profile(), AT_1000_SP)).toBe(false);
  });

  it('daily: não roda 2× se já rodou há menos de 23h', () => {
    const lastRun = new Date('2026-06-30T06:19:00Z');
    expect(isProfileDue(profile({ last_run_at: lastRun }), AT_0320_SP)).toBe(false);
  });

  it('hourly: roda por intervalo, independente do horário', () => {
    expect(isProfileDue(profile({ frequency: 'hourly' }), AT_1000_SP)).toBe(true);
  });

  it('hourly: não roda antes do intervalo mínimo', () => {
    const lastRun = new Date(AT_1000_SP.getTime() - 10 * 60 * 1000);
    expect(isProfileDue(profile({ frequency: 'hourly', last_run_at: lastRun }), AT_1000_SP)).toBe(false);
  });

  it('time inválido: não roda (fail-closed)', () => {
    expect(isProfileDue(profile({ time: 'xx:yy' }), AT_0320_SP)).toBe(false);
  });
});

describe('selectDueProfiles', () => {
  it('filtra só os prontos', () => {
    const due = selectDueProfiles(
      [
        profile() as never,
        profile({ enabled: false }) as never,
        profile({ frequency: 'hourly' }) as never,
      ],
      AT_0320_SP,
    );
    expect(due).toHaveLength(2);
  });
});
