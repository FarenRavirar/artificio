// Modal seletor de mídia (spec 011, T19). Reutilizável: imagem destacada, OG image, bloco do editor.
import { type MediaItem } from "../api";
import { MediaLibrary } from "./MediaLibrary";

export function MediaPicker({ onPick, onClose }: { onPick: (item: MediaItem) => void; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 className="title" style={{ margin: 0 }}>Biblioteca de mídia</h2>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Fechar ✕</button>
        </div>
        <MediaLibrary onPick={(m) => { onPick(m); onClose(); }} />
      </div>
    </div>
  );
}
