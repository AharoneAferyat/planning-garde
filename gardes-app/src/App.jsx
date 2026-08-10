import { Routes, Route } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import TopBar from './components/TopBar';
import Home from './components/Home';
import PlanningView from './components/PlanningView';
import InternesManager from './components/InternesManager';

export default function App() {
  const { loading } = useAuth();
  if (loading) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }
  return (
    <div className="app">
      <TopBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/semestre/:id" element={<PlanningView />} />
        <Route path="/internes" element={<InternesManager />} />
      </Routes>
    </div>
  );
}
