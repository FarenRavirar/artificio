import { ProtectedRoute } from '../components/ProtectedRoute';
import { MinhasSugestoesPage } from '../pages/MinhasSugestoesPage';

export default function Route() {
  return (
    <ProtectedRoute>
      <MinhasSugestoesPage />
    </ProtectedRoute>
  );
}
