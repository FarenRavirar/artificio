import React, { useEffect, useState } from 'react';
import { X, Zap, Calendar, ArrowRight } from 'lucide-react';
import api from '../services/api';

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

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<Changelog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      const fetchLogs = async () => {
        try {
          setLoading(true);
          const response = await api.get('/changelog');
          setLogs(response.data);
        } catch (error) {
          console.error('Erro ao buscar changelogs:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchLogs();
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--surface)] w-full max-w-2xl max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-[var(--line)] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[var(--navy-block-bg)] px-6 py-8 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-[rgba(255,255,255,0.7)] hover:text-[var(--navy-block-fg)] transition-colors p-2 hover:bg-[var(--fill)] rounded-full"
          >
            <X size={24} />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-[var(--artificio-brand)] text-[var(--navy-block-fg)] p-2 rounded-xl shadow-lg">
              <Zap size={24} fill="currentColor" />
            </div>
            <h2 className="text-2xl font-black text-[var(--navy-block-fg)] uppercase tracking-tighter">
              Notas de Atualização
            </h2>
          </div>
          <p className="text-[rgba(255,255,255,0.6)] text-sm font-medium">
            Confira as últimas melhorias e novos termos inseridos no Glossário.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 bg-[var(--surface-subtle)]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-10 h-10 border-4 border-[var(--artificio-brand)] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[var(--fg-muted)] font-bold text-sm uppercase tracking-widest">Carregando Novidades...</span>
            </div>
          )}

          {!loading && Object.keys(groupedLogs).length === 0 && (
            <div className="text-center py-12 text-[var(--fg-muted)]">
              Nenhuma atualização encontrada.
            </div>
          )}

          {!loading && Object.entries(groupedLogs).map(([date, dailyLogs]) => (
            <div key={date} className="relative pl-8">
              {/* Vertical line decoration */}
              <div className="absolute left-[11px] top-8 bottom-0 w-px bg-[var(--surface-strong)]"></div>
              
              <div className="flex items-center gap-2 mb-4 -ml-8">
                <div className="bg-[var(--surface)] border-2 border-[var(--artificio-brand)] w-6 h-6 rounded-full flex items-center justify-center z-10">
                  <div className="w-2 h-2 bg-[var(--artificio-brand)] rounded-full"></div>
                </div>
                <span className="bg-[rgba(255,87,34,0.10)] text-[var(--artificio-brand)] px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Calendar size={12} />
                  {date}
                </span>
              </div>

              <div className="space-y-4">
                {dailyLogs.map((log) => (
                  <div key={log.id} className="bg-[var(--surface)] p-5 rounded-2xl shadow-sm border border-[var(--line)] hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${
                        log.type === 'dados' ? 'bg-[var(--state-success-bg)] text-[var(--state-success-fg)]' : 'bg-[var(--state-info-bg)] text-[var(--state-info-fg)]'
                      }`}>
                        {log.type === 'dados' ? 'BASE DE DADOS' : 'SISTEMA'}
                      </span>
                    </div>
                    <h3 className="text-[var(--fg)] font-black text-base uppercase leading-tight mb-2">
                       {log.title}
                    </h3>
                    {(() => {
                      const isLongText = log.body.length > 120 || log.body.includes('\n');
                      return (
                        <>
                          <p className={`text-[var(--fg-muted)] text-sm leading-relaxed whitespace-pre-wrap ${!expandedLogs[log.id] && isLongText ? 'line-clamp-2' : ''}`}>
                            {log.body}
                          </p>
                          {isLongText && (
                            <div 
                              onClick={() => setExpandedLogs(prev => ({ ...prev, [log.id]: !prev[log.id] }))}
                              className="mt-3 flex items-center gap-1 text-[10px] text-[var(--artificio-brand)] font-bold uppercase tracking-widest group cursor-pointer hover:text-[var(--fg)] transition-all max-w-max"
                            >
                              {expandedLogs[log.id] ? 'Recolher' : 'Ver detalhes'} <ArrowRight size={12} className={`transition-transform ${expandedLogs[log.id] ? 'rotate-90' : ''}`} />
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 bg-[var(--surface)] border-t border-[var(--line)] flex justify-end">
          <button 
            onClick={onClose}
            className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-[var(--btn-primary-bg-hover)] transition-all shadow-lg"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
