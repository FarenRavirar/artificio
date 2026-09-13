import { ProtectedRoute } from '../components/ProtectedRoute';
import { OnboardingPage } from '../pages/OnboardingPage';

export default function Route() {
  return (
    <ProtectedRoute>
      <OnboardingPage />
    </ProtectedRoute>
  );
}
