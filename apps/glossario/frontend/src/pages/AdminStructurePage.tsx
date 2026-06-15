import React, { useEffect, useState } from 'react';
import { PlusCircle, X, CheckCircle, Edit2, AlertCircle, ChevronUp, ChevronDown, Download } from 'lucide-react';
import api from '../services/api';

// Sessão via cookie SSO (api.withCredentials). Sem Bearer manual.
const headers = () => ({});

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

  const inputClass = "w-full px-4 py-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--fg)] focus:ring-2 focus:ring-[var(--artificio-brand)] focus:border-transparent outline-none transition-all placeholder-[var(--fg-muted)] text-sm";
  const labelClass = "block text-[10px] font-black text-[var(--fg)] mb-1 uppercase tracking-widest";

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
          <h1 className="text-2xl font-black text-[var(--fg)]">Gestão de Estrutura</h1>
          <div className="text-[10px] font-bold text-[var(--fg-muted)] uppercase bg-[var(--surface)] px-3 py-1 rounded-full border border-[var(--line)] shadow-sm inline-block mt-1">Painel do Administrador</div>
        </div>
        <button 
          onClick={handleExportMateCat}
          disabled={exporting}
          className="flex items-center gap-2 bg-[var(--surface)] text-[var(--fg)] px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-azul-50 border border-[var(--line)] transition-all shadow-sm disabled:opacity-50"
        >
          {exporting ? (
            <div className="w-4 h-4 border-2 border-[var(--line)] border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Download size={18} />
          )}
          {exporting ? 'Gerando XLSX...' : 'Exportar MateCat'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--surface-subtle)] rounded-2xl p-1.5 mb-8 w-fit shadow-inner">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all relative ${tab === t.key ? 'bg-[var(--surface)] shadow-xl text-[var(--fg)] scale-105' : 'text-[var(--fg-muted)] hover:text-[var(--fg-muted)] hover:bg-[var(--surface-strong)]'}`}>
            {t.label}
            {t.key === 'pending' && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[var(--artificio-brand)] text-[var(--navy-block-fg)] text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black border-2 border-[var(--line)] animate-bounce shadow-lg">
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
            <p className="text-sm font-medium text-[var(--fg-muted)]">Organize as categorias de termos por tipo.</p>
            <button onClick={() => { setModal('addCat'); setForm({ type: 'sistema', position: categories.length }); }}
              className="flex items-center gap-2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-[var(--btn-primary-bg-hover)] transition-all shadow-lg shadow-blue-900/10">
              <PlusCircle size={18} /> Nova Categoria
            </button>
          </div>
          <div className="space-y-8">
            {['sistema', 'cenario'].map(type => (
              <div key={type} className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--line)]">
                <p className="text-[10px] font-black text-[var(--fg-muted)] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${type === 'sistema' ? 'bg-[var(--navy-block-bg)]' : 'bg-[var(--artificio-brand)]'}`}></div>
                  {type === 'sistema' ? 'Categorias de Mecânica (Sistemas)' : 'Categorias de Lore (Cenários)'}
                </p>
                <div className="space-y-2">
                  {categories.filter(c => c.type === type && !c.parent_id).map((cat, idx, arr) => (
                    <div key={cat.id} className="bg-[var(--surface)] rounded-2xl border border-[var(--line)] px-5 py-4 flex items-center justify-between shadow-sm hover:border-[var(--line-strong)] transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1 mr-2">
                          <button onClick={() => reorder('categories', cat, 'up')} disabled={idx === 0} className="text-[var(--fg-muted)] hover:text-[var(--fg-muted)] disabled:opacity-0 transition-colors"><ChevronUp size={14} /></button>
                          <button onClick={() => reorder('categories', cat, 'down')} disabled={idx === arr.length - 1} className="text-[var(--fg-muted)] hover:text-[var(--fg-muted)] disabled:opacity-0 transition-colors"><ChevronDown size={14} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--fg)]">{cat.name}</span>
                          <span className="text-[10px] font-mono text-[var(--fg-muted)] uppercase">/{cat.slug}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setModal('editCat'); setEditingId(cat.id); setForm(cat); }} className="text-[var(--fg-muted)] hover:text-[var(--fg-muted)] transition-colors p-2 rounded-xl hover:bg-azul-50"><Edit2 size={16} /></button>
                        <button onClick={() => deleteItem('categories', cat.id)} className="text-[var(--fg-muted)] hover:text-[var(--state-danger-fg)] transition-colors p-2 rounded-xl hover:bg-[var(--state-danger-bg)]"><X size={16} /></button>
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
            <p className="text-sm font-medium text-[var(--fg-muted)]">Gerencie os sistemas e suas edições específicas.</p>
            <div className="flex gap-2">
              <button onClick={() => { setModal('addEdition'); setForm({ position: editions.length }); }}
                className="flex items-center gap-2 bg-[var(--surface-subtle)] text-[var(--fg)] px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-[var(--surface-strong)] transition-all border border-[var(--line)]">
                <PlusCircle size={18} /> Nova Edição
              </button>
              <button onClick={() => { setModal('addSys'); setForm({ position: systems.length }); }}
                className="flex items-center gap-2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-[var(--btn-primary-bg-hover)] transition-all shadow-lg shadow-blue-900/10">
                <PlusCircle size={18} /> Novo Sistema
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systems.filter(s => s.status === 'aprovado').map((sys, idx, arr) => {
              const sysEditions = editions.filter(e => e.system_id === sys.id && e.status === 'aprovado');
              const isExpanded = expandedSys.includes(sys.id);
              return (
              <div key={sys.id} className="bg-[var(--surface)] rounded-3xl border border-[var(--line)] overflow-hidden shadow-sm hover:border-[var(--line-strong)] transition-all group">
                <div className="px-5 py-4 flex items-center justify-between bg-[var(--surface-subtle)] border-b border-[var(--line)]">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => reorder('systems', sys, 'up')} disabled={idx === 0} className="text-[var(--fg-muted)] hover:text-[var(--fg-muted)] disabled:opacity-0 transition-colors tooltip tooltip-right"><ChevronUp size={12} /></button>
                      <button onClick={() => reorder('systems', sys, 'down')} disabled={idx === arr.length - 1} className="text-[var(--fg-muted)] hover:text-[var(--fg-muted)] disabled:opacity-0 transition-colors"><ChevronDown size={12} /></button>
                    </div>
                    <span className="font-black text-[var(--fg)]">{sys.name}</span>
                    <button onClick={() => toggleSys(sys.id)} className="ml-2 text-[10px] font-bold text-[var(--fg-muted)] bg-azul-50 px-2.5 py-1 rounded-full hover:bg-azul-100 transition-colors flex items-center gap-1 cursor-pointer">
                      {sysEditions.length} edições {isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setModal('editSys'); setEditingId(sys.id); setForm(sys); }} className="text-[var(--fg-muted)] hover:text-[var(--fg-muted)] transition-colors p-1.5 rounded-lg hover:bg-[var(--surface)]"><Edit2 size={14} /></button>
                    <button onClick={() => deleteItem('systems', sys.id)} className="text-[var(--fg-muted)] hover:text-[var(--state-danger-fg)] transition-colors p-1.5 rounded-lg hover:bg-[var(--surface)]"><X size={14} /></button>
                  </div>
                </div>
                {isExpanded && (
                <div className="p-4 space-y-1 bg-[var(--surface)] animate-in slide-in-from-top-2 duration-200">
                  {sysEditions.length === 0 && (
                    <p className="text-xs text-[var(--fg-muted)] font-medium italic px-3 py-2">Sem edições cadastradas.</p>
                  )}
                  {sysEditions.map((ed, eIdx, eArr) => (
                    <div key={ed.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-[var(--surface-subtle)] transition-all group/ed">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-0.5 opacity-0 group-hover/ed:opacity-100 transition-opacity">
                          <button onClick={() => reorder('editions', ed, 'up')} disabled={eIdx === 0} className="text-[var(--fg-muted)] hover:text-[var(--fg-muted)] disabled:opacity-0 transition-colors"><ChevronUp size={10} /></button>
                          <button onClick={() => reorder('editions', ed, 'down')} disabled={eIdx === eArr.length - 1} className="text-[var(--fg-muted)] hover:text-[var(--fg-muted)] disabled:opacity-0 transition-colors"><ChevronDown size={10} /></button>
                        </div>
                        <span className="text-sm font-semibold text-[var(--fg-muted)]">↳ {ed.name}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover/ed:opacity-100 transition-opacity">
                        <button onClick={() => { setModal('editEdition'); setEditingId(ed.id); setForm(ed); }} className="text-[var(--fg-muted)] hover:text-[var(--fg-muted)] transition-colors p-1"><Edit2 size={12} /></button>
                        <button onClick={() => deleteItem('editions', ed.id)} className="text-[var(--fg-muted)] hover:text-[var(--state-danger-fg)] transition-colors p-1"><X size={12} /></button>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 px-3 mt-2 border-t border-[var(--line)]">
                    <button onClick={() => { setModal('addEdition'); setForm({ position: editions.length, system_id: sys.id }); }}
                      className="text-[11px] font-black text-[var(--artificio-brand)] uppercase tracking-wider flex items-center gap-1.5 hover:text-[var(--state-warning-fg)] transition-colors">
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
            <p className="text-sm font-medium text-[var(--fg-muted)]">Gerencie os mundos e planos de existência.</p>
            <button onClick={() => { setModal('addScenario'); setForm({ position: scenarios.length }); }}
              className="flex items-center gap-2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-[var(--btn-primary-bg-hover)] transition-all shadow-lg shadow-blue-900/10">
              <PlusCircle size={18} /> Novo Cenário
            </button>
          </div>
          <div className="space-y-2">
            {scenarios.filter(sc => sc.status === 'aprovado').map((sc, idx, arr) => (
              <div key={sc.id} className="bg-[var(--surface)] rounded-2xl border border-[var(--line)] px-5 py-4 flex items-center justify-between group hover:border-[rgba(255,87,34,0.30)] transition-all">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => reorder('scenarios', sc, 'up')} disabled={idx === 0} className="text-[var(--fg-muted)] hover:text-[var(--fg-muted)] disabled:opacity-0 transition-colors"><ChevronUp size={14} /></button>
                    <button onClick={() => reorder('scenarios', sc, 'down')} disabled={idx === arr.length - 1} className="text-[var(--fg-muted)] hover:text-[var(--fg-muted)] disabled:opacity-0 transition-colors"><ChevronDown size={14} /></button>
                  </div>
                  <div>
                    <span className="font-bold text-[var(--fg)]">{sc.name}</span>
                    <span className="text-[10px] font-mono text-[var(--fg-muted)] uppercase ml-2 tracking-widest">/{sc.slug}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setModal('editScenario'); setEditingId(sc.id); setForm(sc); }} className="text-[var(--fg-muted)] hover:text-[var(--fg-muted)] transition-colors p-2 rounded-xl hover:bg-azul-50"><Edit2 size={16} /></button>
                  <button onClick={() => deleteItem('scenarios', sc.id)} className="text-[var(--fg-muted)] hover:text-[var(--state-danger-fg)] transition-colors p-2 rounded-xl hover:bg-[var(--state-danger-bg)]"><X size={16} /></button>
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
            <div className="bg-[var(--surface)] border-2 border-dashed border-[var(--line)] rounded-[32px] p-24 text-center">
              <div className="bg-[var(--state-success-bg)] w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-[var(--state-success-fg)]">
                <CheckCircle size={40} />
              </div>
              <p className="font-black text-[var(--fg-muted)] uppercase tracking-widest">Tudo revisado!</p>
              <p className="text-[var(--fg-muted)] text-sm mt-1">Nenhuma sugestão de estrutura pendente.</p>
            </div>
          ) : (
            <>
              {[
                { label: 'Sistemas', items: systems.filter(s => s.status === 'pendente'), type: 'systems', modal: 'editSys' },
                { label: 'Edições', items: editions.filter(e => e.status === 'pendente'), type: 'editions', modal: 'editEdition' },
                { label: 'Cenários', items: scenarios.filter(sc => sc.status === 'pendente'), type: 'scenarios', modal: 'editScenario' },
                { label: 'Categorias', items: categories.filter(c => c.status === 'pendente'), type: 'categories', modal: 'editCat' },
              ].map(group => group.items.length > 0 && (
                <div key={group.type} className="bg-[var(--surface)] p-6 rounded-[32px] border border-[var(--line)]">
                  <p className="text-[10px] font-black text-[var(--fg)] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                   <AlertCircle size={14} className="text-[var(--artificio-brand)]" /> {group.label} para revisão
                  </p>
                  <div className="space-y-2">
                    {group.items.map(item => (
                      <div key={item.id} className="bg-[var(--surface)] rounded-2xl border border-[rgba(255,87,34,0.10)] p-5 flex items-center justify-between shadow-sm hover:border-[rgba(255,87,34,0.30)] transition-all">
                        <div>
                          <p className="font-black text-[var(--fg)]">{item.name}</p>
                          <p className="text-[10px] text-[var(--fg-muted)] font-mono uppercase mt-0.5">slug: {item.slug} {group.type === 'editions' && `| sys_id: ${(item as any).system_id}`}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setModal(group.modal as any); setEditingId(item.id); setForm(item); }} className="bg-[var(--surface-subtle)] text-[var(--fg-muted)] p-2.5 rounded-xl hover:bg-[var(--surface-strong)] transition-all"><Edit2 size={18} /></button>
                          <button onClick={() => deleteItem(group.type === 'editions' ? 'editions' : group.type, item.id)} className="bg-[var(--state-danger-bg)] text-[var(--state-danger-fg)] p-2.5 rounded-xl hover:bg-[var(--state-danger-bg)] transition-all"><X size={18} /></button>
                          <button onClick={() => approve(group.type, item.id, item)} className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] px-6 py-2.5 rounded-xl text-xs font-black hover:bg-[var(--btn-primary-bg-hover)] transition-all flex items-center gap-2 shadow-lg shadow-blue-900/10"><CheckCircle size={14} /> APROVAR</button>
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
          <div className="bg-[var(--surface)] rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-[var(--line-strong)]">
            <div className={`px-8 py-6 ${modal.startsWith('edit') ? 'bg-[var(--artificio-brand)]' : 'bg-[var(--navy-block-bg)]'}`}>
              <h3 className="font-black text-[var(--navy-block-fg)] text-xl uppercase tracking-tighter">
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
                <button onClick={() => { setModal(null); setEditingId(null); setForm({}); }} className="flex-1 py-4 border border-[var(--line)] rounded-2xl text-xs font-black text-[var(--fg-muted)] hover:bg-[var(--surface-subtle)] transition-all uppercase tracking-widest">Sair</button>
                <button onClick={save} disabled={saving} className="flex-[2] py-4 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] rounded-2xl text-xs font-black hover:bg-[var(--btn-primary-bg-hover)] transition-all disabled:opacity-50 shadow-xl shadow-blue-900/20 uppercase tracking-widest">
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
