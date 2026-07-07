// js/auth.js
// RBAC Authentication Layer – manages login, sessions, and role-based routing

import { supabase, dbQuery } from './supabase-client.js';

const SESSION_KEY = 'hms_session';

/** ──────────────────────────────────────────────
 *  Login: verify credentials against hms_users
 *  Returns user object or throws on failure
 * ────────────────────────────────────────────── */
export async function login(username, password) {
    const data = await dbQuery(
        supabase
            .from('hms_users')
            .select('*')
            .eq('username', username.trim())
            .eq('password_hash', password)   // MVP plain-text compare
            .eq('is_active', true)
            .maybeSingle()
    );

    if (!data) throw new Error('Invalid username or password.');

    // Store minimal session in localStorage
    const session = {
        user_id:   data.user_id,
        username:  data.username,
        full_name: data.full_name,
        role:      data.role
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
}

/** Retrieve current session */
export function getSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
}

/** Destroy session and redirect to login */
export function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = '/index.html';
}

/** Require a session; redirect if none */
export function requireAuth() {
    const session = getSession();
    if (!session) {
        window.location.href = '/index.html';
        return null;
    }
    return session;
}

/** Role → dashboard page map */
export const ROLE_ROUTES = {
    Admin:      'pages/nurse-dashboard.html',    // Admin sees all, lands on Nurse
    Nurse:      'pages/nurse-dashboard.html',
    Doctor:     'pages/doctor-dashboard.html',
    LabTech:    'pages/labtech-dashboard.html',
    Accountant: 'pages/accountant-dashboard.html',
    Pharmacist: 'pages/pharmacist-dashboard.html'
};

export function redirectByRole(role) {
    const page = ROLE_ROUTES[role] || 'index.html';
    window.location.href = page;
}
