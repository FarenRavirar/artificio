import { useEffect, useRef, useState } from 'react';
import { useSession } from '@artificio/auth/client';
import toast from 'react-hot-toast';
import { useAddCollectionItem, useCollections } from '../hooks/useCollections';

// DEB-074-03 (spec 074/075) — botao de "adicionar a colecao" na ficha
// publica, reusando POST /collections/:id/items (ja existia sem UI aqui).
export function AddToCollectionButton({ materialId }: Readonly<{ materialId: string }>) {
  const { user } = useSession();
  const { data: collections } = useCollections();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 text-sm text-[var(--fg)] hover:border-artificio-orange"
        aria-expanded={open}
      >
        Adicionar à coleção
      </button>

      {open && (
        <div className="absolute z-10 mt-2 w-64 rounded-md border border-[var(--line)] bg-[var(--surface)] p-2 shadow-lg">
          {collections?.length === 0 && (
            <p className="px-2 py-1 text-sm text-[var(--fg-muted)]">Você ainda não tem coleções. Crie uma no painel.</p>
          )}
          <ul className="flex flex-col gap-1">
            {collections?.map((collection) => (
              <CollectionOption
                key={collection.id}
                collectionId={collection.id}
                title={collection.title}
                materialId={materialId}
                onDone={() => setOpen(false)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CollectionOption({
  collectionId,
  title,
  materialId,
  onDone,
}: Readonly<{
  collectionId: string;
  title: string;
  materialId: string;
  onDone: () => void;
}>) {
  const addItem = useAddCollectionItem(collectionId);

  const handleAdd = async () => {
    try {
      await addItem.mutateAsync(materialId);
      toast.success(`Adicionado a "${title}".`);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao adicionar.');
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={() => handleAdd()}
        disabled={addItem.isPending}
        className="min-h-[36px] w-full rounded-md px-2 py-1 text-left text-sm text-[var(--fg-muted)] hover:bg-[var(--surface-subtle)] disabled:opacity-50"
      >
        {title}
      </button>
    </li>
  );
}
