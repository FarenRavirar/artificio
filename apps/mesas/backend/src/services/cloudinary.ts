import { v2 as cloudinary } from 'cloudinary';
import { downloadPublicImage, uploadBuffer } from '@artificio/media';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('[cloudinary] Config loaded:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'set' : 'MISSING',
  api_key: process.env.CLOUDINARY_API_KEY ? 'set' : 'MISSING',
  api_secret: process.env.CLOUDINARY_API_SECRET ? 'set' : 'MISSING',
});

export async function uploadImageToCloudinary(imageUrl: string) {
  try {
    const transformations = [
      { width: 1200, height: 650, crop: 'fill' },
      { quality: 'auto', fetch_format: 'auto' }
    ];

    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: 'mesas_rpg',
      transformation: transformations
    });
    
    return {
      secure_url: result.secure_url,
      public_id: result.public_id
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : error;
    console.error('[cloudinary] Upload failed:', message);
    throw error;
  }
}

/**
 * Upload de captura de tela do widget de feedback (Spec 022).
 * Usa crop 'limit' (preserva proporcao, nao distorce como o banner 1200x650).
 */
export async function uploadScreenshotToCloudinary(dataUri: string) {
  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'mesas_rpg/dev_feedback',
      resource_type: 'image',
      transformation: [
        { width: 1600, crop: 'limit' },
        { quality: 'auto:eco', fetch_format: 'auto' },
      ],
    });

    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : error;
    console.error('[cloudinary] Screenshot upload failed:', message);
    throw error;
  }
}

/**
 * Remove imagem do Cloudinary por public_id. Nao-fatal: usado para limpar
 * uploads orfaos quando a persistencia subsequente falha.
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : error;
    console.error('[cloudinary] Delete failed:', publicId, message);
  }
}

export async function uploadRemoteImageToCloudinary(rawUrl: string) {
  const image = await downloadPublicImage(rawUrl, {
    maxBytes: 5 * 1024 * 1024,
    userAgent: 'MesasRPGArtificio/1.0 image-import',
  });
  const result = await uploadBuffer(image.buffer, {
    folder: 'mesas_rpg',
    resourceType: 'image',
    transformation: [
      { width: 1200, height: 650, crop: 'fill' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  });

  return { secure_url: result.url, public_id: result.public_id };
}
