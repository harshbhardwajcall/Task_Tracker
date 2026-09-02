import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getActiveUserId, setActiveUserId } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadUserProfile = async (userId, fallbackUsers = []) => {
    try {
      setLoading(true);
      let targetId = userId;
      let res = null;

      try {
        if (targetId) {
          res = await api.getUserProfile(targetId);
        }
      } catch (e) {
        console.warn(`User profile ID ${targetId} unavailable, switching to available manager...`);
      }

      // If requested user not found, fall back to first manager or first user
      if (!res || !res.user) {
        let usersList = fallbackUsers.length > 0 ? fallbackUsers : availableUsers;
        if (usersList.length === 0) {
          const fetched = await api.getUsers();
          usersList = fetched.users || [];
          setAvailableUsers(usersList);
        }

        const fallback = usersList.find(u => u.role === 'Manager') || usersList[0];
        if (fallback) {
          res = await api.getUserProfile(fallback.id);
        }
      }

      if (res && res.user) {
        setUser(res.user);
        setActiveUserId(res.user.id);
      }
    } catch (err) {
      console.error('Failed loading active user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const usersRes = await api.getUsers();
        const usersList = usersRes.users || [];
        setAvailableUsers(usersList);
        const activeId = getActiveUserId();
        await loadUserProfile(activeId, usersList);
      } catch (err) {
        console.error('Initialization error:', err);
        setLoading(false);
      }
    }
    init();
  }, []);

  const refreshUsers = async () => {
    try {
      const usersRes = await api.getUsers();
      setAvailableUsers(usersRes.users || []);
    } catch (err) {
      console.error('Failed refreshing user profiles:', err);
    }
  };

  const switchProfile = async (userId) => {
    await loadUserProfile(userId);
  };

  return (
    <AuthContext.Provider value={{ user, availableUsers, switchProfile, refreshUsers, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
