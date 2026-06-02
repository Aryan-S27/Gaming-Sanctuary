// =========================================================
//  GAMING SANCTUARY — Supabase Client (single source of truth)
//  Replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY
//  with your real Supabase project values.
// =========================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://qvtbiezemtglatixymxp.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dGJpZXplbXRnbGF0aXh5bXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjk1NzMsImV4cCI6MjA5NTkwNTU3M30.8ZNmeVkKGvQpB4oFtwhjxXH0LPYnbAwiBoywu5wEqiE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
