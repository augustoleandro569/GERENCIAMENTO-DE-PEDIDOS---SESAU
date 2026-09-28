import { useState, useEffect } from 'react';
import { store } from '../services/store';

export function useStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setTick(t => t + 1);
    });
    return unsubscribe;
  }, []);

  return {
    orders: store.getOrders(),
    schedules: store.getSchedules(),
    units: store.getUnits(),
    programs: store.getPrograms(),
    orderTypes: store.getOrderTypes(),
    importRecords: store.getImportRecords(),
    auditLogs: store.getAuditLogs(),
    currentUser: store.getCurrentUser(),
    settings: store.getSettings(),
    // Actions
    addOrder: store.addOrder.bind(store),
    updateOrder: store.updateOrder.bind(store),
    updateOperationalStatus: store.updateOperationalStatus.bind(store),
    processImport: store.processImport.bind(store),
    addSchedule: store.addSchedule.bind(store),
    addSchedules: store.addSchedules.bind(store),
    updateSchedule: store.updateSchedule.bind(store),
    deleteSchedule: store.deleteSchedule.bind(store),
    runAutoLinking: store.runAutoLinking.bind(store),
    addUnit: store.addUnit.bind(store),
    updateUnit: store.updateUnit.bind(store),
    setCurrentUser: store.setCurrentUser.bind(store),
    updateSettings: store.updateSettings.bind(store),
    resetToDefault: store.resetToDefault.bind(store),
  };
}
