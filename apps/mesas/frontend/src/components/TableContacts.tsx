import { Globe, Mail, MessageCircle, Phone, Share2, Users } from 'lucide-react';
import type { TableContact } from '../types/tables';

interface TableContactsProps {
  contacts: TableContact[];
}

const CHANNEL_META: Record<TableContact['channel'], { label: string; icon: typeof MessageCircle }> = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
  discord: { label: 'Discord', icon: Users },
  phone: { label: 'Telefone', icon: Phone },
  email: { label: 'E-mail', icon: Mail },
  facebook: { label: 'Facebook', icon: Share2 },
  instagram: { label: 'Instagram', icon: Globe },
  form: { label: 'Formulário', icon: Globe },
};

const normalizeExternalUrl = (value: string): string => {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
};

const buildMainHref = (contact: TableContact): string | null => {
  switch (contact.channel) {
    case 'whatsapp':
    case 'phone': {
      // Ambos usam wa.me (padrão brasileiro)
      const phone = contact.value.replace(/\D/g, '');
      // Adiciona +55 se não tiver código de país
      const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
      return phone ? `https://wa.me/${fullPhone}` : null;
    }
    case 'email': {
      return `mailto:${contact.value}`;
    }
    case 'facebook': {
      // Remove https:// se existir para normalizar
      const cleanValue = contact.value.replace(/^https?:\/\/(www\.)?/i, '');
      // Remove facebook.com ou fb.com se existir
      const username = cleanValue.replace(/^(facebook\.com\/|fb\.com\/)/i, '');
      return `https://fb.com/${username}`;
    }
    case 'instagram': {
      // Remove https:// se existir para normalizar
      const cleanValue = contact.value.replace(/^https?:\/\/(www\.)?/i, '');
      // Remove instagram.com ou instagr.am se existir
      const username = cleanValue.replace(/^(instagram\.com\/|instagr\.am\/)/i, '');
      return `https://instagr.am/${username}`;
    }
    case 'discord': {
      // Se já é um link completo, usa direto
      if (/^https?:\/\//i.test(contact.value)) {
        return contact.value;
      }
      // Se é um código de convite (ex: abc123), gera discord.gg
      const inviteCode = contact.value.replace(/^(discord\.gg\/|discord\.com\/invite\/)/i, '');
      return `https://discord.gg/${inviteCode}`;
    }
    case 'form': {
      return normalizeExternalUrl(contact.value);
    }
    default:
      return null;
  }
};

export function TableContacts({ contacts }: TableContactsProps) {
  if (!contacts?.length) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5" id="mesa-contacts-empty">
        <h2 className="text-lg font-bold mb-2">Recrutamento e contato</h2>
        <p className="text-sm text-white/70">Os canais de contato não foram informados para esta mesa.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3" id="mesa-contacts-block">
      <h2 className="text-lg font-bold">Recrutamento e contato</h2>
      <div className="space-y-2">
        {contacts.map((contact, index) => {
          const channelMeta = CHANNEL_META[contact.channel] ?? { label: contact.channel, icon: MessageCircle };
          const Icon = channelMeta.icon;
          const href = buildMainHref(contact);
          const displayValue = contact.label?.trim() || contact.value;

          return (
            <article
              key={`${contact.channel}-${contact.sort_order}-${index}`}
              className="rounded-xl border border-white/10 bg-[#13213f]/65 p-3"
              id={`mesa-contact-item-${contact.channel}-${index}`}
            >
              <p className="text-xs uppercase tracking-wider text-white/55 inline-flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-[var(--color-artificio-orange)]" />
                {channelMeta.label}
              </p>

              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-sm font-semibold text-[var(--color-artificio-orange)] hover:text-[var(--color-artificio-orange-hover)] transition-colors break-all"
                  id={`mesa-contact-main-link-${contact.channel}-${index}`}
                >
                  {displayValue}
                </a>
              ) : (
                <p className="mt-1 text-sm font-semibold text-white break-all" id={`mesa-contact-main-text-${contact.channel}-${index}`}>
                  {displayValue}
                </p>
              )}

              {contact.channel === 'discord' && contact.discord_server_url && (
                <a
                  href={normalizeExternalUrl(contact.discord_server_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-2 text-xs text-white/80 hover:text-white transition-colors"
                  id={`mesa-contact-discord-server-${index}`}
                >
                  Entrar no servidor da comunidade
                </a>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
