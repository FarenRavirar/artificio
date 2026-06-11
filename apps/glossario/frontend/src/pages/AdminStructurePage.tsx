import React, { useEffect, useState } from 'react';
import { PlusCircle, X, CheckCircle, Edit2, AlertCircle, ChevronUp, ChevronDown, Download } from 'lucide-react';
import api from '../services/api';

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('glossario_token')}` });

interface Category { id: string; name: string; slug: string; type: string; parent_id: string | null; position: number; status: string; }
interface System { id: string; name: string; slug: string; status: string; position: number; }
interface Edition { id: string; name: string; slug: string; system_id: string; status: string; position: number; }
interface Scenario { id: string; name: string; slug: string; status: string; position: number; }

const AdminStructurePage: React.FC = () => {
  const [tab, setTab] = useState<'categories' | 'systems' | 'scenarios' | 'pending'>('categories');
  const [exporting, setExporting] = useState(false);
  
  const handleExportMateCat = async () => {
    try {
      setExporting(true);
      const response = await api.get('/export/matecat', {
        responseType: 'blob',
        headers: headers()
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'glossario_artificio_matecat.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Erro ao exportar:', err);
      alert('Falha ao gerar exportação. Verifique se você tem permissão de administrador.');
    } finally {
      setExporting(false);
    }
  };

  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  const [modal, setModal] = useState<null | 'addCat' | 'addSys' | 'addScenario' | 'addEdition' | 'editCat' | 'editSys' | 'editScenario' | 'editEdition'>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  // Accordion state
  const [expandedSys, setExpandedSys] = useState<string[]>([]);
  const toggleSys = (id: string) => setExpandedSys(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const load = async () => {
    try {
      const [cats, sysList, scList] = await Promise.all([
        api.get('/categories', { headers: headers() }),
        api.get('/systems', { headers: headers() }),
        api.get('/scenarios', { headers: headers() }),
      ]);
      setCategories(cats.data);
      setSystems(sysList.data);
      setScenarios(scList.data);
      
      const allEditions: Edition[] = [];
      for (const sys of sysList.data) {
        const edRes = await api.get(`/systems/${sys.id}/editions`, { headers: headers() });
        allEditions.push(...edRes.data);
      }
      setEditions(allEditions);
    } catch (e) { console.error('Erro ao carregar estrutura:', e); }
  };

  useEffect(() => { load(); }, []);

  const slugify = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-laranja focus:border-transparent outline-none transition-all placeholder-gray-400 text-sm";
  const labelClass = "block text-[10px] font-black text-azul-escuro mb-1 uppercase tracking-widest";

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, slug: form.slug || slugify(form.name) };
      
      if (modal?.startsWith('add')) {
        if (modal === 'addCat') await api.post('/categories', payload, { headers: headers() });
        else if (modal === 'addSys') await api.post('/systems', payload, { headers: headers() });
        else if (modal === 'addEdition') await api.post(`/systems/${form.system_id}/editions`, payload, { headers: headers() });
        else if (modal === 'addScenario') await api.post('/scenarios', payload, { headers: headers() });
      } else {
        if (modal === 'editCat') await api.put(`/categories/${editingId}`, payload, { headers: headers() });
        else if (modal === 'editSys') await api.put(`/systems/${editingId}`, payload, { headers: headers() });
        else if (modal === 'editEdition') await api.put(`/systems/editions/${editingId}`, payload, { headers: headers() });
        else if (modal === 'editScenario') await api.put(`/scenarios/${editingId}`, payload, { headers: headers() });
      }
      
      setModal(null);
      setEditingId(null);
      setForm({});
      await load();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const reorder = async (type: 'categories' | 'systems' | 'scenarios' | 'editions', item: any, direction: 'up' | 'down') => {
    const list = type === 'categories' ? categories.filter(c => c.type === item.type) 
               : type === 'systems' ? systems 
               : type === 'scenarios' ? scenarios 
               : editions.filter(e => e.system_id === item.system_id);
    
    const idx = list.findIndex(i => i.id === item.id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === list.length - 1) return;

    const other = list[direction === 'up' ? idx - 1 : idx + 1];
    
    try {
      const route = type === 'categories' ? `/categories` 
                  : type === 'systems' ? `/systems` 
                  : type === 'scenarios' ? `/scenarios` 
                  : `/systems/editions`;

      const finalRoute = (t: string, id: string) => t === '/systems/editions' ? `/systems/editions/${id}` : `${t}/${id}`;

      await Promise.all([
        api.put(finalRoute(route, item.id), { ...item, position: other.position }, { headers: headers() }),
        api.put(finalRoute(route, other.id), { ...other, position: item.position }, { headers: headers() })
      ]);
      await load();
    } catch (e) { console.error('Erro ao reordenar:', e); }
  };

  const approve = async (type: string, id: string, item: any) => {
    try {
      const route = type === 'editions' ? `/systems/editions/${id}` : `/${type}/${id}`;
      await api.put(route, { ...item, status: 'aprovado' }, { headers: headers() });
      await load();
    } catch (e) { console.error(e); }
  };

  const deleteItem = async (type: string, id: string) => {
    if (!confirm('Confirmar exclusão?')) return;
    try {
      const route = type === 'editions' ? `systems/editions/${id}` : `${type}/${id}`;
      await api.delete(route, { headers: headers() });
      await load();
    } catch (e) { console.error(e); }
  };

  const tabs = [
    { key: 'categories', label: 'Categorias' },
    { key: 'systems', label: 'Sistemas & Edições' },
    { key: 'scenarios', label: 'Cenários' },
    { key: 'pending', label: 'Pendentes' },
  ] as const;

  const pendingCount = [
    ...categories.filter(c => c.status === 'pendente'),
    ...systems.filter(s => s.status === 'pendente'),
    ...editions.filter(e => e.status === 'pendente'),
    ...scenarios.filter(sc => sc.status === 'pendente')
  ].length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-azul-escuro">Gestão de Estrutura</h1>
          <div className="text-[10px] font-bold text-gray-400 uppercase bg-white px-3 py-1 rounded-full border border-gray-100 shadow-sm inline-block mt-1">Painel do Administrador</div>
        </div>
        <button 
          onClick={handleExportMateCat}
          disabled={exporting}
          className="flex items-center gap-2 bg-white text-azul-escuro px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-azul-50 border border-gray-200 transition-all shadow-sm disabled:opacity-50"
        >
          {exporting ? (
            <div className="w-4 h-4 border-2 border-azul-escuro border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Download size={18} />
          )}
          {exporting ? 'Gerando XLSX...' : 'Exportar MateCat'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1.5 mb-8 w-fit shadow-inner">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all relative ${tab === t.key ? 'bg-white shadow-xl text-azul-escuro scale-105' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>
            {t.label}
            {t.key === 'pending' && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-laranja text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black border-2 border-white animate-bounce shadow-lg">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* CATEGORIAS */}
      {tab === 'categories' && (
        <div className="animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm font-medium text-gray-500">Organize as categorias de termos por tipo.</p>
            <button onClick={() => { setModal('addCat'); setForm({ type: 'sistema', position: categories.length }); }}
              className="flex items-center gap-2 bg-azul-escuro text-white px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-black transition-all shadow-lg shadow-blue-900/10">
              <PlusCircle size={18} /> Nova Categoria
            </button>
          </div>
          <div className="space-y-8">
            {['sistema', 'cenario'].map(type => (
              <div key={type} className="bg-white/50 p-6 rounded-3xl border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${type === 'sistema' ? 'bg-azul-medio' : 'bg-laranja'}`}></div>
                  {type === 'sistema' ? 'Categorias de Mecânica (Sistemas)' : 'Categorias de Lore (Cenários)'}
                </p>
                <div className="space-y-2">
                  {categories.filter(c => c.type === type && !c.parent_id).map((cat, idx, arr) => (
                    <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between shadow-sm hover:border-azul-medio/30 transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1 mr-2">
                          <button onClick={() => reorder('categories', cat, 'up')} disabled={idx === 0} className="text-gray-300 hover:text-azul-medio disabled:opacity-0 transition-colors"><ChevronUp size={14} /></button>
                          <button onClick={() => reorder('categories', cat, 'down')} disabled={idx === arr.length - 1} className="text-gray-300 hover:text-azul-medio disabled:opacity-0 transition-colors"><ChevronDown size={14} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800">{cat.name}</span>
                          <span className="text-[10px] font-mono text-gray-300 uppercase">/{cat.slug}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setModal('editCat'); setEditingId(cat.id); setForm(cat); }} className="text-gray-400 hover:text-azul-medio transition-colors p-2 rounded-xl hover:bg-azul-50"><Edit2 size={16} /></button>
                        <button onClick={() => deleteItem('categories', cat.id)} className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-xl hover:bg-red-50"><X size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SISTEMAS */}
      {tab === 'systems' && (
        <div className="animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm font-medium text-gray-500">Gerencie os sistemas e suas edições específicas.</p>
            <div className="flex gap-2">
              <button onClick={() => { setModal('addEdition'); setForm({ position: editions.length }); }}
                className="flex items-center gap-2 bg-gray-100 text-gray-700 px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-gray-200 transition-all border border-gray-200">
                <PlusCircle size={18} /> Nova Edição
              </button>
              <button onClick={() => { setModal('addSys'); setForm({ position: systems.length }); }}
                className="flex items-center gap-2 bg-azul-escuro text-white px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-black transition-all shadow-lg shadow-blue-900/10">
                <PlusCircle size={18} /> Novo Sistema
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systems.filter(s => s.status === 'aprovado').map((sys, idx, arr) => {
              const sysEditions = editions.filter(e => e.system_id === sys.id && e.status === 'aprovado');
              const isExpanded = expandedSys.includes(sys.id);
              return (
              <div key={sys.id} className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:border-azul-medio/30 transition-all group">
                <div className="px-5 py-4 flex items-center justify-between bg-gray-50/50 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => reorder('systems', sys, 'up')} disabled={idx === 0} className="text-gray-300 hover:text-azul-medio disabled:opacity-0 transition-colors tooltip tooltip-right"><ChevronUp size={12} /></button>
                      <button onClick={() => reorder('systems', sys, 'down')} disabled={idx === arr.length - 1} className="text-gray-300 hover:text-azul-medio disabled:opacity-0 transition-colors"><ChevronDown size={12} /></button>
                    </div>
                    <span className="font-black text-azul-escuro">{sys.name}</span>
                    <button onClick={() => toggleSys(sys.id)} className="ml-2 text-[10px] font-bold text-azul-medio bg-azul-50 px-2.5 py-1 rounded-full hover:bg-azul-100 transition-colors flex items-center gap-1 cursor-pointer">
                      {sysEditions.length} edições {isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setModal('editSys'); setEditingId(sys.id); setForm(sys); }} className="text-gray-400 hover:text-azul-medio transition-colors p-1.5 rounded-lg hover:bg-white"><Edit2 size={14} /></button>
                    <button onClick={() => deleteItem('systems', sys.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-white"><X size={14} /></button>
                  </div>
                </div>
                {isExpanded && (
                <div className="p-4 space-y-1 bg-white animate-in slide-in-from-top-2 duration-200">
                  {sysEditions.length === 0 && (
                    <p className="text-xs text-gray-400 font-medium italic px-3 py-2">Sem edições cadastradas.</p>
                  )}
                  {sysEditions.map((ed, eIdx, eArr) => (
                    <div key={ed.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-gray-50 transition-all group/ed">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-0.5 opacity-0 group-hover/ed:opacity-100 transition-opacity">
                          <button onClick={() => reorder('editions', ed, 'up')} disabled={eIdx === 0} className="text-gray-300 hover:text-azul-medio disabled:opacity-0 transition-colors"><ChevronUp size={10} /></button>
                          <button onClick={() => reorder('editions', ed, 'down')} disabled={eIdx === eArr.length - 1} className="text-gray-300 hover:text-azul-medio disabled:opacity-0 transition-colors"><ChevronDown size={10} /></button>
                        </div>
                        <span className="text-sm font-semibold text-gray-600">↳ {ed.name}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover/ed:opacity-100 transition-opacity">
                        <button onClick={() => { setModal('editEdition'); setEditingId(ed.id); setForm(ed); }} className="text-gray-300 hover:text-azul-medio transition-colors p-1"><Edit2 size={12} /></button>
                        <button onClick={() => deleteItem('editions', ed.id)} className="text-gray-300 hover:text-red-400 transition-colors p-1"><X size={12} /></button>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 px-3 mt-2 border-t border-gray-50">
                    <button onClick={() => { setModal('addEdition'); setForm({ position: editions.length, system_id: sys.id }); }}
                      className="text-[11px] font-black text-laranja uppercase tracking-wider flex items-center gap-1.5 hover:text-orange-600 transition-colors">
                      <PlusCircle size={12} /> Adicionar Edição
                    </button>
                  </div>
                </div>
                )}
              </div>
            )})}
          </div>
        </div>
      )}

      {/* CENÁRIOS */}
      {tab === 'scenarios' && (
        <div className="animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm font-medium text-gray-500">Gerencie os mundos e planos de existência.</p>
            <button onClick={() => { setModal('addScenario'); setForm({ position: scenarios.length }); }}
              className="flex items-center gap-2 bg-azul-escuro text-white px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-black transition-all shadow-lg shadow-blue-900/10">
              <PlusCircle size={18} /> Novo Cenário
            </button>
          </div>
          <div className="space-y-2">
            {scenarios.filter(sc => sc.status === 'aprovado').map((sc, idx, arr) => (
              <div key={sc.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between group hover:border-laranja/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => reorder('scenarios', sc, 'up')} disabled={idx === 0} className="text-gray-300 hover:text-azul-medio disabled:opacity-0 transition-colors"><ChevronUp size={14} /></button>
                    <button onClick={() => reorder('scenarios', sc, 'down')} disabled={idx === arr.length - 1} className="text-gray-300 hover:text-azul-medio disabled:opacity-0 transition-colors"><ChevronDown size={14} /></button>
                  </div>
                  <div>
                    <span className="font-bold text-gray-800">{sc.name}</span>
                    <span className="text-[10px] font-mono text-gray-300 uppercase ml-2 tracking-widest">/{sc.slug}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setModal('editScenario'); setEditingId(sc.id); setForm(sc); }} className="text-gray-400 hover:text-azul-medio transition-colors p-2 rounded-xl hover:bg-azul-50"><Edit2 size={16} /></button>
                  <button onClick={() => deleteItem('scenarios', sc.id)} className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-xl hover:bg-red-50"><X size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PENDENTES */}
      {tab === 'pending' && (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
          {pendingCount === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-100 rounded-[32px] p-24 text-center">
              <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-green-400">
                <CheckCircle size={40} />
              </div>
              <p className="font-black text-gray-400 uppercase tracking-widest">Tudo revisado!</p>
              <p className="text-gray-300 text-sm mt-1">Nenhuma sugestão de estrutura pendente.</p>
            </div>
          ) : (
            <>
              {[
                { label: 'Sistemas', items: systems.filter(s => s.status === 'pendente'), type: 'systems', modal: 'editSys' },
                { label: 'Edições', items: editions.filter(e => e.status === 'pendente'), type: 'editions', modal: 'editEdition' },
                { label: 'Cenários', items: scenarios.filter(sc => sc.status === 'pendente'), type: 'scenarios', modal: 'editScenario' },
                { label: 'Categorias', items: categories.filter(c => c.status === 'pendente'), type: 'categories', modal: 'editCat' },
              ].map(group => group.items.length > 0 && (
                <div key={group.type} className="bg-white/50 p-6 rounded-[32px] border border-gray-100">
                  <p className="text-[10px] font-black text-azul-escuro uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                   <AlertCircle size={14} className="text-laranja" /> {group.label} para revisão
                  </p>
                  <div className="space-y-2">
                    {group.items.map(item => (
                      <div key={item.id} className="bg-white rounded-2xl border border-laranja/10 p-5 flex items-center justify-between shadow-sm hover:border-laranja/30 transition-all">
                        <div>
                          <p className="font-black text-azul-escuro">{item.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono uppercase mt-0.5">slug: {item.slug} {group.type === 'editions' && `| sys_id: ${(item as any).system_id}`}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setModal(group.modal as any); setEditingId(item.id); setForm(item); }} className="bg-gray-100 text-gray-500 p-2.5 rounded-xl hover:bg-gray-200 transition-all"><Edit2 size={18} /></button>
                          <button onClick={() => deleteItem(group.type === 'editions' ? 'editions' : group.type, item.id)} className="bg-red-50 text-red-400 p-2.5 rounded-xl hover:bg-red-100 transition-all"><X size={18} /></button>
                          <button onClick={() => approve(group.type, item.id, item)} className="bg-azul-escuro text-white px-6 py-2.5 rounded-xl text-xs font-black hover:bg-black transition-all flex items-center gap-2 shadow-lg shadow-blue-900/10"><CheckCircle size={14} /> APROVAR</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200" onClick={e => { if (e.target === e.currentTarget) { setModal(null); setEditingId(null); setForm({}); } }}>
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
            <div className={`px-8 py-6 ${modal.startsWith('edit') ? 'bg-laranja' : 'bg-azul-escuro'}`}>
              <h3 className="font-black text-white text-xl uppercase tracking-tighter">
                {modal.startsWith('edit') ? '✏️ Editar' : '✨ Novo'} {modal.includes('Cat') ? 'Categoria' : modal.includes('Sys') ? 'Sistema' : modal.includes('Edition') ? 'Edição' : 'Cenário'}
              </h3>
            </div>
            <div className="p-8 space-y-5">
              {(modal === 'addEdition' || modal === 'editEdition') && (
                <div>
                  <label className={labelClass}>Vincular Sistema</label>
                  <select className={inputClass}
                    value={form.system_id || ''} onChange={e => setForm(f => ({ ...f, system_id: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={labelClass}>Nome Visível</label>
                <input className={inputClass}
                  value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: D&D 5e, Reinos Esquecidos..." />
              </div>
              <div>
                <label className={labelClass}>Identificador URL (Slug)</label>
                <input className={inputClass}
                  value={form.slug || ''} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="Gerado automaticamente se vazio..." />
              </div>
              {(modal === 'addCat' || modal === 'editCat') && (
                <div>
                  <label className={labelClass}>Tipo de Categoria</label>
                  <select className={inputClass}
                    value={form.type || 'sistema'} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="sistema">Sistema (Mecânica/Regras)</option>
                    <option value="cenario">Cenário (Mundo/Lore)</option>
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button onClick={() => { setModal(null); setEditingId(null); setForm({}); }} className="flex-1 py-4 border border-gray-100 rounded-2xl text-xs font-black text-gray-400 hover:bg-gray-50 transition-all uppercase tracking-widest">Sair</button>
                <button onClick={save} disabled={saving} className="flex-[2] py-4 bg-azul-escuro text-white rounded-2xl text-xs font-black hover:bg-black transition-all disabled:opacity-50 shadow-xl shadow-blue-900/20 uppercase tracking-widest">
                  {saving ? 'SALVANDO...' : 'CONFIRMAR'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStructurePage;
