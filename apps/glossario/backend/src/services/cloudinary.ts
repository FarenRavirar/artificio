import { v2 as cloudinary } from 'cloudinary';

/**
 * Upload/exclusao de captura de tela do widget de feedback (Spec 021).
 *
 * Port minimo de `apps/mesas/backend/src/services/cloudinary.ts` (so o necessario
 * para o screenshot). Credenciais por app via env CLOUDINARY_*. Sem credencial, o
 * upload falha e o feedback e gravado sem imagem (nao-fatal — FR-006).
 */

// Reusa a MESMA conta Cloudinary do projeto (mesas/site). Aceita as duas formas que já
// existem na VM: CLOUDINARY_URL única OU o trio CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET.
if (process.env.CLOUDINARY_URL) {
  cloudinary.config(); // SDK lê CLOUDINARY_URL do ambiente
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_URL
    || (process.env.CLOUDINARY_CLOUD_NAME
      && process.env.CLOUDINARY_API_KEY
      && process.env.CLOUDINARY_API_SECRET),
  );
}

export async function uploadScreenshotToCloudinary(dataUri: string) {
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'glossario_rpg/dev_feedback',
    resource_type: 'image',
    transformation: [
      { width: 1600, crop: 'limit' },
      { quality: 'auto:eco', fetch_format: 'auto' },
    ],
  });
  return { secure_url: result.secure_url, public_id: result.public_id };
}

/**
 * Remove imagem por public_id. Nao-fatal: engole erros (limpeza de orfaos).
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (error: any) {
    console.error('[cloudinary] Delete failed:', publicId, error?.message || error);
  }
}
