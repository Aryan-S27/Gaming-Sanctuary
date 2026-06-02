// =========================================================
//  GAMING SANCTUARY — Auth Guard
//  Usage: import { requireAuth } from '../js/auth-guard.js';
//         const auth = await requireAuth('customer'); // or 'admin' or null
//         if (!auth) throw new Error('redirecting');
// =========================================================

import { supabase } from './supabase-client.js';

/**
 * Checks the current session and optionally enforces a role.
 * Redirects to /login.html if no session, or to the correct
 * dashboard if the role doesn't match.
 *
 * @param {string|null} allowedRole - 'customer' | 'admin' | null (any role)
 * @returns {{ session, profile } | null}
 */
export async function requireAuth(allowedRole = null) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = '/login.html';
    return null;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    await supabase.auth.signOut();
    window.location.href = '/login.html';
    return null;
  }

  if (allowedRole && profile.role !== allowedRole) {
    window.location.href = profile.role === 'admin'
      ? '/admin/dashboard.html'
      : '/customer/dashboard.html';
    return null;
  }

  return { session, profile };
}

/**
 * Returns the current user's profile, or null if not logged in.
 */
export async function getProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  return data;
}

/**
 * Signs the user out and redirects to /login.html.
 */
export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/login.html';
}
