// ==================================================
// SLANCAR CONFIGURATION & STORAGE
// ==================================================

const SlancarConfig = {
  // Defaults can be overridden via UI Profile/Settings screen
  SUPABASE_URL: localStorage.getItem('slancar_supabase_url') || '',
  SUPABASE_ANON_KEY: localStorage.getItem('slancar_supabase_anon_key') || '',
  GEMINI_API_KEY: localStorage.getItem('slancar_gemini_api_key') || '',

  saveConfig(supabaseUrl, supabaseKey, geminiKey) {
    if (supabaseUrl) localStorage.setItem('slancar_supabase_url', supabaseUrl.trim());
    if (supabaseKey) localStorage.setItem('slancar_supabase_anon_key', supabaseKey.trim());
    if (geminiKey) localStorage.setItem('slancar_gemini_api_key', geminiKey.trim());
    
    this.SUPABASE_URL = localStorage.getItem('slancar_supabase_url') || '';
    this.SUPABASE_ANON_KEY = localStorage.getItem('slancar_supabase_anon_key') || '';
    this.GEMINI_API_KEY = localStorage.getItem('slancar_gemini_api_key') || '';
  },

  isConfigured() {
    return Boolean(this.SUPABASE_URL && this.SUPABASE_ANON_KEY);
  }
};
