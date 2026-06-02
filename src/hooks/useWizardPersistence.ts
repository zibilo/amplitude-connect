import { useEffect, useRef, useState } from 'react';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';

const STORE_KEY = 'import_wizard_state_v1';
const FILE_KEY = 'import_wizard_file_v1';
const DEBOUNCE_MS = 400;

export interface PersistedFile {
  name: string;
  type: string;
  lastModified: number;
  buffer: ArrayBuffer;
}

/**
 * Persists arbitrary wizard state in IndexedDB with debounced writes.
 * Survives navigation, reload, and browser restart. Per-user scoping via
 * the provided `userId` keeps multi-user sessions isolated on shared devices.
 */
export function useWizardPersistence<T extends Record<string, unknown>>(
  userId: string | null | undefined,
  state: T,
  onHydrate: (saved: Partial<T>) => void,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;
  const [hydrated, setHydrated] = useState(false);
  const onHydrateRef = useRef(onHydrate);
  onHydrateRef.current = onHydrate;
  const scope = userId || 'anon';
  const storeKey = `${STORE_KEY}:${scope}`;

  // Hydrate once on mount (or when user changes).
  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setHydrated(true);
      return;
    }
    (async () => {
      try {
        const saved = await idbGet<Partial<T>>(storeKey);
        if (!cancelled && saved && typeof saved === 'object') {
          onHydrateRef.current(saved);
        }
      } catch (err) {
        console.warn('[wizard-persist] hydrate failed', err);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeKey, enabled]);

  // Debounced persist on any state change after hydration.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!enabled || !hydrated) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      idbSet(storeKey, state).catch((err) =>
        console.warn('[wizard-persist] save failed', err),
      );
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state, storeKey, hydrated, enabled]);

  // Flush on unload so nothing is lost if user closes the tab quickly.
  useEffect(() => {
    if (!enabled) return;
    const flush = () => {
      try {
        idbSet(storeKey, state);
      } catch {
        // ignore
      }
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [state, storeKey, enabled]);

  const clear = async () => {
    try {
      await Promise.all([idbDel(storeKey), idbDel(`${FILE_KEY}:${scope}`)]);
    } catch (err) {
      console.warn('[wizard-persist] clear failed', err);
    }
  };

  return { hydrated, clear, scope };
}

/** Save a File (Excel upload) so it can be restored after navigation. */
export async function persistWizardFile(scope: string, file: File | null) {
  const key = `${FILE_KEY}:${scope}`;
  try {
    if (!file) {
      await idbDel(key);
      return;
    }
    const buffer = await file.arrayBuffer();
    const payload: PersistedFile = {
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      buffer,
    };
    await idbSet(key, payload);
  } catch (err) {
    console.warn('[wizard-persist] persistFile failed', err);
  }
}

/** Restore a previously persisted File as a real `File` instance. */
export async function loadWizardFile(scope: string): Promise<File | null> {
  const key = `${FILE_KEY}:${scope}`;
  try {
    const saved = await idbGet<PersistedFile>(key);
    if (!saved) return null;
    return new File([saved.buffer], saved.name, {
      type: saved.type,
      lastModified: saved.lastModified,
    });
  } catch (err) {
    console.warn('[wizard-persist] loadFile failed', err);
    return null;
  }
}