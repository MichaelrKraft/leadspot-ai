'use client';

import { useCallback } from 'react';

const DB_NAME = 'leadspot-workspace';
const STORE_NAME = 'widget-snapshots';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function useWidgetCache(userId: string | null) {
  const saveSnapshot = useCallback(
    async (widgetId: string, data: unknown): Promise<void> => {
      if (!userId) return;
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(
          { data, savedAt: Date.now() },
          `${userId}:${widgetId}`
        );
        await new Promise<void>((res, rej) => {
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
        db.close();
      } catch (e) {
        console.warn('Widget cache save failed:', e);
      }
    },
    [userId]
  );

  const loadSnapshot = useCallback(
    async (widgetId: string): Promise<unknown | null> => {
      if (!userId) return null;
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const result = await new Promise<unknown>((res, rej) => {
          const req = tx.objectStore(STORE_NAME).get(`${userId}:${widgetId}`);
          req.onsuccess = () => res(req.result);
          req.onerror = () => rej(req.error);
        });
        db.close();
        return result;
      } catch {
        return null;
      }
    },
    [userId]
  );

  return { saveSnapshot, loadSnapshot };
}
