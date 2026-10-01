import { useLayoutEffect, useSyncExternalStore } from "react";

let activeModalCount = 0;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return activeModalCount > 0;
}

export function useWindowModalActive() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function useWindowModalState() {
  useLayoutEffect(() => {
    activeModalCount += 1;
    if (activeModalCount === 1) {
      window.desktop.setWindowModalActive(true);
      notifyListeners();
    }

    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount === 0) {
        window.desktop.setWindowModalActive(false);
        notifyListeners();
      }
    };
  }, []);
}
