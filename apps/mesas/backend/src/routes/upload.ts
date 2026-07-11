import express from 'express';
import multer from 'multer';
import { uploadImageToCloudinary, uploadRemoteImageToCloudinary } from '../services/cloudinary';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error('Formato inválido. Envie apenas JPG, PNG ou WEBP.'));
      return;
    }

    cb(null, true);
  },
});

router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' });
      return;
    }

    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    const result = await uploadImageToCloudinary(dataUri);
    
    res.json({ 
      secure_url: result.secure_url,
      public_id: result.public_id
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    console.error('[upload] Erro ao fazer upload:', message || error);

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'Arquivo muito grande. Limite de 5 MB.' });
      return;
    }

    if (message === 'Formato inválido. Envie apenas JPG, PNG ou WEBP.') {
      res.status(400).json({ error: message });
      return;
    }

    res.status(500).json({ error: 'Falha ao processar imagem' });
  }
});

router.post('/upload/url', authMiddleware, async (req, res) => {
  try {
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const purpose = typeof req.body?.purpose === 'string' ? req.body.purpose : 'table_banner';

    if (!url) {
      res.status(400).json({ error: 'Informe a URL da imagem.' });
      return;
    }

    if (!['table_banner', 'profile_avatar', 'profile_banner'].includes(purpose)) {
      res.status(400).json({ error: 'Finalidade de imagem inválida.' });
      return;
    }

    const result = await uploadRemoteImageToCloudinary(url);

    res.json({
      secure_url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    console.error('[upload:url] Erro ao importar imagem:', message || error);
    res.status(400).json({
      error: 'Não foi possível importar a imagem desse link.',
    });
  }
});

export default router;
