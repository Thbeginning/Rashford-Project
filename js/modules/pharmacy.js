// js/modules/pharmacy.js – Pharmacy & Dispensing Management

import { supabase, dbQuery } from '../supabase-client.js';

/** Fetch pending prescriptions (PENDING dispense status) */
export async function getPendingDispenseQueue() {
    const { data, error } = await supabase
        .from('prescriptions')
        .select(`
            *,
            encounters (
                patient_pin,
                patients ( first_name, last_name )
            )
        `)
        .eq('status_dispensed', 'PENDING')
        .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

/** Fetch dispensed history */
export async function getDispensedHistory() {
    const { data, error } = await supabase
        .from('prescriptions')
        .select(`
            *,
            encounters ( patient_pin, patients ( first_name, last_name ) ),
            hms_users ( full_name )
        `)
        .eq('status_dispensed', 'DISPENSED')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) throw new Error(error.message);
    return data || [];
}

/** Fetch pharmacy stock ledger */
export async function getPharmacyStock() {
    const { data, error } = await supabase
        .from('pharmacy_stock')
        .select('*')
        .order('medication_name');
    if (error) throw new Error(error.message);
    return data || [];
}

/**
 * STATE MACHINE: Check billing clearance for a patient.
 * Returns: 'PAID' | 'UNPAID' | 'NO_INVOICE'
 */
export async function checkBillingClearance(patientPin) {
    const { data, error } = await supabase
        .from('invoices')
        .select('payment_status')
        .eq('patient_pin', patientPin)
        .order('date_created', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return 'NO_INVOICE';
    return data.payment_status;
}

/**
 * Dispense a prescription.
 * Pre-check: invoice must be PAID.
 * Post-action: decrement pharmacy_stock.
 */
export async function dispenseMedication({ scriptId, pharmacistId, patientPin }) {
    // 1. STATE MACHINE CONSTRAINT: Check billing clearance
    const status = await checkBillingClearance(patientPin);
    if (status !== 'PAID') {
        throw new Error('Awaiting Accounting Settlement Cleared Flag');
    }

    // 2. Fetch prescription details
    const script = await dbQuery(supabase
        .from('prescriptions')
        .select('*')
        .eq('script_id', scriptId)
        .single()
    );

    if (script.status_dispensed === 'DISPENSED') {
        throw new Error('This prescription has already been dispensed.');
    }

    // 3. Decrement stock ledger
    const { data: stockRow, error: sErr } = await supabase
        .from('pharmacy_stock')
        .select('quantity')
        .eq('medication_name', script.medication_name)
        .maybeSingle();

    if (sErr) throw new Error(sErr.message);

    if (!stockRow || stockRow.quantity < script.quantity) {
        throw new Error(`Insufficient stock for: ${script.medication_name}`);
    }

    await dbQuery(supabase
        .from('pharmacy_stock')
        .update({ quantity: stockRow.quantity - script.quantity, updated_at: new Date().toISOString() })
        .eq('medication_name', script.medication_name)
    );

    // 4. Mark prescription as DISPENSED
    await dbQuery(supabase
        .from('prescriptions')
        .update({ status_dispensed: 'DISPENSED', pharmacist_id: pharmacistId })
        .eq('script_id', scriptId)
    );
}
