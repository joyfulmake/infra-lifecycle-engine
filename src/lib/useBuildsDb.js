import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, localSaveBuild, localDeleteBuild } from './db.js';
import { canUseFeature } from './auth.js';
import { FIREBASE_CONFIGURED, cloudSaveBuild, cloudLoadBuilds, cloudDeleteBuild } from './firebase.js';
import { getOrgForEmail, orgLoadBuilds, orgSaveBuild, orgDeleteBuild } from './orgDb.js';

// Returns true if this user's plan allows cloud sync AND Firebase is configured.
function canSync(authUser) {
  return FIREBASE_CONFIGURED && canUseFeature(authUser, 'save_builds') && !!authUser?.email;
}
function isTeam(authUser) {
  return FIREBASE_CONFIGURED && ['team', 'enterprise'].includes(authUser?.plan) && !!authUser?.email;
}

export function useBuildsDb(authUser) {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [org, setOrg] = useState(null);         // current user's org doc
  const [orgBuilds, setOrgBuilds] = useState([]); // shared org builds

  // Live reactive query from IndexedDB — personal builds
  const localBuilds = useLiveQuery(
    () => db.builds.orderBy('updatedAt').reverse().toArray(),
    [],
    []
  );

  // Sync personal builds from Firestore to local IndexedDB on sign-in
  useEffect(() => {
    if (!canSync(authUser)) return;
    let cancelled = false;
    async function pull() {
      setSyncing(true);
      setSyncError(null);
      try {
        const cloudBuilds = await cloudLoadBuilds(authUser.email);
        for (const cb of cloudBuilds) {
          const local = await db.builds.get(cb.id);
          if (!local || (cb.updatedAt || 0) > (local.updatedAt || 0)) {
            if (!cancelled) await db.builds.put(cb);
          }
        }
        if (!cancelled) setLastSync(Date.now());
      } catch (e) {
        if (!cancelled) setSyncError(e.message);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    }
    pull();
    return () => { cancelled = true; };
  }, [authUser?.email]);

  // Load org metadata + shared builds for Team+ users
  useEffect(() => {
    if (!isTeam(authUser)) { setOrg(null); setOrgBuilds([]); return; }
    let cancelled = false;
    async function pullOrg() {
      try {
        const orgDoc = await getOrgForEmail(authUser.email);
        if (cancelled) return;
        setOrg(orgDoc);
        if (orgDoc) {
          const shared = await orgLoadBuilds(orgDoc.id);
          if (!cancelled) setOrgBuilds(shared);
        }
      } catch {
        // org fetch is best-effort
      }
    }
    pullOrg();
    return () => { cancelled = true; };
  }, [authUser?.email, authUser?.plan]);

  // Merge personal + org builds, deduplicating by ID (org version wins if both exist)
  const builds = (() => {
    const personal = localBuilds ?? [];
    if (!orgBuilds.length) return personal;
    const orgIds = new Set(orgBuilds.map(b => b.id));
    return [
      ...orgBuilds,
      ...personal.filter(b => !orgIds.has(b.id)),
    ];
  })();

  const saveBuild = useCallback(async (build) => {
    const record = { ...build, updatedAt: Date.now() };
    // If build is a shared org build, save to org collection
    if (record._shared && org) {
      await orgSaveBuild(org.id, record);
      setOrgBuilds(prev => {
        const filtered = prev.filter(b => b.id !== record.id);
        return [record, ...filtered];
      });
      return;
    }
    await localSaveBuild(record);
    if (canSync(authUser)) cloudSaveBuild(authUser.email, record);
  }, [authUser, org]);

  const deleteBuild = useCallback(async (id) => {
    const isShared = orgBuilds.some(b => b.id === id);
    if (isShared && org) {
      await orgDeleteBuild(org.id, id);
      setOrgBuilds(prev => prev.filter(b => b.id !== id));
      return;
    }
    await localDeleteBuild(id);
    if (canSync(authUser)) cloudDeleteBuild(authUser.email, id);
  }, [authUser, org, orgBuilds]);

  // Share a personal build to the team org collection
  const shareToTeam = useCallback(async (build) => {
    if (!org) throw new Error('No org — create or join a team first');
    const shared = { ...build, _shared: true, sharedBy: authUser.email, updatedAt: Date.now() };
    await orgSaveBuild(org.id, shared);
    setOrgBuilds(prev => {
      const filtered = prev.filter(b => b.id !== shared.id);
      return [shared, ...filtered];
    });
  }, [org, authUser]);

  const pushAllToCloud = useCallback(async () => {
    if (!canSync(authUser)) return;
    setSyncing(true);
    try {
      const all = await db.builds.toArray();
      await Promise.all(all.map(b => cloudSaveBuild(authUser.email, b)));
      setLastSync(Date.now());
    } catch (e) {
      setSyncError(e.message);
    } finally {
      setSyncing(false);
    }
  }, [authUser]);

  return {
    builds,
    saveBuild,
    deleteBuild,
    shareToTeam,
    pushAllToCloud,
    org,
    setOrg,
    orgBuilds,
    syncing,
    syncError,
    lastSync,
    cloudEnabled: canSync(authUser),
    teamEnabled: isTeam(authUser),
  };
}
