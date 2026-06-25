import React, { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ChangelogEntry, ChangelogModalLabels } from "./changelog.js";
import { DEFAULT_CHANGELOG_LABELS, normalizeChangelogEntries } from "./changelog.js";
import { useChangelogData } from "./hooks.js";

export function renderMarkdown(text: string): ReactNode {
  const lines = text.split("\n");
  const elements: ReactNode[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (line.trim() === "") continue;

    const spans: ReactNode[] = [];
    let currentIndex = 0;
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let match: RegExpExecArray | null;

    while ((match = boldRegex.exec(line)) !== null) {
      if (match.index > currentIndex) {
        spans.push(
          <span key={`t-${lineIndex}-${currentIndex}`}>
            {line.substring(currentIndex, match.index)}
          </span>,
        );
      }
      spans.push(
        <strong key={`b-${lineIndex}-${match.index}`}>{match[1]}</strong>,
      );
      currentIndex = match.index + match[0].length;
    }

    if (currentIndex < line.length) {
      spans.push(
        <span key={`t-${lineIndex}-${currentIndex}`}>
          {line.substring(currentIndex)}
        </span>,
      );
    }

    if (spans.length === 0) {
      spans.push(<span key={`e-${lineIndex}-${line.length}`}>{line}</span>);
    }

    elements.push(
      <div key={`l-${lineIndex}-${line.length}`} className="mb-1 last:mb-0">
        {spans}
      </div>,
    );
  }

  return <>{elements}</>;
}

interface ChangelogModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly changelogs: ChangelogEntry[];
  readonly loading?: boolean;
  readonly error?: string | null;
  readonly onRetry?: () => void;
  readonly labels?: Partial<ChangelogModalLabels>;
  readonly renderBody?: (body: string) => ReactNode;
  readonly bodyTruncateAt?: number;
}

