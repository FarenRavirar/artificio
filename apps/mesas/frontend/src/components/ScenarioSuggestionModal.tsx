import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';

import { authPost } from '../services/apiClient';

interface ScenarioSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ScenarioSuggestionModal = ({ isOpen, onClose, onSuccess }: ScenarioSuggestionModalProps) => {
  const { isAuthenticated } = useAuth();

  const [name, setName] = useState('');
  const [namePt, setNamePt] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const response = await authPost('/api/v1/scenario-suggestions', {
          name: name.trim(),
          name_pt: namePt.trim() || null,
          description: description.trim() || null,
        });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao enviar sugestão');
      }

      setName('');
      setNamePt('');
      setDescription('');
      onSuccess?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar sugestão';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#1B2A4A] border border-white/10 rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Sugerir Cenário</h2>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4">
          <p className="text-white/70 text-sm mb-6">
            Sugira um novo cenário para o catálogo da plataforma. Sua sugestão será revisada por um administrador.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white font-semibold mb-2 text-sm">
                Nome do Cenário *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ex: Forgotten Realms"
                className="w-full px-4 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-artificio-orange)]"
              />
            </div>

            <div>
              <label className="block text-white font-semibold mb-2 text-sm">
                Nome em português (opcional)
              </label>
              <input
                type="text"
                value={namePt}
                onChange={(e) => setNamePt(e.target.value)}
                placeholder="Ex: Reinos Esquecidos"
                className="w-full px-4 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-artificio-orange)]"
              />
            </div>

            <div>
              <label className="block text-white font-semibold mb-2 text-sm">
                Descrição (opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contexto adicional sobre o cenário..."
                rows={4}
                className="w-full px-4 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-artificio-orange)] resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-transparent border border-white/20 text-white rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex-1 px-4 py-2 bg-[var(--color-artificio-orange)] text-white font-semibold rounded-lg hover:bg-[var(--color-artificio-orange)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Enviando...' : 'Enviar Sugestão'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
};
