import React, { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ChangelogEntry, ChangelogModalLabels } from "./changelog.js";
import { DEFAULT_CHANGELOG_LABELS } from "./changelog.js";

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  changelogs: ChangelogEntry[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  labels?: Partial<ChangelogModalLabels>;
  renderBody?: (body: string) => ReactNode;
  bodyTruncateAt?: number;
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
  const labels = { ...DEFAULT_CHANGELOG_LABELS, ...customLabels };
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const groupedLogs = changelogs.reduce(
    (acc: Record<string, ChangelogEntry[]>, log) => {
      const date = new Date(log.created_at).toLocaleDateString("pt-BR");
      if (!acc[date]) acc[date] = [];
      acc[date].push(log);
      return acc;
    },
    {},
  );

  const bodyRenderer =
    renderBody ?? ((text: string) => <>{text}</>);

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] w-full max-w-2xl max-h-[calc(100dvh-2rem)] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[var(--line)]"
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
              <h2 className="text-xl font-black text-[var(--navy-block-fg)] uppercase tracking-tight">
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
            Object.entries(groupedLogs).map(([date, dailyLogs]) => (
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
                  {dailyLogs.map((log) => {
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

                    return (
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
                            onClick={() =>
                              setExpandedLogs((prev) => ({
                                ...prev,
                                [log.id]: !isExpanded,
                              }))
                            }
                            className="text-[var(--artificio-brand)] text-xs font-bold mt-3 hover:underline"
                            aria-expanded={isExpanded}
                          >
                            {isExpanded
                              ? `▲ ${labels.expandLess}`
                              : `▼ ${labels.expandMore}`}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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
