import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { X, Zap, Calendar } from 'lucide-react';

interface Changelog {
  id: string;
  title: string;
  body: string;
  type: 'app' | 'dados';
  created_at: string;
}

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Função robusta de processamento de markdown
const renderMarkdown = (text: string): ReactNode => {
  return text.split('\n').map((line, lineIndex) => {
    const elements: ReactNode[] = [];
    let currentIndex = 0;
    
    // Regex para capturar **texto** (negrito)
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let match;
    
    while ((match = boldRegex.exec(line)) !== null) {
      // Adicionar texto antes do negrito
      if (match.index > currentIndex) {
        elements.push(
          <span key={`text-${lineIndex}-${currentIndex}`}>
            {line.substring(currentIndex, match.index)}
          </span>
        );
      }
      
      // Adicionar negrito
      elements.push(
        <strong key={`bold-${lineIndex}-${match.index}`}>
          {match[1]}
        </strong>
      );
      
      currentIndex = match.index + match[0].length;
    }
    
    // Adicionar texto restante após o último negrito
    if (currentIndex < line.length) {
      elements.push(
        <span key={`text-${lineIndex}-${currentIndex}`}>
          {line.substring(currentIndex)}
        </span>
      );
    }
    
    // Se não houver nenhum elemento, renderizar a linha vazia
    if (elements.length === 0) {
      elements.push(<span key={`empty-${lineIndex}`}>{line}</span>);
    }
    
    return (
      <div key={`line-${lineIndex}`}>
        {elements}
      </div>
    );
  });
};

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<Changelog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/changelog');
      
      if (!res.ok) {
        throw new Error(`Erro ao carregar atualizações (HTTP ${res.status})`);
      }
      
      const json: unknown = await res.json();
      const data = typeof json === 'object' && json !== null && 'data' in json ? json.data : [];
      setLogs(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error('Erro ao buscar changelogs:', err);
      setError('Não foi possível carregar as atualizações. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const controller = new AbortController();
      
      const fetchLogsWithAbort = async () => {
        try {
          setLoading(true);
          setError(null);
          const res = await fetch('/api/v1/changelog', {
            signal: controller.signal,
          });
          
          if (!res.ok) {
            throw new Error(`Erro ao carregar atualizações (HTTP ${res.status})`);
          }
          
          const json: unknown = await res.json();
          const data = typeof json === 'object' && json !== null && 'data' in json ? json.data : [];
          setLogs(Array.isArray(data) ? data : []);
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          
          console.error('Erro ao buscar changelogs:', err);
          setError('Não foi possível carregar as atualizações. Tente novamente mais tarde.');
        } finally {
          setLoading(false);
        }
      };
      
      fetchLogsWithAbort();
      
      return () => controller.abort();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Agrupar por dia
  const groupedLogs = logs.reduce((acc: Record<string, Changelog[]>, log) => {
    const date = new Date(log.created_at).toLocaleDateString('pt-BR');
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-3xl max-h-[calc(100dvh-2rem)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header - Compacto */}
        <div className="bg-[var(--color-artificio-blue)] px-6 py-4 relative flex-shrink-0">
          <button 
            onClick={onClose} 
            className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-[var(--color-artificio-orange)] text-white p-1.5 rounded-lg">
              <Zap size={18} fill="currentColor" />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">
              Novidades
            </h2>
          </div>
        </div>

        {/* Content - Scroll independente */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 min-h-0">
          {loading && (
            <div className="text-center py-8 text-gray-500" aria-live="polite">Carregando...</div>
          )}

          {!loading && error && (
            <div className="text-center py-8" role="alert">
              <p className="text-red-600 font-semibold mb-2">⚠️ Erro ao carregar atualizações</p>
              <p className="text-gray-600 text-sm mb-4">{error}</p>
              <button
                onClick={fetchLogs}
                className="px-4 py-2 bg-[var(--color-artificio-orange)] text-white rounded-lg hover:bg-opacity-90 transition-colors text-sm font-semibold"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!loading && !error && Object.entries(groupedLogs).map(([date, dailyLogs], dateIndex) => (
            <div key={`${date}-${dateIndex}`} className="mb-8 last:mb-0">
              
              {/* Data */}
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-[var(--color-artificio-orange)] w-2 h-2 rounded-full"></div>
                <span className="text-[var(--color-artificio-orange)] text-xs font-bold uppercase flex items-center gap-1.5">
                  <Calendar size={14} />
                  {date}
                </span>
              </div>

              {/* Changelogs do dia */}
              <div className="space-y-4">
                {dailyLogs.map((log) => {
                  const isExpanded = expandedLogs[log.id];
                  const shouldTruncate = log.body.length > 300;
                  
                  let displayBody = log.body;
                  if (shouldTruncate && !isExpanded) {
                    const truncated = log.body.slice(0, 300);
                    const lastSpace = Math.max(
                      truncated.lastIndexOf(' '),
                      truncated.lastIndexOf('\n')
                    );
                    displayBody = (lastSpace > 250 ? truncated.slice(0, lastSpace) : truncated) + '...';
                  }

                  return (
                    <div key={log.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="text-[var(--color-artificio-blue)] font-bold text-base leading-tight flex-1">
                          {log.title}
                        </h3>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase flex-shrink-0 ${
                          log.type === 'dados' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {log.type === 'dados' ? 'CONTEÚDO' : 'SISTEMA'}
                        </span>
                      </div>
                      
                      <div className="text-gray-700 text-sm leading-relaxed">
                        {renderMarkdown(displayBody)}
                      </div>
                      
                      {shouldTruncate && (
                        <button
                          onClick={() => setExpandedLogs(prev => ({ ...prev, [log.id]: !isExpanded }))}
                          className="text-[var(--color-artificio-orange)] text-xs font-bold mt-3 hover:underline"
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? '▲ Ver menos' : '▼ Ver mais'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {!loading && !error && logs.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nenhuma atualização disponível no momento.
            </div>
          )}
        </div>

        {/* Footer - Compacto */}
        <div className="p-4 bg-white border-t border-gray-100 flex justify-end flex-shrink-0">
          <button 
            onClick={onClose} 
            className="bg-[var(--color-artificio-blue)] text-white px-6 py-2 rounded-lg font-semibold text-sm uppercase hover:bg-opacity-90 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
