import type { SyntheticEvent } from 'react';
import bannerPlaceholder from '../assets/banner_placeholder.webp';

export function resolveTableImageSource(src?: string | null): string {
  const trimmed = typeof src === 'string' ? src.trim() : '';
  return trimmed || bannerPlaceholder;
}

export function applyTableImageFallback(event: SyntheticEvent<HTMLImageElement>): void {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === 'true') return;
  img.dataset.fallbackApplied = 'true';
  img.src = bannerPlaceholder;
}

export { bannerPlaceholder };
