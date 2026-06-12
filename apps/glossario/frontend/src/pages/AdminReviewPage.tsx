import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import api from '../services/api';

interface Term {
  id: string;
  name_en: string;
  name_pt: string;
  nucleus: string;
  status: string;
  source_type: string;
  system_name: string | null;
  edition_name: string | null;
  scenario_name: string | null;
  category_name: string | null;
  added_by_name: string;
  created_at: string;
  book_reference: string | null;
  page_reference: string | null;
}

const statusLabel: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-50 text-yellow-700' },
  verificado: { label: 'Verificado', color: 'bg-green-50 text-green-700' },
  rejeitado: { label: 'Rejeitado', color: 'bg-red-50 text-red-600' },
};

const AdminReviewPage: React.FC = () => {
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTerms = async () => {
    setLoading(true);
    try {
      const res = await api.get('/terms?status=pendente');
      setTerms(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTerms(); }, []);

  const moderate = async (id: string, status: 'verificado' | 'rejeitado') => {
    await api.patch(`/terms/${id}/approve`, { status });
    setTerms(prev => prev.filter(t => t.id !== id));
  };

  const pendentes = terms.filter(t => t.status === 'pendente');

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-azul-escuro flex items-center gap-2">
            <CheckCircle size={24} /> Revisão de Sugestões
          </h1>
          <p className="text-gray-500 text-sm mt-1">{pendentes.length} sugestão(ões) aguardando sua revisão</p>
        </div>
        <button onClick={fetchTerms} className="flex items-center gap-2 text-sm text-gray-500 hover:text-azul-escuro transition-colors">
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-400">Carregando sugestões...</div>
      ) : pendentes.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
          <CheckCircle size={48} className="mx-auto text-green-300 mb-4" />
          <p className="text-xl font-bold text-gray-400">Tudo em dia!</p>
          <p className="text-gray-400 text-sm mt-1">Nenhuma sugestão pendente de revisão.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendentes.map(term => (
            <div key={term.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${statusLabel[term.status]?.color}`}>
                      {statusLabel[term.status]?.label}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 uppercase tracking-wide">
                      {term.nucleus}
                    </span>
                    {term.system_name && (
                      <span className="text-[10px] text-gray-500">Sistema: {term.system_name} {term.edition_name && `(${term.edition_name})`}</span>
                    )}
                    {term.scenario_name && (
                      <span className="text-[10px] text-gray-500">Cenário: {term.scenario_name}</span>
                    )}
                  </div>

                  <div className="mt-2">
                    <span className="font-black text-lg text-azul-escuro">{term.name_pt}</span>
                    <span className="text-gray-400 mx-2">·</span>
                    <span className="text-gray-600 font-medium">{term.name_en}</span>
                  </div>

                  {term.category_name && <p className="text-xs text-gray-400 mt-1">Categoria: {term.category_name}</p>}
                  {term.book_reference && (
                    <p className="text-xs text-gray-500 mt-1">
                      📖 {term.book_reference}, p. {term.page_reference}
                    </p>
                  )}

                  <p className="text-xs text-gray-400 mt-2">
                    Sugerido por <span className="font-semibold">{term.added_by_name}</span> em {new Date(term.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => moderate(term.id, 'verificado')}
                    title="Aprovar"
                    className="flex items-center gap-1 bg-green-50 text-green-600 hover:bg-green-100 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    <CheckCircle size={16} /> Aprovar
                  </button>
                  <button
                    onClick={() => moderate(term.id, 'rejeitado')}
                    title="Rejeitar"
                    className="flex items-center gap-1 bg-red-50 text-red-500 hover:bg-red-100 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
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
