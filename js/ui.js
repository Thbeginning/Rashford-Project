// js/ui.js – Shared UI utility functions

/** ── Toast Notifications ─────────────────────────── */
export function toast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(el);

    setTimeout(() => el.remove(), 4200);
}

/** ── Sidebar wiring ─────────────────────────────── */
export function wireSidebar(session) {
    const avatar = document.getElementById('sidebar-avatar');
    const name   = document.getElementById('sidebar-name');
    const role   = document.getElementById('sidebar-role');

    if (avatar) avatar.textContent = (session.full_name || session.username).slice(0,2).toUpperCase();
    if (name)   name.textContent   = session.full_name || session.username;
    if (role)   role.textContent   = session.role;

    // Logout button
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('hms_session');
            window.location.href = '../index.html';
        });
    }
}

/** ── Loading state on button ───────────────────── */
export function setLoading(btn, loading, label = null) {
    if (loading) {
        btn.dataset.origLabel = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span> Working…';
        btn.disabled = true;
    } else {
        btn.innerHTML = label || btn.dataset.origLabel || btn.innerHTML;
        btn.disabled = false;
    }
}

/** ── Confirm dialog ────────────────────────────── */
export function confirm(message) {
    return window.confirm(message);
}

/** ── Format date ───────────────────────────────── */
export function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

export function fmtDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB');
}

/** ── Format currency in XAF ─────────────────── */
export function fmtXAF(amount) {
    return Number(amount || 0).toLocaleString('fr-CM') + ' XAF';
}

/** ── Live search dropdown wiring ──────────────── */
export function wireSearchDropdown({ inputEl, dropdownEl, hiddenEl, badgeEl, onSelect, fetchFn }) {
    let debounce = null;

    inputEl.addEventListener('input', () => {
        clearTimeout(debounce);
        const q = inputEl.value.trim();
        if (q.length < 2) { dropdownEl.classList.remove('open'); return; }

        debounce = setTimeout(async () => {
            const results = await fetchFn(q);
            dropdownEl.innerHTML = '';
            if (!results.length) {
                dropdownEl.innerHTML = '<div class="search-item text-muted">No results found</div>';
            } else {
                results.forEach(r => {
                    const div = document.createElement('div');
                    div.className = 'search-item';
                    div.innerHTML = `<div>${r.label}</div><div class="sid">${r.sub}</div>`;
                    div.addEventListener('click', () => {
                        inputEl.value = r.label;
                        if (hiddenEl) hiddenEl.value = r.value;
                        if (badgeEl) {
                            badgeEl.textContent = r.value;
                            badgeEl.classList.remove('hidden');
                        }
                        dropdownEl.classList.remove('open');
                        if (onSelect) onSelect(r);
                    });
                    dropdownEl.appendChild(div);
                });
            }
            dropdownEl.classList.add('open');
        }, 280);
    });

    document.addEventListener('click', (e) => {
        if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
            dropdownEl.classList.remove('open');
        }
    });
}
