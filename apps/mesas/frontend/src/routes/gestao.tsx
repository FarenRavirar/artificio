import { ProtectedRoute } from '../components/ProtectedRoute';
import { GestaoLayout } from '../features/admin/components/GestaoLayout';

export default function Gestao() {
  return (
    <ProtectedRoute requiredRole="admin">
      <GestaoLayout />
    </ProtectedRoute>
  );
}
