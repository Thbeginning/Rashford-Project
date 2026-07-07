// js/modules/encounter.js – Triage, Consultation, Lab Requests, Prescriptions

import { supabase, dbQuery } from '../supabase-client.js';

/** ─── Triage: Create new encounter row with vitals ─────── */
export async function createTriage({ patientPin, doctorId, bp, temp, pulse, weight }) {
    // Input boundary validation (Unit Test UT-2 requirement)
    const tempVal = parseFloat(temp);
    if (isNaN(tempVal) || tempVal < 30.0 || tempVal > 45.0) {
        throw new Error('Invalid Temperature Boundary Entered (valid range: 30–45°C)');
    }

    const vitals = { bp: bp.trim(), temp: tempVal, pulse: parseInt(pulse), weight: parseFloat(weight) };

    const data = await dbQuery(supabase.from('encounters').insert({
        patient_pin:   patientPin,
        doctor_id:     parseInt(doctorId),
        triage_vitals: vitals,
        clinical_notes: null
    }).select().single());

    return data;
}

/** ─── Fetch a doctor's pending consultation queue ─────── */
export async function getPendingQueueForDoctor(doctorId) {
    const { data, error } = await supabase
        .from('encounters')
        .select(`
            *,
            patients ( first_name, last_name, dob, gender, phone_num )
        `)
        .eq('doctor_id', doctorId)
        .is('clinical_notes', null)
        .order('date_created', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

/** ─── Fetch the latest encounter for a patient ─────────── */
export async function getLatestEncounterByPIN(pin) {
    const { data, error } = await supabase
        .from('encounters')
        .select(`
            *,
            patients ( first_name, last_name ),
            hms_users ( full_name )
        `)
        .eq('patient_pin', pin)
        .order('date_created', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
}

/** ─── Fetch a single encounter by ID ─────────────────── */
export async function getEncounterById(encId) {
    const { data, error } = await supabase
        .from('encounters')
        .select(`
            *,
            patients ( first_name, last_name, dob, gender, phone_num ),
            hms_users ( full_name )
        `)
        .eq('encounter_id', encId)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
}

/** ─── Save clinical consultation notes ───────────────── */
export async function saveConsultation(encounterId, notes) {
    await dbQuery(supabase
        .from('encounters')
        .update({ clinical_notes: notes.trim() })
        .eq('encounter_id', encounterId)
    );
}

/** ─── Request Lab Order ───────────────────────────────── */
export async function requestLabOrder(encounterId, testType) {
    return await dbQuery(supabase
        .from('lab_orders')
        .insert({ encounter_id: encounterId, test_type: testType.trim(), status: 'PENDING' })
        .select()
        .single()
    );
}

/** ─── Issue Digital Prescription ──────────────────────── */
export async function issuePrescription({ encounterId, medicationName, dosage, quantity }) {
    return await dbQuery(supabase
        .from('prescriptions')
        .insert({
            encounter_id:    encounterId,
            medication_name: medicationName.trim(),
            dosage:          dosage.trim(),
            quantity:        parseInt(quantity),
            status_billing:  'UNPAID',
            status_dispensed:'PENDING'
        })
        .select()
        .single()
    );
}

/** ─── Fetch lab orders for an encounter ─────────────── */
export async function getLabOrdersForEncounter(encounterId) {
    const { data, error } = await supabase
        .from('lab_orders')
        .select('*')
        .eq('encounter_id', encounterId)
        .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
}

/** ─── Fetch prescriptions for an encounter ─────────── */
export async function getPrescriptionsForEncounter(encounterId) {
    const { data, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('encounter_id', encounterId)
        .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
}

/** ─── Fetch all active doctors ──────────────────────── */
export async function getDoctors() {
    const { data, error } = await supabase
        .from('hms_users')
        .select('user_id, username, full_name')
        .eq('role', 'Doctor')
        .eq('is_active', true);
    if (error) throw new Error(error.message);
    return data || [];
}
