import { Navigate } from 'react-router-dom';

// Cadastro por email/senha desativado (spec 015): provisionamento é via SSO no
// 1º login Google. Mantido como rota apenas para redirecionar links antigos.
const Register = () => <Navigate to="/login" replace />;

export default Register;
