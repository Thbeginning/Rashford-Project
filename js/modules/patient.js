// js/modules/patient.js – Patient registration, PIN generation, search

import { supabase, dbQuery } from '../supabase-client.js';

/** ──────────────────────────────────────────────────────────
 *  Generate the next sequential, time-based Patient PIN.
 *  Format: PT-YYYYMMDD-XXXX  (XXXX = 4-digit counter, per day)
 * ────────────────────────────────────────────────────────── */
export async function generateNextPIN() {
    const now     = new Date();
    const year    = now.getFullYear();
    const month   = String(now.getMonth() + 1).padStart(2, '0');
    const day     = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;           // "20260703"
    const prefix  = `PT-${dateStr}-`;                  // "PT-20260703-"

    // Find the highest existing sequence for today
    const { data, error } = await supabase
        .from('patients')
        .select('patient_pin')
        .like('patient_pin', `${prefix}%`)
        .order('patient_pin', { ascending: false })
        .limit(1);

    if (error) throw new Error(error.message);

    let nextSeq = 1;
    if (data && data.length > 0) {
        const lastPin = data[0].patient_pin;              // "PT-20260703-0042"
        const parts   = lastPin.split('-');
        nextSeq = parseInt(parts[parts.length - 1]) + 1;
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`; // "PT-20260703-0043"
}

/** Register a new patient and return the generated PIN */
export async function registerPatient({ firstName, lastName, dob, gender, phoneNum }) {
    const pin = await generateNextPIN();

    await dbQuery(supabase.from('patients').insert({
        patient_pin: pin,
        first_name:  firstName.trim(),
        last_name:   lastName.trim(),
        dob,
        gender,
        phone_num:   phoneNum?.trim() || null
    }));

    return pin;
}

/** Search patients by PIN, first_name, last_name, or phone */
export async function searchPatients(query) {
    const term = query.trim();
    const { data, error } = await supabase
        .from('patients')
        .select('*')
        .or(`patient_pin.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone_num.ilike.%${term}%`)
        .order('registered_at', { ascending: false })
        .limit(20);

    if (error) throw new Error(error.message);
    return data || [];
}

/** Fetch a single patient by PIN */
export async function getPatientByPIN(pin) {
    return await dbQuery(
        supabase.from('patients').select('*').eq('patient_pin', pin).maybeSingle()
    );
}
