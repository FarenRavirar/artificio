import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

interface VttPlatform {
  id: string;
  name: string;
  slug: string;
  logo_filename: string | null;
  website_url: string | null;
}

interface VttPlatformsEditorProps {
  selectedPlatforms: string[]; // Array de UUIDs
  onSave: (platformIds: string[]) => Promise<void>;
}

export function VttPlatformsEditor({ selectedPlatforms, onSave }: VttPlatformsEditorProps) {
  const [platforms, setPlatforms] = useState<VttPlatform[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedPlatforms));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const res = await fetch('/api/v1/vtt-platforms');
        if (!res.ok) throw new Error('Erro ao carregar plataformas');
        const json = await res.json();
        setPlatforms(json.data || []);
      } catch (err: unknown) {
        setError(err instanceof Error && err.message ? err.message : 'Erro ao carregar plataformas');
      } finally {
        setLoading(false);
      }
    };

    fetchPlatforms();
  }, []);

  const togglePlatform = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(Array.from(selected));
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 rounded-xl bg-white/5 border border-white/10">
        <p className="text-white/60 text-sm animate-pulse">Carregando plataformas...</p>
      </div>
    );
  }

  if (error && platforms.length === 0) {
    return (
      <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-white mb-2">Plataformas VTT que você usa</h3>
        <p className="text-sm text-white/60 mb-4">
          Selecione as plataformas virtuais que você utiliza para mestrar suas mesas online.
        </p>
      </div>

      {/* Grid de plataformas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {platforms.map((platform) => {
          const isSelected = selected.has(platform.id);
          return (
            <button
              key={platform.id}
              onClick={() => togglePlatform(platform.id)}
              className={`
                relative p-4 rounded-xl border-2 transition-all
                ${isSelected
                  ? 'border-purple-500 bg-purple-500/20'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
                }
              `}
            >
              {/* Checkmark */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              {/* Logo */}
              <div className="flex flex-col items-center gap-2">
                {platform.logo_filename ? (
                  <img
                    src={`/vtt-logos/${platform.logo_filename}`}
                    alt={platform.name}
                    className="h-12 w-auto object-contain"
                  />
                ) : (
                  <div className="h-12 flex items-center justify-center">
                    <span className="text-2xl">🎮</span>
                  </div>
                )}
                <span className="text-sm font-medium text-white text-center">
                  {platform.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Botão salvar */}
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <p className="text-sm text-white/60">
          {selected.size} {selected.size === 1 ? 'plataforma selecionada' : 'plataformas selecionadas'}
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white font-medium transition"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
