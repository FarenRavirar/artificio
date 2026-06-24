import { useEffect, useMemo, useState } from 'react';
import { Edit, Trash2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { authGet, authPost, authPut, authDelete } from '../../../services/apiClient';

type PlatformKind = 'vtt' | 'communication';

interface PlatformBase {
  id: string;
  name: string;
  slug: string;
  website_url: string | null;
  is_active: boolean;
  sort_order: number;
}

interface VttPlatform extends PlatformBase {
  logo_filename: string | null;
}

type PlatformRecord = PlatformBase | VttPlatform;

interface PlatformFormState {
  name: string;
  slug: string;
  website_url: string;
  logo_filename: string;
  sort_order: string;
  is_active: boolean;
}

const DEFAULT_FORM: PlatformFormState = {
  name: '',
  slug: '',
  website_url: '',
  logo_filename: '',
  sort_order: '0',
  is_active: true,
};

const getEndpoint = (kind: PlatformKind): string => (
  kind === 'vtt'
    ? '/api/v1/vtt-platforms/admin'
    : '/api/v1/communication-platforms/admin'
);

const parseErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const json = await response.json();
      return json.error || fallback;
    }

    const text = await response.text();
    return text || fallback;
  } catch {
    return fallback;
  }
};

const isVttPlatform = (item: PlatformRecord): item is VttPlatform => (
  'logo_filename' in item
);

