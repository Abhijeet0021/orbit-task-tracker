import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const AlertContext = createContext(undefined);

export const AlertProvider = ({ children }) => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refreshAlerts = useCallback(async () => {
    if (!user) {
      setAlerts([]);
      setAlertCount(0);
      return;
    }
    try {
      setLoading(true);
      const res = await api.getOverdueAlerts();
      setAlerts(res.alerts);
      setAlertCount(res.count);
    } catch (err) {
      console.error('Failed to load overdue alerts', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshAlerts();
    const interval = setInterval(refreshAlerts, 60000);
    return () => clearInterval(interval);
  }, [refreshAlerts]);

  const dismissAlert = async (taskId) => {
    await api.dismissAlert(taskId);
    await refreshAlerts();
  };

  return (
    <AlertContext.Provider value={{ alerts, alertCount, loading, refreshAlerts, dismissAlert }}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlerts = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlerts must be used within an AlertProvider');
  }
  return context;
};
