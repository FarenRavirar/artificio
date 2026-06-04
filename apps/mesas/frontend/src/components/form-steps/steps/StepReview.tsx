import type { SessionSchedule } from '../../SessionRepeater';
import type { ContactFormEntry } from '../../ContactsFormBlock';

interface StepReviewProps {
  form: {
    title: string;
    description: string;
    type: string;
    modality: string;
    audience: string;
    price_type: string;
    price_value: string;
    slots_total: string;
    experience_level: string;
    language: string;
  };
  selectedSystemName: string | null;
  selectedScenarioName: string | null;
  sessions: SessionSchedule[];
  contacts: ContactFormEntry[];
  publisherRole: 'gm' | 'announcer';
  actualGmName: string;
  rulesNotes: string;
  bannerUrl: string;
}

export function StepReview({
  form,
  selectedSystemName,
  selectedScenarioName,
  sessions,
  contacts,
  publisherRole,
  actualGmName,
  rulesNotes,
  bannerUrl,
}: StepReviewProps) {
  const validContacts = contacts.filter((c) => c.value.trim().length > 0);
  const formatSession = (session: SessionSchedule): string => {
    const day = session.day_of_week === 'to_define' ? 'Dia a definir' : session.day_of_week;
    const start = session.start_time || 'Horário a definir';
    const end = session.start_time && session.end_time ? ` - ${session.end_time}` : '';
    return `${day} · ${start}${end}`;
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
        <p className="text-yellow-200 text-sm font-medium">
          ⚠️ Revise todas as informações antes de publicar
        </p>
      </div>

      {/* Básico */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h3 className="text-lg font-bold text-white">Informações Básicas</h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-white/60">Título:</span>{' '}
            <span className="text-white font-medium">{form.title || '(não informado)'}</span>
          </div>
          <div>
            <span className="text-white/60">Descrição:</span>{' '}
            <span className="text-white">{form.description || '(não informada)'}</span>
          </div>
        </div>
      </div>

      {/* Sistema */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h3 className="text-lg font-bold text-white">Sistema e Cenário</h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-white/60">Sistema:</span>{' '}
            <span className="text-white font-medium">{selectedSystemName || '(não selecionado)'}</span>
          </div>
          {selectedScenarioName && (
            <div>
              <span className="text-white/60">Cenário:</span>{' '}
              <span className="text-white font-medium">{selectedScenarioName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Configuração */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h3 className="text-lg font-bold text-white">Configuração</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-white/60">Tipo:</span>{' '}
            <span className="text-white">{form.type}</span>
          </div>
          <div>
            <span className="text-white/60">Modalidade:</span>{' '}
            <span className="text-white">{form.modality}</span>
          </div>
          <div>
            <span className="text-white/60">Vagas:</span>{' '}
            <span className="text-white">{form.slots_total}</span>
          </div>
          <div>
            <span className="text-white/60">Cobrança:</span>{' '}
            <span className="text-white">
              {form.price_type === 'paga' && form.price_value
                ? `R$ ${form.price_value}`
                : 'Gratuita'}
            </span>
          </div>
          <div>
            <span className="text-white/60">Experiência:</span>{' '}
            <span className="text-white">{form.experience_level}</span>
          </div>
          <div>
            <span className="text-white/60">Idioma:</span>{' '}
            <span className="text-white">{form.language}</span>
          </div>
        </div>
        {publisherRole === 'announcer' && (
          <div className="pt-2 border-t border-white/10">
            <span className="text-white/60">Publicador:</span>{' '}
            <span className="text-orange-300">Apenas anunciante</span>
            {actualGmName && (
              <>
                {' · '}
                <span className="text-white">Mestre: {actualGmName}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Sessões */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h3 className="text-lg font-bold text-white">Sessões</h3>
        <div className="space-y-2 text-sm">
          {sessions.length > 0 ? (
            sessions.map((session, idx) => (
              <div key={idx} className="p-2 bg-white/5 rounded-lg">
                <span className="text-white">
                  {formatSession(session)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-white/40">Nenhuma sessão configurada</p>
          )}
        </div>
      </div>

      {/* Contatos */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h3 className="text-lg font-bold text-white">Contatos</h3>
        <div className="space-y-2 text-sm">
          {validContacts.length > 0 ? (
            validContacts.map((contact, idx) => (
              <div key={idx} className="p-2 bg-white/5 rounded-lg">
                <span className="text-white/60">{contact.channel}:</span>{' '}
                <span className="text-white">{contact.value}</span>
                {contact.label && (
                  <span className="text-white/40 ml-2">({contact.label})</span>
                )}
              </div>
            ))
          ) : (
            <p className="text-white/40">Nenhum contato configurado</p>
          )}
        </div>
      </div>

      {/* Detalhes */}
      {(rulesNotes || bannerUrl) && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h3 className="text-lg font-bold text-white">Detalhes Adicionais</h3>
          <div className="space-y-2 text-sm">
            {rulesNotes && (
              <div>
                <span className="text-white/60">Regras/Observações:</span>{' '}
                <span className="text-white">{rulesNotes}</span>
              </div>
            )}
            {bannerUrl && (
              <div>
                <span className="text-white/60">Banner:</span>{' '}
                <span className="text-white">✓ Configurado</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
