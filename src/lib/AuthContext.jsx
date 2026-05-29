import { createContext, useContext, useState, useEffect } from 'react';
import { getAuthUser, trySilentFirebaseAuth } from './auth.js';
import { FIREBASE_CONFIGURED } from './firebase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(() => getAuthUser());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(false);

  // On mount: silent Firebase re-auth for Pro+ users with stored sync password
  useEffect(() => {
    async function silentAuth() {
      if (authUser && FIREBASE_CONFIGURED) {
        await trySilentFirebaseAuth(authUser);
      }
      setFirebaseReady(true);
    }
    silentAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ authUser, setAuthUser, showAuthModal, setShowAuthModal, firebaseReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
