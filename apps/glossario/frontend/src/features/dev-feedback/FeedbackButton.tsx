import { lazy, Suspense, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FEEDBACK_COPY } from '@artificio/ui/feedback';

const FeedbackModal = lazy(() =>
  import('./FeedbackModal').then((module) => ({ default: module.FeedbackModal }))
);

// Esconde nas telas de auth/migração (espelha mesas, que esconde em /login).
const HIDDEN_PATHS = ['/login', '/register', '/migrar'];

export const FeedbackButton = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (HIDDEN_PATHS.includes(location.pathname)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={FEEDBACK_COPY.trigger.ariaLabel}
        title={FEEDBACK_COPY.trigger.ariaLabel}
        className="fixed bottom-5 right-5 z-[900] flex items-center gap-2 rounded-full bg-[var(--artificio-brand)] px-4 py-3 text-sm font-semibold text-[var(--fg)] shadow-lg transition-all hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--line-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]"
      >
        <span aria-hidden="true">{FEEDBACK_COPY.trigger.icon}</span>
        <span className="hidden sm:inline">{FEEDBACK_COPY.trigger.label}</span>
      </button>
      {open && (
        <Suspense fallback={null}>
          <FeedbackModal onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
};
