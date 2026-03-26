// All Supabase operations must go through backend API endpoints for security.
// Remove all direct Supabase client usage from frontend.

// Example: Use fetch(API_URL + '/api/auth/login', ...) for login, signup, etc.

// If you need to call Supabase, do it in the backend only.

// Only add AppState listener on native platforms or in browser
if (isBrowser && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
} else if (isBrowser && Platform.OS === 'web') {
  // On web, always keep auto refresh running
  supabase.auth.startAutoRefresh();
}
