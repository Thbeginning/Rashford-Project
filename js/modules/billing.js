// js/modules/billing.js – Finance & Billing Engine

import { supabase, dbQuery } from '../supabase-client.js';

// Fixed tariff schedule (XAF) – mirrors Readme Chapter 4 data matrix
export const TARIFFS = {
    consultation: 5000,
    lab_order:    3500,
    prescription: 2500
};

/**
 * Aggregate all unbilled clinical items for a patient.
 * Returns: { items: [...], totalAmount: number }
 */
export async function getUnbilledItems(patientPin) {
    const items = [];

    // 1. Find all encounters for this patient that are NOT yet invoiced
    // We consider an encounter "unbilled" if it has no corresponding PAID invoice
    // and has at least one unpaid prescription OR at least one clinical note
    const { data: encounters, error: encErr } = await supabase
        .from('encounters')
        .select('encounter_id, date_created, clinical_notes')
        .eq('patient_pin', patientPin)
        .order('date_created', { ascending: false });

    if (encErr) throw new Error(encErr.message);
    if (!encounters?.length) return { items: [], totalAmount: 0 };

    // Check if there's already a PAID invoice for this patient (most recent)
    const { data: paidInvoice } = await supabase
        .from('invoices')
        .select('date_paid, invoice_id')
        .eq('patient_pin', patientPin)
        .eq('payment_status', 'PAID')
        .order('date_paid', { ascending: false })
        .limit(1)
        .maybeSingle();

    // Only bill encounters AFTER the last paid invoice (or all if never invoiced)
    const afterDate = paidInvoice?.date_paid || '2000-01-01';

    for (const enc of encounters) {
        if (new Date(enc.date_created) <= new Date(afterDate)) continue;

        // Consultation fee per encounter (if clinical notes exist or vitals)
        items.push({
            type: 'consultation',
            ref: `ENC-${enc.encounter_id}`,
            description: `General Outpatient Consultation (Visit #${enc.encounter_id})`,
            department: 'Clinical',
            cost: TARIFFS.consultation,
            encounter_id: enc.encounter_id
        });

        // 2. Lab orders for this encounter
        const { data: labs } = await supabase
            .from('lab_orders')
            .select('lab_order_id, test_type')
            .eq('encounter_id', enc.encounter_id);

        (labs || []).forEach(l => {
            items.push({
                type: 'lab_order',
                ref: `LAB-${l.lab_order_id}`,
                description: `${l.test_type} (Lab Order #${l.lab_order_id})`,
                department: 'Laboratory',
                cost: TARIFFS.lab_order,
                encounter_id: enc.encounter_id
            });
        });

        // 3. Prescriptions (UNPAID only)
        const { data: scripts } = await supabase
            .from('prescriptions')
            .select('script_id, medication_name, quantity')
            .eq('encounter_id', enc.encounter_id)
            .eq('status_billing', 'UNPAID');

        (scripts || []).forEach(s => {
            items.push({
                type: 'prescription',
                ref: `PHM-${s.script_id}`,
                description: `${s.medication_name} (Qty: ${s.quantity})`,
                department: 'Pharmacy',
                cost: TARIFFS.prescription,
                encounter_id: enc.encounter_id,
                script_id: s.script_id
            });
        });
    }

    const totalAmount = items.reduce((sum, i) => sum + i.cost, 0);
    return { items, totalAmount };
}

/** Create an itemized invoice record */
export async function createInvoice({ patientPin, totalAmount, itemsSnapshot }) {
    return await dbQuery(supabase
        .from('invoices')
        .insert({
            patient_pin:    patientPin,
            total_amount:   totalAmount,
            payment_status: 'UNPAID',
            items_snapshot: itemsSnapshot
        })
        .select()
        .single()
    );
}

/** Process payment: flip invoice to PAID + update prescription flags */
export async function processPayment({ invoiceId, accountantId, patientPin }) {
    // 1. Update invoice to PAID
    await dbQuery(supabase
        .from('invoices')
        .update({ payment_status: 'PAID', accountant_id: accountantId, date_paid: new Date().toISOString() })
        .eq('invoice_id', invoiceId)
    );

    // 2. Mark all UNPAID prescriptions for this patient as PAID
    const { data: encIds } = await supabase
        .from('encounters')
        .select('encounter_id')
        .eq('patient_pin', patientPin);

    const ids = (encIds || []).map(e => e.encounter_id);
    if (ids.length) {
        await supabase
            .from('prescriptions')
            .update({ status_billing: 'PAID' })
            .in('encounter_id', ids)
            .eq('status_billing', 'UNPAID');
    }
}

/** Fetch all pending (UNPAID) invoices */
export async function getPendingInvoices() {
    const { data, error } = await supabase
        .from('invoices')
        .select(`*, patients ( first_name, last_name )`)
        .eq('payment_status', 'UNPAID')
        .order('date_created', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
}

/** Fetch invoice history (all) */
export async function getInvoiceHistory() {
    const { data, error } = await supabase
        .from('invoices')
        .select(`*, patients ( first_name, last_name ), hms_users ( full_name )`)
        .order('date_created', { ascending: false })
        .limit(80);
    if (error) throw new Error(error.message);
    return data || [];
}
