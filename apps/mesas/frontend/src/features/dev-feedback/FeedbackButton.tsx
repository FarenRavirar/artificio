import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FeedbackModal } from './FeedbackModal';

const HIDDEN_PATHS = ['/login'];

export const FeedbackButton = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (HIDDEN_PATHS.includes(location.pathname)) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Reportar problema ou sugerir melhoria"
        title="Reportar problema ou sugerir melhoria"
        className="fixed bottom-5 right-5 z-[900] flex items-center gap-2 rounded-full bg-[#FF9457] px-4 py-3 text-sm font-semibold text-[#020740] shadow-lg transition-all hover:bg-[#E0712F] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1B2A4A]"
      >
        <span aria-hidden="true">💬</span>
        <span className="hidden sm:inline">Reportar / Sugerir</span>
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
};
