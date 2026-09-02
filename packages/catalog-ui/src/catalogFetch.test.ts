import { describe, expect, it } from 'vitest';
import { normalizeNodes } from './catalogFetch.js';

/** Nó mínimo que passa por `isCatalogUiNode`. */
const base = {
  id: 'n1',
  name: 'D&D',
  canonical_slug: 'dnd',
  parent_id: null,
  node_type: 'system' as const,
  children: [],
};

describe('normalizeNodes — campos opcionais vindos de HTTP', () => {
  it('descarta campo de edicao malformado em vez de propaga-lo ao formulario', () => {
    // `CatalogNodeForm` le estes tres com `?? ''` e entrega a um input controlado:
    // um objeto no lugar da string vira `value={{}}`, que o React nao aceita — e se
    // renderizasse, o admin salvaria `[object Object]` de volta no catalogo.
    const [node] = normalizeNodes([
      {
        ...base,
        description: {},
        official_website_url: 42,
        logo_media_id: ['a'],
      },
    ]);

    expect(node.description).toBeNull();
    expect(node.official_website_url).toBeNull();
    expect(node.logo_media_id).toBeNull();
  });

  it('preserva os valores validos', () => {
    const [node] = normalizeNodes([
      {
        ...base,
        description: 'Sistema classico',
        official_website_url: 'https://dnd.wizards.com',
        logo_media_id: 'media-1',
      },
    ]);

    expect(node.description).toBe('Sistema classico');
    expect(node.official_website_url).toBe('https://dnd.wizards.com');
    expect(node.logo_media_id).toBe('media-1');
  });

  it('campo malformado em DESCENDENTE tambem e limpo', () => {
    // Recursivo: a arvore desce em `children`, e o formulario abre qualquer no dela.
    const [node] = normalizeNodes([
      { ...base, children: [{ ...base, id: 'n2', description: { texto: 'x' } }] },
    ]);

    expect(node.children[0].description).toBeNull();
  });

  it('ausencia do campo continua sendo null, nao undefined', () => {
    const [node] = normalizeNodes([base]);
    expect(node.description).toBeNull();
  });
});
