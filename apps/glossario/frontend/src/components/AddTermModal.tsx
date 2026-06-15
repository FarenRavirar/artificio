import React, { useEffect, useState } from 'react';
import { X, PlusCircle, Loader2, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface System { id: string; name: string; }
interface Edition { id: string; name: string; system_id: string; }
interface Scenario { id: string; name: string; }
interface Category { id: string; name: string; type: string; parent_id: string | null; }

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const inputClass = "w-full px-4 py-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--fg)] focus:ring-2 focus:ring-[var(--artificio-brand)] focus:border-transparent outline-none transition-all placeholder-[var(--fg-muted)] text-sm";
const labelClass = "block text-[10px] font-black text-[var(--fg)] mb-1 uppercase tracking-widest";
const selectClass = "w-full px-4 py-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--fg)] focus:ring-2 focus:ring-[var(--artificio-brand)] focus:border-transparent outline-none transition-all text-sm";

const AddTermModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [systems, setSystems] = useState<System[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [nucleus, setNucleus] = useState<'sugestao' | 'oficial'>('sugestao');
  const [sourceType, setSourceType] = useState<'sistema' | 'cenario'>('sistema');
  
  // IDs
  const [systemId, setSystemId] = useState('');
  const [editionId, setEditionId] = useState('');
  const [scenarioId, setScenarioId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  
  // Novos campos para sugestão dinâmica
  const [newSystemName, setNewSystemName] = useState('');
  const [newEditionName, setNewEditionName] = useState('');
  const [newScenarioName, setNewScenarioName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryParentId, setNewCategoryParentId] = useState('');

  const [nameEn, setNameEn] = useState('');
  const [namePt, setNamePt] = useState('');
  const [bookRef, setBookRef] = useState('');
  const [pageRef, setPageRef] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [stayOpen, setStayOpen] = useState(isAdmin); // Admins começam com stayOpen = true por padrão

  useEffect(() => {
    console.log('AddTermModal: Carregando dados iniciais...');
    Promise.all([
      api.get('/systems'),
      api.get('/scenarios'),
      api.get('/categories'),
    ]).then(([sys, sc, cats]) => {
      console.log('AddTermModal: Dados carregados com sucesso', { sys: sys.data.length, sc: sc.data.length, cats: cats.data.length });
      setSystems(sys.data);
      setScenarios(sc.data);
      setCategories(cats.data);
    }).catch(err => {
      console.error('AddTermModal: Erro ao carregar dados:', err);
      setError('Falha ao conectar ao servidor. Verifique sua conexão.');
    });
  }, []);

  useEffect(() => {
    if (!systemId || systemId === 'new') { setEditions([]); setEditionId(''); return; }
    api.get(`/systems/${systemId}/editions`).then(res => {
      setEditions(res.data);
      setEditionId('');
    });
  }, [systemId]);

  const filteredCategories = categories.filter(c => c.type === sourceType);
  const parentCategories = filteredCategories.filter(c => !c.parent_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validação estrita para Membro, flexível para Admin
    if (!isAdmin && nucleus === 'oficial' && (!bookRef || !pageRef)) {
      setError('Termos oficiais exigem referência de Livro e Página.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      let finalSystemId = systemId;
      let finalEditionId = editionId;
      let finalScenarioId = scenarioId;
      let finalCategoryId = categoryId;

      // Sessão via cookie SSO (api.withCredentials). Sem Bearer manual.
      const authHeaders = {};

      // Sequencial: Se o sistema é novo, cria primeiro
      if (sourceType === 'sistema' && systemId === 'new') {
        const sysRes = await api.post('/systems', { name: newSystemName }, { headers: authHeaders });
        const newItem = sysRes.data;
        setSystems(prev => [...prev, newItem].sort((a,b) => a.name.localeCompare(b.name)));
        finalSystemId = newItem.id;
        setNewSystemName('');
        
        // Se também pediu edição nova, cria vinculando ao sistema recém-criado
        if (editionId === 'new') {
          const edRes = await api.post(`/systems/${finalSystemId}/editions`, { name: newEditionName }, { headers: authHeaders });
          const newEd = edRes.data;
          setEditions([newEd]); // Como o sistema é novo, a lista de edições era vazia
          finalEditionId = newEd.id;
          setNewEditionName('');
        }
      } else if (sourceType === 'sistema' && editionId === 'new') {
        const edRes = await api.post(`/systems/${systemId}/editions`, { name: newEditionName }, { headers: authHeaders });
        const newEd = edRes.data;
        setEditions(prev => [...prev, newEd].sort((a,b) => a.name.localeCompare(b.name)));
        finalEditionId = newEd.id;
        setNewEditionName('');
      }

      // Cenário novo
      if (sourceType === 'cenario' && scenarioId === 'new') {
        const scRes = await api.post('/scenarios', { name: newScenarioName }, { headers: authHeaders });
        const newItem = scRes.data;
        setScenarios(prev => [...prev, newItem].sort((a,b) => a.name.localeCompare(b.name)));
        finalScenarioId = newItem.id;
        setNewScenarioName('');
      }

      // Categoria nova
      if (categoryId === 'new') {
        try {
          const catRes = await api.post('/categories', { 
            name: newCategoryName, 
            type: sourceType,
            parent_id: newCategoryParentId || null 
          }, { headers: authHeaders });
          const newItem = catRes.data;
          setCategories(prev => [...prev, newItem].sort((a,b) => a.name.localeCompare(b.name)));
          finalCategoryId = newItem.id;
          setNewCategoryName('');
          setNewCategoryParentId('');
        } catch (err) {
          throw new Error('Erro ao criar categoria.');
        }
      }

      // SÓ CRIA O TERMO SE TIVER PELO MENOS UM NOME PREENCHIDO
      let wasTermCreated = false;
      if (nameEn || namePt) {
        try {
          await api.post('/terms', {
            name_en: nameEn,
            name_pt: namePt,
            nucleus,
            source_type: sourceType,
            system_id: sourceType === 'sistema' ? finalSystemId || null : null,
            edition_id: sourceType === 'sistema' ? finalEditionId || null : null,
            scenario_id: sourceType === 'cenario' ? finalScenarioId || null : null,
            category_id: finalCategoryId || null,
            book_reference: bookRef || null,
            page_reference: pageRef || null,
            additional_info: additionalInfo || null,
          });
          wasTermCreated = true;
        } catch (err: any) {
          throw new Error(err.response?.data?.message || 'Erro ao criar o termo.');
        }
      }

      // Feedback e resets
      const structuralChange = systemId === 'new' || editionId === 'new' || scenarioId === 'new' || categoryId === 'new';
      
      // Se apenas criou estrutura e não o termo, força manter aberto para o usuário continuar
      const shouldStayOpen = stayOpen || (structuralChange && !wasTermCreated);

      if (shouldStayOpen) {
        setSuccessMsg(structuralChange && !wasTermCreated ? 'Estrutura criada com sucesso! Agora adicione o termo.' : 'Salvo com sucesso!');
        setNameEn('');
        setNamePt('');
        setBookRef('');
        setPageRef('');
        setAdditionalInfo('');
        // Atualiza os IDs para apontar para o que acabamos de selecionar/criar
        setSystemId(finalSystemId);
        setEditionId(finalEditionId);
        setScenarioId(finalScenarioId);
        setCategoryId(finalCategoryId);
        onSuccess(); // Atualiza a lista ao fundo
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header Standardized */}
        <div className="bg-[var(--navy-block-bg)] p-6 text-center border-b-4 border-[var(--artificio-brand)] font-black italic uppercase tracking-tighter relative">
          <h2 className="text-[var(--navy-block-fg)] text-xl flex items-center justify-center gap-2">
            <PlusCircle size={22} /> Adicionar Sugestão
          </h2>
          <p className="text-[var(--state-info-fg)] text-xs mt-1 normal-case font-medium not-italic tracking-normal">Contribua com a base do Glossário Artifício</p>
          <button onClick={onClose} className="absolute right-6 top-1/2 -translate-y-1/2 text-[var(--state-info-fg)] hover:text-[var(--navy-block-fg)] transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && <div className="bg-[var(--state-danger-bg)] border border-[var(--state-danger-line)] text-[var(--state-danger-fg)] px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
          {successMsg && <div className="bg-[var(--state-success-bg)] border border-[var(--state-success-line)] text-[var(--state-success-fg)] px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 animation-fade-in"><PlusCircle size={16} /> {successMsg}</div>}

          {/* Núcleo */}
          <div>
            <label className={labelClass}>Núcleo do Termo</label>
            <div className="grid grid-cols-2 gap-2">
              {(['sugestao', 'oficial'] as const).map(n => (
                <button key={n} type="button" onClick={() => setNucleus(n)}
                  className={`py-3 rounded-xl border-2 text-sm font-black transition-all ${nucleus === n ? 'border-[var(--line)] bg-[var(--navy-block-bg)] text-[var(--navy-block-fg)] shadow-lg' : 'border-[var(--line)] text-[var(--fg-muted)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-subtle)] hover:border-[var(--line)]'}`}>
                  {n === 'sugestao' ? '💡 SUGESTÃO' : '📖 OFICIAL'}
                </button>
              ))}
            </div>
            {nucleus === 'oficial' && (
              <p className="text-[10px] font-bold text-[var(--state-info-fg)] bg-[var(--state-info-bg)] border border-[var(--state-info-line)] px-3 py-2 rounded-lg mt-2 uppercase tracking-wide">
                Termos oficiais exigem referência bibliográfica obrigatória.
              </p>
            )}
          </div>

          {/* Tipo de Fonte */}
          <div>
            <label className={labelClass}>Contexto Principal</label>
            <div className="grid grid-cols-2 gap-2">
              {(['sistema', 'cenario'] as const).map(t => (
                <button key={t} type="button" onClick={() => { setSourceType(t); setCategoryId(''); }}
                  className={`py-3 rounded-xl border-2 text-sm font-black transition-all ${sourceType === t ? 'border-[var(--artificio-brand)] bg-[var(--artificio-brand)] text-[var(--navy-block-fg)] shadow-lg' : 'border-[var(--line)] text-[var(--fg-muted)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-subtle)] hover:border-[var(--line)]'}`}>
                  {t === 'sistema' ? '⚔️ SISTEMA' : '🌍 CENÁRIO'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {/* Sistema ou Cenário */}
            {sourceType === 'sistema' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={labelClass}>Sistema (Regras)</label>
                  <select className={selectClass} value={systemId} onChange={e => setSystemId(e.target.value)} required={!isAdmin}>
                    <option value="">Selecione...</option>
                    <option value="new" className="font-bold text-[var(--artificio-brand)]">✨ SUGERIR NOVO...</option>
                    {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {systemId === 'new' && (
                    <input className={inputClass} value={newSystemName} onChange={e => setNewSystemName(e.target.value)} placeholder="Nome do Novo Sistema..." required={!isAdmin} />
                  )}
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Edição</label>
                  <select className={selectClass} value={editionId} onChange={e => setEditionId(e.target.value)} disabled={!systemId && !isAdmin}>
                    <option value="">Selecione...</option>
                    {(systemId || isAdmin) && <option value="new" className="font-bold text-[var(--artificio-brand)]">✨ SUGERIR NOVA...</option>}
                    {editions.map(ed => <option key={ed.id} value={ed.id}>{ed.name}</option>)}
                  </select>
                  {editionId === 'new' && (
                    <input className={inputClass} value={newEditionName} onChange={e => setNewEditionName(e.target.value)} placeholder="Nome da Nova Edição..." required={!isAdmin} />
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className={labelClass}>Cenário (Lore/Mundo)</label>
                <select className={selectClass} value={scenarioId} onChange={e => setScenarioId(e.target.value)} required={!isAdmin}>
                  <option value="">Selecione...</option>
                  <option value="new" className="font-bold text-[var(--artificio-brand)]">✨ SUGERIR NOVO...</option>
                  {scenarios.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                </select>
                {scenarioId === 'new' && (
                  <input className={inputClass} value={newScenarioName} onChange={e => setNewScenarioName(e.target.value)} placeholder="Nome do Novo Cenário..." required={!isAdmin} />
                )}
              </div>
            )}
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <label className={labelClass}>Categoria / Subcategoria</label>
            <select className={selectClass} value={categoryId} onChange={e => setCategoryId(e.target.value)} required={!isAdmin}>
              <option value="">Selecione uma categoria...</option>
              <option value="new" className="font-bold text-[var(--artificio-brand)]">✨ SUGERIR NOVA CATEGORIA...</option>
              {filteredCategories.filter(c => !c.parent_id).map(c => (
                <optgroup key={c.id} label={c.name}>
                  <option value={c.id}>{c.name}</option>
                  {filteredCategories.filter(sub => sub.parent_id === c.id).map(sub => (
                    <option key={sub.id} value={sub.id}>   ↳ {sub.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {categoryId === 'new' && (
              <div className="p-4 bg-[rgba(255,87,34,0.05)] rounded-2xl border border-[rgba(255,87,34,0.10)] space-y-3">
                <input className={inputClass} value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nome da Nova Categoria..." required={!isAdmin} />
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-[var(--artificio-brand)] uppercase tracking-tighter">Vincular a uma categoria pai? (Opcional)</label>
                  <select className={selectClass} value={newCategoryParentId} onChange={e => setNewCategoryParentId(e.target.value)}>
                    <option value="">Nenhuma (Raiz)</option>
                    {parentCategories.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Nomes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Termo Original (EN)</label>
              <input required={!isAdmin} type="text" value={nameEn} onChange={e => setNameEn(e.target.value)}
                className={inputClass} placeholder="Ex: Fireball" />
            </div>
            <div>
              <label className={labelClass}>Tradução Sugerida (PT)</label>
              <input required={!isAdmin} type="text" value={namePt} onChange={e => setNamePt(e.target.value)}
                className={inputClass} placeholder="Ex: Bola de Fogo" />
            </div>
          </div>

          {/* Referência (Oficial) */}
          {nucleus === 'oficial' && (
            <div className="grid grid-cols-3 gap-3 p-4 bg-[var(--state-info-bg)] rounded-2xl border border-[var(--state-info-line)]">
              <div className="col-span-2">
                <label className={labelClass}>Livro</label>
                <input type="text" value={bookRef} onChange={e => setBookRef(e.target.value)}
                  className={inputClass} placeholder="Ex: Player's Handbook" required={!isAdmin} />
              </div>
              <div>
                <label className={labelClass}>Página</label>
                <input type="text" value={pageRef} onChange={e => setPageRef(e.target.value)}
                  className={inputClass} placeholder="Ex: 241" required={!isAdmin} />
              </div>
            </div>
          )}

          {/* Info Adicional */}
          <div>
            <label className={labelClass}>Notas e Contexto</label>
            <textarea rows={2} value={additionalInfo} onChange={e => setAdditionalInfo(e.target.value)}
              className={`${inputClass} resize-none`} placeholder="Onde o termo aparece? Alguma observação especial?" />
          </div>

          <div className="flex flex-col gap-4 pt-2">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setStayOpen(!stayOpen)}>
              <div className={`w-10 h-6 rounded-full transition-all flex items-center p-1 ${stayOpen ? 'bg-[var(--artificio-brand)]' : 'bg-[var(--surface-strong)]'}`}>
                <div className={`w-4 h-4 bg-[var(--surface)] rounded-full shadow-sm transition-transform ${stayOpen ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-[11px] font-black text-[var(--fg)] uppercase tracking-widest group-hover:text-[var(--artificio-brand)] transition-colors">
                Manter este modal aberto após enviar sugestão
              </span>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-4 border border-[var(--line)] rounded-2xl text-sm font-black text-[var(--fg-muted)] hover:bg-[var(--surface-subtle)] transition-all uppercase tracking-widest">Cancelar</button>
              <button type="submit" disabled={loading}
                className="flex-[2] bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-bg-hover)] text-[var(--btn-primary-fg)] font-black py-4 rounded-2xl shadow-xl shadow-blue-900/10 transition-all flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50">
                {loading ? <Loader2 size={20} className="animate-spin" /> : <PlusCircle size={20} />}
                {loading ? 'Processando...' : 'Enviar Sugestão'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTermModal;
