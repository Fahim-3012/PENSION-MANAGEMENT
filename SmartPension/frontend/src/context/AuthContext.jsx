import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setUnauthorizedHandler, tokenStore } from "../api/client";
import { authApi } from "../api/services";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => logout());
    let active = true;
    (async () => {
      if (!tokenStore.get()) {
        setInitializing(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (active) setUser(me);
      } catch {
        tokenStore.clear();
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => { active = false; };
  }, [logout]);

  const applyAuth = useCallback((res) => {
    tokenStore.set(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const login = useCallback(async (email, password) => applyAuth(await authApi.login({ email, password })), [applyAuth]);
  const register = useCallback(async (payload) => applyAuth(await authApi.register(payload)), [applyAuth]);
  const refresh = useCallback(async () => {
    const me = await authApi.me();
    setUser(me);
    return me;
  }, []);

  const value = useMemo(() => {
    const roles = user?.roles || [];
    return {
      user,
      initializing,
      isAuthenticated: !!user,
      isAdmin: roles.includes("Admin") || roles.includes("SuperAdmin"),
      isSuperAdmin: roles.includes("SuperAdmin"),
      isPensioner: roles.includes("Pensioner"),
      login,
      register,
      logout,
      refresh,
    };
  }, [user, initializing, login, register, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Default landing route for a signed-in user. */
export function homeFor(user) {
  const roles = user?.roles || [];
  return roles.includes("Admin") || roles.includes("SuperAdmin") ? "/admin/dashboard" : "/app/dashboard";
}
