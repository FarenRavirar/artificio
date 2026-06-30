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
