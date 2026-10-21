/** Where the /v1 API and sign-in live. Null when not configured: the app then works phone-only. */
export function apiConfig(): { baseUrl: string; supabaseUrl: string; anonKey: string } | null {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;
  return { baseUrl: `${supabaseUrl.replace(/\/$/, '')}/functions/v1/api`, supabaseUrl, anonKey };
}
