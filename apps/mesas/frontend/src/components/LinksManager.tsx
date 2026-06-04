import { useState } from 'react';
import { Trash2, Video, Music, Radio, MessageCircle, FileText, Globe, Plus, Loader, Camera, Share2, Briefcase } from 'lucide-react';
import { useLinks, type UserLink } from '../hooks/useLinks';
import { useConfirm } from './ui/useConfirm';
import './LinksManager.css';

const LINK_TYPE_ICONS = {
  youtube: Video,
  spotify: Music,
  twitch: Radio,
  twitter: MessageCircle,
  instagram: Camera,
  facebook: Share2,
  tiktok: Music,
  linkedin: Briefcase,
  podcast: Radio,
  article: FileText,
  website: Globe,
};

const LINK_TYPE_LABELS = {
  youtube: 'YouTube',
  spotify: 'Spotify',
  twitch: 'Twitch',
  twitter: 'Twitter/X',
  article: 'Artigo',
  website: 'Website',
};

export function LinksManager() {
  const { links, loading, error, addLink, removeLink } = useLinks();
  const { confirm } = useConfirm();
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUrl.trim()) return;

    setAdding(true);
    setAddError(null);

    const result = await addLink(newUrl.trim());
    
    if (result) {
      setNewUrl('');
    } else {
      setAddError('Erro ao adicionar link. Verifique a URL e tente novamente.');
    }
    
    setAdding(false);
  };

  const handleRemoveLink = async (linkId: string) => {
    const confirmed = await confirm({
      title: 'Remover link?',
      message: 'Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmText: 'Remover',
      cancelText: 'Cancelar',
    });
    
    if (confirmed) {
      await removeLink(linkId);
    }
  };

  if (loading) {
    return (
      <div className="links-manager-loading">
        <Loader className="spinner" />
        <p>Carregando links...</p>
      </div>
    );
  }

  return (
    <div className="links-manager">
      <div className="links-manager-header">
        <h3>Links e Conteúdo</h3>
        <p className="links-manager-subtitle">
          Adicione links para YouTube, Spotify, artigos e mais. Máximo de 10 links.
        </p>
      </div>

      {error && (
        <div className="links-manager-error">
          {error}
        </div>
      )}

      <form onSubmit={handleAddLink} className="links-add-form">
        <div className="links-add-input-wrapper">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Cole o link aqui (YouTube, Spotify, etc)"
            className="links-add-input"
            disabled={adding || links.length >= 10}
          />
          <button
            type="submit"
            className="links-add-button"
            disabled={adding || !newUrl.trim() || links.length >= 10}
          >
            {adding ? (
              <Loader className="spinner-small" />
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Adicionar
              </>
            )}
          </button>
        </div>
        
        {addError && (
          <p className="links-add-error">{addError}</p>
        )}
        
        {links.length >= 10 && (
          <p className="links-limit-warning">
            Limite de 10 links atingido. Remova um link para adicionar outro.
          </p>
        )}
      </form>

      {links.length > 0 ? (
        <div className="links-list">
          {links.map((link) => (
            <LinkItem
              key={link.id}
              link={link}
              onRemove={() => handleRemoveLink(link.id)}
            />
          ))}
        </div>
      ) : (
        <div className="links-empty">
          <Globe className="links-empty-icon" />
          <p>Nenhum link adicionado ainda</p>
          <p className="links-empty-hint">
            Adicione links para seu canal, podcast, artigos ou portfólio
          </p>
        </div>
      )}
    </div>
  );
}

interface LinkItemProps {
  link: UserLink;
  onRemove: () => void;
}

function LinkItem({ link, onRemove }: LinkItemProps) {
  const Icon = LINK_TYPE_ICONS[link.type];
  const label = LINK_TYPE_LABELS[link.type];

  return (
    <div className="link-item">
      <div className="link-item-icon">
        <Icon className="w-5 h-5" />
      </div>
      
      <div className="link-item-content">
        <div className="link-item-header">
          <span className="link-item-type">{label}</span>
        </div>
        
        <p className="link-item-title">
          {link.title || new URL(link.url).hostname}
        </p>
        
        {link.description && (
          <p className="link-item-description">{link.description}</p>
        )}
        
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="link-item-url"
        >
          {link.url}
        </a>
      </div>
      
      <button
        onClick={onRemove}
        className="link-item-remove"
        title="Remover link"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
