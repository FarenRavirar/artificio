import express from 'express';
import multer from 'multer';
import { uploadImageToCloudinary, uploadRemoteImageToCloudinary } from '../services/cloudinary.js';
import { IMAGE_KIND_LIST, imageKindSpec, isImageKind } from '@artificio/media/image-kinds';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// O multer decide o limite ANTES de o corpo ser parseado, entao nao da para
// consultar o `purpose` da requisicao aqui. Usamos o maior limite entre os
// tipos como teto do transporte; o limite especifico de cada tipo e conferido
// depois, ja com o `purpose` conhecido.
const MAX_UPLOAD_BYTES = Math.max(
  ...IMAGE_KIND_LIST.map((kind) => imageKindSpec(kind).maxFileBytes),
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
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

    // O tipo chega por campo do FormData; origem nao confiavel, entao
    // `isImageKind` narrowa e o default continua sendo o banner de mesa —
    // preserva o contrato de quem ainda nao envia `purpose`.
    const rawKind = typeof req.body?.purpose === 'string' ? req.body.purpose : undefined;
    const kind = isImageKind(rawKind) ? rawKind : 'table_banner';

    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    const spec = imageKindSpec(kind);
    if (req.file.size > spec.maxFileBytes) {
      const limitMb = Math.round(spec.maxFileBytes / (1024 * 1024));
      res.status(400).json({ error: `Arquivo muito grande para ${spec.label}. Limite de ${limitMb} MB.` });
      return;
    }

    const result = await uploadImageToCloudinary(dataUri, kind);

    // width/height sao do arquivo ARMAZENADO. O editor de recorte precisa
    // deles para converter `*_crop_data` em `object-position` na exibicao.
    res.json({
      secure_url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    console.error('[upload] Erro ao fazer upload:', message || error);

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: `Arquivo muito grande. Limite de ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.` });
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

    // Antes o `purpose` era validado aqui e DESCARTADO na linha seguinte:
    // `uploadRemoteImageToCloudinary(url)` sem argumento aplicava a
    // transformacao de banner de mesa a qualquer imagem, inclusive avatar.
    if (!isImageKind(purpose)) {
      res.status(400).json({ error: 'Finalidade de imagem inválida.' });
      return;
    }

    const result = await uploadRemoteImageToCloudinary(url, purpose);

    res.json({
      secure_url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
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
