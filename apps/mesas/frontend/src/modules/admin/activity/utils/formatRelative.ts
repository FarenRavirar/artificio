export function formatRelative(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const now = Date.now();
  const diffMs = now - date.getTime();

  if (diffMs < 60_000) {
    return 'agora';
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `há ${diffMinutes}min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `há ${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `há ${diffDays}d`;
  }

  return date.toLocaleDateString('pt-BR');
}
