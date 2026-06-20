import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas-pro';
import toast from 'react-hot-toast';
import { FEEDBACK_COPY, type FeedbackKind } from '@artificio/ui/feedback';
import { useAuth } from '../../context/auth-context';
import { collectPageContext, getDiagnosticsSnapshot } from './diagnostics';
import { submitFeedback } from './feedbackApi';

interface FeedbackModalProps {
  onClose: () => void;
}

async function captureViewport(): Promise<string | null> {
  try {
    const scale = Math.min(1, 1280 / Math.max(window.innerWidth, 1));
    const canvas = await html2canvas(document.body, {
      x: window.scrollX,
      y: window.scrollY,
      width: window.innerWidth,
      height: window.innerHeight,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
      useCORS: true,
      logging: false,
      scale,
    });
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch (error) {
    console.warn('[FeedbackModal] Falha ao capturar tela.', error);
    return null;
  }
}

export const FeedbackModal = ({ onClose }: FeedbackModalProps) => {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const pageContext = useMemo(() => collectPageContext(), []);
  const diagnostics = useMemo(() => getDiagnosticsSnapshot(), []);
  const errorCount = diagnostics.consoleErrors.length + diagnostics.networkErrors.length;

  const c = FEEDBACK_COPY;

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const handleSubmit = async () => {
    if (title.trim().length === 0 || description.trim().length === 0) {
      toast.error(c.toasts.missingFields);
      return;
    }
    setSubmitting(true);
    try {
      let screenshot: string | null = null;
      if (includeScreenshot) {
        screenshot = await captureViewport();
      }

      await submitFeedback({
        kind,
        title: title.trim(),
        description: description.trim(),
        contact_email: !isAuthenticated && email.trim().length > 0 ? email.trim() : null,
        page_url: pageContext.page_url,
        route_path: pageContext.route_path,
        page_title: pageContext.page_title,
        environment: pageContext.environment,
        user_agent: pageContext.user_agent,
        viewport: pageContext.viewport,
        console_errors: includeDiagnostics ? diagnostics.consoleErrors : [],
        network_errors: includeDiagnostics ? diagnostics.networkErrors : [],
        screenshot,
      });

      toast.success(c.toasts.success);
      onClose();
    } catch (error) {
      console.error('[FeedbackModal] Erro ao enviar feedback.', error);
      toast.error(c.toasts.error);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="feedback-modal-title" className="text-xl font-bold text-[var(--navy-block-fg)]">
              {c.modal.title}
            </h2>
            <p className="mt-1 text-sm text-[rgba(255,255,255,0.6)]">{c.modal.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            aria-label={c.modal.closeAria}
            className="rounded-lg px-2 py-1 text-[rgba(255,255,255,0.6)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--navy-block-fg)] disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2" role="group" aria-label={c.kinds.groupAria}>
          <button
            type="button"
            onClick={() => setKind('bug')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              kind === 'bug' ? 'bg-[var(--artificio-brand)] text-[var(--fg)]' : 'bg-[var(--fill-subtle)] text-[rgba(255,255,255,0.6)] hover:bg-[var(--fill)]'
            }`}
          >
            {c.kinds.bug.label}
          </button>
          <button
            type="button"
            onClick={() => setKind('suggestion')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              kind === 'suggestion' ? 'bg-[var(--artificio-brand)] text-[var(--fg)]' : 'bg-[var(--fill-subtle)] text-[rgba(255,255,255,0.6)] hover:bg-[var(--fill)]'
            }`}
          >
            {c.kinds.suggestion.label}
          </button>
        </div>

        <label className="mb-1 block text-sm text-[rgba(255,255,255,0.8)]" htmlFor="feedback-title">{c.fields.titleLabel}</label>
        <input
          id="feedback-title"
          ref={titleRef}
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === 'bug' ? c.fields.titlePlaceholder.bug : c.fields.titlePlaceholder.suggestion}
          className="mb-4 w-full rounded-lg border border-[var(--line)] bg-[var(--fill-subtle)] px-3 py-2 text-[var(--navy-block-fg)] placeholder-[rgba(255,255,255,0.4)] focus:border-[var(--artificio-brand)] focus:outline-none"
        />

        <label className="mb-1 block text-sm text-[rgba(255,255,255,0.8)]" htmlFor="feedback-description">{c.fields.descriptionLabel}</label>
        <textarea
          id="feedback-description"
          value={description}
          maxLength={4000}
          rows={4}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={kind === 'bug' ? c.fields.descriptionPlaceholder.bug : c.fields.descriptionPlaceholder.suggestion}
          className="mb-4 w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--fill-subtle)] px-3 py-2 text-[var(--navy-block-fg)] placeholder-[rgba(255,255,255,0.4)] focus:border-[var(--artificio-brand)] focus:outline-none"
        />

        {!isAuthenticated && (
          <>
            <label className="mb-1 block text-sm text-[rgba(255,255,255,0.8)]" htmlFor="feedback-email">
              {c.fields.emailLabel} <span className="text-[rgba(255,255,255,0.4)]">{c.fields.emailOptional}</span>
            </label>
            <input
              id="feedback-email"
              type="email"
              value={email}
              maxLength={254}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={c.fields.emailPlaceholder}
              className="mb-4 w-full rounded-lg border border-[var(--line)] bg-[var(--fill-subtle)] px-3 py-2 text-[var(--navy-block-fg)] placeholder-[rgba(255,255,255,0.4)] focus:border-[var(--artificio-brand)] focus:outline-none"
            />
          </>
        )}

        <div className="mb-4 rounded-lg border border-[var(--line)] bg-[var(--fill-subtle)] p-3 text-sm text-[rgba(255,255,255,0.7)]">
          <p className="mb-2 font-semibold text-[rgba(255,255,255,0.8)]">{c.context.heading}</p>
          <p className="text-xs text-[rgba(255,255,255,0.5)]">{c.context.page} {pageContext.route_path || '/'}</p>
          <p className="text-xs text-[rgba(255,255,255,0.5)]">{c.context.viewport} {pageContext.viewport}</p>
          <p className="text-xs text-[rgba(255,255,255,0.5)]">{c.context.errors} {errorCount}</p>
          <label className="mt-3 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={includeScreenshot} onChange={(e) => setIncludeScreenshot(e.target.checked)} className="h-4 w-4" />
            {c.context.includeScreenshot}
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={includeDiagnostics} onChange={(e) => setIncludeDiagnostics(e.target.checked)} className="h-4 w-4" />
            {c.context.includeDiagnostics} ({errorCount})
          </label>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg px-4 py-2 text-sm text-[rgba(255,255,255,0.7)] transition-colors hover:bg-[var(--fill)] disabled:opacity-50"
          >
            {c.actions.cancel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-[var(--artificio-brand)] px-5 py-2 text-sm font-semibold text-[var(--fg)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? c.actions.submitting : c.actions.submit}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
