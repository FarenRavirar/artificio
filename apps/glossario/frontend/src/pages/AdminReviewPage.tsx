import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { normalizeTermos, type Termo } from '../types/glossario';
import { sanitizeTermForUi } from '../utils/textSanitizer';

/**
 * Data ausente ou impossível de interpretar vira travessão, nunca "Invalid
 * Date" na tela — `new Date(undefined)` renderizava isso quando o campo não
 * vinha no payload (achado de review, PR #260).
 */
function formatarData(valor: string | undefined): string {
  if (!valor) return '—';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('pt-BR');
}

const statusLabel: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-[var(--state-warning-bg)] text-[var(--state-warning-fg)]' },
  verificado: { label: 'Verificado', color: 'bg-[var(--state-success-bg)] text-[var(--state-success-fg)]' },
  rejeitado: { label: 'Rejeitado', color: 'bg-[var(--state-danger-bg)] text-[var(--state-danger-fg)]' },
};

const AdminReviewPage: React.FC = () => {
  const [terms, setTerms] = useState<Termo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTerms = async () => {
    setLoading(true);
    try {
      const res = await api.get('/terms?status=pendente');
      // Duas passagens, nesta ordem: `normalizeTermos` garante a FORMA (payload
      // que não é array virava crash no `.map` de render) e `sanitizeTermForUi`
      // trata o CONTEÚDO. A sanitização faltava aqui — esta tela mostra termos
      // recém-submetidos por usuários, que é justamente onde texto hostil
      // chega primeiro, e era a única listagem do app sem ela (achado de
      // review, PR #260; o `useGlossario` já sanitizava nos 3 pontos dele).
      setTerms(normalizeTermos(res.data).map((t) => sanitizeTermForUi(t)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void (async () => { await fetchTerms(); })(); }, []);

  // `Termo.id` é `string | number` (o legado v1 devolvia número), então a
  // assinatura aceita os dois e escapa antes de montar a URL — o mesmo cuidado
  // que `ResultCard` já tinha e esta tela não.
  const moderate = async (id: string | number, status: 'verificado' | 'rejeitado') => {
    await api.patch(`/terms/${encodeURIComponent(String(id))}/approve`, { status });
    setTerms(prev => prev.filter(t => t.id !== id));
  };

  const pendentes = terms.filter(t => t.status === 'pendente');

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--fg)] flex items-center gap-2">
            <CheckCircle size={24} /> Revisão de Sugestões
          </h1>
          <p className="text-[var(--fg-muted)] text-sm mt-1">{pendentes.length} sugestão(ões) aguardando sua revisão</p>
        </div>
        <button onClick={fetchTerms} className="flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors">
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-[var(--fg-muted)]">Carregando sugestões...</div>
      ) : pendentes.length === 0 ? (
        <div className="bg-[var(--surface)] rounded-2xl border-2 border-dashed border-[var(--line)] p-16 text-center">
          <CheckCircle size={48} className="mx-auto text-[var(--state-success-fg)] mb-4" />
          <p className="text-xl font-bold text-[var(--fg-muted)]">Tudo em dia!</p>
          <p className="text-[var(--fg-muted)] text-sm mt-1">Nenhuma sugestão pendente de revisão.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendentes.map(term => (
            <div key={term.id} className="bg-[var(--surface)] rounded-2xl shadow-sm border border-[var(--line)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${statusLabel[term.status ?? '']?.color ?? ''}`}>
                      {statusLabel[term.status ?? '']?.label ?? term.status ?? '—'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--state-info-bg)] text-[var(--state-info-fg)] uppercase tracking-wide">
                      {term.nucleus}
                    </span>
                    {term.system_name && (
                      <span className="text-[10px] text-[var(--fg-muted)]">Sistema: {term.system_name} {term.edition_name && `(${term.edition_name})`}</span>
                    )}
                    {term.scenario_name && (
                      <span className="text-[10px] text-[var(--fg-muted)]">Cenário: {term.scenario_name}</span>
                    )}
                  </div>

                  <div className="mt-2">
                    <span className="font-black text-lg text-[var(--fg)]">{term.name_pt}</span>
                    <span className="text-[var(--fg-muted)] mx-2">·</span>
                    <span className="text-[var(--fg-muted)] font-medium">{term.name_en}</span>
                  </div>

                  {term.category_name && <p className="text-xs text-[var(--fg-muted)] mt-1">Categoria: {term.category_name}</p>}
                  {term.book_reference && (
                    <p className="text-xs text-[var(--fg-muted)] mt-1">
                      📖 {term.book_reference}, p. {term.page_reference}
                    </p>
                  )}

                  <p className="text-xs text-[var(--fg-muted)] mt-2">
                    Sugerido por <span className="font-semibold">{term.added_by_name ?? 'autor desconhecido'}</span> em {formatarData(term.created_at)}
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => moderate(term.id, 'verificado')}
                    title="Aprovar"
                    className="flex items-center gap-1 bg-[var(--state-success-bg)] text-[var(--state-success-fg)] hover:bg-[var(--state-success-bg)] px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    <CheckCircle size={16} /> Aprovar
                  </button>
                  <button
                    onClick={() => moderate(term.id, 'rejeitado')}
                    title="Rejeitar"
                    className="flex items-center gap-1 bg-[var(--state-danger-bg)] text-[var(--state-danger-fg)] hover:bg-[var(--state-danger-bg)] px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    <XCircle size={16} /> Rejeitar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminReviewPage;
