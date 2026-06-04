import { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Mail, MessageCircle, Hash, ExternalLink } from 'lucide-react';

type ContactChannel = 'whatsapp' | 'email' | 'discord' | 'form';

interface ContactMethod {
  channel: ContactChannel;
  value: string;
  label?: string;
  discord_server_url?: string;
}

interface ContactMethodsEditorProps {
  contacts: ContactMethod[];
  onSave: (contacts: ContactMethod[]) => Promise<void>;
}

const CHANNEL_CONFIG = {
  whatsapp: {
    icon: MessageCircle,
    label: 'WhatsApp',
    placeholder: '+5511999999999',
    color: 'green',
  },
  email: {
    icon: Mail,
    label: 'Email',
    placeholder: 'seu@email.com',
    color: 'blue',
  },
  discord: {
    icon: Hash,
    label: 'Discord',
    placeholder: 'usuario#1234',
    color: 'indigo',
  },
  form: {
    icon: ExternalLink,
    label: 'Formulário',
    placeholder: 'https://forms.google.com/...',
    color: 'purple',
  },
};

export function ContactMethodsEditor({ contacts, onSave }: ContactMethodsEditorProps) {
  const [localContacts, setLocalContacts] = useState<ContactMethod[]>(contacts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const addContact = (channel: ContactChannel) => {
    setLocalContacts([...localContacts, { channel, value: '', label: '' }]);
    setShowAddMenu(false);
  };

  const removeContact = (index: number) => {
    setLocalContacts(localContacts.filter((_, i) => i !== index));
  };

  const updateContact = (index: number, field: keyof ContactMethod, value: string) => {
    const updated = [...localContacts];
    updated[index] = { ...updated[index], [field]: value };
    setLocalContacts(updated);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...localContacts];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setLocalContacts(updated);
  };

  const moveDown = (index: number) => {
    if (index === localContacts.length - 1) return;
    const updated = [...localContacts];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setLocalContacts(updated);
  };

  const validateContact = (contact: ContactMethod): string | null => {
    if (!contact.value.trim()) return 'Valor obrigatório';

    if (contact.channel === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact.value)) return 'Email inválido';
    }

    if (contact.channel === 'whatsapp') {
      // Aceitar formato: +55XXXXXXXXXXX (sem espaços, parênteses ou hífens)
      const whatsappRegex = /^\+\d{1,3}\d{10,11}$/;
      if (!whatsappRegex.test(contact.value)) {
        return 'WhatsApp deve estar no formato: +55XXXXXXXXXXX (sem espaços, parênteses ou hífens)';
      }
    }

    if (contact.channel === 'form') {
      try {
        new URL(contact.value);
      } catch {
        return 'URL inválida';
      }
    }

    return null;
  };

  const handleSave = async () => {
    // Validar todos os contatos
    const errors = localContacts.map(validateContact);
    const hasErrors = errors.some(e => e !== null);

    if (hasErrors) {
      setError('Corrija os erros antes de salvar');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Filtrar contatos vazios e limpar campos opcionais vazios
      const validContacts = localContacts
        .filter(c => c.value.trim())
        .map(c => ({
          ...c,
          label: c.label?.trim() || undefined,
          discord_server_url: c.discord_server_url?.trim() || undefined,
        }));

      await onSave(validContacts);
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-white mb-2">Formas de Contato</h3>
        <p className="text-sm text-white/60 mb-4">
          Configure como os jogadores podem entrar em contato com você.
        </p>
      </div>

      {/* Lista de contatos */}
      <div className="space-y-3">
        {localContacts.map((contact, index) => {
          const config = CHANNEL_CONFIG[contact.channel];
          const Icon = config.icon;
          const validationError = validateContact(contact);

          return (
            <div
              key={index}
              className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3"
            >
              {/* Header com tipo e ações */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 text-${config.color}-400`} />
                  <span className="font-medium text-white">{config.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title="Mover para cima"
                  >
                    <ChevronUp className="w-4 h-4 text-white/60" />
                  </button>
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === localContacts.length - 1}
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title="Mover para baixo"
                  >
                    <ChevronDown className="w-4 h-4 text-white/60" />
                  </button>
                  <button
                    onClick={() => removeContact(index)}
                    className="p-1 rounded hover:bg-red-500/20 transition"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>

              {/* Campos */}
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-white/60 mb-1">
                    {contact.channel === 'form' ? 'URL do formulário' : 'Valor'} *
                  </label>
                  <input
                    type="text"
                    value={contact.value}
                    onChange={(e) => updateContact(index, 'value', e.target.value)}
                    placeholder={config.placeholder}
                    className={`
                      w-full px-3 py-2 rounded-lg bg-white/5 border text-white text-sm
                      ${validationError ? 'border-red-500/50' : 'border-white/10'}
                      focus:outline-none focus:border-purple-500/50
                    `}
                  />
                  {validationError && (
                    <p className="text-xs text-red-400 mt-1">{validationError}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">
                    Label personalizado (opcional)
                  </label>
                  <input
                    type="text"
                    value={contact.label || ''}
                    onChange={(e) => updateContact(index, 'label', e.target.value)}
                    placeholder="Ex: WhatsApp comercial"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                {contact.channel === 'discord' && (
                  <div>
                    <label className="block text-xs text-white/60 mb-1">
                      Link do servidor Discord (opcional)
                    </label>
                    <input
                      type="text"
                      value={contact.discord_server_url || ''}
                      onChange={(e) => updateContact(index, 'discord_server_url', e.target.value)}
                      placeholder="https://discord.gg/..."
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Botão adicionar */}
      <div className="relative">
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="w-full py-3 rounded-lg border-2 border-dashed border-white/20 hover:border-white/40 text-white/60 hover:text-white transition flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Adicionar contato
        </button>

        {showAddMenu && (
          <div className="absolute top-full mt-2 left-0 right-0 p-2 rounded-lg bg-[#0a1628] border border-white/10 shadow-xl z-10 grid grid-cols-2 gap-2">
            {Object.entries(CHANNEL_CONFIG).map(([channel, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={channel}
                  onClick={() => addContact(channel as ContactChannel)}
                  className="flex items-center gap-2 p-3 rounded-lg hover:bg-white/10 transition text-left"
                >
                  <Icon className={`w-5 h-5 text-${config.color}-400`} />
                  <span className="text-sm text-white">{config.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Botão salvar */}
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <p className="text-sm text-white/60">
          {localContacts.length} {localContacts.length === 1 ? 'contato' : 'contatos'}
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white font-medium transition"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
