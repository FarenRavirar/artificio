import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SobreEUsoPage } from './SobreEUsoPage';

// T10.3 (spec 084) — página institucional real (não placeholder), cobre
// D119 (só português) e transparência do scraper.


function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/sobre-e-uso']}>
      <SobreEUsoPage />
    </MemoryRouter>,
  );
}

describe('SobreEUsoPage', () => {
  it('renderiza conteúdo real cobrindo D119 (só português)', () => {
    renderPage();

    expect(screen.getByText('Sobre e uso do Artifício Downloads')).toBeInTheDocument();
    expect(screen.getByText(/apenas materiais de RPG em português/i)).toBeInTheDocument();
  });

  it('menciona transparência do scraper/indexação automática', () => {
    renderPage();

    expect(screen.getByText(/Indexação automática/i)).toBeInTheDocument();
    expect(screen.getByText(/nunca armazena cópia de arquivo/i)).toBeInTheDocument();
  });

  // T9.7g (spec 089) — a política de denúncia já afirmou comportamento que o
  // backend não tinha duas vezes: o canal inexistente (corrigido na T9.7g) e a
  // unicidade vitalícia (achado Codex P2, PR #230), que os índices parciais da
  // migration 036 não impõem. Este teste trava a descrição no que o código faz.
  it('descreve a denúncia como o backend a executa, sem prometer unicidade vitalícia', () => {
    renderPage();

    expect(screen.getByText(/uma denúncia em análise por alvo/i)).toBeInTheDocument();
    expect(screen.getByText(/pode denunciar de novo se o problema voltar/i)).toBeInTheDocument();
    expect(screen.queryByText(/denunciar uma vez o mesmo alvo/i)).not.toBeInTheDocument();
  });
});
