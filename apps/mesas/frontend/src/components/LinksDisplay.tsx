import { Video, Music, Radio, MessageCircle, FileText, Globe, ExternalLink, Camera, Share2, Briefcase, BookOpen, Mic2 } from 'lucide-react';
import type { UserLink } from '../hooks/useLinks';
import './LinksDisplay.css';

const LINK_TYPE_ICONS = {
  youtube: Video,
  spotify: Music,
  twitch: Radio,
  twitter: MessageCircle,
  instagram: Camera,
  facebook: Share2,
  tiktok: Music,
  linkedin: Briefcase,
  whatsapp: MessageCircle,
  podcast: Radio,
  article: FileText,
  website: Globe,
};

const LINK_TYPE_LABELS = {
  youtube: 'YouTube',
  spotify: 'Spotify',
  twitch: 'Twitch',
  twitter: 'Twitter/X',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  podcast: 'Podcast',
  article: 'Artigo',
  website: 'Website',
};

// Categorias para organização visual
const CATEGORIES = {
  content: ['youtube', 'twitch', 'podcast', 'spotify'],
  social: ['instagram', 'twitter', 'facebook', 'tiktok', 'linkedin'],
  contact: ['whatsapp'],
  authority: ['article', 'website'],
};

const CATEGORY_META: Record<string, { label: string; Icon: typeof Video }> = {
  content: { label: 'Conteúdo', Icon: Video },
  social: { label: 'Presença', Icon: Share2 },
  contact: { label: 'Contato', Icon: MessageCircle },
  authority: { label: 'Autoridade', Icon: BookOpen },
};

interface LinksDisplayProps {
  links: UserLink[];
}

export function LinksDisplay({ links }: LinksDisplayProps) {
  if (links.length === 0) return null;

  // Agrupar links por categoria
  const groupedLinks = {
    content: links.filter(l => CATEGORIES.content.includes(l.type)),
    social: links.filter(l => CATEGORIES.social.includes(l.type)),
    contact: links.filter(l => CATEGORIES.contact.includes(l.type)),
    authority: links.filter(l => CATEGORIES.authority.includes(l.type)),
  };

  return (
    <section className="links-display">
      <h2 className="links-display-title">
        <Mic2 className="inline-block mr-2 w-5 h-5" />
        Conteúdo & Redes
      </h2>
      
      {Object.entries(groupedLinks).map(([category, categoryLinks]) => {
        if (categoryLinks.length === 0) return null;
        
        return (
          <div key={category} className="links-category">
            <h3 className="category-title">
              {(() => {
                const meta = CATEGORY_META[category as keyof typeof CATEGORY_META];
                if (!meta) return category;
                const { label, Icon } = meta;
                return <><Icon className="inline-block mr-2 w-4 h-4" />{label}</>;
              })()}
            </h3>
            <div className="links-display-grid">
              {categoryLinks.map((link) => (
                <LinkCard key={link.id} link={link} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

interface LinkCardProps {
  link: UserLink;
}

function LinkCard({ link }: LinkCardProps) {
  const Icon = LINK_TYPE_ICONS[link.type as keyof typeof LINK_TYPE_ICONS] || Globe;
  const label = LINK_TYPE_LABELS[link.type as keyof typeof LINK_TYPE_LABELS] || 'Link';
  
  // Apenas YouTube, Spotify e Twitch têm embed pesado
  const hasHeavyEmbed = ['youtube', 'spotify', 'twitch'].includes(link.type) && link.embed_url;
  
  // Canal YouTube sem embed (URLs com /@handle)
  const isChannelLike = link.type === 'youtube' && !link.embed_url;
  
  // Redes sociais têm preview leve
  const isSocial = CATEGORIES.social.includes(link.type);

  return (
    <div className="link-card">
      <div className="link-card-header">
        <div className="link-card-icon">
          <Icon className="w-5 h-5" />
        </div>
        <span className="link-card-type">{label}</span>
      </div>

      {/* Canal YouTube sem embed (preview leve) */}
      {isChannelLike && (
        <div className="link-card-channel-preview">
          <Icon className="w-10 h-10" />
          <div>
            <p className="link-card-channel-handle">
              {(() => {
                try {
                  const pathname = new URL(link.url).pathname;
                  const handle = pathname.replace(/^\/+/, '').split('/')[0];
                  return handle.startsWith('@') ? handle : `@${handle}`;
                } catch {
                  return 'Canal';
                }
              })()}
            </p>
            <p className="link-card-channel-label">Abrir canal no YouTube</p>
          </div>
        </div>
      )}

      {/* Embeds pesados (YouTube, Spotify, Twitch) */}
      {hasHeavyEmbed && (
        <div className="link-card-embed">
          <iframe
            src={link.embed_url}
            title={link.title || label}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allow={link.type === 'youtube' ? "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" : "encrypted-media"}
            allowFullScreen={link.type === 'youtube' || link.type === 'twitch'}
          />
        </div>
      )}



      {/* Thumbnail para artigos/sites */}
      {!hasHeavyEmbed && !isSocial && !isChannelLike && link.thumbnail_url && (
        <div className="link-card-thumbnail">
          <img src={link.thumbnail_url} alt={link.title || ''} />
        </div>
      )}

      <div className="link-card-content">
        <h3 className="link-card-title">
          {(['article', 'website', 'podcast'].includes(link.type) ? link.title : null) || link.url.replace(/^https?:\/\//, '')}
        </h3>
        
        {/* Redes sociais protegidas não mostram description (OG bloqueado por CORS) */}
        {link.description && !['instagram', 'facebook', 'twitter', 'tiktok'].includes(link.type) && (
          <p className="link-card-description">{link.description}</p>
        )}
        
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="link-card-cta"
        >
          Ver conteúdo
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
