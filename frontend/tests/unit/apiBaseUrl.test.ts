import assert from 'node:assert/strict';
import { resolveApiBaseUrl } from '../../lib/apiBaseUrl';

const clearEnvApiUrl = () => {
  delete process.env.NEXT_PUBLIC_API_URL;
};

const deleteWindow = () => {
  delete (globalThis as { window?: unknown }).window;
};

export const run = async () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalWindow = (globalThis as { window?: unknown }).window;

  try {
    process.env.NEXT_PUBLIC_API_URL = 'https://custom-api.example.com/';
    assert.equal(resolveApiBaseUrl(), 'https://custom-api.example.com');

    clearEnvApiUrl();
    (globalThis as { window?: unknown }).window = {
      location: {
        hostname: 'fairlens-frontend.dpratik3005.workers.dev',
      },
    };
    assert.equal(resolveApiBaseUrl(), 'https://fairlens-api-worker.dpratik3005.workers.dev');

    deleteWindow();
    assert.equal(resolveApiBaseUrl(), 'http://localhost:8787');
  } finally {
    if (typeof originalApiUrl === 'string') {
      process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    } else {
      clearEnvApiUrl();
    }

    if (originalWindow === undefined) {
      deleteWindow();
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  }
};
