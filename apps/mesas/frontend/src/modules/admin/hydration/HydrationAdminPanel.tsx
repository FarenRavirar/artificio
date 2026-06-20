import { useState, useEffect } from 'react';
import { Database, AlertTriangle, ShieldCheck, Download, RefreshCcw } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface HydrationLog {
  table: string;
  candidates: number;
  inserted: number;
  updated: number;
  ignored: number;
}

interface HydrationResult {
  success: boolean;
  dry_run: boolean;
  data: {
    tables: HydrationLog[];
  };
}

export const HydrationAdminPanel = () => {
  const [loading, setLoading] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [lastResult, setLastResult] = useState<HydrationResult | null>(null);
  const [lastRunDate, setLastRunDate] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // T018: histórico do localStorage. setState deferido p/ fora do corpo síncrono.
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      const history = localStorage.getItem('lastHydrationLog');
      if (!history) return;
      try {
        const parsed = JSON.parse(history);
        setLastResult(parsed.result);
        setLastRunDate(parsed.date);
      } catch (e) {
        console.error('Error parsing hydration history', e);
      }
    })();
    return () => { active = false; };
  }, []);

  const handleHydrate = async () => {
    // T014 / T020: Bloqueio de UI durante execução
    if (loading) return;

    if (!dryRun) {
      const confirmText = prompt('Você está prestes a modificar o banco do ambiente de testes usando dados de produção. Digite "CONFIRMO" para prosseguir.');
      if (confirmText !== 'CONFIRMO') {
        toast.error('Operação cancelada.');
        return;
      }
    }

    setLoading(true);
    try {
      // T016: Consumo do endpoint POST
      const response = await fetch(`${API_BASE}/api/v1/admin/sync/hydrate?dry_run=${dryRun}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(dryRun ? 'Simulação de hidratação concluída!' : 'Hidratação concluída com sucesso!');
        setLastResult(data);
        const dateStr = new Date().toLocaleString('pt-BR');
        setLastRunDate(dateStr);

        // T018: Persistir no localStorage
        localStorage.setItem('lastHydrationLog', JSON.stringify({ result: data, date: dateStr }));
      } else {
        toast.error(data.error || 'Erro ao hidratar banco de dados.');
      }
    } catch (error) {
      console.error('[Hydration]', error);
      toast.error('Falha de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#1A233A] rounded-xl border border-white/10 p-6 shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400">
          <Database size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Sincronização Prod → Dev</h2>
          <p className="text-white/60 text-sm">Clone sanitizado do ambiente de produção (PIIs ofuscados e integridade garantida).</p>
        </div>
      </div>

      <div className="flex items-center gap-6 mb-8 p-4 bg-white/5 border border-white/10 rounded-lg">
        {/* T015: Toggle Dry-Run */}
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={dryRun}
              onChange={() => setDryRun(!dryRun)}
              disabled={loading}
            />
            <div className={`block w-14 h-8 rounded-full transition-colors ${dryRun ? 'bg-blue-500' : 'bg-red-500'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${dryRun ? 'transform translate-x-0' : 'transform translate-x-6'}`}></div>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-medium flex items-center gap-2">
              Modo Simulação (Dry-Run) {dryRun ? <ShieldCheck size={16} className="text-green-400" /> : <AlertTriangle size={16} className="text-yellow-400" />}
            </span>
            <span className="text-white/50 text-xs">
              {dryRun ? 'Nenhuma tabela será modificada.' : 'CUIDADO: O banco será modificado!'}
            </span>
          </div>
        </label>

        {/* T014: Botão principal */}
        <button
          onClick={handleHydrate}
          disabled={loading}
          className={`ml-auto flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
            loading
              ? 'bg-white/10 text-white/40 cursor-not-allowed'
              : dryRun
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]'
          }`}
        >
          {loading ? (
            <><RefreshCcw className="animate-spin" size={20} /> Processando...</>
          ) : (
            <><Download size={20} /> Executar Sincronização</>
          )}
        </button>
      </div>

      {/* T017: Área de Log */}
      {lastResult && (
        <div className="mt-8 animate-fade-in">
          <div className="flex justify-between items-end mb-4 border-b border-white/10 pb-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Resultados da Sincronização
              {lastResult.dry_run && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">DRY-RUN</span>}
            </h3>
            <span className="text-white/40 text-sm">Última execução: {lastRunDate}</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/20">
            <table className="w-full text-left text-sm text-white/80">
              <thead className="bg-white/5 text-white/60 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Tabela</th>
                  <th className="px-4 py-3 text-right">Candidatos</th>
                  <th className="px-4 py-3 text-right text-green-400">Inseridos</th>
                  <th className="px-4 py-3 text-right text-blue-400">Atualizados</th>
                  <th className="px-4 py-3 text-right text-white/40">Ignorados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {lastResult.data.tables.map((log) => (
                  <tr key={log.table} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{log.table}</td>
                    <td className="px-4 py-3 text-right">{log.candidates}</td>
                    <td className="px-4 py-3 text-right font-mono text-green-400">{log.inserted}</td>
                    <td className="px-4 py-3 text-right font-mono text-blue-400">{log.updated}</td>
                    <td className="px-4 py-3 text-right font-mono text-white/40">{log.ignored}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
