import type { SyntheticEvent } from 'react';
import bannerPlaceholder from '../assets/banner_placeholder.webp';
import { safeImageSrc } from './imageSource';

export function resolveTableImageSource(src?: string | null): string {
  return safeImageSrc(src, bannerPlaceholder);
}

export function applyTableImageFallback(event: SyntheticEvent<HTMLImageElement>): void {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === 'true') return;
  img.dataset.fallbackApplied = 'true';
  img.src = bannerPlaceholder;
}

export { bannerPlaceholder };
