const DEFAULT_API_URL = 'https://g000st.com/api/v1';

function normalizeBaseUrl(value: string | undefined): string {
  const candidate = value?.trim() || DEFAULT_API_URL;
  return candidate.replace(/\/+$/, '');
}

export const env = Object.freeze({
  apiBaseUrl: normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL),
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || undefined,
});
