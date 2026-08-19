import { useState } from 'react';
import { cropToObjectPosition, imageKindSpec, type CropRect, type ImageKind } from '@artificio/media/image-kinds';
import { isUsableImageSrc } from '../utils/imageSource';

export interface CroppedImageProps {
  src: string | null | undefined;
  alt: string;
  kind: ImageKind;
  /** Retângulo salvo, em pixels da imagem armazenada. */
  crop?: CropRect | null;
  /** Dimensões da imagem armazenada; sem elas o recorte não é conversível. */
  imageWidth?: number | null;
  imageHeight?: number | null;
  className?: string;
  /** Exibido quando não há imagem ou o carregamento falha. */
  fallbackSrc?: string;
  /** Conteúdo alternativo quando não há imagem nem fallback (ex.: inicial do nome). */
  placeholder?: React.ReactNode;
}

/**
 * Exibe imagem no enquadramento escolhido pelo dono.
 *
 * Ponto do componente: `object-fit: cover` sozinho sempre recorta pelo CENTRO
 * geométrico. Num avatar circular de 140px sobre uma imagem retangular, isso
 * descarta as laterais sem que ninguém possa escolher o quê. Somando ao corte
 * destrutivo que o servidor aplicava no upload, a imagem chegava ao usuário
 * cortada duas vezes — foi o defeito medido em produção (2026-08-18).
 *
 * Aqui o recorte salvo vira `object-position`, então o enquadramento é do dono
 * da imagem, e continua reajustável porque o arquivo nunca foi alterado.
 */
export function CroppedImage({
  src,
  alt,
  kind,
  crop,
  imageWidth,
  imageHeight,
  className = '',
  fallbackSrc,
  placeholder,
}: Readonly<CroppedImageProps>) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  // A falha pertence a UMA imagem, nao ao componente. Guardar so um booleano
  // prendia o fallback para sempre: quem trocasse a foto quebrada por outra
  // valida continuaria vendo o placeholder, sem entender por que o envio
  // "nao funcionou". Guardar QUAL src falhou faz a recuperacao ser automatica.
  const loadFailed = typeof src === 'string' && src === failedSrc;
  const spec = imageKindSpec(kind);
  const isAvatar = kind === 'profile_avatar';

  const usable = isUsableImageSrc(src) && !loadFailed;
  const resolvedSrc = usable ? src : fallbackSrc;

  const shape = isAvatar ? 'rounded-full' : 'rounded-xl';
  const wrapperClass = `overflow-hidden ${shape} ${className}`.trim();
  // `aspectRatio` vem do contrato: avatar sempre 1:1, banner 1200x650. Sem
  // isso o contêiner assumiria a forma da imagem e o enquadramento escolhido
  // no editor não corresponderia ao que aparece.
  const wrapperStyle = { aspectRatio: spec.aspectRatioCss };

  if (!resolvedSrc) {
    return (
      <div className={wrapperClass} style={wrapperStyle}>
        {placeholder}
      </div>
    );
  }

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      <img
        src={resolvedSrc}
        alt={alt}
        className="w-full h-full object-cover"
        style={{ objectPosition: cropToObjectPosition(crop, imageWidth, imageHeight) }}
        // Marca a `src` ORIGINAL, nao a resolvida: se o fallback tambem
        // falhar, gravar o fallback faria a proxima imagem valida herdar a
        // falha de um arquivo que nem era dela.
        onError={() => { if (typeof src === 'string') setFailedSrc(src); }}
      />
    </div>
  );
}
