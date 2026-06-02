// =========================================================
//  GAMING SANCTUARY — Shared Utilities
// =========================================================

import { supabase } from './supabase-client.js';

// ---- Toast Notifications ----------------------------------------

/**
 * Shows a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
export function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: 'check-circle', error: 'x-circle', info: 'info' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i data-lucide="${icons[type] || 'bell'}"></i><span>${message}</span>`;
  container.appendChild(toast);

  if (window.lucide) lucide.createIcons({ nodes: [toast] });

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ---- Date / Time Formatters -------------------------------------

/**
 * Formats "2026-06-01" → "Mon, 1 Jun 2026"
 */
export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  // Parse as local date to avoid UTC offset issues
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric',
    month: 'short', year: 'numeric',
  });
}

/**
 * Formats "14:00:00" → "2:00 PM"
 */
export function fmtTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Formats "2026-06-01T14:00:00Z" → "1 Jun · 2:00 PM"
 */
export function fmtDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Formats a number as Indian Rupee: 1500 → "₹1,500"
 */
export function fmtPrice(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

// ---- Today's date string "YYYY-MM-DD" --------------------------
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ---- Confirm Dialog (Promise) -----------------------------------

/**
 * Shows a styled confirm dialog.
 * @param {string} msg
 * @param {string} [okLabel='Confirm']
 * @param {'btn-danger'|'btn-primary'} [okClass='btn-danger']
 * @returns {Promise<boolean>}
 */
export function confirmDialog(msg, okLabel = 'Confirm', okClass = 'btn-danger') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <span class="modal-title">Are you sure?</span>
        </div>
        <p style="color:var(--muted-l);font-size:0.9rem;line-height:1.6">${msg}</p>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="c-cancel">Cancel</button>
          <button class="btn ${okClass}" id="c-ok">${okLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#c-cancel').onclick = () => { overlay.remove(); resolve(false); };
    overlay.querySelector('#c-ok').onclick     = () => { overlay.remove(); resolve(true);  };
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
  });
}

// ---- Overlap Check ----------------------------------------------

/**
 * Returns true if a booking for [startTime, endTime) on rigId/date
 * would overlap with any existing booking, excluding optionalExcludeId.
 *
 * @param {number} rigId
 * @param {string} date "YYYY-MM-DD"
 * @param {string} startTime "HH:MM"
 * @param {string} endTime "HH:MM"
 * @param {number|null} excludeId  — booking ID to exclude (for edit flows)
 */
export async function checkOverlap(rigId, date, startTime, endTime, excludeId = null) {
  let query = supabase
    .from('bookings')
    .select('id, start_time, end_time')
    .eq('rig_id', rigId)
    .eq('date', date);

  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).some(b => {
    const bStart = b.start_time.slice(0,5);
    const bEnd   = b.end_time.slice(0,5);
    // Overlap if NOT (endTime <= bStart OR startTime >= bEnd)
    return !(endTime <= bStart || startTime >= bEnd);
  });
}

// ---- Loading state helper ---------------------------------------

/**
 * Sets a button's loading state.
 * @param {HTMLButtonElement} btn
 * @param {boolean} loading
 * @param {string} [loadingText]
 */
export function setLoading(btn, loading, loadingText = 'Loading...') {
  if (loading) {
    btn._origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${loadingText}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn._origText || btn.innerHTML;
  }
}

// ---- Render avatar initials ------------------------------------
export function avatarInitials(name) {
  return (name || 'U').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ---- Status badge helper ---------------------------------------
export function orderStatusBadge(status) {
  const map = {
    pending:   'badge-amber',
    preparing: 'badge-teal',
    completed: 'badge-green',
  };
  return `<span class="badge ${map[status] || 'badge-gray'}">${capitalize(status)}</span>`;
}

export function rigStatusBadge(status) {
  const map = {
    available:   'badge-green',
    occupied:    'badge-amber',
    maintenance: 'badge-red',
  };
  return `<span class="badge ${map[status] || 'badge-gray'}">${capitalize(status)}</span>`;
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
