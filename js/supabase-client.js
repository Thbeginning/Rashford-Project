// js/supabase-client.js
// Supabase JS client initialization – single source of truth for all DB operations

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ──────────────────────────────────────────────
// Rashford Project – Supabase Configuration
// ──────────────────────────────────────────────
const SUPABASE_URL  = 'https://wmroidutfnedublujyfw.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtcm9pZHV0Zm5lZHVibHVqeWZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMjk1NTcsImV4cCI6MjA5ODYwNTU1N30.gFThFImC6ccFG6aZUmewUsqFxnR-rRMyhC2KzZOktbY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

/**
 * Convenience wrapper – throws on Supabase error so callers can use try/catch.
 */
export async function dbQuery(promise) {
    const { data, error } = await promise;
    if (error) throw new Error(error.message);
    return data;
}
