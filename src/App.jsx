import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AuthGate from './components/AuthGate';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PlanningsList from './components/PlanningsList';
import PlanningView from './components/PlanningView';
import Invitations from './components/Invitations';
import JoinPage from './components/JoinPage';
import AdminPage from './components/AdminPage';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <AuthGate />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/plannings" element={<PlanningsList />} />
        <Route path="/planning/:id" element={<PlanningView />} />
        <Route path="/invitations" element={<Invitations />} />
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/admin" element={<AdminPage />} />
        {/* Toute URL inconnue ramène au tableau de bord (évite l'écran vide) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
