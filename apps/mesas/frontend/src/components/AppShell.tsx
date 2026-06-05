import type { ReactNode } from 'react';
import { Footer, Header } from '@artificio/ui';
import { FeedbackButton } from '../features/dev-feedback/FeedbackButton';
import { getMesasPublicOrigin } from '../utils/auth';

interface AppShellProps {
  children: ReactNode;
}

export const AppShell = ({ children }: AppShellProps) => {
  const publicOrigin = getMesasPublicOrigin();

  return (
    <div className="min-h-screen bg-[var(--color-artificio-blue)] text-white flex flex-col">
      <Header variant="dark" brandHref={publicOrigin} currentHref={publicOrigin} />
      <div className="flex-1 pt-6">
        {children}
      </div>
      <Footer variant="dark" />
      <FeedbackButton />
    </div>
  );
};
