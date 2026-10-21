import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export function useMetadata() {
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetadata = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [deptRes, projRes, empRes] = await Promise.all([
        api.getDepartments().catch(() => ({ departments: [] })),
        api.getProjects().catch(() => ({ projects: [] })),
        api.getEmployees().catch(() => ({ employees: [] }))
      ]);

      setDepartments(deptRes.departments || []);
      setProjects(projRes.projects || []);
      setEmployees(empRes.employees || []);
    } catch (err) {
      console.error('Failed to load metadata:', err);
      setError(err.message || 'Failed to load metadata');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  return {
    departments,
    projects,
    employees,
    loading,
    error,
    refreshMetadata: fetchMetadata
  };
}
