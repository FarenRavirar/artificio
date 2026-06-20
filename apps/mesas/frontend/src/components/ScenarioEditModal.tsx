import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface ScenarioEditModalProps {
  scenario: {
    id: string;
    name: string;
    name_pt?: string | null;
    slug: string;
    subgenres: string[];
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

const slugify = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

export const ScenarioEditModal = ({ scenario, onClose, onSuccess }: ScenarioEditModalProps) => {
  const [name, setName] = useState('');
  const [namePt, setNamePt] = useState('');
  const [slug, setSlug] = useState('');
  const [subgenres, setSubgenres] = useState<string[]>([]);
  const [subgenreInput, setSubgenreInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Sincroniza os campos com o `scenario` — ajuste durante o render (sem effect).
  const [prevScenario, setPrevScenario] = useState(scenario);
  if (prevScenario !== scenario) {
    setPrevScenario(scenario);
    if (scenario) {
      setName(scenario.name);
      setNamePt(scenario.name_pt || '');
      setSlug(scenario.slug);
      setSubgenres(scenario.subgenres || []);
    } else {
      setName('');
      setNamePt('');
      setSlug('');
      setSubgenres([]);
      setSubgenreInput('');
    }
  }

  const handleNameChange = (value: string) => {
    setName(value);
    if (!scenario) {
      // Auto-gerar slug apenas ao criar
      setSlug(slugify(value));
    }
  };

  const handleAddSubgenre = () => {
    const trimmed = subgenreInput.trim();
    if (trimmed && !subgenres.includes(trimmed)) {
      setSubgenres([...subgenres, trimmed]);
      setSubgenreInput('');
    }
  };

  const handleRemoveSubgenre = (index: number) => {
    setSubgenres(subgenres.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setLoading(true);

    try {
      const url = scenario
        ? `${API_BASE}/api/v1/scenarios/admin/${scenario.id}`
        : `${API_BASE}/api/v1/scenarios/admin`;

      const method = scenario ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          name_pt: namePt.trim() || null,
          subgenres,
        }),
      });

      if (response.ok) {
        toast.success(scenario ? 'Cenário atualizado!' : 'Cenário criado!');
        onSuccess();
        onClose();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao salvar cenário');
      }
    } catch (error) {
      console.error('[ScenarioEditModal]', error);
      toast.error('Erro ao salvar cenário');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
      <div className="bg-[#1B2A4A] border border-white/20 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#1B2A4A] border-b border-white/10 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            {scenario ? 'Editar Cenário' : 'Criar Cenário'}
          </h2>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Nome */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Nome <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-4 py-3 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
              placeholder="Ex: Tormenta"
              required
            />
          </div>

          {/* Nome em português */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Nome em português <span className="text-white/40 text-xs">(opcional)</span>
            </label>
            <input
              type="text"
              value={namePt}
              onChange={(e) => setNamePt(e.target.value)}
              className="w-full px-4 py-3 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
              placeholder="Ex: Reinos Esquecidos"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Slug <span className="text-white/40 text-xs">(gerado automaticamente)</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full px-4 py-3 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
              placeholder={slug || 'slug-gerado-automaticamente'}
              disabled={!!scenario}
            />
          </div>

          {/* Subgêneros */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Subgêneros
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={subgenreInput}
                onChange={(e) => setSubgenreInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubgenre();
                  }
                }}
                className="flex-1 px-4 py-2 bg-[#0F1A2E] border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
                placeholder="Ex: Alta fantasia"
              />
              <button
                type="button"
                onClick={handleAddSubgenre}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
              >
                Adicionar
              </button>
            </div>
            {subgenres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {subgenres.map((subgenre, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-sm text-white"
                  >
                    {subgenre}
                    <button
                      type="button"
                      onClick={() => handleRemoveSubgenre(index)}
                      className="text-white/60 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Salvando...' : scenario ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
