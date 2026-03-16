function getBavarianHolidays(year) {
    function getEaster(year) {
        const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    }
    const easter = getEaster(year);
    const add = (d, n) => { let r = new Date(d); r.setDate(r.getDate() + n); return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, '0')}-${String(r.getDate()).padStart(2, '0')}`; };
    return {
        [`${year}-01-01`]: 'Neujahr', [`${year}-01-06`]: 'Hl. 3 Könige', [`${year}-05-01`]: 'Tag der Arbeit', [`${year}-08-15`]: 'Mariä Himmelfahrt', [`${year}-10-03`]: 'Tag d. dt. Einheit', [`${year}-11-01`]: 'Allerheiligen', [`${year}-12-25`]: '1. Weihnachtstag', [`${year}-12-26`]: '2. Weihnachtstag',
        [add(easter, -2)]: 'Karfreitag', [add(easter, 1)]: 'Ostermontag', [add(easter, 39)]: 'Christi Himmelfahrt', [add(easter, 50)]: 'Pfingstmontag', [add(easter, 60)]: 'Fronleichnam'
    };
}

class DataService {
    static async load() {
        try {
            const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.binId}/latest`, {
                headers: { 'X-Master-Key': CONFIG.apiKey }
            });
            if (!res.ok) {
                const err = await res.json();
                console.error("JSONBin Error:", err);
                return { error: true, status: res.status, message: err.message };
            }
            return (await res.json()).record;
        } catch (e) {
            console.error("Error loading data:", e);
            return { error: true, message: e.message };
        }
    }
    static async save(state) {
        try {
            const payload = { employees: CONFIG.employees, state };
            if (CONFIG.skills) payload.skills = CONFIG.skills;
            if (CONFIG.groupOrder) payload.groupOrder = CONFIG.groupOrder;
            if (CONFIG.groupColors) payload.groupColors = CONFIG.groupColors;

            await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.binId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-Master-Key': CONFIG.apiKey },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error("Error saving data:", e);
        }
    }
}

class App {
    constructor(config) {
        window.CONFIG = config;
        this.currentUser = null;
        this.state = {};
        this.isDragging = false;
        this.currentMode = 'U';
        this.currentText = '';
        this.currentVertreterText = '';
        this._hasChanged = false;
        this._affectedDates = new Set();
        this._visStart = -1;
        this._visEnd = -1;
        this._rafPending = false;
        this._touchStart = null;
        this._isScroll = false;

        this.dates = this.generateDates();
        this._datesMap = new Map();
        this.dates.forEach(d => this._datesMap.set(d.dateStr, d));

        this.initApp();

        const calendar = document.getElementById('calendar');
        if (calendar) {
            calendar.addEventListener('scroll', () => this._scheduleVirtualUpdate(), { passive: true });
            calendar.addEventListener('mousedown', ev => {
                if (ev.button !== 0) return;
                const cell = ev.target.closest('.day-cell[data-eid]');
                if (!cell) return;
                ev.preventDefault();
                this.handleMouseDown(cell.dataset.eid, cell.dataset.date);
            }, { passive: false });
            calendar.addEventListener('mouseover', ev => {
                const cell = ev.target.closest('.day-cell[data-eid]');
                if (cell) this.handleMouseOver(cell.dataset.eid, cell.dataset.date);
            });
            calendar.addEventListener('dblclick', ev => {
                const cell = ev.target.closest('.day-cell[data-eid]');
                if (cell) this.editAbsence(cell.dataset.eid, cell.dataset.date);
            });
            calendar.addEventListener('contextmenu', ev => {
                const cell = ev.target.closest('.day-cell[data-eid]');
                if (!cell) return;
                ev.preventDefault();
                this.editAbsence(cell.dataset.eid, cell.dataset.date);
            });            calendar.addEventListener('touchstart', ev => {
                const touch = ev.touches[0];
                this._touchStart = { x: touch.clientX, y: touch.clientY, time: Date.now() };
                this._isScroll = false;
            }, { passive: true });

            calendar.addEventListener('touchmove', ev => {
                if (!this._touchStart) return;
                const touch = ev.touches[0];
                const dx = Math.abs(touch.clientX - this._touchStart.x);
                const dy = Math.abs(touch.clientY - this._touchStart.y);
                if (dx > 10 || dy > 10) this._isScroll = true;

                if (this.isDragging) {
                    const el = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.day-cell[data-eid]');
                    if (el) this.handleMouseOver(el.dataset.eid, el.dataset.date);
                }
            }, { passive: true });

            calendar.addEventListener('touchend', ev => {
                if (!this._touchStart) return;
                if (!this._isScroll) {
                    const elapsed = Date.now() - this._touchStart.time;
                    const cell = ev.target.closest('.day-cell[data-eid]');
                    if (cell && elapsed < 300) {
                        this.handleMouseDown(cell.dataset.eid, cell.dataset.date);
                    }
                }
                this.stopDrag();
                this._touchStart = null;
            }, { passive: true });
        }

        this.stopDrag = this.stopDrag.bind(this);
        document.addEventListener('mouseup', this.stopDrag);
        document.addEventListener('touchend', this.stopDrag);
        document.addEventListener('touchcancel', this.stopDrag);
    }

    formatDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    generateDates() {
        const res = [];
        CONFIG.years.forEach(y => {
            let d = new Date(y, 0, 1);
            while (d.getFullYear() === y) {
                if (y === 2028 && d.getMonth() > 0) break;
                const s = this.formatDate(d);
                const sh = CONFIG.schoolHolidays.find(h => s >= h.start && s <= h.end);
                res.push({
                    year: y,
                    dateStr: s,
                    day: d.getDate(),
                    month: d.getMonth(),
                    weekday: d.getDay(),
                    isWeekend: d.getDay() === 0 || d.getDay() === 6,
                    holiday: CONFIG.holidays[s],
                    isSchoolHoliday: !!sh,
                    schoolHoliday: sh ? sh.name : null
                });
                d.setDate(d.getDate() + 1);
            }
        });
        return res;
    }

    logout() {
        if (!confirm('Möchtest du dich wirklich abmelden?')) return;
        this.currentUser = null;
        document.body.classList.add('pre-login');
        document.getElementById('loginModal').style.display = 'flex';
        // Reset inputs
        document.getElementById('loginPwdInput').value = '';
        document.getElementById('loginSelect').value = '';
        document.getElementById('loginSearch').value = '';
        // Clear sensitive key from memory if desired, but usually keep it for easier re-login
        localStorage.removeItem('last_user_id');
        localStorage.removeItem('last_user_pin');
        location.reload(); // Refresh to ensure a clean state
    }

    async initApp() {
        const storedKey = localStorage.getItem('jsonbin_key');
        if (storedKey) {
            CONFIG.apiKey = storedKey;
            const apiKeyInput = document.getElementById('apiKeyInput');
            if (apiKeyInput) apiKeyInput.value = storedKey;
            await this.reloadData();
        }
        this.initUI();
        this.showLoginModal();

        // Try auto-login if credentials exist
        const lastUserId = localStorage.getItem('last_user_id');
        const lastUserPin = localStorage.getItem('last_user_pin');
        if (lastUserId && lastUserPin && storedKey) {
            document.getElementById('loginSelect').value = lastUserId;
            document.getElementById('loginPwdInput').value = lastUserPin;
            this.processLogin(true); // true means auto-login attempt
        }

        // Listen for Master Key input to load employees on-the-fly if not already loaded
        const apiKeyInput = document.getElementById('apiKeyInput');
        if (apiKeyInput) {
            apiKeyInput.addEventListener('input', async () => {
                const errorEl = document.getElementById('loginError');
                if (errorEl) errorEl.style.display = 'none'; // Hide error on input

                const key = apiKeyInput.value.trim();
                if (key.length > 20) { // JSONBin keys are typically long
                    CONFIG.apiKey = key;
                    const loaded = await this.reloadData();
                    if (loaded && !loaded.error) {
                        this.showLoginModal(); // Refresh the list
                    }
                }
            });
        }
    }

    async reloadData() {
        const data = await DataService.load();
        if (data && !data.error) {
            CONFIG.employees = data.employees || [];
            this.state = data.state || {};
            if (data.skills) CONFIG.skills = data.skills;
            if (data.groupOrder) CONFIG.groupOrder = data.groupOrder;
            if (data.groupColors) CONFIG.groupColors = data.groupColors;
            this.sortEmployees();
            return data;
        }
        return data; // returns the error object if data.error is true
    }

