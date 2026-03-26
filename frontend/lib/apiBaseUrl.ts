const DEFAULT_LOCAL_API_URL = 'http://localhost:8787';
const DEFAULT_WORKERS_API_URL = 'https://fairlens-api-worker.dpratik3005.workers.dev';

const normalizeUrl = (value: string | undefined): string => {
  if (!value) {
    return '';
  }
  return value.trim().replace(/\/$/, '');
};

export const resolveApiBaseUrl = (): string => {
  const envUrl = normalizeUrl(process.env.NEXT_PUBLIC_API_URL);
  if (envUrl) {
    return envUrl;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.endsWith('.workers.dev')) {
      return DEFAULT_WORKERS_API_URL;
    }
  }

  return DEFAULT_LOCAL_API_URL;
};
