// ─────────────────────────────────────────────────────────────────────────────
// Firebase project config — fill in after creating your Firebase project.
//
// Setup steps:
//   1. https://console.firebase.google.com → Create / select project
//   2. Project Settings → Your apps → Add Web app → copy config below
//   3. Authentication → Sign-in method → Enable "Email/Password"
//   4. Firestore Database → Create database (production mode)
//   5. Firestore → Rules → paste the rules from CLAUDE.md (Firestore section)
//   6. Set FIREBASE_CONFIGURED = true
//
// Firebase client config keys are NOT secret — they identify the project.
// Security is enforced by Firestore Security Rules, not by keeping these private.
// ─────────────────────────────────────────────────────────────────────────────

export const firebaseConfig = {
  apiKey: "AIzaSyCahdYLnRZbt9kPEB2ie3UC2IqC5Yr_rAo",
  authDomain: "opsmanifest-d363a.firebaseapp.com",
  projectId: "opsmanifest-d363a",
  storageBucket: "opsmanifest-d363a.firebasestorage.app",
  messagingSenderId: "1046131210161",
  appId: "1:1046131210161:web:0470595b79dfae77dd6f90",
  measurementId: "G-6EB50CGTXJ"
};


export const FIREBASE_CONFIGURED = true;
