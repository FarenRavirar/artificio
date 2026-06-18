import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Termo } from '../types/glossario';
import { BookOpen, CheckCircle2, HelpCircle, Award, User as UserIcon, Pencil, Trash2, Save, X, ThumbsUp, ThumbsDown, MessageSquare, Send, ChevronDown, Clock3, History } from 'lucide-react';
import type { AtualizacaoTermoPayload } from '../hooks/useGlossario';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { trackViewTermo } from '@artificio/analytics';

interface ResultCardProps {
  termo: Termo;
  isAdmin?: boolean;
  onSave?: (id: string | number, payload: AtualizacaoTermoPayload) => Promise<void>;
  onDelete?: (id: string | number) => Promise<void>;
}

interface Comment {
  id: string;
  body: string;
  author_name: string;
  created_at: string;
  deleted: boolean;
  user_id: string;
}

interface TermHistoryChange {
  field: string;
  old_value: string | null;
  new_value: string | null;
}

interface TermHistoryEvent {
  changed_at: string;
  changed_by_name: string | null;
  changes: TermHistoryChange[];
}

type Nucleus = 'oficial' | 'sugestao' | 'artificio';
type Status = 'pendente' | 'verificado' | 'rejeitado';
type SourceType = 'sistema' | 'cenario';

interface SystemOption { id: string; name: string; }
interface EditionOption { id: string; name: string; system_id: string; }
interface ScenarioOption { id: string; name: string; }
interface CategoryOption { id: string; name: string; type: SourceType; parent_id: string | null; }

interface EditFormState {
  name_en: string;
  name_pt: string;
  additional_info: string;
  book_reference: string;
  page_reference: string;
  nucleus: Nucleus;
  status: Status;
  source_type: SourceType;
  system_id: string;
  edition_id: string;
  scenario_id: string;
  category_id: string;
}

const buildInitialState = (termo: Termo): EditFormState => ({
  name_en: termo.name_en || termo.nome_en || '',
  name_pt: termo.name_pt || termo.nome_pt || '',
  additional_info: termo.additional_info || termo.informacao || '',
  book_reference: termo.book_reference || '',
  page_reference: termo.page_reference || '',
  nucleus: (termo.nucleus as Nucleus) || 'sugestao',
  status: termo.status === 'pendente' || termo.status === 'rejeitado' ? termo.status : 'verificado',
  source_type: termo.source_type || (termo.scenario_id ? 'cenario' : 'sistema'),
  system_id: termo.system_id || '',
  edition_id: termo.edition_id || '',
  scenario_id: termo.scenario_id || '',
  category_id: termo.category_id || '',
});

const FIELD_LABELS: Record<string, string> = {
  name_pt: 'Nome PT',
  nucleus: 'Núcleo',
  book_reference: 'Livro',
  page_reference: 'Página',
  additional_info: 'Informações adicionais',
  category_id: 'Categoria',
  status: 'Status',
};

const formatHistoryValue = (value: string | null): string => {
  if (value == null || value === '') return 'vazio';
  return value;
};

