import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SobreEUsoPage } from './SobreEUsoPage';

// T10.3 (spec 084) — página institucional real (não placeholder), cobre
// D119 (só português) e transparência do scraper.

vi.mock('@artificio/ui', () => ({
  Header: () => <div data-testid="header" />,
  Footer: () => <div data-testid="footer" />,
  useTheme: () => ({ theme: 'dark' }),
  useChangelogBadge: () => ({ hasNewUpdate: false, markSeen: () => undefined }),
  CHANGELOG_UPDATE_MARKERS: { downloads: 'test-marker' },
  DynamicChangelogModal: () => null,
}));

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
});
