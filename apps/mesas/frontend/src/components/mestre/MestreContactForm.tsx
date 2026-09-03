import { useState } from 'react';
import { Send, CheckCircle } from 'lucide-react';
import { ContentEditor } from '@artificio/content-editor';

interface MestreContactFormProps {
  mestreSlug: string;
}

export function MestreContactForm({ mestreSlug }: MestreContactFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/gm/perfis/${mestreSlug}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Erro ao enviar mensagem');
      }

      setSuccess(true);
      setName('');
      setEmail('');
      setMessage('');

      // Resetar sucesso após 5 segundos
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'Erro ao enviar mensagem');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <section className="p-6 rounded-[var(--radius-lg)] bg-green-500/10 border border-green-500/30">
        <div className="flex items-center gap-3 text-green-400">
          <CheckCircle className="w-6 h-6" />
          <div>
            <h3 className="font-[var(--weight-strong)]">Mensagem enviada!</h3>
            <p className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-green-300/80">
              O mestre receberá seu contato em breve.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="p-6 rounded-[var(--radius-lg)] bg-[var(--fill-5)] border border-[var(--border)]">
      <h2 className="text-[length:var(--text-title)] leading-[var(--leading-title)] font-[var(--weight-strong)] text-[var(--fg)] mb-2">✉️ Envie uma Mensagem</h2>
      <p className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg-low)] mb-4">
        Preencha o formulário abaixo para entrar em contato diretamente com o mestre.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nome */}
        <div>
          <label htmlFor="contact-name" className="block text-[length:var(--text-support)] leading-[var(--leading-support)] font-[var(--weight-medium)] text-[var(--fg-muted)] mb-1">
            Seu nome *
          </label>
          <input
            id="contact-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            placeholder="Como você gostaria de ser chamado?"
            className="w-full px-4 py-2 rounded-[var(--radius-md)] bg-[var(--fill-5)] border border-[var(--border)] text-[var(--fg)] placeholder:text-[var(--fg-ghost)] focus:outline-none focus:border-purple-500/50"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="contact-email" className="block text-[length:var(--text-support)] leading-[var(--leading-support)] font-[var(--weight-medium)] text-[var(--fg-muted)] mb-1">
            Seu email *
          </label>
          <input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="seu@email.com"
            className="w-full px-4 py-2 rounded-[var(--radius-md)] bg-[var(--fill-5)] border border-[var(--border)] text-[var(--fg)] placeholder:text-[var(--fg-ghost)] focus:outline-none focus:border-purple-500/50"
          />
        </div>

        {/* Mensagem */}
        <div>
          <label htmlFor="contact-message" className="block text-[length:var(--text-support)] leading-[var(--leading-support)] font-[var(--weight-medium)] text-[var(--fg-muted)] mb-1">
            Mensagem *
          </label>
          <ContentEditor
            id="contact-message"
            value={message}
            onChange={setMessage}
            label="Mensagem"
            labelledByExternal
            required
            maxLength={1000}
            minHeight={176}
            placeholder="Conte um pouco sobre você e por que gostaria de participar das mesas deste mestre..."
          />
          {/* Sem contador próprio: o `ContentEditor` já renderiza o dele a partir
              do mesmo `maxLength`, e dois contadores divergem assim que o limite
              muda em um só lugar (achado P2 do Codex, PR #275). */}
        </div>

        {/* Erro */}
        {error && (
          <div className="p-3 rounded-[var(--radius-md)] bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-[length:var(--text-support)] leading-[var(--leading-support)]">{error}</p>
          </div>
        )}

        {/* Botão */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-[var(--radius-md)] bg-[var(--special)] hover:brightness-90 disabled:opacity-50 text-[var(--on-solid-fg)] font-[var(--weight-medium)] transition flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-[var(--border-strong)] border-t-white rounded-[var(--radius-pill)] animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Enviar Mensagem
            </>
          )}
        </button>
      </form>
    </section>
  );
}
