import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { checkAccess } from './lib/firebase';
import AuthGate from './components/AuthGate';
import AccessGate from './components/AccessGate';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PlanningsList from './components/PlanningsList';
import PlanningView from './components/PlanningView';
import Invitations from './components/Invitations';
import JoinPage from './components/JoinPage';
import AdminPage from './components/AdminPage';

export default function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [access, setAccess] = useState(undefined); // undefined = en cours, true/false ensuite

  // Vérifie l'autorisation à chaque changement d'utilisateur.
  useEffect(() => {
    let alive = true;
    if (!user) { setAccess(undefined); return; }
    setAccess(undefined);
    checkAccess(user.email).then((ok) => { if (alive) setAccess(ok); });
    return () => { alive = false; };
  }, [user]);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <AuthGate />;

  // On laisse toujours passer un lien d'invitation /join/CODE (c'est le moyen d'entrer).
  const isJoinLink = location.pathname.startsWith('/join/');

  // Vérification d'accès en cours
  if (access === undefined && !isJoinLink) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }

  // Email non autorisé (et pas en train de suivre un lien d'invitation) → AccessGate
  if (access === false && !isJoinLink) {
    return (
      <AccessGate onJoined={() => {
        setAccess(true);
        navigate('/');
      }} />
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/plannings" element={<PlanningsList />} />
        <Route path="/planning/:id" element={<PlanningView />} />
        <Route path="/invitations" element={<Invitations />} />
        <Route path="/join/:code" element={<JoinPage onJoined={() => setAccess(true)} />} />
        <Route path="/admin" element={<AdminPage />} />
        {/* Toute URL inconnue ramène au tableau de bord (évite l'écran vide) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
