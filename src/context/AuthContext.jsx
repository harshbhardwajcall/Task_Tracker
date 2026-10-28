import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getActiveUserId, setActiveUserId, setAuthToken, clearAuth } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadUserProfile = async (userId) => {
    if (!userId) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await api.getUserProfile(userId);
      if (res && res.user) {
        setUser(res.user);
        setActiveUserId(res.user.id);
      } else {
        setUser(null);
        clearAuth();
      }
    } catch (err) {
      console.warn('Session user profile unavailable:', err);
      setUser(null);
      clearAuth();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const usersRes = await api.getUsers().catch(() => ({ users: [] }));
        const usersList = usersRes.users || [];
        setAvailableUsers(usersList);

        const activeId = getActiveUserId();
        if (activeId) {
          await loadUserProfile(activeId);
        } else {
          setUser(null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Initialization error:', err);
        setLoading(false);
      }
    }
    init();
  }, []);

  const login = async (email, password, role) => {
    const res = await api.login({ email, password, role });
    if (res && res.user) {
      setUser(res.user);
      setActiveUserId(res.user.id);
      if (res.token) {
        setAuthToken(res.token);
      }
      await refreshUsers();
      return res.user;
    } else {
      throw new Error('Invalid login response from server.');
    }
  };

  const logout = () => {
    clearAuth();
    setUser(null);
  };

  const refreshUsers = async () => {
    try {
      const usersRes = await api.getUsers();
      setAvailableUsers(usersRes.users || []);
    } catch (err) {
      console.error('Failed refreshing user profiles:', err);
    }
  };

  const refreshCurrentUser = async () => {
    if (user?.id) {
      await loadUserProfile(user.id);
    }
  };

  const updateCurrentUser = (partial) => {
    setUser(prev => (prev ? { ...prev, ...partial } : prev));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        availableUsers,
        login,
        logout,
        refreshUsers,
        refreshCurrentUser,
        updateCurrentUser,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
