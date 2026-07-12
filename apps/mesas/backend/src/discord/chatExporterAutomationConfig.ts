export const DISCORD_CHAT_EXPORTER_LAYOUT = {
  incoming: 'incoming',
  processing: 'processing',
  processed: 'processed',
  error: 'error',
} as const;

export const DISCORD_CHAT_EXPORTER_RETENTION = {
  processedDays: 14,
  errorDays: 30,
} as const;

export const DISCORD_CHAT_EXPORTER_SYSTEMD = {
  serviceName: 'artificio-mesas-discord-import.service',
  timerName: 'artificio-mesas-discord-import.timer',
  schedule: '03:20:00 America/Sao_Paulo',
} as const;

// Fronteira legitima de import_dir (achado SonarCloud "path canonicalized from
// CLI-controlled data must be validated", PR #151, 2026-07-12): import_dir e
// sempre <base>/<profileId> (defaultImportDir em chatExporterAutomation.ts),
// nunca digitado pelo usuario — mas processDiscordChatExporterFolder so valida
// contra allowedBaseDir quando ele e passado. Fonte unica pra base, usada tanto
// na geracao quanto na validacao, pra nao divergir.
export function resolveChatExporterBaseDir(): string {
  return process.env.DISCORD_CHAT_EXPORTER_IMPORT_BASE_DIR?.trim()
    || process.env.DISCORD_CHAT_EXPORTER_IMPORT_DIR?.trim()
    || '/data/chat-exporter';
}
