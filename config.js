// Configuracion de Supabase.
// Obtienes estos valores en Supabase: Project Settings > API.
// Usa la anon public key; nunca pegues service_role keys en frontend.
const SUPABASE_URL = 'https://wfcpndovsdqkvcvzghvb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rQD5SZfsQqg7FbclVTdKzA_kPPAkz2f';

if (!window.supabase) {
  console.error('Supabase JS no esta cargado. Revisa el CDN en index.html.');
} else {
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('Cliente Supabase inicializado correctamente.');
}
