import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { FilterControls, type CatalogFilterValues, type FilterGroupKey } from './FilterControls';

interface FilterPillsProps {
  values: CatalogFilterValues;
  onChange: (key: keyof CatalogFilterValues, value: string) => void;
  /** Rotulo legivel do valor ativo, quando houver (ex.: "D&D 5e"). */
  activeLabels: Partial<Record<FilterGroupKey, string>>;
}

const PILLS: readonly { key: FilterGroupKey; label: string }[] = [
  { key: 'material_type', label: 'Tipo' },
  { key: 'system_id', label: 'Sistema' },
  { key: 'edition_id', label: 'Edição' },
];

// Spec 087 (T2.3) — pills de filtro do modo vitrine.
//
// Pill ativa mostra o VALOR no lugar do rotulo ("Sistema: D&D 5e"), mesmo
// vocabulario do chip de busca: filtro e busca sao a mesma operacao pro
// usuario, entao nao podem ter duas gramaticas visuais diferentes. O ⊗ limpa
// o filtro sem abrir o popover.
export function FilterPills({ values, onChange, activeLabels }: Readonly<FilterPillsProps>) {
  const [openPill, setOpenPill] = useState<FilterGroupKey | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Partial<Record<FilterGroupKey, HTMLButtonElement | null>>>({});
  const popoverId = useId();

  // Fechar o popover devolve o foco pro gatilho que o abriu (achado de review
  // PR #214, CodeRabbit): sem isso, quem navega por teclado perde a posicao e
  // volta pro inicio do documento quando o popover some.
  const closeAndRestoreFocus = useCallback((key: FilterGroupKey | null) => {
    setOpenPill(null);
    if (key) triggerRefs.current[key]?.focus();
  }, []);

  // Escape e clique-fora fecham o popover — mesmas affordances do
  // .artificio-usermenu-dropdown de packages/ui, pra que o comportamento de
  // "camada flutuante" seja um so no produto inteiro.
  useEffect(() => {
    if (!openPill) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAndRestoreFocus(openPill);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenPill(null);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [openPill, closeAndRestoreFocus]);

  return (
    <div ref={containerRef} className="flex flex-wrap gap-2">
      {PILLS.map(({ key, label }) => {
        // Sem rotulo resolvido ainda (facetas em voo), mostra reticencia em vez
        // do valor cru (achado de review PR #214, CodeRabbit): values[key] e um
        // UUID, e "Sistema: 9f3a-..." nao diz nada a ninguem.
        const isActive = Boolean(values[key]);
        const activeLabel = isActive ? activeLabels[key] ?? '…' : null;
        const isOpen = openPill === key;

        return (
          <div key={key} className="relative">
            {/* Achado de review PR #214 (Codex, P1): a pill usava
                rgba(255,87,34,0.10) cru, fora do design system e cego a tema.
                Agora consome --state-brand-*, criado em packages/ui na mesma
                familia dos outros estados (success/warning/danger/info). */}
            <span
              className={[
                'inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-sm font-semibold transition',
                activeLabel
                  ? 'border-[var(--state-brand-line)] bg-[var(--state-brand-bg)] text-[var(--state-brand-fg)]'
                  : 'border-[var(--line)] bg-[var(--fill-subtle)] text-[var(--fg)] hover:border-[var(--line-strong)] hover:bg-[var(--fill)]',
              ].join(' ')}
            >
              {/* Achado de review PR #214 (Codex, P1): min-h-11 (44px) em CADA
                  alvo, nao so no container — a altura da pill nao vira area
                  clicavel do botao interno, entao abrir e remover filtro
                  ficavam abaixo do minimo de toque. Antecipa T4.2. */}
              <button
                type="button"
                ref={(node) => { triggerRefs.current[key] = node; }}
                aria-expanded={isOpen}
                aria-controls={isOpen ? `${popoverId}-${key}` : undefined}
                onClick={() => setOpenPill(isOpen ? null : key)}
                className="inline-flex min-h-11 items-center focus:outline-none focus-visible:underline"
              >
                {activeLabel ? `${label}: ${activeLabel}` : label}
              </button>
              {activeLabel && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(key, '');
                    setOpenPill(null);
                  }}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center text-base leading-none focus:outline-none focus-visible:underline"
                >
                  <span aria-hidden="true">⊗</span>
                  <span className="sr-only">Remover filtro {label}</span>
                </button>
              )}
            </span>

            {isOpen && (
              <div
                id={`${popoverId}-${key}`}
                className="absolute left-0 top-full z-20 mt-2 max-h-80 w-64 overflow-y-auto rounded-lg border border-[var(--admin-border)] bg-[var(--admin-rail)] shadow-lg"
              >
                <FilterControls
                  values={values}
                  groups={[key]}
                  onChange={(changedKey, value) => {
                    onChange(changedKey, value);
                    // Escolher uma opcao fecha o popover; o foco volta pra pill
                    // pra que o teclado continue de onde estava.
                    closeAndRestoreFocus(key);
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
