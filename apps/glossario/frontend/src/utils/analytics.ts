const hasGtag = (): boolean =>
  typeof window !== 'undefined' && typeof window.gtag === 'function';

export const trackEvent = (
  eventName: string,
  params: Record<string, unknown> = {}
): void => {
  if (!hasGtag()) return;
  window.gtag?.('event', eventName, params);
};

export const trackPageView = (path: string): void => {
  if (!hasGtag()) return;
  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
};

export const trackSearch = (searchTerm: string): void => {
  const trimmed = searchTerm.trim();
  if (trimmed.length < 2) return;
  trackEvent('search', { search_term: trimmed });
};
