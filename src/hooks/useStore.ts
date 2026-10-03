import { useState, useEffect } from 'react';
import { store } from '../services/store';
import { dbSync } from '../services/dbSync';

export function useStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsubStore = store.subscribe(() => {
      setTick(t => t + 1);
    });
    const unsubDb = dbSync.subscribeStatus(() => {
      setTick(t => t + 1);
    });
    return () => {
      unsubStore();
      unsubDb();
    };
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
    dbStatus: store.getDatabaseStatus(),
    // Actions
    addOrder: store.addOrder.bind(store),
    updateOrder: store.updateOrder.bind(store),
    updateOperationalStatus: store.updateOperationalStatus.bind(store),
    processImport: store.processImport.bind(store),
    recordFailedImport: store.recordFailedImport.bind(store),
    addSchedule: store.addSchedule.bind(store),
    addSchedules: store.addSchedules.bind(store),
    updateSchedule: store.updateSchedule.bind(store),
    deleteSchedule: store.deleteSchedule.bind(store),
    runAutoLinking: store.runAutoLinking.bind(store),
    addUnit: store.addUnit.bind(store),
    updateUnit: store.updateUnit.bind(store),
    deleteUnit: store.deleteUnit.bind(store),
    setCurrentUser: store.setCurrentUser.bind(store),
    updateSettings: store.updateSettings.bind(store),
    resetToDefault: store.resetToDefault.bind(store),
    reloadStrictFromBackend: store.reloadStrictFromBackend.bind(store),
    syncAllToSupabase: store.syncAllToSupabase.bind(store),
    syncAllFromSupabase: store.syncAllFromSupabase.bind(store),
    unlinkOrdersOfDay: store.unlinkOrdersOfDay.bind(store),
    unlinkOrder: store.unlinkOrder.bind(store),
    cleanDatabase: store.cleanDatabase.bind(store),
    clearDatabaseWithPassword: store.clearDatabaseWithPassword.bind(store),
  };
}
