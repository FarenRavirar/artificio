import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { normalizePlatforms, type VttPlatform } from './normalizePlatforms';

interface VttPlatformsEditorProps {
  /** UUIDs já selecionados. `readonly` porque props são entrada, nunca destino
      de escrita — as 5 props abaixo já eram, e deixar estas duas de fora era
      inconsistência da conversão (achado do Sonar, PR #307). */
  readonly selectedPlatforms: readonly string[];
  readonly onSave: (platformIds: string[]) => Promise<void>;
  /**
   * Catálogo a carregar. Default é o de VTT — os parâmetros existem porque o
   * perfil passou a declarar TAMBÉM as plataformas de comunicação
   * (migration_166), e as duas telas são a mesma grade de seleção. Duplicar o
   * componente faria duas cópias divergirem no primeiro ajuste de layout.
   */
  readonly endpoint?: string;
  readonly title?: string;
  readonly description?: string;
  /** Pasta dos logos; `communication_platforms` não tem `logo_filename`. */
  readonly logoBasePath?: string;
  /** Emoji do fallback quando a plataforma não tem logo. */
  readonly fallbackIcon?: string;
}

export function VttPlatformsEditor({
  selectedPlatforms,
  onSave,
  endpoint = '/api/v1/vtt-platforms',
  title = 'Plataformas VTT que você usa',
  description = 'Selecione as plataformas virtuais que você utiliza para mestrar suas mesas online.',
  logoBasePath = '/vtt-logos',
  fallbackIcon = '🎮',
}: VttPlatformsEditorProps) {
  const [platforms, setPlatforms] = useState<VttPlatform[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedPlatforms));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error('Erro ao carregar plataformas');
        const json: unknown = await res.json();
        setPlatforms(normalizePlatforms(json));
      } catch (err: unknown) {
        setError(err instanceof Error && err.message ? err.message : 'Erro ao carregar plataformas');
      } finally {
        setLoading(false);
      }
    };

    fetchPlatforms();
  }, [endpoint]);

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
      <div className="p-6 rounded-[var(--radius-lg)] bg-[var(--fill-5)] border border-[var(--border)]">
        <p className="text-[var(--fg-low)] text-[length:var(--text-support)] leading-[var(--leading-support)] animate-pulse">Carregando plataformas...</p>
      </div>
    );
  }

  if (error && platforms.length === 0) {
    return (
      <div className="p-6 rounded-[var(--radius-lg)] bg-[var(--state-danger-bg)] border border-[var(--state-danger-line)]">
        <p className="text-[var(--state-danger-fg)] text-[length:var(--text-support)] leading-[var(--leading-support)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[length:var(--text-section)] leading-[var(--leading-section)] font-[var(--weight-strong)] text-[var(--fg)] mb-2">{title}</h3>
        <p className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg-low)] mb-4">
          {description}
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
                relative p-4 rounded-[var(--radius-lg)] border-2 transition-all
                ${isSelected
                  ? 'border-[var(--special)] bg-[color-mix(in_srgb,var(--special)_20%,transparent)]'
                  : 'border-[var(--border)] bg-[var(--fill-5)] hover:border-[var(--border-strong)]'
                }
              `}
            >
              {/* Checkmark */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-[var(--radius-pill)] bg-[var(--special)] flex items-center justify-center">
                  <Check className="w-3 h-3 text-[var(--fg)]" />
                </div>
              )}

              {/* Logo */}
              <div className="flex flex-col items-center gap-2">
                {platform.logo_filename ? (
                  <img
                    src={`${logoBasePath}/${platform.logo_filename}`}
                    alt={platform.name}
                    className="h-12 w-auto object-contain"
                  />
                ) : (
                  <div className="h-12 flex items-center justify-center">
                    <span className="text-[length:var(--text-title)] leading-[var(--leading-title)]">{fallbackIcon}</span>
                  </div>
                )}
                <span className="text-[length:var(--text-support)] leading-[var(--leading-support)] font-[var(--weight-medium)] text-[var(--fg)] text-center">
                  {platform.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Botão salvar */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
        <p className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg-low)]">
          {selected.size} {selected.size === 1 ? 'plataforma selecionada' : 'plataformas selecionadas'}
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 rounded-[var(--radius-md)] bg-[var(--special)] hover:brightness-90 disabled:opacity-50 text-[var(--fg)] font-[var(--weight-medium)] transition"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-[var(--radius-md)] bg-[var(--state-danger-bg)] border border-[var(--state-danger-line)]">
          <p className="text-[var(--state-danger-fg)] text-[length:var(--text-support)] leading-[var(--leading-support)]">{error}</p>
        </div>
      )}
    </div>
  );
}
