import { ProtectedRoute } from '../components/ProtectedRoute';
import { PainelMestrePage } from '../pages/PainelMestrePage';

export default function Route() {
  return (
    <ProtectedRoute>
      <PainelMestrePage />
    </ProtectedRoute>
  );
}
