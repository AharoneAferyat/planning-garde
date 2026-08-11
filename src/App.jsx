import { Routes, Route } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AuthGate from './components/AuthGate';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PlanningsList from './components/PlanningsList';
import PlanningView from './components/PlanningView';
import Invitations from './components/Invitations';
import JoinPage from './components/JoinPage';

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
      </Routes>
    </Layout>
  );
}
