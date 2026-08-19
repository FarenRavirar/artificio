export { ImageEditor, type ImageEditorProps } from './ImageEditor.js';

// Reexporta o contrato para o consumidor não precisar importar dois pacotes
// só para enquadrar uma imagem. A definição continua morando em
// `@artificio/media/image-kinds` — aqui é atalho, não cópia.
export {
  IMAGE_KINDS,
  IMAGE_KIND_LIST,
  cropToObjectPosition,
  imageKindSpec,
  isCropRect,
  isImageKind,
  type CropRect,
  type ImageKind,
  type ImageKindSpec,
} from '@artificio/media/image-kinds';
