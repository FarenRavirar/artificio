export type { CatalogNodeType, CatalogNodeStatus, CatalogUiNode, CatalogUiNodeInput } from './types.js';
export { normalizeText } from './normalize.js';
export { CatalogTree } from './CatalogTree.js';
export type { CatalogTreeMode, CatalogTreeRole, CatalogTreeProps } from './CatalogTree.js';
export { CatalogSystemSelector } from './CatalogSystemSelector.js';
export type { CatalogSystemSelectorProps } from './CatalogSystemSelector.js';
// Contrato de fonte server-side (spec 099 G7): definição única, consumida pelo
// `CatalogSystemSelector` e pelo `CatalogTree`. O caminho antigo
// (`from './CatalogSystemSelector.js'`) continua válido — aquele módulo
// re-exporta os três tipos —, mas a fonte é esta.
export {
  SYSTEM_SEARCH_DEBOUNCE_MS,
  normalizeNodes,
} from './catalogFetch.js';
export type {
  CatalogSystemSearchFetch,
  CatalogSystemChildrenFetch,
  CatalogSystemPathFetch,
} from './catalogFetch.js';
export { CatalogNodeForm, sanitizeCatalogForm } from './CatalogNodeForm.js';
export type { CatalogNodeFormProps } from './CatalogNodeForm.js';
export { CatalogExplorer } from './CatalogExplorer.js';
export type { CatalogExplorerProps } from './CatalogExplorer.js';
