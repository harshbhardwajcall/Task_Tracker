import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export function useTasks(initialFilters = {}, refreshDependency = 0) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);

  const fetchTasks = useCallback(async (currentFilters = filters) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getTasks(currentFilters);
      setTasks(res.tasks || []);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTasks(filters);
  }, [fetchTasks, refreshDependency, filters]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  return {
    tasks,
    loading,
    error,
    filters,
    setFilters,
    updateFilters,
    refetch: fetchTasks
  };
}
