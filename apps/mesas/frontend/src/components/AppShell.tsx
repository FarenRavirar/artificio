import type { ReactNode } from 'react';
import { Footer, Header } from '@artificio/ui';
import { FeedbackButton } from '../features/dev-feedback/FeedbackButton';

interface AppShellProps {
  children: ReactNode;
}

export const AppShell = ({ children }: AppShellProps) => {
  return (
    <div className="min-h-screen bg-[var(--color-artificio-blue)] text-white flex flex-col">
      <Header variant="dark" brandHref="https://mesas.artificiorpg.com" currentHref="https://mesas.artificiorpg.com" />
      <div className="flex-1 pt-6">
        {children}
      </div>
      <Footer />
      <FeedbackButton />
    </div>
  );
};
