import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lightbulb } from 'lucide-react';
import { Button } from '@artificio/ui';
import { SuggestionsView } from '../features/suggestions/SuggestionsView';

/**
 * Spec 096 / T4.0k — tela "Minhas sugestões" do mestre.
 *
 * Rota: /perfil/minhas-sugestoes[/:suggestionId]. O backend já emite esse path
 * como action_url das notificações de sugestão (suggestionHelpers.ts:79,
 * systemSuggestionsAdmin.ts:524), então o deep link funciona sem redirects. As
 * notificações em si são Fase 7 (T7.4b) — esta tela só lista e sugere VTT.
 */
export const MinhasSugestoesPage = () => {
  const navigate = useNavigate();
  const { suggestionId } = useParams<{ suggestionId?: string }>();

  return (
    <main className="w-full">
      <div className="container mx-auto px-6 py-10">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate('/painel')}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar ao painel
        </Button>
        <div className="mt-4 mb-8">
          <h1 className="text-3xl font-extrabold inline-flex items-center gap-3">
            <Lightbulb className="w-6 h-6 text-[var(--color-artificio-orange)]" />
            Minhas sugestões
          </h1>
          <p className="text-white/40 mt-1 text-sm">
            Acompanhe o status das suas sugestões de sistemas e cenários e sugira novas
            plataformas de jogo.
          </p>
        </div>
        <SuggestionsView highlightId={suggestionId ?? null} />
      </div>
    </main>
  );
};