export const ResultCard: React.FC<ResultCardProps> = ({ termo, isAdmin = false, onSave, onDelete }) => {
  const unwanted = ["NÃO VALIDADO RECENTEMENTE", "DEFINIR DOMINIO", "DEFINIR SUBDOMINIO", "DEFINIR DOMÍNIO", "DEFINIR SUBDOMÍNIO", "INFORMAL"];
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState<EditFormState>(() => buildInitialState(termo));
  const [systems, setSystems] = useState<SystemOption[]>([]);
  const [editions, setEditions] = useState<EditionOption[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  // Estados para Social
  const [voteScore, setVoteScore] = useState(termo.vote_score || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyEvents, setHistoryEvents] = useState<TermHistoryEvent[]>([]);

  // Estado do tooltip de Rigor (com delay de fechamento)
  const [isRigorTooltipVisible, setIsRigorTooltipVisible] = useState(false);
  const rigorTooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const sentRef = useRef(false);

  const clearRigorTooltipTimeout = () => {
    if (rigorTooltipTimeoutRef.current) {
      clearTimeout(rigorTooltipTimeoutRef.current);
      rigorTooltipTimeoutRef.current = null;
    }
  };

  const showRigorTooltip = () => {
    clearRigorTooltipTimeout();
    setIsRigorTooltipVisible(true);
  };

  const hideRigorTooltipWithDelay = () => {
    clearRigorTooltipTimeout();
    rigorTooltipTimeoutRef.current = setTimeout(() => {
      setIsRigorTooltipVisible(false);
      rigorTooltipTimeoutRef.current = null;
    }, 2000);
  };

  // Normalização de chaves para suportar V1 e V2
  const nameEn = termo.name_en || termo.nome_en || '';
  const namePt = termo.name_pt || termo.nome_pt || '';
  const category = (termo.category_name || termo.categoria || '').trim();
  const subcategory = (termo.subcategory_name || termo.subcategoria || '').trim();
  const additionalInfo = termo.additional_info || termo.informacao || '';
  const system = termo.system_name || '';
  const scenario = termo.scenario_name || '';
  const bookReference = termo.book_reference || '';
  const pageReference = termo.page_reference || '';
  const lastUpdateAt = termo.last_changed_at || termo.updated_at || null;
  const hasTermHistory = Boolean(termo.last_changed_at);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || sentRef.current) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          sentRef.current = true;
          trackViewTermo({
            termo_id: String(termo.id),
            termo: nameEn,
            sistema: termo.system_name,
          });
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [termo.id, nameEn, termo.system_name]);

  useEffect(() => {
    sentRef.current = false;
  }, [termo.id]);

  // Lógica consolidada das Badges Arquiteturais (oficial, artificio, sugestao)
  const rawStatus = termo.status || '';
  const rawNucleus = termo.nucleus || 'sugestao';
  const rawCategoryString = `${category} ${subcategory}`.toUpperCase();
  
  // Reference unificada (book + page do V2, ou o texto base do V1)
  const refStr = termo.referencia != null
    ? String(termo.referencia)
    : [bookReference, pageReference].filter(Boolean).join(', '); 

  // Determinar a Badge Final baseada nas suas 3 Regras Estruturais já filtradas no DB
  let badgeType: 'sugestao' | 'rigor' | 'oficial' | 'hidden' = 'sugestao';
  let badgeLabel = 'SUGESTÃO: ' + (rawStatus === 'pendente' ? 'AINDA NÃO REVISADA' : rawStatus.toUpperCase());
  
  if (rawNucleus === 'artificio') {
      badgeType = 'rigor';
      badgeLabel = 'TRADUÇÃO RIGOR ARTIFÍCIO RPG';
  } else if (rawNucleus === 'oficial') {
      badgeType = 'oficial';
      badgeLabel = 'TRADUÇÃO OFICIAL';
  }

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === form.source_type),
    [categories, form.source_type]
  );

  useEffect(() => {
    if (!isEditing) {
      setForm(buildInitialState(termo));
      setActionError(null);
    }
  }, [termo, isEditing]);

  useEffect(() => {
    if (!isAdmin || !isEditing) return;

    const loadStructure = async () => {
      try {
        setLoadingStructure(true);
        const [systemsRes, scenariosRes, categoriesRes] = await Promise.all([
          api.get('/systems'),
          api.get('/scenarios'),
          api.get('/categories'),
        ]);
        setSystems(systemsRes.data);
        setScenarios(scenariosRes.data);
        setCategories(categoriesRes.data);
      } catch (err) {
        console.error(err);
        setActionError('Não foi possível carregar sistemas, cenários e categorias para edição.');
      } finally {
        setLoadingStructure(false);
      }
    };

    loadStructure();
  }, [isAdmin, isEditing]);

  useEffect(() => {
    if (!isAdmin || !isEditing || form.source_type !== 'sistema') return;
    if (!form.system_id) {
      setEditions([]);
      return;
    }

    api.get(`/systems/${form.system_id}/editions`)
      .then((res) => setEditions(res.data))
      .catch((err) => {
        console.error(err);
        setActionError('Não foi possível carregar as edições do sistema selecionado.');
      });
  }, [isAdmin, isEditing, form.source_type, form.system_id]);

  useEffect(() => {
    return () => {
      clearRigorTooltipTimeout();
    };
  }, []);

  const handleSave = async () => {
    if (!onSave) return;

    if (!form.name_en.trim() || !form.name_pt.trim()) {
      setActionError('Os nomes em inglês e português são obrigatórios.');
      return;
    }

    if (form.nucleus === 'oficial' && (!form.book_reference.trim() || !form.page_reference.trim())) {
      setActionError('Termos oficiais exigem Livro e Página de referência.');
      return;
    }

    if (form.source_type === 'sistema' && !form.system_id) {
      setActionError('Selecione um sistema antes de salvar.');
      return;
    }

    if (form.source_type === 'cenario' && !form.scenario_id) {
      setActionError('Selecione um cenário antes de salvar.');
      return;
    }

    try {
      setIsSaving(true);
      setActionError(null);
      const isSistema = form.source_type === 'sistema';
      await onSave(termo.id, {
        name_en: form.name_en.trim(),
        name_pt: form.name_pt.trim(),
        nucleus: form.nucleus,
        status: form.status,
        source_type: form.source_type,
        system_id: isSistema ? (form.system_id || null) : null,
        edition_id: isSistema ? (form.edition_id || null) : null,
        scenario_id: isSistema ? null : (form.scenario_id || null),
        category_id: form.category_id || null,
        book_reference: form.book_reference.trim() || null,
        page_reference: form.page_reference.trim() || null,
        additional_info: form.additional_info.trim() || null,
      });
      setIsEditing(false);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Não foi possível atualizar o termo agora.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleComments = async () => {
    if (!showComments) {
      setShowComments(true);
      if (comments.length === 0) {
        setLoadingComments(true);
        try {
          const { data } = await api.get(`/social/${termo.id}/comments`);
          setComments(data);
        } catch (err) {
          console.error('Erro ao buscar comentários:', err);
        } finally {
          setLoadingComments(false);
        }
      }
    } else {
      setShowComments(false);
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    try {
      setIsSubmittingComment(true);
      const { data } = await api.post(`/social/${termo.id}/comments`, { body: newComment });
      setComments([...comments, { ...data, author_name: user.username, user_id: user.id }]);
      setNewComment('');
    } catch (err) {
      console.error('Erro ao comentar:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleVote = async (direction: 'up' | 'down') => {
    if (!user) {
      setActionError('Faça login para votar nos termos.');
      return;
    }

    try {
      const { data } = await api.post(`/social/${termo.id}/vote`, { direction });
      setVoteScore(data.vote_score);
    } catch (err) {
      console.error('Erro ao votar:', err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Deseja realmente remover este comentário?')) return;
    try {
      await api.delete(`/social/comments/${commentId}`);
      setComments(comments.map(c => 
        c.id === commentId ? { ...c, deleted: true, body: '[Este comentário foi removido]' } : c
      ));
    } catch (err) {
      console.error('Erro ao deletar comentário:', err);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const confirmed = window.confirm('Tem certeza que deseja excluir este termo? Esta ação não pode ser desfeita.');
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      setActionError(null);
      await onDelete(termo.id);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Não foi possível excluir o termo agora.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleHistory = async () => {
    const next = !showHistory;
    setShowHistory(next);
    if (!next || historyEvents.length > 0) return;

    try {
      setLoadingHistory(true);
      const { data } = await api.get(`/terms/${termo.id}/history`);
      const events = Array.isArray(data?.events) ? data.events : [];
      setHistoryEvents(events);
    } catch (err) {
      console.error('Erro ao buscar histórico do termo:', err);
      setActionError('Não foi possível carregar o histórico de alterações.');
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div ref={cardRef} className="bg-[var(--surface)] border rounded-lg shadow-sm border-[var(--line)] relative overflow-visible transition-all hover:shadow-md">
      {(system || scenario) && (
        <div className="bg-[var(--navy-block-bg)] text-[10px] font-black uppercase tracking-widest text-[var(--navy-block-fg)] px-5 py-1.5 flex items-center gap-2 border-b-2 border-[var(--artificio-brand)] rounded-t-lg">
          {system ? `⚔️ SISTEMA: ${system}` : `🌍 CENÁRIO: ${scenario}`}
        </div>
      )}

      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-[var(--fg)] uppercase tracking-tight">
                {nameEn}
              </h2>
            </div>
            <h3 className="text-xl text-[var(--fg-muted)] font-semibold">
              {namePt}
            </h3>
          </div>

          <div className="flex flex-col items-end gap-2 z-10 shrink-0">
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing((prev) => !prev)}
                  className="flex items-center gap-1 bg-[var(--state-info-bg)] text-[var(--state-info-fg)] px-3 py-1.5 rounded-lg border border-[var(--state-info-line)] text-xs font-bold uppercase tracking-wide hover:bg-[var(--state-info-bg)] transition-colors"
                >
                  {isEditing ? <X size={12} /> : <Pencil size={12} />}
                  {isEditing ? 'Fechar edição' : 'Editar'}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1 bg-[var(--state-danger-bg)] text-[var(--state-danger-fg)] px-3 py-1.5 rounded-lg border border-[var(--state-danger-line)] text-xs font-bold uppercase tracking-wide hover:bg-[var(--state-danger-bg)] transition-colors disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  {isDeleting ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            )}

            <div className="flex flex-col items-end gap-2 mt-1">
              <div className="flex items-center gap-2">
                {/* Barra de Votação Social */}
                <div className="flex items-center bg-[var(--surface-subtle)] rounded-full px-2 py-0.5 gap-1">
                  <button 
                    onClick={() => handleVote('up')}
                    className="p-1 text-[var(--fg-muted)] hover:text-[var(--state-success-fg)] transition-colors"
                    title="Gostei"
                  >
                    <ThumbsUp size={14} />
                  </button>
                  <span className={`text-xs font-black min-w-[20px] text-center ${voteScore > 0 ? 'text-[var(--state-success-fg)]' : voteScore < 0 ? 'text-[var(--state-danger-fg)]' : 'text-[var(--fg-muted)]'}`}>
                    {voteScore > 0 ? `+${voteScore}` : voteScore}
                  </span>
                  <button 
                    onClick={() => handleVote('down')}
                    className="p-1 text-[var(--fg-muted)] hover:text-[var(--state-danger-fg)] transition-colors"
                    title="Não gostei"
                  >
                    <ThumbsDown size={14} />
                  </button>
                </div>

                {/* BADGES LATERAIS (Oficial, Rigor, Sugestão) */}
                {badgeType === 'rigor' && (
                  <div
                    className="relative inline-flex"
                    onMouseEnter={showRigorTooltip}
                    onMouseLeave={hideRigorTooltipWithDelay}
                  >
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--state-info-line)] bg-[var(--state-info-bg)] text-[var(--state-info-fg)] text-[10px] font-bold tracking-widest cursor-help">
                      <Award size={12} className="text-[var(--state-info-fg)]" />
                      {badgeLabel}
                    </span>
                    
                    {/* Tooltip Rigor Artifício RPG */}
                    <div
                      className={`absolute bottom-full right-0 mb-4 w-72 sm:w-80 transition-opacity duration-200 z-20 ${
                        isRigorTooltipVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                      }`}
                      onMouseEnter={showRigorTooltip}
                      onMouseLeave={hideRigorTooltipWithDelay}
                    >
                      <div className="bg-[var(--surface)] p-4 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-[var(--line)] text-sm leading-relaxed text-[var(--fg-muted)] relative text-left">
                        Termo padronizado pela Artifício RPG a partir de um{' '}
                        <a href="https://artificiorpg.com/doc/traducao-de-rpg/documentos/como-fazer-um-pre-projeto-de-traducao-de-rpg/" 
                           className="font-bold text-[var(--fg)] hover:text-[var(--artificio-brand)] underline"
                           target="_blank" rel="noopener noreferrer">
                          pré-projeto de tradução
                        </a>
                        , com glossário, padronização de frases, critérios de desempate e análise do contexto mecânico. Também leva em conta o histórico de localização oficial de D&D em múltiplos idiomas, conduzido pela Gale Force Nine em parceria com a Wizards of the Coast.
                        <div className="absolute -bottom-2 right-6 w-4 h-4 bg-[var(--surface)] border-b border-r border-[var(--line)] transform rotate-45"></div>
                      </div>
                    </div>
                  </div>
                )}

                {badgeType === 'oficial' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--state-success-line)] bg-[var(--state-success-bg)] text-[var(--state-success-fg)] text-[10px] font-bold tracking-widest">
                    <CheckCircle2 size={12} className="text-[var(--state-success-fg)]" />
                    {badgeLabel}
                  </span>
                )}

                {badgeType === 'sugestao' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--state-info-line)] bg-[var(--state-info-bg)] text-[var(--state-info-fg)] text-[10px] font-bold tracking-widest">
                    {rawStatus === 'pendente' ? <HelpCircle size={12} /> : <CheckCircle2 size={12} />}
                    {badgeLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs mb-4 items-center">
          {category && !unwanted.includes(category.toUpperCase()) && (() => {
            const isDarkBlueCategory = form.source_type === 'sistema' || termo.source_type === 'sistema' || rawCategoryString.includes('MAGIAS') || rawCategoryString.includes('ITENS MÁGICOS');
            const catClass = isDarkBlueCategory
              ? "bg-[var(--navy-block-bg)] text-[var(--navy-block-fg)] px-3 py-1 rounded-full uppercase font-bold text-[9px]"
              : "bg-[var(--navy-block-bg)] border-none text-[var(--navy-block-fg)] px-3 py-1 rounded-full uppercase font-bold text-[9px]";
            return (
              <span className={catClass}>
                CAT: {category}
              </span>
            );
          })()}

          {subcategory && !unwanted.includes(subcategory.toUpperCase()) && (
            <span className="bg-[var(--state-info-bg)] text-[var(--state-info-fg)] px-3 py-1 rounded-full uppercase font-bold text-[9px] border border-[var(--state-info-line)]">
              SUB: {subcategory}
            </span>
          )}

          {refStr && (
            <span className="text-[var(--fg-muted)] flex items-center gap-1 italic border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-0.5 rounded-full">
              <BookOpen size={10} /> {refStr}
            </span>
          )}

          {termo.added_by_name && (
            <span className="text-[var(--fg-muted)] flex items-center gap-1 text-[10px]">
              <UserIcon size={10} /> {termo.added_by_name}
            </span>
          )}

          {lastUpdateAt && (
            <span className="text-[var(--fg-muted)] flex items-center gap-1 text-[10px]">
              <Clock3 size={10} /> Atualizado em {new Date(lastUpdateAt).toLocaleString('pt-BR')}
            </span>
          )}
        </div>

        <div className="h-px bg-[var(--surface-subtle)] my-4" />

        <div className="text-[var(--fg)] leading-relaxed whitespace-pre-wrap text-sm italic">
          {additionalInfo || (
            <span className="text-[var(--fg-muted)]">Sem notas adicionais.</span>
          )}
        </div>

        {hasTermHistory && (
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)]">
            <button
              type="button"
              onClick={handleToggleHistory}
              className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-[var(--fg)] hover:bg-[var(--surface-subtle)] rounded-xl transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <History size={14} />
                Histórico de Atualizações
              </span>
              <ChevronDown size={14} className={`transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>

            {showHistory && (
              <div className="px-4 pb-4 pt-1 space-y-3">
                {loadingHistory && (
                  <p className="text-[11px] text-[var(--fg-muted)] uppercase tracking-widest">Carregando histórico...</p>
                )}

                {!loadingHistory && historyEvents.length === 0 && (
                  <p className="text-[11px] text-[var(--fg-muted)]">Ainda não há histórico registrado para este termo.</p>
                )}

                {!loadingHistory && historyEvents.map((event, idx) => (
                  <div key={`${event.changed_at}-${idx}`} className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-3">
                    <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest">
                      {new Date(event.changed_at).toLocaleString('pt-BR')}
                      {event.changed_by_name ? ` · por ${event.changed_by_name}` : ''}
                    </p>

                    <div className="mt-2 space-y-1">
                      {event.changes.map((change, changeIdx) => (
                        <p key={`${event.changed_at}-${change.field}-${changeIdx}`} className="text-xs text-[var(--fg)]">
                          <strong>{FIELD_LABELS[change.field] || change.field}:</strong>{' '}
                          <span className="text-[var(--fg-muted)]">{formatHistoryValue(change.old_value)}</span>{' '}
                          <span className="text-[var(--fg-muted)]">→</span>{' '}
                          <span>{formatHistoryValue(change.new_value)}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isAdmin && isEditing && (
          <div className="mt-5 border border-[var(--state-info-line)] bg-[var(--state-info-bg)] rounded-xl p-4 space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-[var(--fg)]">Edição Administrativa</p>

            {loadingStructure && (
              <p className="text-xs text-[var(--fg-muted)]">Carregando estrutura de sistema, cenário e categoria...</p>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-xs text-[var(--fg)] font-semibold">
                Nome em inglês
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
                  value={form.name_en}
                  onChange={(e) => setForm((prev) => ({ ...prev, name_en: e.target.value }))}
                />
              </label>

              <label className="text-xs text-[var(--fg)] font-semibold">
                Nome em português
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
                  value={form.name_pt}
                  onChange={(e) => setForm((prev) => ({ ...prev, name_pt: e.target.value }))}
                />
              </label>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <label className="text-xs text-[var(--fg)] font-semibold">
                Núcleo
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
                  value={form.nucleus}
                  onChange={(e) => setForm((prev) => ({ ...prev, nucleus: e.target.value as Nucleus }))}
                >
                  <option value="sugestao">Sugestão</option>
                  <option value="oficial">Oficial</option>
                </select>
              </label>

              <label className="text-xs text-[var(--fg)] font-semibold">
                Status
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as Status }))}
                >
                  <option value="pendente">Pendente</option>
                  <option value="verificado">Verificado</option>
                  <option value="rejeitado">Rejeitado</option>
                </select>
              </label>

              <label className="text-xs text-[var(--fg)] font-semibold">
                Contexto
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
                  value={form.source_type}
                  onChange={(e) => {
                    const nextSourceType = e.target.value as SourceType;
                    setForm((prev) => ({
                      ...prev,
                      source_type: nextSourceType,
                      system_id: nextSourceType === 'sistema' ? prev.system_id : '',
                      edition_id: nextSourceType === 'sistema' ? prev.edition_id : '',
                      scenario_id: nextSourceType === 'cenario' ? prev.scenario_id : '',
                      category_id: '',
                    }));
                  }}
                >
                  <option value="sistema">Sistema</option>
                  <option value="cenario">Cenário</option>
                </select>
              </label>
            </div>

            {form.source_type === 'sistema' ? (
              <div className="grid md:grid-cols-2 gap-3">
                <label className="text-xs text-[var(--fg)] font-semibold">
                  Sistema
                  <select
                    className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
                    value={form.system_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, system_id: e.target.value, edition_id: '' }))}
                  >
                    <option value="">Selecione...</option>
                    {systems.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>

                <label className="text-xs text-[var(--fg)] font-semibold">
                  Edição
                  <select
                    className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
                    value={form.edition_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, edition_id: e.target.value }))}
                    disabled={!form.system_id}
                  >
                    <option value="">Selecione...</option>
                    {editions.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <div className="grid md:grid-cols-1 gap-3">
                <label className="text-xs text-[var(--fg)] font-semibold">
                  Cenário
                  <select
                    className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
                    value={form.scenario_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, scenario_id: e.target.value }))}
                  >
                    <option value="">Selecione...</option>
                    {scenarios.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <label className="text-xs text-[var(--fg)] font-semibold">
              Categoria / Subcategoria
              <select
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
                value={form.category_id}
                onChange={(e) => setForm((prev) => ({ ...prev, category_id: e.target.value }))}
              >
                <option value="">Selecione...</option>
                {filteredCategories.filter((item) => !item.parent_id).map((parent) => (
                  <optgroup key={parent.id} label={parent.name}>
                    <option value={parent.id}>{parent.name}</option>
                    {filteredCategories
                      .filter((child) => child.parent_id === parent.id)
                      .map((child) => (
                        <option key={child.id} value={child.id}>↳ {child.name}</option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-xs text-[var(--fg)] font-semibold">
                Livro de referência
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
                  value={form.book_reference}
                  onChange={(e) => setForm((prev) => ({ ...prev, book_reference: e.target.value }))}
                />
              </label>

              <label className="text-xs text-[var(--fg)] font-semibold">
                Página de referência
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
                  value={form.page_reference}
                  onChange={(e) => setForm((prev) => ({ ...prev, page_reference: e.target.value }))}
                />
              </label>
            </div>

            <label className="text-xs text-[var(--fg)] font-semibold block">
              Informações adicionais
              <textarea
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm min-h-[100px]"
                value={form.additional_info}
                onChange={(e) => setForm((prev) => ({ ...prev, additional_info: e.target.value }))}
              />
            </label>

            {actionError && (
              <p className="text-xs text-[var(--state-danger-fg)] font-semibold">{actionError}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setForm(buildInitialState(termo));
                  setIsEditing(false);
                  setActionError(null);
                }}
                className="px-3 py-2 rounded-lg border border-[var(--line)] text-[var(--fg-muted)] text-xs font-bold uppercase tracking-wide hover:bg-[var(--surface-subtle)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] text-xs font-bold uppercase tracking-wide hover:bg-[var(--btn-primary-bg-hover)] transition-colors disabled:opacity-60"
              >
                <Save size={12} />
                {isSaving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        )}

        {/* Footer com comentários */}
        <div className="border-t border-[var(--line)] bg-[var(--surface-subtle)] mt-4 rounded-b-2xl">
          <button 
            type="button"
            onClick={handleToggleComments}
            className="w-full flex items-center justify-between px-6 py-3 text-xs font-bold text-[var(--fg)] hover:bg-[var(--surface-subtle)] transition-colors uppercase tracking-widest"
          >
            <div className="flex items-center gap-2">
              <MessageSquare size={16} />
              <span>{comments.length > 0 ? `${comments.length} Comentários` : 'Comentários'}</span>
            </div>
            <ChevronDown size={16} className={`transition-transform duration-300 ${showComments ? 'rotate-180' : ''}`} />
          </button>

          {showComments && (
            <div className="px-6 pb-6 pt-2 space-y-4 animate-in slide-in-from-top-2 duration-300">
              {/* Lista de Comentários */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {loadingComments ? (
                  <div className="text-center py-4 text-[var(--fg-muted)] text-[10px] font-bold uppercase tracking-widest animate-pulse">Carregando...</div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-4 text-[var(--fg-muted)] text-[10px] font-bold uppercase tracking-widest">Seja o primeiro a comentar!</div>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className={`p-3 rounded-xl border ${comment.deleted ? 'bg-[var(--surface-subtle)] border-[var(--line)]' : 'bg-[var(--surface)] border-[var(--line)] shadow-sm'}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black text-[var(--fg)] uppercase tracking-wider">{comment.author_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-[var(--fg-muted)]">{new Date(comment.created_at).toLocaleDateString('pt-BR')}</span>
                          {!comment.deleted && (user?.id === comment.user_id || user?.role === 'admin') && (
                            <button 
                              type="button"
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-[var(--fg-muted)] hover:text-[var(--state-danger-fg)] transition-colors"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className={`text-xs ${comment.deleted ? 'text-[var(--fg-muted)] italic' : 'text-[var(--fg-muted)]'}`}>
                        {comment.body}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Input de Novo Comentário */}
              {user ? (
                <form onSubmit={handleSendComment} className="relative">
                  <input 
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Escreva um comentário..."
                    className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-full py-2 pl-4 pr-12 text-sm focus:ring-2 focus:ring-[var(--artificio-brand)] focus:border-[var(--artificio-brand)] outline-none transition-all"
                  />
                  <button 
                    disabled={isSubmittingComment || !newComment.trim()}
                    type="submit"
                    className="absolute right-1 top-1 p-2 bg-[var(--artificio-brand)] text-[var(--navy-block-fg)] rounded-full hover:bg-[var(--btn-primary-bg-hover)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={14} />
                  </button>
                </form>
              ) : (
                <div className="text-center p-3 bg-[var(--state-info-bg)] rounded-xl border border-[var(--state-info-line)]">
                  <p className="text-[10px] font-bold text-[var(--fg)] uppercase tracking-widest">Faça login para participar da conversa</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultCard;
