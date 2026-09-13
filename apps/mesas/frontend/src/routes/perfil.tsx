import { ProtectedRoute } from '../components/ProtectedRoute';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ProfileProvider } from '../contexts/ProfileContext';
import ProfileEditPage from '../pages/ProfileEditPage';

export default function Perfil() {
  return (
    <ProtectedRoute>
      <ErrorBoundary>
        <ProfileProvider>
          <ProfileEditPage />
        </ProfileProvider>
      </ErrorBoundary>
    </ProtectedRoute>
  );
}
