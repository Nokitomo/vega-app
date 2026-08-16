export const hasStreamRequestHeaders = (stream?: {
  headers?: Record<string, unknown>;
}): boolean => {
  if (!stream?.headers || typeof stream.headers !== 'object') {
    return false;
  }
  return Object.entries(stream.headers).some(
    ([key, value]) => key.trim().length > 0 && value != null && value !== '',
  );
};
