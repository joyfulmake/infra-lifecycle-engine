import { FIREBASE_CONFIGURED } from './firebaseConfig.js';

// ── Org structure in Firestore ─────────────────────────────────────────────
// organisations/{orgId}/
//   meta: { id, name, ownerEmail, memberEmails: [], inviteCode, createdAt }
//   builds/{buildId}: shared build documents
//
// Firestore security rules for orgs — add to your Firestore Rules:
//
// match /organisations/{orgId} {
//   function isMember() {
//     return request.auth != null &&
//            request.auth.token.email in resource.data.memberEmails;
//   }
//   function isOwner() {
//     return request.auth != null &&
//            request.auth.token.email == resource.data.ownerEmail;
//   }
//   allow read: if isMember() || isOwner();
//   allow create: if request.auth != null;
//   allow update: if isOwner();
//   allow delete: if isOwner();
//   match /builds/{buildId} {
//     allow read, write: if request.auth != null &&
//       request.auth.token.email in
//       get(/databases/$(database)/documents/organisations/$(orgId)).data.memberEmails;
//   }
// }

function makeInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function getDb() {
  if (!FIREBASE_CONFIGURED) return null;
  const { getDb: _getDb } = await import('./firebase.js');
  return _getDb();
}

// Create a new org owned by email; returns the org doc
export async function createOrg(email, orgName) {
  if (!FIREBASE_CONFIGURED) throw new Error('Firebase not configured');
  const db = await getDb();
  if (!db) throw new Error('Firestore unavailable');
  const { doc, setDoc, collection } = await import('firebase/firestore');
  const orgId = 'org_' + Date.now();
  const orgData = {
    id: orgId,
    name: orgName.trim(),
    ownerEmail: email,
    memberEmails: [email],
    inviteCode: makeInviteCode(),
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'organisations', orgId), orgData);
  return orgData;
}

// Join an org by invite code; returns the org doc or null if code not found
export async function joinOrgByCode(email, inviteCode) {
  if (!FIREBASE_CONFIGURED) throw new Error('Firebase not configured');
  const db = await getDb();
  if (!db) throw new Error('Firestore unavailable');
  const { collection, query, where, getDocs, doc, updateDoc, arrayUnion } = await import('firebase/firestore');
  const snap = await getDocs(query(
    collection(db, 'organisations'),
    where('inviteCode', '==', inviteCode.toUpperCase().trim())
  ));
  if (snap.empty) return null;
  const orgDoc = snap.docs[0];
  const orgData = orgDoc.data();
  if (!orgData.memberEmails.includes(email)) {
    await updateDoc(doc(db, 'organisations', orgData.id), {
      memberEmails: arrayUnion(email),
    });
    orgData.memberEmails = [...orgData.memberEmails, email];
  }
  return orgData;
}

// Get the org(s) this email belongs to; returns first match or null
export async function getOrgForEmail(email) {
  if (!FIREBASE_CONFIGURED) return null;
  const db = await getDb();
  if (!db) return null;
  const { collection, query, where, getDocs } = await import('firebase/firestore');
  try {
    const snap = await getDocs(query(
      collection(db, 'organisations'),
      where('memberEmails', 'array-contains', email)
    ));
    if (snap.empty) return null;
    return snap.docs[0].data();
  } catch {
    return null;
  }
}

// Load all builds from org collection
export async function orgLoadBuilds(orgId) {
  if (!FIREBASE_CONFIGURED) return [];
  const db = await getDb();
  if (!db) return [];
  const { collection, getDocs } = await import('firebase/firestore');
  try {
    const snap = await getDocs(collection(db, 'organisations', orgId, 'builds'));
    return snap.docs.map(d => ({ ...d.data(), _shared: true }));
  } catch {
    return [];
  }
}

// Save a build to the org collection (marks it shared)
export async function orgSaveBuild(orgId, build) {
  if (!FIREBASE_CONFIGURED) return;
  const db = await getDb();
  if (!db) return;
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'organisations', orgId, 'builds', build.id), {
    ...build, _shared: true, updatedAt: Date.now(),
  });
}

// Delete a build from the org collection
export async function orgDeleteBuild(orgId, id) {
  if (!FIREBASE_CONFIGURED) return;
  const db = await getDb();
  if (!db) return;
  const { doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'organisations', orgId, 'builds', id));
}
