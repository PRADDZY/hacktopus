export const safeJsonParse = <T>(value: string | null): T | null => {
  if (!value) return null;
  if (!value.trim()) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};