    initUI() {
        const yNav = document.getElementById('yearNav'), mNav = document.getElementById('monthNav');
        if (yNav) {
            yNav.innerHTML = '';
            CONFIG.years.forEach(y => {
                const b = document.createElement('button');
                b.innerText = y;
                b.id = `btn-year-${y}`;
                b.onclick = () => this.setYear(y);
                yNav.appendChild(b);
            });
        }
        if (mNav) {
            mNav.innerHTML = '';
            ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'].forEach((m, i) => {
                const b = document.createElement('button');
                b.innerText = m;
                b.id = `btn-month-${i}`;
                b.onclick = () => this.scrollToMonth(i, true);
                mNav.appendChild(b);
            });
        }
    }

    showLoginModal() {
        this._loginOptions = [
            { id: 'admin', name: 'Admin' },
            { id: 'sekretariat', name: 'Sekretariat' },
            ...CONFIG.employees.filter(e => e.id !== 'admin' && e.id !== 'sekretariat' && (e.active !== false || e.pin)).map(e => ({ id: e.id, name: e.name }))
        ];
        if (CONFIG.additionalLoginOptions) {
            this._loginOptions.push(...CONFIG.additionalLoginOptions);
        }
        const loginSearch = document.getElementById('loginSearch');
        if (loginSearch) loginSearch.onfocus = () => this.filterLoginEmployees();
    }

    filterLoginEmployees() {
        const loginSearch = document.getElementById('loginSearch');
        const loginResults = document.getElementById('loginResults');
        if (!loginSearch || !loginResults) return;

        const q = loginSearch.value.toLowerCase();
        loginResults.innerHTML = '';
        const matches = this._loginOptions.filter(o => !q || o.name.toLowerCase().includes(q));
        if (matches.length === 0) {
            loginResults.style.display = 'none';
            return;
        }
        matches.forEach(o => {
            const i = document.createElement('div');
            i.textContent = o.name;
            i.style.padding = '10px';
            i.style.cursor = 'pointer';
            i.onmousedown = () => {
                loginSearch.value = o.name;
                document.getElementById('loginSelect').value = o.id;
                loginResults.style.display = 'none';
            };
            loginResults.appendChild(i);
        });
        loginResults.style.display = 'block';
    }

    async processLogin(isAutoLogin = false) {
        const loginSelect = document.getElementById('loginSelect');
        const apiKeyInput = document.getElementById('apiKeyInput');
        const loginPwdInput = document.getElementById('loginPwdInput');
        const errorEl = document.getElementById('loginError');
        if (!loginSelect || !apiKeyInput || !loginPwdInput) return;

        if (errorEl) errorEl.style.display = 'none';

        const id = loginSelect.value;
        const key = apiKeyInput.value.trim();
        const pwd = loginPwdInput.value.trim();

        if (!id || !key) {
            if (errorEl) {
                errorEl.textContent = 'Bitte Name und Master Key eingeben.';
                errorEl.style.display = 'block';
            }
            return;
        }

        // 1. Set the key and try to load data
        CONFIG.apiKey = key;
        const loaded = await this.reloadData();

        // 2. Check if loading failed
        if (!loaded || loaded.error) {
            if (errorEl && !isAutoLogin) {
                errorEl.textContent = 'Master Key ungültig oder Netzwerkfehler.';
                errorEl.style.display = 'block';
            }
            if (isAutoLogin) {
                localStorage.removeItem('last_user_id');
                localStorage.removeItem('last_user_pin');
            }
            return;
        }

        // 3. Ensure we actually have data (employees) before proceeding
        if (!CONFIG.employees || CONFIG.employees.length === 0) {
            if (errorEl) {
                errorEl.textContent = 'Daten geladen, aber keine Mitarbeiter gefunden.';
                errorEl.style.display = 'block';
            }
            return;
        }

        // 4. Verify PIN for the selected account
        const userEntry = CONFIG.employees.find(e => e.id === id);
        // Special case for admin/sekretariat if they are not in the employees list yet (should not happen with good data)
        if (userEntry) {
            if (userEntry.pin && String(userEntry.pin) !== pwd) {
                if (errorEl && !isAutoLogin) {
                    errorEl.textContent = 'Falscher PIN.';
                    errorEl.style.display = 'block';
                }
                if (isAutoLogin) {
                    localStorage.removeItem('last_user_id');
                    localStorage.removeItem('last_user_pin');
                }
                return;
            }
        } else if (id !== 'admin' && id !== 'sekretariat') {
            // Only allow non-listed login for hardcoded admin/sekretariat if they are not in the DB
            // But they should ideally be in the DB with a PIN.
            if (errorEl) {
                errorEl.textContent = 'Nutzer nicht in der Datenbank gefunden.';
                errorEl.style.display = 'block';
            }
            return;
        }

        // 5. Successful login
        localStorage.setItem('jsonbin_key', key);
        localStorage.setItem('last_user_id', id);
        localStorage.setItem('last_user_pin', pwd);
        this.currentUser = id;

        document.getElementById('loginModal').style.display = 'none';
        document.body.classList.remove('pre-login');

        this.onAfterLogin(id);

        this.updateSummary();
        this.switchTab(id === 'sekretariat' ? 'po' : 'calendar');
        this.render();
        this.updateRequestsBadge();
        setTimeout(() => this.scrollToMonth(new Date().getMonth(), true), 500);
    }

    onAfterLogin(id) {
        const isAdmin = (id === 'admin' || id === 'sekretariat' || (CONFIG.isSprecher && id === CONFIG.isSprecher));
        const isRealAdmin = (id === 'admin');
        const canDrag = (id === 'admin' || (CONFIG.isSprecher && id === CONFIG.isSprecher));

        const tabContainer = document.querySelector('.tab-container');
        if (tabContainer) tabContainer.style.display = 'flex';

        const absenceInputModePanel = document.getElementById('absenceInputModePanel');
        if (absenceInputModePanel) {
            absenceInputModePanel.style.display = canDrag ? 'flex' : 'none';
        }

        const btnExport = document.getElementById('btnExport');
        if (btnExport) btnExport.style.display = isAdmin ? 'inline-block' : 'none';

        const btnExportICal = document.getElementById('btnExportICal');
        if (btnExportICal) btnExportICal.style.display = isAdmin ? 'inline-block' : 'none';

        const btnImport = document.getElementById('btnImport');
        if (btnImport) btnImport.style.display = isRealAdmin ? 'inline-block' : 'none';

        const btnAddAbsence = document.getElementById('btnAddAbsence');
        if (btnAddAbsence) btnAddAbsence.style.display = (id === 'sekretariat' ? 'none' : 'inline-block');

        // Common tabs
        const tabs = ['admin', 'summary', 'status', 'requests', 'po', 'groups', 'skills'];
        tabs.forEach(t => {
            const el = document.getElementById('tab-' + t);
            if (el) {
                if (t === 'admin') el.style.display = isRealAdmin ? 'inline-block' : 'none';
                else if (t === 'summary' || t === 'status') el.style.display = (isAdmin && id !== CONFIG.isSprecher) ? 'inline-block' : 'none';
                else if (t === 'requests') el.style.display = (id === 'sekretariat' ? 'none' : 'inline-block');
                else if (t === 'po') el.style.display = (id === 'sekretariat' ? 'inline-block' : 'none');
                else if (t === 'groups' || t === 'skills') el.style.display = (isRealAdmin || (CONFIG.isSprecher && id === CONFIG.isSprecher)) ? 'inline-block' : 'none';
            }
        });

        const mSel = document.getElementById('modalEmp');
        if (mSel) {
            mSel.innerHTML = '';
            const allowed = (isAdmin ? CONFIG.employees.filter(e => e.active !== false && e.id !== 'admin' && e.id !== 'sekretariat') : CONFIG.employees.filter(e => e.id === id));
            allowed.forEach(e => {
                const o = document.createElement('option');
                o.value = e.id;
                o.innerText = e.name;
                mSel.appendChild(o);
                const iSel = document.getElementById('importEmp');
                if (iSel) {
                    const o2 = document.createElement('option');
                    o2.value = e.id;
                    o2.innerText = e.name;
                    iSel.appendChild(o2);
                }
            });
        }
    }

    checkPermission(eid) {
        if (this.currentUser === 'admin' || this.currentUser === 'sekretariat' || (CONFIG.isSprecher && this.currentUser === CONFIG.isSprecher) || eid === this.currentUser) return true;
        alert('Stopp! Du kannst Abwesenheiten nur in deiner eigenen Zeile eintragen oder bearbeiten.');
        return false;
    }

    render() {
        const container = document.getElementById('calendar');
        if (!container) return;
        container.innerHTML = '';
        const frag = document.createDocumentFragment();
        const isMobile = window.innerWidth <= 768;
        let lastM = -1, lastY = -1;

        this.dates.forEach((d, i) => {
            if (d.month !== lastM || d.year !== lastY) {
                const m = document.createElement('div');
                m.className = 'cell header-cell sticky-header month-header';
                m.innerText = new Date(d.year, d.month, 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' });
                m.id = `month-header-${d.year}-${d.month}`;
                m.style.gridColumnStart = i + 2;
                let s = 1, j = i + 1;
                while (j < this.dates.length && this.dates[j].month === d.month && this.dates[j].year === d.year) { s++; j++; }
                m.style.gridColumnEnd = `span ${s}`;
                frag.appendChild(m);
                lastM = d.month; lastY = d.year;
            }
        });

        const corner = document.createElement('div');
        corner.className = 'cell header-cell sticky-col sticky-corner sticky-header';
        corner.style.gridRow = '1 / span 2';
        corner.style.gridColumn = '1';
        corner.innerText = isMobile ? 'Name' : 'Mitarbeiter';
        frag.appendChild(corner);

        this.dates.forEach((d, i) => {
            const h = document.createElement('div');
            h.className = `cell header-cell sticky-header day-header ${d.isWeekend ? 'weekend' : ''} ${d.holiday ? 'holiday' : ''} ${d.isSchoolHoliday ? 'school-holiday' : ''}`;
            h.innerHTML = `<span>${d.day}</span>`;
            h.style.gridRow = 2;
            h.style.gridColumn = i + 2;
            h.dataset.date = d.dateStr;
            h.onmouseenter = (ev) => {
                const info = [d.holiday, d.schoolHoliday].filter(x => x).join(' & ');
                if (info) this.showSimpleTip(ev, info, false);
            };
            h.onmouseleave = () => this.hideTip();
            frag.appendChild(h);
        });

        const valH = document.createElement('div');
        valH.className = 'cell sticky-col validation-row';
        valH.style.gridRow = 3;
        valH.style.gridColumn = '1';
        valH.innerText = '⚠ Abdeckung';
        frag.appendChild(valH);

        this.dates.forEach((d, i) => {
            const issues = this.validateCoverage(d);
            const c = document.createElement('div');
            c.className = `cell validation-cell ${d.holiday ? 'holiday' : ''}`;
            c.id = `val-${d.dateStr}`;
            c.style.gridRow = 3;
            c.style.gridColumn = i + 2;
            if (issues) {
                c.innerHTML = `<span class="warning-text">${issues.join('<br>')}</span>`;
                c.title = 'Fehlend: ' + issues.join(', ');
            }
            frag.appendChild(c);
        });

        const emps = CONFIG.employees.filter(e => e.id !== 'admin' && e.id !== 'sekretariat' && e.active !== false);
        emps.forEach((e, ei) => {
            const n = document.createElement('div');
            n.className = 'cell employee-row-header sticky-col';
            n.style.gridRow = ei + 4;
            n.style.gridColumn = '1';
            const displayName = isMobile ? (e.name.split(' ').pop() || e.name) : e.name;
            n.innerHTML = `<span>${displayName}</span>`;
            const vacBadge = document.createElement('span');
            vacBadge.id = `vac-badge-${e.id}`;
            vacBadge.className = 'vac-badge';
            n.appendChild(vacBadge);
            this._renderVacBadge(e.id, vacBadge);

            if (this.currentUser === e.id) n.style.backgroundColor = '#e0f2fe';

            const grp = this.getPrimaryGrp(e);
            if (grp) {
                const color = this.getGroupColor(grp);
                n.style.borderLeft = `4px solid ${color}`;
                const prev = emps[ei - 1];
                if (!prev || this.getPrimaryGrp(prev) !== grp) {
                    const lbl = document.createElement('span');
                    lbl.innerText = grp;
                    lbl.style.cssText = `position:absolute; top:1px; left:4px; font-size:0.5rem; color:${color}; font-weight:bold; text-transform:uppercase; pointer-events:none;`;
                    n.appendChild(lbl);
                    n.style.borderTop = `1px solid ${color}`;
                }
                const next = emps[ei + 1];
                if (!next || this.getPrimaryGrp(next) !== grp) n.style.borderBottom = `1px solid ${color}`;
            }
            frag.appendChild(n);

            const wrapper = document.createElement('div');
            wrapper.id = `dw-${e.id}`;
            wrapper.className = 'employee-data-wrapper';
            wrapper.style.gridRow = ei + 4;
            frag.appendChild(wrapper);
        });

        container.appendChild(frag);
        this.updateNavHighlighting();
        this._visStart = -1;
        this._visEnd = -1;
        const initialEnd = Math.max(30, Math.min(this.dates.length, Math.ceil((container.clientWidth - 200) / 40) + 10));
        this.renderVisibleCells(0, initialEnd);
    }

    renderVisibleCells(startCol, endCol) {
        const emps = CONFIG.employees.filter(e => e.id !== 'admin' && e.id !== 'sekretariat' && e.active !== false);
        emps.forEach(e => {
            const wrapper = document.getElementById(`dw-${e.id}`);
            if (!wrapper) return;
            Array.from(wrapper.children).forEach(cell => {
                const ci = parseInt(cell.dataset.ci);
                if (ci < startCol || ci >= endCol) cell.remove();
            });
            for (let ci = startCol; ci < endCol; ci++) {
                const d = this.dates[ci];
                if (!d) continue;
                if (document.getElementById(`cell-${e.id}-${d.dateStr}`)) continue;
                const s = this.state[e.id]?.[d.dateStr];
                const cell = document.createElement('div');
                cell.className = `cell day-cell${d.isWeekend ? ' weekend' : ''}${d.holiday ? ' holiday' : ''}${d.isSchoolHoliday ? ' school-holiday' : ''}`;
                cell.id = `cell-${e.id}-${d.dateStr}`;
                cell.dataset.eid = e.id;
                cell.dataset.date = d.dateStr;
                cell.dataset.ci = ci;
                cell.style.cssText = `position:absolute;left:${ci * 40}px;width:40px;top:0;bottom:0`;
                if (s) {
                    const t = s.type || s;
                    cell.classList.add(t === 'U' || t === 'V' ? 'status-vacation' : t === 'D' ? 'status-trip' : t === 'F' ? 'status-training' : 'status-custom');
                    if (s.text) {
                        const span = document.createElement('span');
                        span.className = 'cell-text';
                        span.textContent = s.text;
                        cell.appendChild(span);
                    }
                } else {
                    const req = (this.state.__REQUESTS__ || []).find(r =>
                        r.empId === e.id &&
                        r.dates.includes(d.dateStr) &&
                        (r.status === 'pending_vertreter' || r.status === 'pending_admin')
                    );
                    if (req) {
                        cell.classList.add(req.status === 'pending_vertreter' ? 'status-pending-vertreter' : 'status-pending-admin');
                        cell.dataset.reqId = req.id;
                        cell.title = req.status === 'pending_vertreter'
                            ? 'Wunsch eingereicht — wartet auf Vertreter-Zustimmung'
                            : 'Wunsch eingereicht — wartet auf Admin-Freigabe';
                    }
                }
                cell.onmouseenter = (ev) => this.showTip(ev, e.id, d.dateStr);
                cell.onmouseleave = () => this.hideTip();
                wrapper.appendChild(cell);
            }
        });
        this._visStart = startCol;
        this._visEnd = endCol;
    }

    _scheduleVirtualUpdate() {
        if (this._rafPending) return;
        this._rafPending = true;
        requestAnimationFrame(() => {
            this._rafPending = false;
            const c = document.getElementById('calendar');
            if (!c) return;
            const start = Math.max(0, Math.floor(c.scrollLeft / 40) - 10);
            const end = Math.min(this.dates.length, Math.ceil((c.scrollLeft + c.clientWidth - 200) / 40) + 10);
            if (start !== this._visStart || end !== this._visEnd) {
                this.renderVisibleCells(start, end);
            }
            this.updateNavHighlighting();
        });
    }

    handleMouseDown(empId, dateStr) {
        if (this.currentUser === 'sekretariat') { alert('Du bist als Sekretariat angemeldet und kannst keine Bearbeitungen machen'); return; }
        if (!this.checkPermission(empId)) return;
        if (this.currentUser !== 'admin' && this.currentUser !== CONFIG.isSprecher) {
            this.openRequestModal(empId, dateStr);
            return;
        }
        this.isDragging = true;
        const current = this.state[empId]?.[dateStr];
        this.dragStartVal = current ? null : { type: this.currentMode, text: this.currentText, vertreter: this.currentVertreterText };
        this.setVacation(empId, dateStr, this.dragStartVal, true, true);
    }

    handleMouseOver(empId, dateStr) {
        if (this.isDragging) {
            this.setVacation(empId, dateStr, this.dragStartVal, true, true);
        }
    }

    stopDrag() {
        if (this.isDragging) {
            this.isDragging = false;
            this.dragStartVal = null;
            if (this._hasChanged) {
                this.saveState();
                this._affectedDates.forEach(d => this.updateValidationUI(d));
                this._hasChanged = false;
                this._affectedDates.clear();
            }
        }
    }

    setVacation(empId, dateStr, valObj, isDrag = false, immediateDOM = false) {
        if (!this.state[empId]) this.state[empId] = {};
        if (valObj) this.state[empId][dateStr] = valObj;
        else delete this.state[empId][dateStr];

        if (isDrag) {
            this._hasChanged = true;
            this._affectedDates.add(dateStr);
        }

        if (immediateDOM) {
            const cell = document.getElementById(`cell-${empId}-${dateStr}`);
            if (cell) {
                cell.classList.remove('status-vacation', 'status-trip', 'status-training', 'status-custom');
                cell.innerHTML = '';
                if (valObj) {
                    const t = valObj.type;
                    cell.classList.add(t === 'U' || t === 'V' ? 'status-vacation' : t === 'D' ? 'status-trip' : t === 'F' ? 'status-training' : 'status-custom');
                    if (valObj.text) {
                        const span = document.createElement('span');
                        span.className = 'cell-text';
                        span.textContent = valObj.text;
                        cell.appendChild(span);
                    }
                }
            }
            this.updateValidationUI(dateStr);
            this._renderVacBadge(empId);
        } else if (!isDrag) {
            this.render();
        }
    }

    updateValidationUI(dateStr) {
        const valCell = document.getElementById(`val-${dateStr}`);
        if (!valCell) return;
        const dObj = this._datesMap.get(dateStr);
        if (!dObj) return;
        const issues = this.validateCoverage(dObj);
        valCell.innerHTML = '';
        if (issues) {
            valCell.innerHTML = `<span class="warning-text">${issues.join('<br>')}</span>`;
            valCell.title = 'Fehlend: ' + issues.join(', ');
        } else {
            valCell.title = '';
        }
    }

    scrollToMonth(m, cur) {
        const y = cur ? this.currentYear || CONFIG.years[0] : CONFIG.years[0];
        const el = document.getElementById(`month-header-${y}-${m}`);
        const c = document.getElementById('calendar');
        if (el && c) {
            const offset = document.querySelector('.sticky-corner').offsetWidth;
            c.scrollTo({ left: el.offsetLeft - offset, behavior: 'smooth' });
        }
    }

    setYear(y) {
        this.currentYear = y;
        this.scrollToMonth(0, true);
        this.updateVacationBadges();
    }

    updateNavHighlighting() {
        const c = document.getElementById('calendar');
        if (!c) return;
        const dIdx = Math.min(Math.floor(c.scrollLeft / 40), this.dates.length - 1);
        const d = this.dates[dIdx < 0 ? 0 : dIdx];
        if (d) {
            this.currentYear = d.year;
            CONFIG.years.forEach(y => {
                const b = document.getElementById(`btn-year-${y}`);
                if (b) b.classList.toggle('primary', y === d.year);
            });
            for (let i = 0; i < 12; i++) {
                const b = document.getElementById(`btn-month-${i}`);
                if (b) b.classList.toggle('primary', i === d.month);
            }
        }
    }

    editAbsence(eid, d) {
        if (!this.checkPermission(eid)) return;
        const s = this.state[eid]?.[d];
        if (!s) return;
        const modalEmp = document.getElementById('modalEmp');
        const modalType = document.getElementById('modalType');
        const modalText = document.getElementById('modalText');
        const modalVertreterInput = document.getElementById('modalVertreterInput');
        const modalVertreterId = document.getElementById('modalVertreterId');
        const vertreterResults = document.getElementById('vertreterResults');
        const modalStart = document.getElementById('modalStart');
        const modalEnd = document.getElementById('modalEnd');
        const addModal = document.getElementById('addModal');

        if (modalEmp) modalEmp.value = eid;
        if (modalType) modalType.value = (s.type === 'T' ? 'S' : s.type) || 'U';
        if (modalText) modalText.value = s.text || '';
        if (modalVertreterInput) modalVertreterInput.value = s.vertreter || '';
        if (modalVertreterId) modalVertreterId.value = s.vertreterId || '';
        if (vertreterResults) vertreterResults.innerHTML = '';
        const titleEl = document.querySelector('#addModal h2');
        if (titleEl) titleEl.textContent = 'Abwesenheit eintragen';
        if (modalStart) modalStart.value = d;
        if (modalEnd) modalEnd.value = d;
        if (addModal) addModal.style.display = 'flex';
    }

    openModal() {
        const modalType = document.getElementById('modalType');
        const modalText = document.getElementById('modalText');
        const modalVertreterInput = document.getElementById('modalVertreterInput');
        const modalVertreterId = document.getElementById('modalVertreterId');
        const vertreterResults = document.getElementById('vertreterResults');
        const addModal = document.getElementById('addModal');

        if (modalType) modalType.value = this.currentMode;
        if (modalText) modalText.value = '';
        if (modalVertreterInput) modalVertreterInput.value = '';
        if (modalVertreterId) modalVertreterId.value = '';
        if (vertreterResults) vertreterResults.innerHTML = '';
        const titleEl = document.querySelector('#addModal h2');
        if (titleEl) titleEl.textContent = 'Abwesenheit eintragen';
        if (addModal) addModal.style.display = 'flex';
    }

    addRange() {
        const isAdmin = (this.currentUser === 'admin' || this.currentUser === CONFIG.isSprecher);
        if (isAdmin) {
            this._addRangeDirect();
        } else {
            this.submitRequest();
        }
    }

    _addRangeDirect() {
        const eid = document.getElementById('modalEmp').value;
        const type = document.getElementById('modalType').value;
        const text = document.getElementById('modalText').value;
        const vertreter = document.getElementById('modalVertreterInput').value;
        const vertreterId = document.getElementById('modalVertreterId').value;
        const start = document.getElementById('modalStart').value;
        const end = document.getElementById('modalEnd').value;
        if (!eid || !start || !end) return;
        if (!this.checkPermission(eid)) return;
        let curr = new Date(start), endD = new Date(end);
        while (curr <= endD) {
            const ds = this.formatDate(curr);
            if (!this.state[eid]) this.state[eid] = {};
            this.state[eid][ds] = { type, text, vertreter, vertreterId, status: 'confirmed' };
            curr.setDate(curr.getDate() + 1);
        }
        this.saveState();
        this.render();
        document.getElementById('addModal').style.display = 'none';
    }

    openRequestModal(empId, dateStr) {
        const modal = document.getElementById('addModal');
        document.getElementById('modalEmp').value = empId;
        document.getElementById('modalStart').value = dateStr;
        document.getElementById('modalEnd').value = dateStr;
        document.getElementById('modalType').value = 'U';
        document.getElementById('modalText').value = '';
        document.getElementById('modalVertreterInput').value = '';
        document.getElementById('modalVertreterId').value = '';
        document.getElementById('vertreterResults').innerHTML = '';
        document.getElementById('vertreterGroup').style.display = this.needsVertreter(empId) ? '' : 'none';
        const titleEl = modal.querySelector('h2');
        if (titleEl) titleEl.textContent = 'Abwesenheitswunsch einreichen';
        const vertreterInput = document.getElementById('modalVertreterInput');
        const vertreterResults = document.getElementById('vertreterResults');
        const showVertreterList = () => {
            const q = vertreterInput.value.toLowerCase().trim();
            const reqEmp = CONFIG.employees.find(e => e.id === empId);
            const reqGrps = Array.isArray(reqEmp?.groups) ? reqEmp.groups : (reqEmp?.group ? [reqEmp.group] : []);
            const startVal = document.getElementById('modalStart').value;
            const endVal = document.getElementById('modalEnd').value;
            const reqDates = [];
            if (startVal) {
                let cur = new Date(startVal), endD = new Date(endVal || startVal);
                while (cur <= endD) { reqDates.push(this.formatDate(cur)); cur.setDate(cur.getDate() + 1); }
            }
            const candidates = CONFIG.employees.map(e => {
                if (e.id === empId || e.id === 'admin' || e.id === 'sekretariat' || e.active === false) return null;
                if (q && !e.name.toLowerCase().includes(q)) return null;
                const eGrps = Array.isArray(e.groups) ? e.groups : (e.group ? [e.group] : []);
                if (reqGrps.length > 0 && !eGrps.some(g => reqGrps.includes(g))) return null;
                const absentDates = reqDates.filter(d => this.state[e.id]?.[d]);
                if (absentDates.length === reqDates.length && reqDates.length > 0) return null;
                return { e, partial: absentDates.length > 0, absentDates };
            }).filter(Boolean);
            vertreterResults.innerHTML = candidates.slice(0, 10).map(({ e, partial, absentDates }) => {
                const warning = partial ? ` <span style="color:#f59e0b;font-size:0.8rem">⚠ abwesend: ${absentDates.join(', ')}</span>` : '';
                return `<div style="padding:6px 10px;cursor:pointer;border-bottom:1px solid #f0f0f0;${partial ? 'background:#fffbeb' : ''}" onmousedown="document.getElementById('modalVertreterInput').value='${e.name.replace(/'/g, "\\'")}';document.getElementById('modalVertreterId').value='${e.id}';document.getElementById('vertreterResults').innerHTML=''">${e.name}${warning}</div>`;
            }).join('') || '<div style="padding:6px 10px;color:#9ca3af;font-size:0.85rem">Keine verfügbaren Kollegen aus gleicher Gruppe</div>';
        };
        vertreterInput.oninput = showVertreterList;
        vertreterInput.onfocus = showVertreterList;
        vertreterInput.onblur = () => setTimeout(() => { vertreterResults.innerHTML = ''; }, 200);
        this._showVertreterListFn = showVertreterList;
        this._requestModalEmpId = empId;
        this.onModalDateChange();
        modal.style.display = 'flex';
    }

    onModalDateChange() {
        if (typeof this._showVertreterListFn === 'function') this._showVertreterListFn();
        const empId = this._requestModalEmpId;
        if (!empId || this.currentUser === 'admin' || this.currentUser === CONFIG.isSprecher) return;
        const startVal = document.getElementById('modalStart').value;
        const endVal = document.getElementById('modalEnd').value;
        if (!startVal) return;
        const dates = [];
        let cur = new Date(startVal), endD = new Date(endVal || startVal);
        while (cur <= endD) { dates.push(this.formatDate(cur)); cur.setDate(cur.getDate() + 1); }
        const issues = this.checkCoverageForRequest(empId, dates);
        const box = document.getElementById('coverageWarning');
        if (!box) return;
        if (issues.length > 0) {
            const lines = issues.map(({ date, missing }) => `${date}: fehlend ${missing.join(', ')}`).join('<br>');
            box.innerHTML = `⚠ <strong>Abdeckungsproblem:</strong> Deine Abwesenheit würde an folgenden Tagen die Mindestbesetzung verletzen:<br>${lines}<br><small>Du kannst den Antrag trotzdem einreichen.</small>`;
            box.style.display = 'block';
        } else {
            box.style.display = 'none';
        }
    }

    checkCoverageForRequest(empId, dates) {
        const issues = [];
        for (const dateStr of dates) {
            const dObj = this._datesMap?.get(dateStr);
            if (!dObj || dObj.isWeekend || dObj.holiday) continue;
            if (!this.state[empId]) this.state[empId] = {};
            const prev = this.state[empId][dateStr];
            this.state[empId][dateStr] = { type: 'U', status: 'confirmed' };
            const result = this.validateCoverage(dObj);
            if (prev === undefined) delete this.state[empId][dateStr];
            else this.state[empId][dateStr] = prev;
            if (result) issues.push({ date: dateStr, missing: result });
        }
        return issues;
    }

    submitRequest() {
        const eid = document.getElementById('modalEmp').value;
        const type = document.getElementById('modalType').value;
        const text = document.getElementById('modalText').value;
        const vertreter = document.getElementById('modalVertreterInput').value;
        const vertreterId = document.getElementById('modalVertreterId').value;
        const start = document.getElementById('modalStart').value;
        const end = document.getElementById('modalEnd').value;

        if (this.needsVertreter(eid) && !vertreterId) { alert('Bitte einen Vertreter aus der Liste auswählen.'); return; }

        const dates = [];
        let curr = new Date(start), endD = new Date(end);
        while (curr <= endD) { dates.push(this.formatDate(curr)); curr.setDate(curr.getDate() + 1); }

        if (this.needsVertreter(eid)) {
            const vertreterAbsentDates = dates.filter(d => this.state[vertreterId]?.[d]);
            if (vertreterAbsentDates.length > 0) {
                alert(`${vertreter} ist an folgenden Tagen selbst abwesend: ${vertreterAbsentDates.join(', ')}.\n\nBitte teile den Antrag auf und wähle für diese Tage einen anderen Vertreter.`);
                return;
            }
        }

        const conflict = this.checkVertretungConflict(eid, dates);
        if (conflict) {
            alert(`Achtung: Du bist an ${conflict.date} bereits als Vertreter für ${conflict.who} eingetragen. Wunsch kann nicht eingereicht werden.`);
            return;
        }

        if (type === 'U') {
            const reqYear = new Date(start).getFullYear();
            const quota = (this.state.__VACATION_QUOTA__ || {})[eid] ?? 30;
            const entries = this.state[eid] || {};
            const alreadyUsed = Object.entries(entries).filter(([d, v]) =>
                d.startsWith(String(reqYear)) && v && v.type === 'U' && this.isWorkday(d)
            ).length;
            const newDays = dates.filter(d => d.startsWith(String(reqYear)) && this.isWorkday(d)).length;
            const total = alreadyUsed + newDays;
            if (total > quota) {
                alert(`Urlaubskontingent überschritten!\n\nBereits genommen: ${alreadyUsed} Tage\nNeu beantragt:    ${newDays} Tage\nGesamt:           ${total} Tage\nKontingent:       ${quota} Tage\n\nDer Antrag kann nicht eingereicht werden.`);
                return;
            }
        }

        const coverageIssues = this.checkCoverageForRequest(eid, dates);
        if (coverageIssues.length > 0) {
            const lines = coverageIssues.map(({ date, missing }) => `${date}: fehlend ${missing.join(', ')}`).join('\n');
            const proceed = confirm(`⚠ Abdeckungsproblem:\nDeine Abwesenheit würde an folgenden Tagen die Mindestbesetzung verletzen:\n\n${lines}\n\nTrotzdem einreichen?`);
            if (!proceed) return;
        }

        const req = {
            id: 'req_' + Date.now(),
            empId: eid, type, text, vertreter, vertreterId, dates,
            status: this.needsVertreter(eid) ? 'pending_vertreter' : 'pending_admin',
            createdAt: this.formatDate(new Date()),
            rejectedBy: null, rejectionNote: null,
            stamps: { submitted: this.makeStamp() }
        };
        if (!this.state.__REQUESTS__) this.state.__REQUESTS__ = [];
        this.state.__REQUESTS__.push(req);
        this.saveState();
        this.render();
        this.updateRequestsBadge();
        document.getElementById('addModal').style.display = 'none';
    }

    checkVertretungConflict(empId, dates) {
        for (const dateStr of dates) {
            for (const otherId of Object.keys(this.state)) {
                if (otherId.startsWith('__') || otherId === empId) continue;
                const entry = this.state[otherId]?.[dateStr];
                if (entry && entry.vertreterId === empId && entry.status === 'confirmed') {
                    const other = CONFIG.employees.find(e => e.id === otherId);
                    return { date: dateStr, who: other?.name || otherId };
                }
            }
        }
        return null;
    }

    approveAsVertreter(reqId) {
        const req = (this.state.__REQUESTS__ || []).find(r => r.id === reqId);
        if (!req) return;
        const coverageIssues = this.checkCoverageForRequest(req.empId, req.dates);
        if (coverageIssues.length > 0) {
            const lines = coverageIssues.map(({ date, missing }) => `${date}: fehlend ${missing.join(', ')}`).join('\n');
            const proceed = confirm(`⚠ Abdeckungsproblem:\nDiese Abwesenheit würde an folgenden Tagen die Mindestbesetzung verletzen:\n\n${lines}\n\nTrotzdem zustimmen?`);
            if (!proceed) return;
        }
        req.status = 'pending_admin';
        if (!req.stamps) req.stamps = {};
        req.stamps.vertreter = this.makeStamp();
        this.saveState();
        this.render();
        this.renderRequestsTab();
        this.updateRequestsBadge();
    }

    approveAsAdmin(reqId) {
        const req = (this.state.__REQUESTS__ || []).find(r => r.id === reqId);
        if (!req) return;
        const coverageIssues = this.checkCoverageForRequest(req.empId, req.dates);
        if (coverageIssues.length > 0) {
            const lines = coverageIssues.map(({ date, missing }) => `${date}: fehlend ${missing.join(', ')}`).join('\n');
            const proceed = confirm(`⚠ Abdeckungsproblem:\nDiese Abwesenheit würde an folgenden Tagen die Mindestbesetzung verletzen:\n\n${lines}\n\nTrotzdem genehmigen?`);
            if (!proceed) return;
        }
        req.status = 'approved';
        if (!req.stamps) req.stamps = {};
        req.stamps.admin = this.makeStamp();
        if (!this.state[req.empId]) this.state[req.empId] = {};
        req.dates.forEach(ds => {
            this.state[req.empId][ds] = {
                type: req.type,
                text: req.text,
                vertreter: req.vertreter,
                vertreterId: req.vertreterId,
                status: 'confirmed'
            };
        });
        this.saveState();
        this.render();
        this.renderRequestsTab();
        this.updateRequestsBadge();
    }

    rejectRequest(reqId, by, note) {
        const req = (this.state.__REQUESTS__ || []).find(r => r.id === reqId);
        if (!req) return;
        req.status = 'rejected';
        req.rejectedBy = by;
        req.rejectionNote = note || null;
        if (!req.stamps) req.stamps = {};
        req.stamps.rejected = this.makeStamp();
        this.saveState();
        this.render();
        this.renderRequestsTab();
        this.updateRequestsBadge();
    }

    updateRequestsBadge() {
        const badge = document.getElementById('requests-badge');
        if (!badge) return;
        const requests = this.state.__REQUESTS__ || [];
        const cu = this.currentUser;
        const isAdmin = cu === 'admin' || cu === CONFIG.isSprecher;
        let count = 0;
        if (isAdmin) {
            count = requests.filter(r => r.status === 'pending_admin').length;
        } else {
            count = requests.filter(r => r.vertreterId === cu && r.status === 'pending_vertreter').length;
            const ownPending = requests.filter(r => r.empId === cu && (r.status === 'pending_vertreter' || r.status === 'pending_admin')).length;
            if (count === 0) count = ownPending;
        }
        badge.textContent = count > 0 ? String(count) : '';
    }

    _fmtStamp(stamp, label) {
        if (!stamp) return '';
        const d = new Date(stamp.at);
        const ds = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const ts = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        return `<div style="font-size:0.72rem;color:#6b7280;margin-top:3px;padding:3px 8px;background:#f9fafb;border-radius:3px;border-left:3px solid #d1d5db"><strong>${label}</strong>: ${stamp.name} · ${ds}, ${ts} Uhr · ${stamp.device}</div>`;
    }

    renderRequestsTab() {
        const container = document.getElementById('requestsList');
        if (!container) return;
        const requests = this.state.__REQUESTS__ || [];
        const cu = this.currentUser;
        const isAdmin = cu === 'admin';
        const isSprecher = (CONFIG.isSprecher && cu === CONFIG.isSprecher);
        let html = '';

        const typeLabel = { U: 'Urlaub', D: 'Dienstreise', F: 'Fortbildung', T: 'Sonstiges', S: 'Sonstiges' };
        const statusLabel = {
            pending_vertreter: '⏳ Wartet auf Vertreter-Zustimmung',
            pending_admin: '⏳ Wartet auf Admin-Freigabe',
            approved: '✓ Genehmigt',
            rejected: '✗ Abgelehnt'
        };

        if (isAdmin || isSprecher) {
            const adminReqs = requests.filter(r => r.status === 'pending_admin');
            if (adminReqs.length === 0) {
                html += '<p style="color:#6b7280">Keine offenen Anfragen zur Genehmigung.</p>';
            } else {
                adminReqs.forEach(req => {
                    const emp = CONFIG.employees.find(e => e.id === req.empId);
                    const from = req.dates[0], to = req.dates[req.dates.length - 1];
                    html += `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;background:#fff">
                        <strong>${emp?.name || req.empId}</strong> — ${from}${from !== to ? ' bis ' + to : ''} — ${typeLabel[req.type] || req.type}
                        ${req.text ? `<br><em>${req.text}</em>` : ''}
                        <br>Vertreter: ${req.vertreter} ✓
                        ${this._fmtStamp(req.stamps?.submitted, 'Antrag')}
                        ${this._fmtStamp(req.stamps?.vertreter, 'Vertreter-Zustimmung')}
                        ${isAdmin ? `
                        <br><div id="reject-area-${req.id}" style="display:none;margin-top:8px">
                            <input type="text" id="reject-note-${req.id}" placeholder="Ablehnungsgrund (optional)" style="width:100%;padding:4px;margin-bottom:4px">
                        </div>
                        <div style="margin-top:8px;display:flex;gap:8px">
                            <button onclick="app.approveAsAdmin('${req.id}')" style="background:#22c55e;color:white;border:none;padding:6px 14px;border-radius:4px;cursor:pointer">Genehmigen</button>
                            <button onclick="document.getElementById('reject-area-${req.id}').style.display='block';this.style.display='none';document.getElementById('confirm-reject-${req.id}').style.display='inline'" style="background:#f3f4f6;border:1px solid #d1d5db;padding:6px 14px;border-radius:4px;cursor:pointer">Ablehnen...</button>
                            <button onclick="app.rejectRequest('${req.id}','admin',document.getElementById('reject-note-${req.id}').value)" style="display:none;background:#ef4444;color:white;border:none;padding:6px 14px;border-radius:4px;cursor:pointer" id="confirm-reject-${req.id}">Ablehnen bestätigen</button>
                        </div>` : '<br><span style="color:#6b7280;font-size:0.85rem;margin-top:6px;display:inline-block">⏳ Wartet auf Genehmigung durch Admin</span>'}
                    </div>`;
                });
            }
            const history = requests.filter(r => r.status === 'approved' || r.status === 'rejected');
            if (history.length > 0) {
                html += '<h4 style="margin-top:20px;color:#374151">Verlauf</h4>';
                history.forEach(req => {
                    const emp = CONFIG.employees.find(e => e.id === req.empId);
                    const from = req.dates[0], to = req.dates[req.dates.length - 1];
                    const statusColor = req.status === 'approved' ? '#22c55e' : '#ef4444';
                    const rejectedBy = req.rejectedBy === 'vertreter' ? 'Vertreter' : 'Admin';
                    html += `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:8px;background:#f9fafb;opacity:0.8">
                        <strong>${emp?.name || req.empId}</strong> — ${from}${from !== to ? ' bis ' + to : ''} — ${typeLabel[req.type] || req.type}
                        <span style="float:right;color:${statusColor}">${statusLabel[req.status]}</span>
                        ${req.rejectionNote ? `<br><small>Grund: ${req.rejectionNote}</small>` : ''}
                        ${this._fmtStamp(req.stamps?.submitted, 'Antrag')}
                        ${this._fmtStamp(req.stamps?.vertreter, 'Vertreter-Zustimmung')}
                        ${req.status === 'approved' ? this._fmtStamp(req.stamps?.admin, 'Genehmigung Admin') : this._fmtStamp(req.stamps?.rejected, `Ablehnung (${rejectedBy})`)}
                    </div>`;
                });
            }
        } else {
            const vertretenReqs = requests.filter(r => r.vertreterId === cu && r.status === 'pending_vertreter');
            if (vertretenReqs.length > 0) {
                html += '<h4 style="color:#374151;margin-bottom:12px">Vertretungsanfragen</h4>';
                vertretenReqs.forEach(req => {
                    const emp = CONFIG.employees.find(e => e.id === req.empId);
                    const from = req.dates[0], to = req.dates[req.dates.length - 1];
                    html += `<div style="border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:12px;background:#eff6ff">
                        <strong>${emp?.name || req.empId}</strong> möchte vom <strong>${from}</strong>${from !== to ? ' bis <strong>' + to + '</strong>' : ''} ${typeLabel[req.type] || req.type} nehmen.
                        ${req.text ? `<br>Beschreibung: <em>${req.text}</em>` : ''}
                        ${this._fmtStamp(req.stamps?.submitted, 'Antrag')}
                        <br><div id="reject-area-v-${req.id}" style="display:none;margin-top:8px">
                            <input type="text" id="reject-note-v-${req.id}" placeholder="Ablehnungsgrund (optional)" style="width:100%;padding:4px;margin-bottom:4px">
                        </div>
                        <div style="margin-top:10px;display:flex;gap:8px">
                            <button onclick="app.approveAsVertreter('${req.id}')" style="background:#22c55e;color:white;border:none;padding:6px 14px;border-radius:4px;cursor:pointer">Zustimmen</button>
                            <button onclick="document.getElementById('reject-area-v-${req.id}').style.display='block';document.getElementById('confirm-reject-v-${req.id}').style.display='inline'" style="background:#f3f4f6;border:1px solid #d1d5db;padding:6px 14px;border-radius:4px;cursor:pointer">Ablehnen...</button>
                            <button onclick="app.rejectRequest('${req.id}','vertreter',document.getElementById('reject-note-v-${req.id}').value)" style="display:none;background:#ef4444;color:white;border:none;padding:6px 14px;border-radius:4px;cursor:pointer" id="confirm-reject-v-${req.id}">Ablehnen bestätigen</button>
                        </div>
                    </div>`;
                });
            }
            const ownReqs = requests.filter(r => r.empId === cu);
            if (ownReqs.length > 0) {
                html += '<h4 style="color:#374151;margin-bottom:12px;margin-top:20px">Meine Anfragen</h4>';
                ownReqs.forEach(req => {
                    const from = req.dates[0], to = req.dates[req.dates.length - 1];
                    const statusColor = { pending_vertreter: '#3b82f6', pending_admin: '#f59e0b', approved: '#22c55e', rejected: '#ef4444' }[req.status] || '#6b7280';
                    const rejectedBy = req.rejectedBy === 'vertreter' ? 'Vertreter' : 'Admin';
                    html += `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:8px;background:#fff">
                        <strong>${typeLabel[req.type] || req.type}</strong>: ${from}${from !== to ? ' – ' + to : ''}
                        | Vertreter: ${req.vertreter}
                        <span style="float:right;color:${statusColor}">${statusLabel[req.status] || req.status}</span>
                        ${req.rejectionNote ? `<br><small style="color:#ef4444">Ablehnungsgrund: ${req.rejectionNote}</small>` : ''}
                        ${this._fmtStamp(req.stamps?.submitted, 'Antrag')}
                        ${this._fmtStamp(req.stamps?.vertreter, 'Vertreter-Zustimmung')}
                        ${req.status === 'approved' ? this._fmtStamp(req.stamps?.admin, 'Genehmigung Admin') : ''}
                        ${req.status === 'rejected' ? this._fmtStamp(req.stamps?.rejected, `Ablehnung (${rejectedBy})`) : ''}
                    </div>`;
                });
            }
            if (vertretenReqs.length === 0 && ownReqs.length === 0) {
                html += '<p style="color:#6b7280">Keine Anfragen vorhanden.</p>';
            }
        }
        container.innerHTML = html;
    }

    renderPOView() {
        const container = document.getElementById('poList');
        if (!container) return;
        const requests = this.state.__REQUESTS__ || [];
        const poDone = this.state.__PO_DONE__ || {};

        const approved = requests.filter(r => r.status === 'approved');
        if (approved.length === 0) {
            container.innerHTML = '<p style="color:#6b7280">Keine genehmigten Abwesenheiten vorhanden.</p>';
            return;
        }

        const typeLabel = { U: 'Urlaub', D: 'Dienstreise', F: 'Fortbildung', T: 'Sonstiges', S: 'Sonstiges' };
        approved.sort((a, b) => (a.dates[0] || '').localeCompare(b.dates[0] || ''));

        const pending = approved.filter(r => !poDone[r.id]);
        const done = approved.filter(r => poDone[r.id]);

        let html = '<h3 style="margin-bottom:16px;color:#111827">Genehmigte Abwesenheiten — Übertragung in PO</h3>';

        if (pending.length > 0) {
            html += '<table style="width:100%;border-collapse:collapse;margin-bottom:24px">';
            html += '<thead><tr style="background:#f3f4f6;text-align:left">';
            html += '<th style="padding:8px 12px;border:1px solid #e5e7eb">Person</th>';
            html += '<th style="padding:8px 12px;border:1px solid #e5e7eb">Von</th>';
            html += '<th style="padding:8px 12px;border:1px solid #e5e7eb">Bis</th>';
            html += '<th style="padding:8px 12px;border:1px solid #e5e7eb">Art</th>';
            html += '<th style="padding:8px 12px;border:1px solid #e5e7eb">Vertreter</th>';
            html += '<th style="padding:8px 12px;border:1px solid #e5e7eb">In PO eingetragen</th>';
            html += '</tr></thead><tbody>';

            pending.forEach(req => {
                const emp = CONFIG.employees.find(e => e.id === req.empId);
                const from = req.dates[0], to = req.dates[req.dates.length - 1];
                html += `<tr style="background:#fff">`;
                html += `<td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:500">${emp?.name || req.empId}</td>`;
                html += `<td style="padding:8px 12px;border:1px solid #e5e7eb">${from}</td>`;
                html += `<td style="padding:8px 12px;border:1px solid #e5e7eb">${to}</td>`;
                html += `<td style="padding:8px 12px;border:1px solid #e5e7eb">${typeLabel[req.type] || req.type}</td>`;
                html += `<td style="padding:8px 12px;border:1px solid #e5e7eb">${req.vertreter || '—'}</td>`;
                html += `<td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center">
                    <input type="checkbox" onchange="app.markPODone('${req.id}', this.checked)" style="width:18px;height:18px;cursor:pointer">
                </td>`;
                html += '</tr>';
            });
            html += '</tbody></table>';
        } else {
            html += '<p style="color:#22c55e;margin-bottom:24px">&#10003; Alle genehmigten Abwesenheiten wurden in PO eingetragen.</p>';
        }

        if (done.length > 0) {
            html += `<details style="margin-top:16px"><summary style="cursor:pointer;color:#6b7280;font-size:0.9rem">Bereits eingetragen (${done.length})</summary>`;
            html += '<table style="width:100%;border-collapse:collapse;margin-top:8px;opacity:0.6">';
            html += '<thead><tr style="background:#f3f4f6;text-align:left">';
            html += '<th style="padding:6px 10px;border:1px solid #e5e7eb">Person</th><th style="padding:6px 10px;border:1px solid #e5e7eb">Von</th><th style="padding:6px 10px;border:1px solid #e5e7eb">Bis</th><th style="padding:6px 10px;border:1px solid #e5e7eb">Art</th><th style="padding:6px 10px;border:1px solid #e5e7eb">Vertreter</th><th style="padding:6px 10px;border:1px solid #e5e7eb">Status</th>';
            html += '</tr></thead><tbody>';
            done.forEach(req => {
                const emp = CONFIG.employees.find(e => e.id === req.empId);
                const from = req.dates[0], to = req.dates[req.dates.length - 1];
                html += `<tr style="background:#f9fafb">`;
                html += `<td style="padding:6px 10px;border:1px solid #e5e7eb">${emp?.name || req.empId}</td>`;
                html += `<td style="padding:6px 10px;border:1px solid #e5e7eb">${from}</td>`;
                html += `<td style="padding:6px 10px;border:1px solid #e5e7eb">${to}</td>`;
                html += `<td style="padding:6px 10px;border:1px solid #e5e7eb">${typeLabel[req.type] || req.type}</td>`;
                html += `<td style="padding:6px 10px;border:1px solid #e5e7eb">${req.vertreter || '—'}</td>`;
                html += `<td style="padding:6px 10px;border:1px solid #e5e7eb;color:#22c55e">&#10003; Eingetragen${req.stamps?.po ? '<br>' + this._fmtStamp(req.stamps.po, 'PO-Eintragung') : ''}</td>`;
                html += '</tr>';
            });
            html += '</tbody></table></details>';
        }
        container.innerHTML = html;
    }

    markPODone(reqId, checked) {
        if (!this.state.__PO_DONE__) this.state.__PO_DONE__ = {};
        const req = (this.state.__REQUESTS__ || []).find(r => r.id === reqId);
        if (checked) {
            this.state.__PO_DONE__[reqId] = true;
            if (req) { if (!req.stamps) req.stamps = {}; req.stamps.po = this.makeStamp(); }
        } else {
            delete this.state.__PO_DONE__[reqId];
            if (req && req.stamps) delete req.stamps.po;
        }
        this.saveState();
        this.renderPOView();
    }

    showTip(ev, eid, d) {
        if (this.isDragging) return;
        const s = eid ? this.state[eid]?.[d] : null;
        const dObj = this._datesMap.get(d);
        if (!dObj) return;
        const info = [dObj.holiday, dObj.schoolHoliday].filter(x => x).join(' & ');
        if (!s && !info) return;
        const TYPE_NAMES = { U: 'Urlaub', D: 'Dienstreise', F: 'Fortbildung', T: 'Sonstiges', S: 'Sonstiges' };
        let tip = `<strong>${s ? (s.text || TYPE_NAMES[s.type] || s.type) : ''}</strong>`;
        if (s && s.vertreter) tip += `<br>Vertreter: ${s.vertreter}`;
        if (info) tip += `<br>${info}`;
        this.showSimpleTip(ev, tip, true);
    }

    showSimpleTip(ev, text, isHTML = false) {
        const t = document.getElementById('custom-tooltip');
        if (!t) return;
        if (isHTML) t.innerHTML = text;
        else t.innerHTML = `<strong>${text}</strong>`;
        t.style.display = 'block';
        t.style.left = ev.clientX + 10 + 'px';
        t.style.top = ev.clientY + 10 + 'px';
    }

    hideTip() {
        const t = document.getElementById('custom-tooltip');
        if (t) t.style.display = 'none';
    }

    switchTab(tabId) {
        const tabs = ['calendar', 'summary', 'status', 'admin', 'requests', 'po', 'groups', 'skills'];
        tabs.forEach(t => { const btn = document.getElementById('tab-' + t); if (btn) btn.classList.remove('active'); });
        const activeBtn = document.getElementById('tab-' + tabId);
        if (activeBtn) activeBtn.classList.add('active');

        const bulkPanel = document.getElementById('bulkImportPanel');
        const views = ['calendar', 'summary', 'status', 'admin', 'requests', 'po', 'groups', 'skills'];
        views.forEach(v => {
            const el = document.getElementById(v + 'View');
            if (el) el.style.display = (v === tabId) ? 'block' : 'none';
        });

        if (bulkPanel) bulkPanel.style.display = (tabId === 'calendar' && (this.currentUser === 'admin' || this.currentUser === 'sekretariat')) ? 'flex' : 'none';

        if (tabId === 'admin') this.renderAdminTable();
        if (tabId === 'requests') this.renderRequestsTab();
        if (tabId === 'po') this.renderPOView();
        if (tabId === 'groups') this.renderGroupsAdmin();
        if (tabId === 'skills') this.renderSkillsAdmin();
    }

    setMode(m) { this.currentMode = m; }
    setCustomText(t) { this.currentText = t; }
    setVertreterText(t) { this.currentVertreterText = t; }

    needsVertreter(empId) {
        const emp = CONFIG.employees.find(e => e.id === empId);
        const grps = Array.isArray(emp?.groups) ? emp.groups : (emp?.group ? [emp.group] : []);
        return !grps.includes('Kein Vertreter nötig');
    }

    isWorkday(dateStr) {
        const dow = new Date(dateStr).getDay();
        return dow !== 0 && dow !== 6 && !CONFIG.holidays[dateStr];
    }

    countVacationDays(empId) {
        const year = this.currentYear || CONFIG.years[0];
        const entries = this.state[empId] || {};
        return Object.entries(entries).filter(([d, v]) =>
            d.startsWith(String(year)) && v && v.type === 'U' && this.isWorkday(d)
        ).length;
    }

    _renderVacBadge(empId, el) {
        if (!el) el = document.getElementById(`vac-badge-${empId}`);
        if (!el) return;
        const used = this.countVacationDays(empId);
        const quota = (this.state.__VACATION_QUOTA__ || {})[empId] ?? 30;
        const over = used > quota;
        el.innerHTML = `<span style="color:${over ? '#ef4444' : '#3b82f6'};font-weight:bold">${used}</span><span style="color:#9ca3af"> von </span><span class="vac-quota" onclick="app.editVacationQuota('${empId}')" title="Klicken zum Ändern">${quota}</span>`;
        el.title = `${used} von ${quota} Urlaubstagen genommen`;
    }

    updateVacationBadges() {
        const emps = CONFIG.employees.filter(e => e.id !== 'admin' && e.id !== 'sekretariat' && e.active !== false);
        emps.forEach(e => this._renderVacBadge(e.id));
    }

    editVacationQuota(empId) {
        const current = (this.state.__VACATION_QUOTA__ || {})[empId] ?? 30;
        const emp = CONFIG.employees.find(e => e.id === empId);
        const val = prompt(`Jahresurlaub für ${emp?.name || empId} (Tage):`, current);
        if (val === null) return;
        const num = parseInt(val);
        if (isNaN(num) || num < 0) { alert('Ungültige Zahl.'); return; }
        if (!this.state.__VACATION_QUOTA__) this.state.__VACATION_QUOTA__ = {};
        this.state.__VACATION_QUOTA__[empId] = num;
        this.saveState();
        this._renderVacBadge(empId);
    }

    saveState() {
        DataService.save(this.state);
        this.updateSummary();
    }

    getEmpName(id) {
        const emp = CONFIG.employees.find(e => e.id === id);
        return emp ? emp.name : id;
    }

    exportData() {
        const d = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state));
        const a = document.createElement('a'); a.href = d; a.download = CONFIG.exportFilename || "planer_data.json"; a.click();
    }

    importData(input) {
        const file = input.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (confirm('Sollen die Daten wirklich importiert werden? Bestehende Daten werden überschrieben.')) {
                    this.state = data; this.saveState(); this.render();
                }
            } catch (err) { alert('Fehler beim Importieren!'); }
        };
        reader.readAsText(file);
    }

    parseDate(d, m, y) {
        let year = y ? parseInt(y) : this.currentYear;
        if (isNaN(year)) year = this.currentYear;
        if (year < 100) year += 2000;
        return new Date(year, parseInt(m) - 1, parseInt(d));
    }

    processBulkImport() {
        const empId = document.getElementById('importEmp').value;
        const text = document.getElementById('importText').value.trim();
        if (!text || !empId) return alert('Bitte Mitarbeiter und Text angeben.');
        if (this.currentUser !== 'admin' && this.currentUser !== 'sekretariat' && empId !== this.currentUser) { alert('Bulk-Import ist nur für den eigenen Nutzer möglich.'); return; }

        const lines = text.split('\n');
        let count = 0;
        if (!this.state[empId]) this.state[empId] = {};

        lines.forEach(line => {
            line = line.trim(); if (!line) return;
            let start, end, descRaw, match = line.match(/(\d{1,2})\.(\d{1,2})\.(?:(\d{2,4})?)\s*(?:bis|-)\s*(\d{1,2})\.(\d{1,2})\.(?:(\d{2,4})?)\s*(.*)/i);
            if (match) {
                const [, d1, m1, y1, d2, m2, y2, desc] = match;
                start = this.parseDate(d1, m1, y1); end = this.parseDate(d2, m2, y2); descRaw = desc;
            } else {
                match = line.match(/(\d{1,2})\.(\d{1,2})\.(?:(\d{2,4})?)\s*(.*)/i);
                if (match) { const [, d1, m1, y1, desc] = match; start = this.parseDate(d1, m1, y1); end = new Date(start); descRaw = desc; }
            }
            if (start && end && start <= end) {
                let type = 'T', desc = descRaw ? descRaw.trim() : '', vertreter = '';
                const vertMatch = desc.match(/(?:Vertreter|Vertr|V):?\s*(.*)/i);
                if (vertMatch) { vertreter = vertMatch[1].trim(); desc = desc.replace(/(?:Vertreter|Vertr|V):?\s*.*/i, '').trim(); }
                const lowerDesc = desc.toLowerCase();
                if (lowerDesc.includes('urlaub')) type = 'U'; else if (lowerDesc.includes('dienstreise')) type = 'D'; else if (lowerDesc.includes('fortbildung')) type = 'F';
                let curr = new Date(start);
                const val = { type, text: desc, vertreter };
                while (curr <= end) {
                    const dStr = this.formatDate(curr);
                    if (dStr.startsWith('2026') || dStr.startsWith('2027') || dStr.startsWith('2028')) { this.state[empId][dStr] = val; }
                    curr.setDate(curr.getDate() + 1);
                }
                count++;
            }
        });
        alert(`${count} Einträge verarbeitet.`);
        document.getElementById('importText').value = '';
        this.saveState(); this.render();
    }

    updateSummary() {
        const list = [];
        CONFIG.employees.forEach(emp => {
            if (emp.id === 'admin' || emp.id === 'sekretariat' || emp.active === false || !this.state[emp.id]) return;
            const entries = Object.keys(this.state[emp.id]).sort().map(d => ({ date: d, val: this.state[emp.id][d] }));
            if (entries.length === 0) return;
            const ranges = []; let rStart = entries[0], rEnd = entries[0];
            for (let i = 1; i < entries.length; i++) {
                const curr = entries[i], d1 = new Date(rEnd.date); d1.setDate(d1.getDate() + 1);
                if (this.formatDate(d1) === curr.date && rEnd.val.type === curr.val.type && rEnd.val.text === curr.val.text) { rEnd = curr; }
                else { ranges.push(this.formatRange(rStart, rEnd)); rStart = curr; rEnd = curr; }
            }
            ranges.push(this.formatRange(rStart, rEnd));
            list.push(`${emp.name}: ${ranges.join(', ')}`);
        });
        const summaryEl = document.getElementById('exportSummary');
        if (summaryEl) summaryEl.value = list.join('\n');

        const statusList = [];
        if (this.state.__STATUS__) {
            CONFIG.employees.forEach(emp => {
                if (emp.id === 'admin' || emp.id === 'sekretariat' || emp.active === false) return;
                if (this.state.__STATUS__[emp.id]) statusList.push(`Mitarbeiter ${emp.name} fertig`);
            });
        }
        const statusEl = document.getElementById('statusSummary');
        if (statusEl) statusEl.value = statusList.join('\n');
    }

    formatRange(start, end) {
        const fmt = d => { const [y, m, day] = d.split('-'); return `${day}.${m}.`; };
        const datePart = (start.date === end.date) ? fmt(start.date) : `${fmt(start.date)} - ${fmt(end.date)}`;
        const typeMap = { 'U': 'Urlaub', 'D': 'Dienstreise', 'F': 'Fortbildung', 'T': 'Sonstiges', 'S': 'Sonstiges' };
        const t = typeMap[start.val.type] || 'Abwesend';
        return `${datePart} (${t}${start.val.text ? `: ${start.val.text}` : ''})`;
    }

    deleteEmployee(empId) {
        if (confirm('Mitarbeiter wirklich löschen?')) { CONFIG.employees = CONFIG.employees.filter(e => e.id !== empId); this.renderAdminTable(); }
    }

    saveEmployees() {
        if (!confirm('Änderungen an der Mitarbeiterliste speichern?')) return;
        this.sortEmployees(); document.body.style.cursor = 'wait';
        DataService.save(this.state).then(() => {
            document.body.style.cursor = 'default';
            this.onAfterLogin(this.currentUser);
            alert('Mitarbeiterliste gespeichert!'); this.renderAdminTable(); this.render();
        });
    }

    getGroupColor(grp) {
        if (CONFIG.groupColors && CONFIG.groupColors[grp]) return CONFIG.groupColors[grp];
        const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];
        const list = CONFIG.groupOrder || CONFIG.skills || [];
        const i = list.indexOf(grp);
        return i !== -1 ? palette[i % palette.length] : '#64748b';
    }

    // Abstract or page-specific methods to be overridden
    validateCoverage(d) { return null; }
    sortEmployees() {}
    getPrimaryGrp(e) { return ''; }
    renderAdminTable() {}
    renderGroupsAdmin() {}
    renderSkillsAdmin() {}
}
