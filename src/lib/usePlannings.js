import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { watchMyPlannings, watchSharedPlanningIds, watchPlanning } from '../lib/firebase';

// Retourne { mine, shared, loading } où mine/shared sont des tableaux de plannings.
export function usePlannings() {
  const { user } = useAuth();
  const [mine, setMine] = useState([]);
  const [sharedIds, setSharedIds] = useState([]); // [{planningId, role}]
  const [sharedDocs, setSharedDocs] = useState({}); // id -> planning
  const [loadingMine, setLoadingMine] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    return watchMyPlannings(user.email, (list) => {
      setMine(list);
      setLoadingMine(false);
    });
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    return watchSharedPlanningIds(user.email, setSharedIds);
  }, [user?.email]);

  // Pour chaque planning partagé, on écoute le doc (en excluant ceux dont je suis owner)
  useEffect(() => {
    const unsubs = [];
    const ownIds = new Set(mine.map((p) => p.id));
    sharedIds.forEach(({ planningId, role }) => {
      if (ownIds.has(planningId)) return;
      const u = watchPlanning(planningId, (p) => {
        setSharedDocs((prev) => {
          if (!p) { const c = { ...prev }; delete c[planningId]; return c; }
          return { ...prev, [planningId]: { ...p, myRole: role } };
        });
      });
      unsubs.push(u);
    });
    return () => unsubs.forEach((u) => u && u());
  }, [sharedIds, mine]);

  const shared = Object.values(sharedDocs);
  return { mine, shared, loading: loadingMine };
}
