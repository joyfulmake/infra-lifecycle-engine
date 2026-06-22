import { firebaseConfig, FIREBASE_CONFIGURED } from './firebaseConfig.js';

export { FIREBASE_CONFIGURED };

// Lazy singleton — only init when first used and when configured
let _app = null;
let _db = null;
let _auth = null;

async function getApp() {
  if (!FIREBASE_CONFIGURED) return null;
  if (_app) return _app;
  const { initializeApp } = await import('firebase/app');
  _app = initializeApp(firebaseConfig);
  return _app;
}

async function getDb() {
  if (!FIREBASE_CONFIGURED) return null;
  if (_db) return _db;
  const app = await getApp();
  const { getFirestore } = await import('firebase/firestore');
  _db = getFirestore(app);
  return _db;
}

async function getAuthInstance() {
  if (!FIREBASE_CONFIGURED) return null;
  if (_auth) return _auth;
  const app = await getApp();
  const { getAuth } = await import('firebase/auth');
  _auth = getAuth(app);
  return _auth;
}

// ── Firebase Auth ─────────────────────────────────────────────────────────────

// Signs in (or creates) a Firebase account for the given email + sync password.
// The sync password is user-chosen and stored locally for silent re-auth.
export async function fbSignIn(email, syncPassword) {
  if (!FIREBASE_CONFIGURED) return null;
  const auth = await getAuthInstance();
  const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
  try {
    const cred = await signInWithEmailAndPassword(auth, email, syncPassword);
    return cred.user;
  } catch (e) {
    if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-email') {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, syncPassword);
        return cred.user;
      } catch (ce) {
        console.warn('[Firebase Auth] create failed:', ce.message);
        return null;
      }
    }
    console.warn('[Firebase Auth] sign-in failed:', e.message);
    return null;
  }
}

// Google OAuth — one tap sign-in, covers all Google Workspace institutions.
// Returns { email, displayName, photoURL } on success, or null on failure/cancel.
export async function fbSignInWithGoogle() {
  if (!FIREBASE_CONFIGURED) return null;
  const auth = await getAuthInstance();
  if (!auth) return null;
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    return { email: cred.user.email, displayName: cred.user.displayName, photoURL: cred.user.photoURL };
  } catch (e) {
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return null;
    console.warn('[Firebase Auth] Google sign-in failed:', e.message);
    return null;
  }
}

// Microsoft OAuth — covers Azure AD / Entra ID institutions and personal Microsoft accounts.
// Tenant is set to 'common' so both work/school and personal accounts are accepted.
export async function fbSignInWithMicrosoft() {
  if (!FIREBASE_CONFIGURED) return null;
  const auth = await getAuthInstance();
  if (!auth) return null;
  const { OAuthProvider, signInWithPopup } = await import('firebase/auth');
  try {
    const provider = new OAuthProvider('microsoft.com');
    provider.setCustomParameters({ prompt: 'select_account', tenant: 'common' });
    const cred = await signInWithPopup(auth, provider);
    return { email: cred.user.email, displayName: cred.user.displayName, photoURL: cred.user.photoURL };
  } catch (e) {
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return null;
    console.warn('[Firebase Auth] Microsoft sign-in failed:', e.message);
    return null;
  }
}

export async function fbSignOut() {
  if (!FIREBASE_CONFIGURED) return;
  const auth = await getAuthInstance();
  if (!auth) return;
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}

// ── Firestore build CRUD ──────────────────────────────────────────────────────

export async function cloudSaveBuild(email, build) {
  if (!FIREBASE_CONFIGURED) return;
  const db = await getDb();
  if (!db) return;
  const { doc, setDoc } = await import('firebase/firestore');
  try {
    await setDoc(doc(db, 'users', email, 'builds', build.id), build);
  } catch (e) {
    console.warn('[Firestore] save failed:', e.message);
  }
}

export async function cloudLoadBuilds(email) {
  if (!FIREBASE_CONFIGURED) return [];
  const db = await getDb();
  if (!db) return [];
  const { collection, getDocs } = await import('firebase/firestore');
  try {
    const snap = await getDocs(collection(db, 'users', email, 'builds'));
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.warn('[Firestore] load failed:', e.message);
    return [];
  }
}

export async function cloudDeleteBuild(email, id) {
  if (!FIREBASE_CONFIGURED) return;
  const db = await getDb();
  if (!db) return;
  const { doc, deleteDoc } = await import('firebase/firestore');
  try {
    await deleteDoc(doc(db, 'users', email, 'builds', id));
  } catch (e) {
    console.warn('[Firestore] delete failed:', e.message);
  }
}

// ── Subscription (written by Stripe Worker webhook) ───────────────────────

export async function getSubscription(email) {
  if (!FIREBASE_CONFIGURED) return null;
  const db = await getDb();
  if (!db) return null;
  const { doc, getDoc } = await import('firebase/firestore');
  try {
    const snap = await getDoc(doc(db, 'users', email, 'subscription', 'active'));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

export { getDb };