export function PlatformsPage() {
  const [kind, setKind] = useState<PlatformKind>('vtt');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [vttPlatforms, setVttPlatforms] = useState<VttPlatform[]>([]);
  const [communicationPlatforms, setCommunicationPlatforms] = useState<PlatformBase[]>([]);
  const [form, setForm] = useState<PlatformFormState>(DEFAULT_FORM);

  const currentItems = useMemo<PlatformRecord[]>(
    () => (kind === 'vtt' ? vttPlatforms : communicationPlatforms),
    [kind, vttPlatforms, communicationPlatforms]
  );

  const filteredItems = useMemo(
    () => currentItems.filter((item) => (
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
      || item.slug.toLowerCase().includes(searchQuery.toLowerCase())
    )),
    [currentItems, searchQuery]
  );

  const loadPlatforms = async (targetKind: PlatformKind) => {
    setLoading(true);

    try {
      const response = await authGet(getEndpoint(targetKind));

      if (!response.ok) {
        const message = await parseErrorMessage(response, 'Erro ao buscar plataformas.');
        throw new Error(message);
      }

      const data = await response.json();
      const items = data.data || [];

      if (targetKind === 'vtt') {
        setVttPlatforms(items);
      } else {
        setCommunicationPlatforms(items);
      }
    } catch (error) {
      console.error('[PlatformsPage] Erro ao carregar plataformas:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar plataformas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => { await loadPlatforms(kind); })();
  }, [kind]);

  const resetForm = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
  };

  const handleEdit = (item: PlatformRecord) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      slug: item.slug,
      website_url: item.website_url || '',
      logo_filename: isVttPlatform(item) ? (item.logo_filename || '') : '',
      sort_order: String(item.sort_order),
      is_active: item.is_active,
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Nome da plataforma é obrigatório.');
      return;
    }

    const sortOrder = Number(form.sort_order);
    if (!Number.isInteger(sortOrder)) {
      toast.error('Ordem deve ser um número inteiro.');
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      sort_order: sortOrder,
      is_active: form.is_active,
      website_url: form.website_url.trim() || null,
    };

    if (form.slug.trim()) {
      payload.slug = form.slug.trim();
    }

    if (kind === 'vtt') {
      payload.logo_filename = form.logo_filename.trim() || null;
    }

    setSaving(true);

    try {
      const endpoint = editingId ? `${getEndpoint(kind)}/${editingId}` : getEndpoint(kind);

      const response = editingId
        ? await authPut(endpoint, payload)
        : await authPost(endpoint, payload);

      if (!response.ok) {
        const message = await parseErrorMessage(response, 'Erro ao salvar plataforma.');
        throw new Error(message);
      }

      toast.success(editingId ? 'Plataforma atualizada com sucesso!' : 'Plataforma criada com sucesso!');
      resetForm();
      await loadPlatforms(kind);
    } catch (error) {
      console.error('[PlatformsPage] Erro ao salvar plataforma:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar plataforma');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: PlatformRecord) => {
    if (!confirm(`Remover plataforma "${item.name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setDeletingId(item.id);

    try {
      const response = await authDelete(`${getEndpoint(kind)}/${item.id}`);

      if (!response.ok) {
        const message = await parseErrorMessage(response, 'Erro ao remover plataforma.');
        throw new Error(message);
      }

      toast.success('Plataforma removida com sucesso!');
      await loadPlatforms(kind);

      if (editingId === item.id) {
        resetForm();
      }
    } catch (error) {
      console.error('[PlatformsPage] Erro ao remover plataforma:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao remover plataforma');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (item: PlatformRecord) => {
    try {
      const response = await authPut(`${getEndpoint(kind)}/${item.id}`, { is_active: !item.is_active });

      if (!response.ok) {
        const message = await parseErrorMessage(response, 'Erro ao atualizar status da plataforma.');
        throw new Error(message);
      }

      toast.success(item.is_active ? 'Plataforma desativada.' : 'Plataforma ativada.');
      await loadPlatforms(kind);

      if (editingId === item.id) {
        setForm((prev) => ({ ...prev, is_active: !item.is_active }));
      }
    } catch (error) {
      console.error('[PlatformsPage] Erro ao alternar status:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => {
            setKind('vtt');
            resetForm();
          }}
          className={`px-4 py-2 rounded-lg transition-all ${
            kind === 'vtt'
              ? 'bg-blue-600 text-white'
              : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          Plataformas VTT
        </button>
        <button
          onClick={() => {
            setKind('communication');
            resetForm();
          }}
          className={`px-4 py-2 rounded-lg transition-all ${
            kind === 'communication'
              ? 'bg-blue-600 text-white'
              : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          Plataformas de Comunicação
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-1 bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <h3 className="text-white font-semibold">
            {editingId ? 'Editar plataforma' : 'Nova plataforma'}
          </h3>

          <input
            id="platform-name"
            type="text"
            placeholder="Nome"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/40"
          />

          <input
            id="platform-slug"
            type="text"
            placeholder="Slug (opcional)"
            value={form.slug}
            onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
            className="w-full px-3 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/40"
          />

          <input
            id="platform-website"
            type="text"
            placeholder="URL do site (opcional)"
            value={form.website_url}
            onChange={(e) => setForm((prev) => ({ ...prev, website_url: e.target.value }))}
            className="w-full px-3 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/40"
          />

          {kind === 'vtt' && (
            <input
              id="platform-logo"
              type="text"
              placeholder="Logo filename (opcional)"
              value={form.logo_filename}
              onChange={(e) => setForm((prev) => ({ ...prev, logo_filename: e.target.value }))}
              className="w-full px-3 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/40"
            />
          )}

          <input
            id="platform-sort-order"
            type="number"
            placeholder="Ordem"
            value={form.sort_order}
            onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
            className="w-full px-3 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/40"
          />

          <label htmlFor="platform-active" className="flex items-center gap-2 text-white/80 text-sm">
            <input
              id="platform-active"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="w-4 h-4"
            />
            Plataforma ativa
          </label>

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold rounded-lg transition-colors"
            >
              {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                title="Cancelar edição"
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="xl:col-span-2 bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="platform-search"
              type="text"
              placeholder="Buscar por nome ou slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/40"
            />
          </div>

          {loading ? (
            <div className="text-white/60 text-center py-8">Carregando plataformas...</div>
          ) : (
            <div className="space-y-3">
              {filteredItems.length === 0 && (
                <div className="text-white/50 text-sm py-6 text-center">Nenhuma plataforma encontrada.</div>
              )}

              {filteredItems.map((item) => (
                <div key={item.id} className="bg-white/5 border border-white/10 rounded-lg p-4 flex justify-between gap-3">
                  <div>
                    <h4 className="text-white font-semibold">{item.name}</h4>
                    <p className="text-white/50 text-xs mt-1">slug: {item.slug}</p>
                    <p className="text-white/50 text-xs">ordem: {item.sort_order}</p>
                    <p className="text-white/50 text-xs">
                      status: {item.is_active ? 'ativo' : 'inativo'}
                    </p>
                    {item.website_url && (
                      <p className="text-white/50 text-xs break-all">site: {item.website_url}</p>
                    )}
                    {isVttPlatform(item) && item.logo_filename && (
                      <p className="text-white/50 text-xs">logo: {item.logo_filename}</p>
                    )}
                  </div>

                  <div className="flex gap-2 self-start">
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        item.is_active
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                      title="Alternar status"
                    >
                      {item.is_active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      className="p-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
