import React, { createContext, useEffect, useRef, useState } from "react";
import { apiUrl } from "../utils/apiBase";
import { csrfHeaders, setCsrfToken } from "../utils/api";

let sessionRequest;

function restoreSession() {
  if (!sessionRequest) {
    sessionRequest = (async () => {
      const response = await fetch(apiUrl('/api/auth/session'), { credentials: 'include' });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        if (response.status === 500 && contentType.startsWith('text/plain')) {
          throw new Error('Vite could not reach the Flask API at http://127.0.0.1:5000. Start Flask with `python -m backend.app`.');
        }
        throw new Error(`The API returned HTTP ${response.status} without a JSON response.`);
      }
      const result = await response.json();
      setCsrfToken(result.csrf_token);
      if (response.status === 401 || response.status === 422) {
        const clearResponse = await fetch(apiUrl('/api/auth/logout'), {
          method: 'POST',
          credentials: 'include',
          headers: csrfHeaders('POST'),
        });
        if (!clearResponse.ok) throw new Error('Could not clear the expired session. Please refresh and try again.');
        setCsrfToken(null);
        return null;
      }
      if (!response.ok) throw new Error(result.error || 'Could not restore your session.');
      return result.user || null;
    })().finally(() => {
      sessionRequest = null;
    });
  }
  return sessionRequest;
}

export const AuthContext = createContext({
  user: null,
  setUser: () => {},
  authError: null,
  authLoading: true,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const authChannel = useRef(null);

  useEffect(() => {
    let active = true;
    const refreshSession = async () => {
      try {
        const profile = await restoreSession();
        if (active) {
          setUser(profile);
          setAuthError(null);
        }
      } catch (error) {
        if (active) setAuthError(error.message);
      }
    };
    if (typeof BroadcastChannel !== 'undefined') {
      authChannel.current = new BroadcastChannel('student-study-planner-auth');
      authChannel.current.onmessage = refreshSession;
    }
    restoreSession()
      .then((profile) => {
        if (active) setUser(profile);
      })
      .catch((error) => {
        if (active) setAuthError(error.message);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
      authChannel.current?.close();
      authChannel.current = null;
    };
  }, []);

  const updateUser = (profile) => {
    setUser(profile);
    authChannel.current?.postMessage({ type: 'session-changed' });
  };

  return (
    <AuthContext.Provider value={{ user, setUser: updateUser, authError, authLoading }}>{children}</AuthContext.Provider>
  );
};
