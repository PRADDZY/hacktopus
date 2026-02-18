import assert from 'node:assert/strict';
import { getDashboardMode, setDashboardMode } from '../../lib/dashboardMode';

const createLocalStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
};

export const run = () => {
  const originalWindow = globalThis.window;
  const originalCustomEvent = globalThis.CustomEvent;

  const setup = () => {
    const localStorage = createLocalStorage();

    globalThis.CustomEvent = class CustomEvent {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    } as unknown as typeof CustomEvent;

    globalThis.window = {
      localStorage,
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as Window & typeof globalThis;
  };

  const teardown = () => {
    globalThis.window = originalWindow;
    globalThis.CustomEvent = originalCustomEvent;
  };

  const runCase = (fn: () => void) => {
    setup();
    try {
      fn();
    } finally {
      teardown();
    }
  };

  runCase(() => {
    assert.equal(getDashboardMode(), 'live');
  });

  runCase(() => {
    setDashboardMode('demo');
    assert.equal(getDashboardMode(), 'demo');
  });

  runCase(() => {
    setDashboardMode('demo');
    setDashboardMode('live');
    assert.equal(getDashboardMode(), 'live');
  });
};
