import { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { authDelete, authGet, authPost, authPut } from '../../../services/apiClient';
import { AdminTable, StatusPill } from './ui';

interface SettingStyleSuggestion {
  id: string;
  setting_name: string;
  suggested_styles: string[];
  created_at: string;
  updated_at: string;
}

interface SettingForm {
  id: string | null;
  setting_name: string;
  stylesText: string;
}

const EMPTY_FORM: SettingForm = {
  id: null,
  setting_name: '',
  stylesText: '',
};

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeStyles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeSuggestions(value: unknown): SettingStyleSuggestion[] {
  if (!Array.isArray(value)) return [];
  const rows: SettingStyleSuggestion[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = readString(row.id);
    const settingName = readString(row.setting_name);
    if (!id || !settingName) continue;
    rows.push({
      id,
      setting_name: settingName,
      suggested_styles: normalizeStyles(row.suggested_styles),
      created_at: readString(row.created_at),
      updated_at: readString(row.updated_at),
    });
  }
  return rows;
}

function stylesFromText(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).error === 'string') {
      return String((payload as Record<string, unknown>).error);
    }
  } catch {
    // Mantem fallback.
  }
  return fallback;
}

export function SettingSuggestionsPanel() {
  const [rows, setRows] = useState<SettingStyleSuggestion[]>([]);
  const [form, setForm] = useState<SettingForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authGet('/api/v1/admin/setting-suggestions');
      if (!response.ok) throw new Error('Erro ao carregar estilos por cenário.');
      const payload: unknown = await response.json();
      const data = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).suggestions : [];
      setRows(normalizeSuggestions(data));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar estilos por cenário.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const save = async () => {
    const suggested_styles = stylesFromText(form.stylesText);
    if (!form.setting_name.trim() || suggested_styles.length === 0) {
      toast.error('Informe cenário e ao menos um estilo.');
      return;
    }
    setSaving(true);
    try {
      const body = { setting_name: form.setting_name.trim(), suggested_styles };
      const response = form.id
        ? await authPut(`/api/v1/admin/setting-suggestions/${form.id}`, body)
        : await authPost('/api/v1/admin/setting-suggestions', body);
      if (!response.ok) throw new Error(await readError(response, 'Erro ao salvar estilos.'));
      setForm(EMPTY_FORM);
      await load();
      toast.success('Estilos salvos.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar estilos.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: SettingStyleSuggestion) => {
    if (!globalThis.confirm(`Apagar estilos de "${row.setting_name}"?`)) return;
    const response = await authDelete(`/api/v1/admin/setting-suggestions/${row.id}`);
    if (!response.ok) {
      toast.error(await readError(response, 'Erro ao apagar estilos.'));
      return;
    }
    await load();
    toast.success('Estilos apagados.');
  };

  const columns = useMemo(() => [
    {
      key: 'setting_name',
      header: 'Cenário',
      render: (row: SettingStyleSuggestion) => <span className="font-medium text-[var(--fg)]">{row.setting_name}</span>,
    },
    {
      key: 'styles',
      header: 'Estilos sugeridos',
      render: (row: SettingStyleSuggestion) => (
        <div className="flex flex-wrap gap-1.5">
          {row.suggested_styles.map((style) => <StatusPill key={style} tone="info">{style}</StatusPill>)}
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--admin-surface)] p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
          <label className="space-y-1 text-sm text-[var(--fg-muted)]">
            <span>Cenário</span>
            <input
              value={form.setting_name}
              onChange={(event) => setForm({ ...form, setting_name: event.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-input)] px-3 py-2 text-[var(--fg)]"
              placeholder="Forgotten Realms"
            />
          </label>
          <label className="space-y-1 text-sm text-[var(--fg-muted)]">
            <span>Estilos</span>
            <input
              value={form.stylesText}
              onChange={(event) => setForm({ ...form, stylesText: event.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-input)] px-3 py-2 text-[var(--fg)]"
              placeholder="Alta fantasia, exploração, intriga"
            />
          </label>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-artificio-orange)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Save size={15} /> {form.id ? 'Salvar' : 'Criar'}
          </button>
        </div>
        {form.id && (
          <button type="button" onClick={() => setForm(EMPTY_FORM)} className="mt-3 text-sm text-[var(--fg-faint)] hover:text-[var(--fg)]">
            Limpar edição
          </button>
        )}
      </div>

      <AdminTable
        tableId="setting-styles"
        rows={rows}
        getRowId={(row) => row.id}
        columns={columns}
        searchKeys={[(row) => `${row.setting_name} ${row.suggested_styles.join(' ')}`]}
        searchPlaceholder="Buscar cenário ou estilo..."
        loading={loading}
        error={error}
        emptyTitle="Nenhum estilo cadastrado"
        emptyHint="Cadastre estilos por cenário para auxiliar o preenchimento das mesas."
        onEdit={(row) => setForm({ id: row.id, setting_name: row.setting_name, stylesText: row.suggested_styles.join(', ') })}
        rowActions={[
          { key: 'delete', label: 'Apagar', icon: <Trash2 size={15} />, tone: 'danger', onRun: remove },
        ]}
      />
    </div>
  );
}
