import { PlusCircle, Trash2 } from 'lucide-react';
import type { TableContactChannel } from '../types/tables';

export interface ContactFormEntry {
  channel: TableContactChannel;
  value: string;
  label: string;
  discord_server_url: string;
}

interface ContactsFormBlockProps {
  contacts: ContactFormEntry[];
  onChange: (next: ContactFormEntry[]) => void;
  error?: string | null;
}

const CHANNEL_OPTIONS: Array<{ value: TableContactChannel; label: string; placeholder: string }> = [
  { value: 'whatsapp', label: 'WhatsApp', placeholder: '+55 11999999999' },
  { value: 'discord', label: 'Discord', placeholder: 'usuario#1234 ou link de perfil' },
  { value: 'phone', label: 'Telefone', placeholder: '(11) 99999-9999' },
  { value: 'email', label: 'E-mail', placeholder: 'contato@exemplo.com' },
  { value: 'facebook', label: 'Facebook', placeholder: 'facebook.com/seu-perfil' },
  { value: 'instagram', label: 'Instagram', placeholder: 'instagram.com/seu-perfil' },
  { value: 'form', label: 'Formulário', placeholder: 'https://seu-formulario.com' },
];

const DEFAULT_CONTACT: ContactFormEntry = {
  channel: 'whatsapp',
  value: '',
  label: '',
  discord_server_url: '',
};

export function ContactsFormBlock({ contacts, onChange, error }: ContactsFormBlockProps) {
  const updateContact = (index: number, patch: Partial<ContactFormEntry>) => {
    onChange(contacts.map((contact, currentIndex) => (currentIndex === index ? { ...contact, ...patch } : contact)));
  };

  const addContact = () => {
    onChange([...contacts, { ...DEFAULT_CONTACT }]);
  };

  const removeContact = (index: number) => {
    const next = contacts.filter((_, currentIndex) => currentIndex !== index);
    onChange(next);
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-[#13213f]/60 p-4 space-y-4" id="painel-mestre-contacts-block">
      <div>
        <h2 className="text-sm font-semibold text-white inline-flex items-center gap-2">
          Canais de recrutamento *
        </h2>
        <p className="text-xs text-white/60 mt-1">Adicione ao menos um canal para jogadores entrarem em contato.</p>
      </div>

      <div className="space-y-3">
        {contacts.map((contact, index) => {
          const selectedChannel = CHANNEL_OPTIONS.find((option) => option.value === contact.channel) ?? CHANNEL_OPTIONS[0];

          return (
            <article key={`contact-form-item-${index}`} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`painel-mestre-contact-channel-${index}`} className="text-xs text-white/65">Canal</label>
                  <select
                    id={`painel-mestre-contact-channel-${index}`}
                    value={contact.channel}
                    onChange={(event) => updateContact(index, { channel: event.target.value as TableContactChannel, discord_server_url: event.target.value === 'discord' ? contact.discord_server_url : '' })}
                    className="app-select w-full py-2.5"
                  >
                    {CHANNEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor={`painel-mestre-contact-value-${index}`} className="text-xs text-white/65">Valor do contato *</label>
                  <input
                    id={`painel-mestre-contact-value-${index}`}
                    value={contact.value}
                    onChange={(event) => updateContact(index, { value: event.target.value })}
                    placeholder={selectedChannel.placeholder}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/30 outline-none focus:border-[var(--color-artificio-orange)]/60 transition-all"
                  />
                </div>

                <button
                  type="button"
                  id={`painel-mestre-contact-remove-${index}`}
                  onClick={() => removeContact(index)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-red-400/35 text-red-200 hover:bg-red-500/15 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`painel-mestre-contact-label-${index}`} className="text-xs text-white/65">Rótulo opcional</label>
                  <input
                    id={`painel-mestre-contact-label-${index}`}
                    value={contact.label}
                    onChange={(event) => updateContact(index, { label: event.target.value })}
                    placeholder="Ex: Falar com o organizador"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/30 outline-none focus:border-[var(--color-artificio-orange)]/60 transition-all"
                  />
                </div>

                {contact.channel === 'discord' && (
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`painel-mestre-contact-discord-server-${index}`} className="text-xs text-white/65">Link opcional do servidor</label>
                    <input
                      id={`painel-mestre-contact-discord-server-${index}`}
                      value={contact.discord_server_url}
                      onChange={(event) => updateContact(index, { discord_server_url: event.target.value })}
                      placeholder="https://discord.gg/..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/30 outline-none focus:border-[var(--color-artificio-orange)]/60 transition-all"
                    />
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200" id="painel-mestre-contacts-error">
          {error}
        </div>
      )}

      <button
        type="button"
        id="painel-mestre-contact-add"
        onClick={addContact}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 text-sm hover:border-[var(--color-artificio-orange)] hover:text-[var(--color-artificio-orange)] transition-colors"
      >
        <PlusCircle className="w-4 h-4" />
        Adicionar canal
      </button>
    </section>
  );
}
