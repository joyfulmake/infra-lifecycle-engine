import Dexie from 'dexie';

// IndexedDB database — local storage for all plan tiers.
// Pro+ users get Firestore cloud sync on top of this (see firebase.js).
export const db = new Dexie('OpsManifest');

db.version(1).stores({
  // builds: all saved build snapshots
  // id is the build's own id field (not auto-increment) so Firestore and local stay in sync
  builds: 'id, name, email, updatedAt',
});

// ── Helper: get all builds for a given email (local) ─────────────────────────
export async function localGetBuilds(email) {
  if (!email) return db.builds.toArray();
  return db.builds.where('email').equals(email).toArray();
}

export async function localSaveBuild(build) {
  await db.builds.put({ ...build, updatedAt: Date.now() });
}

export async function localDeleteBuild(id) {
  await db.builds.delete(id);
}
