// js/modules/lab.js – Laboratory Management

import { supabase, dbQuery } from '../supabase-client.js';

/** Fetch all PENDING lab orders (with patient info) */
export async function getPendingLabOrders() {
    const { data, error } = await supabase
        .from('lab_orders')
        .select(`
            *,
            encounters (
                patient_pin,
                patients ( first_name, last_name )
            )
        `)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

/** Fetch all COMPLETED lab orders (audit log) */
export async function getCompletedLabOrders() {
    const { data, error } = await supabase
        .from('lab_orders')
        .select(`
            *,
            encounters ( patient_pin, patients ( first_name, last_name ) ),
            hms_users ( full_name )
        `)
        .eq('status', 'COMPLETED')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) throw new Error(error.message);
    return data || [];
}

/** Save lab results and sign-off (lock after COMPLETED) */
export async function saveLabResults({ labOrderId, techId, resultsPayload }) {
    // CONSTRAINT: Fetch current status first – block if already COMPLETED
    const current = await dbQuery(
        supabase.from('lab_orders').select('status').eq('lab_order_id', labOrderId).single()
    );

    if (current.status === 'COMPLETED') {
        throw new Error('Modification blocked: This lab order has already been formally signed off and is now immutable.');
    }

    await dbQuery(supabase
        .from('lab_orders')
        .update({
            tech_id:         techId,
            results_payload: resultsPayload.trim(),
            status:          'COMPLETED'
        })
        .eq('lab_order_id', labOrderId)
    );
}
