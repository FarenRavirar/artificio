import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas-pro';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/useAuth';
import { collectPageContext, getDiagnosticsSnapshot } from '../../lib/diagnostics';
import { submitDevFeedback, type DevFeedbackKind } from './devFeedbackApi';

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
  const { isAuthenticated } = useAuth();
  const [kind, setKind] = useState<DevFeedbackKind>('bug');
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
      toast.error('Preencha titulo e descricao.');
      return;
    }
    setSubmitting(true);
    try {
      let screenshot: string | null = null;
      if (includeScreenshot) {
        screenshot = await captureViewport();
      }

      await submitDevFeedback({
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

      toast.success('Obrigado! Seu relato foi enviado para a equipe.');
      onClose();
    } catch (error) {
      console.error('[FeedbackModal] Erro ao enviar feedback.', error);
      toast.error('Nao foi possivel enviar. Tente novamente em instantes.');
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
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#1B2A4A] p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="feedback-modal-title" className="text-xl font-bold text-white">
              Reportar problema ou sugerir melhoria
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Ajude a melhorar a plataforma. Coletamos o contexto da pagina para acelerar a correcao.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            aria-label="Fechar"
            className="rounded-lg px-2 py-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Tipo */}
        <div className="mb-4 grid grid-cols-2 gap-2" role="group" aria-label="Tipo de feedback">
          <button
            type="button"
            onClick={() => setKind('bug')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              kind === 'bug' ? 'bg-[#E8521A] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            🐞 Problema
          </button>
          <button
            type="button"
            onClick={() => setKind('suggestion')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              kind === 'suggestion' ? 'bg-[#E8521A] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            💡 Sugestao
          </button>
        </div>

        <label className="mb-1 block text-sm text-white/80" htmlFor="feedback-title">Titulo</label>
        <input
          id="feedback-title"
          ref={titleRef}
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === 'bug' ? 'O que deu errado?' : 'O que voce sugere?'}
          className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/40 focus:border-[#E8521A] focus:outline-none"
        />

        <label className="mb-1 block text-sm text-white/80" htmlFor="feedback-description">Descricao</label>
        <textarea
          id="feedback-description"
          value={description}
          maxLength={4000}
          rows={4}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={kind === 'bug' ? 'Descreva o passo a passo que levou ao problema.' : 'Descreva sua ideia com detalhes.'}
          className="mb-4 w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/40 focus:border-[#E8521A] focus:outline-none"
        />

        {!isAuthenticated && (
          <>
            <label className="mb-1 block text-sm text-white/80" htmlFor="feedback-email">
              E-mail para retorno <span className="text-white/40">(opcional)</span>
            </label>
            <input
              id="feedback-email"
              type="email"
              value={email}
              maxLength={254}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/40 focus:border-[#E8521A] focus:outline-none"
            />
          </>
        )}

        {/* Contexto coletado (transparencia) */}
        <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/70">
          <p className="mb-2 font-semibold text-white/80">Informacoes coletadas para ajudar a equipe</p>
          <p className="text-xs text-white/50">Pagina: {pageContext.route_path || '/'}</p>
          <p className="text-xs text-white/50">Tela: {pageContext.viewport}</p>
          <p className="text-xs text-white/50">Erros tecnicos capturados: {errorCount}</p>
          <label className="mt-3 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={includeScreenshot} onChange={(e) => setIncludeScreenshot(e.target.checked)} className="h-4 w-4" />
            Incluir captura da tela visivel
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={includeDiagnostics} onChange={(e) => setIncludeDiagnostics(e.target.checked)} className="h-4 w-4" />
            Incluir erros tecnicos ({errorCount})
          </label>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-[#E8521A] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#F26733] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