export function ChangelogModal({
  isOpen,
  onClose,
  changelogs,
  loading = false,
  error = null,
  onRetry,
  labels: customLabels,
  renderBody,
  bodyTruncateAt = 300,
}: ChangelogModalProps) {
  const labels: ChangelogModalLabels = {
    typeApp: customLabels?.typeApp ?? DEFAULT_CHANGELOG_LABELS.typeApp,
    typeDados: customLabels?.typeDados ?? DEFAULT_CHANGELOG_LABELS.typeDados,
    title: customLabels?.title ?? DEFAULT_CHANGELOG_LABELS.title,
    subtitle: customLabels?.subtitle ?? DEFAULT_CHANGELOG_LABELS.subtitle,
    close: customLabels?.close ?? DEFAULT_CHANGELOG_LABELS.close,
    loading: customLabels?.loading ?? DEFAULT_CHANGELOG_LABELS.loading,
    empty: customLabels?.empty ?? DEFAULT_CHANGELOG_LABELS.empty,
    errorTitle: customLabels?.errorTitle ?? DEFAULT_CHANGELOG_LABELS.errorTitle,
    retry: customLabels?.retry ?? DEFAULT_CHANGELOG_LABELS.retry,
    expandMore: customLabels?.expandMore ?? DEFAULT_CHANGELOG_LABELS.expandMore,
    expandLess: customLabels?.expandLess ?? DEFAULT_CHANGELOG_LABELS.expandLess,
  };
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const toggleExpand = useCallback((logId: string) => {
    setExpandedLogs((prev) => ({ ...prev, [logId]: !prev[logId] }));
  }, []);

  // Lock body scroll while modal is open (prevents background content from
  // scrolling behind the semi-transparent backdrop — R-F1.1).
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const groupedLogs: Record<string, ChangelogEntry[]> = {};
  for (const log of changelogs) {
    const dateObj = new Date(log.created_at);
    if (isNaN(dateObj.getTime())) continue;
    const date = dateObj.toLocaleDateString("pt-BR");
    if (!groupedLogs[date]) groupedLogs[date] = [];
    groupedLogs[date].push(log);
  }

  const bodyRenderer = renderBody ?? renderMarkdown;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] w-full max-w-2xl max-h-[calc(100dvh-2rem)] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[var(--line)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-modal-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[var(--artificio-brand)] px-6 py-4 relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors"
            aria-label={labels.close}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-[var(--state-info-bg)] text-[var(--state-info-fg)] p-1.5 rounded-lg">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8.56 3.69a9 9 0 0 0-2.92 1.95" />
                <path d="M3.69 8.56A9 9 0 0 0 3 12" />
                <path d="M8.56 20.31A9 9 0 0 0 12 21" />
                <path d="M20.31 15.44A9 9 0 0 0 21 12" />
                <polygon points="13 2 13 13 18 11 13 13 13 2" />
              </svg>
            </div>
            <div>
              <h2 id="changelog-modal-title" className="text-xl font-black text-[var(--navy-block-fg)] uppercase tracking-tight">
                {labels.title}
              </h2>
              {labels.subtitle ? (
                <p className="text-[var(--navy-block-fg)] text-xs mt-0.5 opacity-70">
                  {labels.subtitle}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[var(--surface-subtle)] min-h-0">
          {loading ? (
            <div className="text-center py-8 text-[var(--fg-muted)]" aria-live="polite">
              {labels.loading}
            </div>
          ) : null}

          {!loading && error ? (
            <div className="text-center py-8" role="alert">
              <p className="text-[var(--state-error-fg)] font-semibold mb-2">
                {labels.errorTitle}
              </p>
              <p className="text-[var(--fg-muted)] text-sm mb-4">{error}</p>
              {onRetry ? (
                <button
                  onClick={onRetry}
                  className="px-4 py-2 bg-[var(--artificio-brand)] text-white rounded-lg hover:opacity-90 transition-colors text-sm font-semibold"
                >
                  {labels.retry}
                </button>
              ) : null}
            </div>
          ) : null}

          {!loading && !error && Object.entries(groupedLogs).length === 0 ? (
            <div className="text-center py-8 text-[var(--fg-muted)]">
              {labels.empty}
            </div>
          ) : null}

          {!loading &&
            !error &&
            (() => {
              const entries: ReactNode[] = [];
              const groupEntries = Object.entries(groupedLogs);
              for (let i = 0; i < groupEntries.length; i++) {
                const [date, dailyLogs] = groupEntries[i];
                const logs: ReactNode[] = [];
                for (let j = 0; j < dailyLogs.length; j++) {
                  const log = dailyLogs[j];
                  const isExpanded = expandedLogs[log.id];
                  const shouldTruncate =
                    log.body.length > bodyTruncateAt;
                  let displayBody = log.body;

                  if (shouldTruncate && !isExpanded) {
                    const truncated = log.body.slice(0, bodyTruncateAt);
                    const lastSpace = Math.max(
                      truncated.lastIndexOf(" "),
                      truncated.lastIndexOf("\n"),
                    );
                    displayBody =
                      (lastSpace > bodyTruncateAt * 0.8
                        ? truncated.slice(0, lastSpace)
                        : truncated) + "...";
                  }

                  logs.push(
                    <div
                      key={log.id}
                      className="bg-[var(--surface)] p-5 rounded-xl shadow-sm border border-[var(--line)]"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="text-[var(--fg)] font-bold text-base leading-tight flex-1">
                          {log.title}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase flex-shrink-0 ${
                            log.type === "dados"
                              ? "bg-[var(--state-success-bg)] text-[var(--state-success-fg)]"
                              : "bg-[var(--state-info-bg)] text-[var(--state-info-fg)]"
                          }`}
                        >
                          {log.type === "dados"
                            ? labels.typeDados
                            : labels.typeApp}
                        </span>
                      </div>

                      <div className="text-[var(--fg-muted)] text-sm leading-relaxed whitespace-pre-wrap">
                        {bodyRenderer(displayBody)}
                      </div>

                      {shouldTruncate ? (
                        <button
                          onClick={() => toggleExpand(log.id)}
                          className="text-[var(--artificio-brand)] text-xs font-bold mt-3 hover:underline"
                          aria-expanded={isExpanded}
                        >
                          {isExpanded
                            ? `▲ ${labels.expandLess}`
                            : `▼ ${labels.expandMore}`}
                        </button>
                      ) : null}
                    </div>,
                  );
                }
                entries.push(
                  <div key={date} className="mb-8 last:mb-0">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="bg-[var(--artificio-brand)] w-2 h-2 rounded-full" />
                      <span className="text-[var(--artificio-brand)] text-xs font-bold uppercase flex items-center gap-1.5">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect
                            x="3"
                            y="4"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {date}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {logs}
                    </div>
                  </div>,
                );
              }
              return entries;
            })()}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[var(--surface)] border-t border-[var(--line)] flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] px-6 py-2 rounded-lg font-semibold text-sm uppercase hover:opacity-90 transition-colors"
          >
            {labels.close}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}

interface StaticChangelogModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly changelogs?: ChangelogEntry[];
  /** Raw changelog data (normalized internally via normalizeChangelogEntries). Takes precedence over `changelogs` when provided. */
  readonly rawChangelogs?: unknown;
}

export function StaticChangelogModal({
  isOpen,
  onClose,
  changelogs,
  rawChangelogs,
}: StaticChangelogModalProps) {
  const resolved = rawChangelogs != null
    ? normalizeChangelogEntries(rawChangelogs)
    : changelogs ?? [];

  return (
    <ChangelogModal
      isOpen={isOpen}
      onClose={onClose}
      changelogs={resolved}
    />
  );
}

interface DynamicChangelogModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly fetcher: (signal: AbortSignal) => Promise<unknown>;
  readonly labels?: Partial<ChangelogModalLabels>;
}

export function DynamicChangelogModal({
  isOpen,
  onClose,
  fetcher,
  labels,
}: DynamicChangelogModalProps) {
  const { logs, loading, error, retry } = useChangelogData(fetcher, isOpen);

  return (
    <ChangelogModal
      isOpen={isOpen}
      onClose={onClose}
      changelogs={logs}
      loading={loading}
      error={error}
      onRetry={retry}
      labels={labels}
    />
  );
}
