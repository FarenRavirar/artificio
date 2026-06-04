import { useState, useRef, useCallback } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageEditorProps {
  imageSrc: string;
  onCropComplete: (croppedAreaPixels: PixelCrop, originalWidth: number, originalHeight: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
  aspect?: number;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export function ImageEditor({
  imageSrc,
  onCropComplete,
  onCancel,
  onConfirm,
  aspect = 1200 / 650
}: ImageEditorProps) {
  const [crop, setCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, aspect));
  }, [aspect]);

  const handleCropChange = useCallback((c: Crop) => {
    setCrop(c);
  }, []);

  const handleCropComplete = useCallback((c: PixelCrop) => {
    if (imgRef.current) {
      onCropComplete(c, imgRef.current.naturalWidth, imgRef.current.naturalHeight);
    }
  }, [onCropComplete]);

  const handleZoomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setScale(Number(e.target.value));
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-[#1a1a2e] rounded-xl p-4 max-w-3xl w-full max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-semibold">Ajustar imagem</h3>
          <div className="flex items-center gap-2">
            <label className="text-white/70 text-sm">Zoom:</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={scale}
              onChange={handleZoomChange}
              className="w-24 accent-[var(--color-artificio-orange)]"
            />
            <span className="text-white/50 text-xs">{Math.round(scale * 100)}%</span>
          </div>
        </div>

        <div className="flex justify-center bg-black/30 rounded-lg p-2 overflow-auto" style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
          <ReactCrop
            crop={crop}
            onChange={handleCropChange}
            onComplete={handleCropComplete}
            aspect={aspect}
            className="max-h-[50vh]"
          >
            <img
              ref={imgRef}
              src={imageSrc}
              onLoad={onImageLoad}
              alt="Preview para crop"
              className="max-h-[50vh] object-contain"
            />
          </ReactCrop>
        </div>

        <div className="flex gap-3 mt-4 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-[var(--color-artificio-orange)] text-white hover:bg-[var(--color-artificio-orange-hover)] transition-colors font-medium"
          >
            Aplicar
          </button>
        </div>

        <div className="mt-3 text-center">
          <p className="text-white/50 text-xs">Arraste para mover • Use o zoom para ajustar</p>
        </div>
      </div>
    </div>
  );
}