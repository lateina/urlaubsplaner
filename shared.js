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
        return this.loadExternal(CONFIG.binId);
    }
    static async loadExternal(binId) {
        try {
            const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
                headers: { 'X-Master-Key': CONFIG.apiKey }
            });
            if (!res.ok) {
                const err = await res.json();
                console.error("JSONBin Error:", err);
                return { error: true, status: res.status, message: err.message };
            }
            const data = await res.json();
            const record = data.record || {};
            return this.migrateData(record);
        } catch (e) {
            console.error("Error loading data:", e);
            return { error: true, message: e.message };
        }
    }

    static migrateData(data) {
        if (!data || data.error) return data;

        const migrateToObj = (s) => {
            if (typeof s === 'object' && s !== null && s.id) return s;
            const name = String(s || '').trim();
            if (!name) return null;
            return {
                id: `skill_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                name: name
            };
        };

        // 1. Migrate Skills
        if (data.skills && Array.isArray(data.skills)) {
            data.skills = data.skills.map(migrateToObj).filter(Boolean);
        }

        // 2. Migrate GroupOrder
        if (data.groupOrder && Array.isArray(data.groupOrder)) {
            data.groupOrder = data.groupOrder.map(migrateToObj).filter(Boolean);
        }

        // 3. Migrate Employees Groups
        if (data.employees && Array.isArray(data.employees)) {
            const allSkills = [...(data.skills || []), ...(data.groupOrder || [])];
            
            data.employees = data.employees.map(emp => {
                const grps = Array.isArray(emp.groups) ? emp.groups : (emp.group ? [emp.group] : []);
                const migratedGroups = grps.map(g => {
                    if (typeof g === 'string' && g.startsWith('skill_')) return g;
                    const name = (typeof g === 'object' && g !== null) ? g.name : String(g || '').trim();
                    const skillObj = allSkills.find(s => s.name === name || s.id === name);
                    return skillObj ? skillObj.id : (name ? migrateToObj(name)?.id : null);
                }).filter(Boolean);

                return { ...emp, groups: migratedGroups, group: undefined };
            });
        }

        return data;
    }
    static async save(state) {
        try {
            const empsToSave = CONFIG.employees.filter(e => !e.isExternal);
            const payload = { employees: empsToSave, state };
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

window.MONTH_AREA_MAPPING = {
    'station18a': 'Station 18A',
    'station18b': 'Station 18B',
    'station19a': 'Station 19A',
    'station19b': 'Station 19B',
    'station46': 'Station 46',
    'echolabor': 'Echo',
    'kardambulanz': 'Kard Ambulanz',
    'hfambulanz': 'HF Ambulanz',
    'phambulanz': 'PH Ambulanz',
    'pneumambulanz': 'Pneu Ambulanz',
    'studienambulanz': 'Studienambulanz',
    'station93': 'Station 93',
    'cpu': 'CPU',
    'hfu': 'HFU',
    'sm': 'SM',
    'icd': 'ICD Ambulanz',
    'epu': 'EPU',
    'hkl': 'HKL',
    'med1': 'Med I',
    'med3': 'Med III',
    'bronchoskopie': 'Bronchoskopie',
    'ict': 'ICT',
    'mrtct': 'MRT',
    'schlaflabor': 'Schlaflabor',
    'donaustauf': 'Donaustauf',
    'labor': 'Labor',
    'elternzeit': 'Elternzeit'
};
window.MONTH_AREA_ORDER = Object.keys(window.MONTH_AREA_MAPPING);
window.getAreaColor = function(areaId) {
    if (!areaId || areaId === 'none') return '#cbd5e1';
    let hash = 0;
    for (let i = 0; i < areaId.length; i++) {
        hash = areaId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 65%, 45%)`;
};

window.resolveAreaConflict = function(areaIds) {
    if (!areaIds || areaIds.length === 0) return 'none';
    if (areaIds.length === 1) return areaIds[0];

    let best = areaIds[0];
    let bestIdx = window.MONTH_AREA_ORDER.indexOf(best);
    if (bestIdx === -1) bestIdx = 999;
    
    for (let i = 1; i < areaIds.length; i++) {
        let current = areaIds[i];
        let currentIdx = window.MONTH_AREA_ORDER.indexOf(current);
        if (currentIdx === -1) currentIdx = 999;
        
        if ((best === 'kardambulanz' && current === 'icd') || (best === 'icd' && current === 'kardambulanz')) {
            best = 'icd'; bestIdx = window.MONTH_AREA_ORDER.indexOf(best); continue;
        }
        if ((best === 'labor' && current === 'hkl') || (best === 'hkl' && current === 'labor')) {
            best = 'hkl'; bestIdx = window.MONTH_AREA_ORDER.indexOf(best); continue;
        }
        if ((best === 'labor' && current === 'phambulanz') || (best === 'phambulanz' && current === 'labor')) {
            best = 'phambulanz'; bestIdx = window.MONTH_AREA_ORDER.indexOf(best); continue;
        }
        
        if (currentIdx < bestIdx) {
            best = current;
            bestIdx = currentIdx;
        }
    }
    return best;
};

class App {
    constructor(config) {
        window.CONFIG = config;
        this.currentUser = null;
        this.deferredPrompt = null;
        this._initPwaInstall();
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
        this._longPressTimer = null;
        this._isPanning = false;
        this._panStart = null;
        this.currentRequestsSubTab = 'meine';

        this.dates = this.generateDates();
        this._datesMap = new Map();
        this.dates.forEach(d => this._datesMap.set(d.dateStr, d));

        this.viewMode = 'month'; // 'month', 'year'
        this.currentViewDate = this.formatDate(new Date());
        this.filterGroup = 'All';
        this.isMonthSortingActive = false;
        this.monthlyDistribution = null;
        this.allowedMonths = [];
        this.lastVisibleMonthStr = null;

        this.initApp();

        setTimeout(() => this.populateFilterGroups(), 100);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this._updateScheduled = false;
                this._scheduleVirtualUpdate();
            }
        });

        const calendar = document.getElementById('calendar');
        if (calendar) {
            let scrollTimeout;
            calendar.addEventListener('scroll', () => {
                this._scheduleVirtualUpdate();
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    const startCol = Math.max(0, Math.floor(calendar.scrollLeft / 40));
                    const visibleDate = this.dates[Math.min(startCol + 15, this.dates.length - 1)];
                    if (visibleDate) {
                        const newMonthStr = `month_${visibleDate.year}_${String(visibleDate.month + 1).padStart(2, '0')}`;
                        if (this.lastVisibleMonthStr !== newMonthStr) {
                            this.lastVisibleMonthStr = newMonthStr;
                            if (this.isMonthSortingActive) {
                                this.sortEmployees();
                            }
                            this.render();
                        }
                    }
                }, 500);
            }, { passive: true });
            calendar.addEventListener('mousedown', ev => {
                if (ev.button !== 0 || ev.altKey) return;
                const cell = ev.target.closest('.day-cell[data-eid]');
                if (!cell) return;
                
                // Only start vacation drag if user has permission (silent check to avoid early alert)
                if (this.checkPermission(cell.dataset.eid, true)) {
                    ev.preventDefault();
                    this.handleMouseDown(cell.dataset.eid, cell.dataset.date, ev);
                }
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
                const cell = ev.target.closest('.day-cell[data-eid]');
                if (!cell) return;

                this._touchStart = { x: touch.clientX, y: touch.clientY, time: Date.now(), eid: cell.dataset.eid, date: cell.dataset.date };
                this._isScroll = false;

                if (this._longPressTimer) clearTimeout(this._longPressTimer);
                this._longPressTimer = setTimeout(() => {
                    if (!this._isScroll && this._touchStart) {
                        this.handleMouseDown(this._touchStart.eid, this._touchStart.date, { 
                            clientX: this._touchStart.x, 
                            clientY: this._touchStart.y,
                            type: 'touchstart'
                        });
                    }
                }, 1000);
            }, { passive: true });

            calendar.addEventListener('touchmove', ev => {
                if (!this._touchStart) return;
                const touch = ev.touches[0];
                const dx = Math.abs(touch.clientX - this._touchStart.x);
                const dy = Math.abs(touch.clientY - this._touchStart.y);
                if (dx > 10 || dy > 10) {
                    this._isScroll = true;
                    if (this._longPressTimer) clearTimeout(this._longPressTimer);
                }

                if (this.isDragging) {
                    const el = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.day-cell[data-eid]');
                    if (el) this.handleMouseOver(el.dataset.eid, el.dataset.date);
                }
            }, { passive: true });

            calendar.addEventListener('touchend', ev => {
                if (this._longPressTimer) clearTimeout(this._longPressTimer);
                this.stopDrag();
                this._touchStart = null;
            }, { passive: true });

            // Wheel-to-Horizontal-Scroll on Headers
            calendar.addEventListener('wheel', ev => {
                if (ev.shiftKey) return; 
                const header = ev.target.closest('.month-header, .day-header');
                if (header) {
                    ev.preventDefault();
                    calendar.scrollLeft += ev.deltaY;
                }
            }, { passive: false });

            // Panning Logic
            calendar.addEventListener('mousedown', ev => {
                const header = ev.target.closest('.month-header, .day-header');
                const cell = ev.target.closest('.day-cell[data-eid]');
                const eid = cell ? cell.dataset.eid : null;
                
                const isMiddle = ev.button === 1;
                const isAlt = ev.altKey;
                const canEditThisCell = eid ? this.checkPermission(eid, true) : false;
                
                // Pan if: middle button, alt+left, dragging header, or if clicking a cell WE CANNOT EDIT (regular user other cell)
                if (isMiddle || (isAlt && ev.button === 0) || header || (!canEditThisCell && ev.button === 0)) {
                    // Don't pan if we clicked a button or interactive element
                    if (ev.target.closest('button, select, input')) return;
                    
                    this._isPanning = true;
                    this._panStart = { 
                        x: ev.clientX, 
                        y: ev.clientY, 
                        scrollLeft: calendar.scrollLeft, 
                        scrollTop: calendar.scrollTop 
                    };
                    calendar.style.cursor = 'grabbing';
                    if (isMiddle || isAlt || header || !canEditThisCell) ev.preventDefault();
                }
            });

            window.addEventListener('mousemove', ev => {
                if (!this._isPanning || !this._panStart) return;
                
                // Safety: If no buttons are pressed, stop panning
                if (ev.buttons === 0) {
                    this._isPanning = false;
                    this._panStart = null;
                    calendar.style.cursor = '';
                    return;
                }

                ev.preventDefault();
                const dx = ev.clientX - this._panStart.x;
                const dy = ev.clientY - this._panStart.y;
                calendar.scrollLeft = this._panStart.scrollLeft - dx;
                calendar.scrollTop = this._panStart.scrollTop - dy;
            }, { passive: false });

            window.addEventListener('mouseup', () => {
                if (this._isPanning) {
                    this._isPanning = false;
                    this._panStart = null;
                    calendar.style.cursor = '';
                }
            });
        }

        this.stopDrag = this.stopDrag.bind(this);
        document.addEventListener('mouseup', this.stopDrag);
        document.addEventListener('touchend', this.stopDrag);
        document.addEventListener('touchcancel', this.stopDrag);

        // Global click/touch listener to hide tooltips on mobile
        document.addEventListener('touchstart', (ev) => {
            if (!ev.target.closest('.day-cell')) {
                this.hideTip();
            }
        }, { passive: true });
    }

    setFilterGroup(group) {
        this.filterGroup = group;
        this.render();
    }

    async toggleMonthSorting() {
        this.isMonthSortingActive = !this.isMonthSortingActive;
        const btn = document.getElementById('btnSortMonth');
        
        if (this.isMonthSortingActive) {
            if (!this.monthlyDistributionFull) {
                if (btn) btn.innerHTML = 'Lade...';
                await this.loadMonthlyDistributionSilently();
            }
            if (!this.monthlyDistributionFull) {
                this.isMonthSortingActive = false;
                if (btn) btn.innerHTML = 'Standard';
                alert("Konnte Monatsverteilung nicht laden.");
                return;
            }

            this.allowedMonths = [];
            const now = new Date();
            const currentQuarter = Math.floor(now.getMonth() / 3);
            let startMonth = currentQuarter * 3;
            let currYear = now.getFullYear();

            for (let i = 0; i < 6; i++) {
                let m = startMonth + i;
                let y = currYear;
                if (m > 11) { m -= 12; y++; }
                this.allowedMonths.push(`month_${y}_${String(m + 1).padStart(2, '0')}`);
            }
            
            this.monthlyDistribution = this.monthlyDistributionFull;
            if (btn) btn.innerHTML = 'Rotationen';

            // Set initial visible month
            const c = document.getElementById('calendar');
            if (c) {
                const startCol = Math.max(0, Math.floor(c.scrollLeft / 40));
                const visibleDate = this.dates[Math.min(startCol + 15, this.dates.length - 1)] || this.dates[0];
                this.lastVisibleMonthStr = `month_${visibleDate.year}_${String(visibleDate.month + 1).padStart(2, '0')}`;
            }
        } else {
            if (btn) btn.innerHTML = 'Standard';
        }
        
        this.sortEmployees();
        this.render();
    }

    navigateView(direction) {
        const c = document.getElementById('calendar');
        if (c) c.scrollBy({ left: direction * 400, behavior: 'smooth' });
    }

    populateFilterGroups() {
        const selects = document.querySelectorAll('#groupFilterSelector');
        
        let groupsToShow = [];
        if (CONFIG.skills) {
            groupsToShow = CONFIG.skills;
        } else if (CONFIG.groupOrder) {
            groupsToShow = CONFIG.groupOrder.filter(g => g !== '');
        }

        selects.forEach(sel => {
            if (!sel) return;
            sel.innerHTML = '<option value="All">Alle</option>';
            groupsToShow.forEach(grp => {
                if (grp === 'Kein Vertreter nötig') return; // Hide this specific group from standard filtering if desired, or keep it. Let's keep it.
                const opt = document.createElement('option');
                opt.value = grp;
                opt.textContent = grp;
                sel.appendChild(opt);
            });
            sel.value = this.filterGroup;
        });
    }

    getEmployeeAreaForMonth(empId, monthStr, dataset) {
        if (!dataset || !monthStr) return { id: 'none', name: 'Ohne Bereich' };
        const compactMonthStr = monthStr.replace('month_', '');
        const matchingRecords = dataset.filter(a => 
            (a.monat_id === monthStr || a.mi === compactMonthStr) && 
            (String(a.mitarbeiter_id) === String(empId) || String(a.ei) === String(empId))
        );
        if (matchingRecords.length === 0) return { id: 'none', name: 'Ohne Bereich' };
        
        const areaIds = matchingRecords.map(r => (r.bi || r.bereich_name || '').toLowerCase()).filter(Boolean);
        const resolvedId = window.resolveAreaConflict(areaIds);
        
        let originalName = 'Ohne Bereich';
        const bestRecord = matchingRecords.find(r => (r.bi || r.bereich_name || '').toLowerCase() === resolvedId);
        if (bestRecord) {
            originalName = bestRecord.bereich_name || bestRecord.bi;
        }
        
        return {
            id: resolvedId || 'none',
            name: window.MONTH_AREA_MAPPING[resolvedId] || originalName || 'Ohne Bereich'
        };
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
                const cong = (CONFIG.congresses || []).find(h => s >= h.start && s <= h.end);
                res.push({
                    year: y,
                    dateStr: s,
                    day: d.getDate(),
                    month: d.getMonth(),
                    weekday: d.getDay(),
                    isWeekend: d.getDay() === 0 || d.getDay() === 6,
                    holiday: CONFIG.holidays[s],
                    isSchoolHoliday: !!sh,
                    schoolHoliday: sh ? sh.name : null,
                    isCongress: !!cong,
                    congressName: cong ? cong.name : null
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
        const modal = document.getElementById('loginModal');
        if (modal) modal.style.display = 'flex';
        
        // Reset inputs
        const pwdInput = document.getElementById('loginPwdInput');
        if (pwdInput) pwdInput.value = '';
        const loginSelect = document.getElementById('loginSelect');
        if (loginSelect) loginSelect.value = '';
        const loginSearch = document.getElementById('loginSearch');
        if (loginSearch) loginSearch.value = '';
        
        localStorage.removeItem('last_user_id');
        localStorage.removeItem('last_user_pin');
        location.reload(); 
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

        const lastUserId = localStorage.getItem('last_user_id');
        const lastUserPin = localStorage.getItem('last_user_pin');
        if (lastUserId && lastUserPin && storedKey) {
            const loginSelect = document.getElementById('loginSelect');
            if (loginSelect) loginSelect.value = lastUserId;
            const loginPwdInput = document.getElementById('loginPwdInput');
            if (loginPwdInput) loginPwdInput.value = lastUserPin;
            this.processLogin(true);
        }

        const apiKeyInput = document.getElementById('apiKeyInput');
        if (apiKeyInput) {
            apiKeyInput.addEventListener('input', async () => {
                const errorEl = document.getElementById('loginError');
                if (errorEl) errorEl.style.display = 'none';

                const key = apiKeyInput.value.trim();
                if (key.length >= 20) {
                    CONFIG.apiKey = key;
                    apiKeyInput.style.borderColor = 'var(--primary-color)';
                    apiKeyInput.style.background = 'rgba(59, 130, 246, 0.1)';
                    const loaded = await this.reloadData();
                    if (loaded && !loaded.error) {
                        apiKeyInput.style.borderColor = 'var(--success-color)';
                        apiKeyInput.style.background = 'rgba(16, 185, 129, 0.1)';
                        this.showLoginModal();
                        this.filterLoginEmployees();
                    } else {
                        apiKeyInput.style.borderColor = 'var(--danger-color)';
                        apiKeyInput.style.background = 'rgba(239, 68, 68, 0.1)';
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
            this.populateFilterGroups();
            this.showLoginModal();
            setTimeout(() => this.loadMonthlyDistributionSilently(), 100);
            return data;
        }
        return data;
    }

    async loadMonthlyDistributionSilently() {
        if (!CONFIG.apiKey) return;
        try {
            const binIdForMonth = '699c40edae596e708f42284d';
            const res = await fetch(`https://api.jsonbin.io/v3/b/${binIdForMonth}/latest`, {
                headers: { 'X-Master-Key': CONFIG.apiKey }
            });
            if (res.ok) {
                const data = await res.json();
                
                const now = new Date();
                const currentQuarter = Math.floor(now.getMonth() / 3);
                let startMonth = currentQuarter * 3;
                let currYear = now.getFullYear();

                const allowed = [];
                for (let i = 0; i < 6; i++) {
                    let m = startMonth + i;
                    let y = currYear;
                    if (m > 11) { m -= 12; y++; }
                    allowed.push(`month_${y}_${String(m + 1).padStart(2, '0')}`);
                }
                
                this.monthlyDistributionFull = (data.record || []).filter(r => {
                    return allowed.includes(r.monat_id) || (r.mi && allowed.includes('month_' + r.mi));
                });

                const c = document.getElementById('calendar');
                if (c) {
                    const startCol = Math.max(0, Math.floor(c.scrollLeft / 40));
                    const visibleDate = this.dates[Math.min(startCol + 15, this.dates.length - 1)] || this.dates[0];
                    if (visibleDate) {
                        this.lastVisibleMonthStr = `month_${visibleDate.year}_${String(visibleDate.month + 1).padStart(2, '0')}`;
                    }
                }
                this.render();
            }
        } catch (e) {
            console.warn("Silent load of monthly distribution failed", e);
        }
    }

    initUI() {
        const yNav = document.getElementById('yearNav'), mNav = document.getElementById('monthNav');
        if (yNav) {
            yNav.innerHTML = '';
            
            // Year Buttons first
            CONFIG.years.forEach(y => {
                const b = document.createElement('button');
                b.innerText = y;
                b.id = `btn-year-${y}`;
                b.onclick = () => this.setYear(y);
                yNav.appendChild(b);
            });

            // Arrow Group (positioned to the right with margin)
            const arrowGroup = document.createElement('div');
            arrowGroup.style.display = 'inline-flex';
            arrowGroup.style.gap = '8px';
            arrowGroup.style.marginLeft = '32px';
            arrowGroup.style.verticalAlign = 'middle';
            arrowGroup.style.alignItems = 'center';

            const prevBtn = document.createElement('button');
            prevBtn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H4M10 18l-6-6 6-6"/></svg>';
            prevBtn.className = 'nav-arrow-btn';
            prevBtn.title = 'Zurück / Nach links';
            prevBtn.onclick = () => this.navigateView(-1);

            const nextBtn = document.createElement('button');
            nextBtn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M14 6l6 6-6 6"/></svg>';
            nextBtn.className = 'nav-arrow-btn';
            nextBtn.title = 'Vor / Nach rechts';
            nextBtn.onclick = () => this.navigateView(1);

            arrowGroup.appendChild(prevBtn);
            arrowGroup.appendChild(nextBtn);
            yNav.appendChild(arrowGroup);
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
            { id: 'sekretariat', name: 'Sekretariat' }
        ];
        if (CONFIG.employees && CONFIG.employees.length > 0) {
            const others = CONFIG.employees
                .filter(e => e.id !== 'admin' && e.id !== 'sekretariat' && (e.active !== false || e.pin))
                .map(e => ({ id: e.id, name: e.name }));
            
            if (CONFIG.additionalLoginOptions) {
                others.push(...CONFIG.additionalLoginOptions);
            }

            // Sort by last name
            others.sort((a, b) => {
                const nameA = a.name || '', nameB = b.name || '';
                const lastA = nameA.split(' ').pop();
                const lastB = nameB.split(' ').pop();
                return lastA.localeCompare(lastB, 'de');
            });
            
            this._loginOptions.push(...others);
        } else if (CONFIG.additionalLoginOptions) {
            this._loginOptions.push(...CONFIG.additionalLoginOptions);
        }
        const loginSearch = document.getElementById('loginSearch');
        if (loginSearch) {
            loginSearch.onfocus = () => this.filterLoginEmployees();
            loginSearch.onclick = () => this.filterLoginEmployees();
        }
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
            i.style.padding = '12px';
            i.style.cursor = 'pointer';
            i.style.borderBottom = '1px solid #f1f5f9';
            i.onmousedown = (ev) => {
                ev.preventDefault();
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
            if (errorEl && !isAutoLogin) {
                errorEl.textContent = 'Bitte Name und Master Key eingeben.';
                errorEl.style.display = 'block';
            }
            return;
        }

        CONFIG.apiKey = key;
        const loaded = await this.reloadData();

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

        const userEntry = CONFIG.employees.find(e => e.id === id);
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
        } else if (id !== 'admin' && id !== 'sekretariat' && !(CONFIG.additionalLoginOptions && CONFIG.additionalLoginOptions.some(o => o.id === id))) {
            if (errorEl) {
                errorEl.textContent = 'Nutzer nicht in der Datenbank gefunden.';
                errorEl.style.display = 'block';
            }
            return;
        }

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
        
        // Login Notification for Open Requests
        const isAdmin = id === 'admin' || id === CONFIG.isSprecher;
        const openReqs = (this.state.__REQUESTS__ || []).filter(r => 
            (isAdmin && r.status === 'pending_admin') || (r.vertreterId === id && r.status === 'pending_vertreter')
        ).length;
        if (openReqs > 0) {
            setTimeout(() => {
                alert(`👋 Hallo! Es gibt ${openReqs} offene Anfrage${openReqs > 1 ? 'n' : ''}, die auf deine Bearbeitung wartet${openReqs > 1 ? 'en' : ''}.`);
            }, 800);
        }

        setTimeout(() => this.scrollToMonth(new Date().getMonth(), true), 500);
    }

    onAfterLogin(id) {
        const uDisp = document.getElementById('currentUserDisplay');
        if (uDisp) {
            uDisp.innerText = 'Eingeloggt als: ' + this.getEmpName(id);
        }

        const isAdmin = (id === 'admin' || id === 'sekretariat' || (CONFIG.isSprecher && id === CONFIG.isSprecher));
        const isRealAdmin = (id === 'admin' || (CONFIG.isSprecher && id === CONFIG.isSprecher));
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

        // Nav visibility
        const tabs = ['admin', 'summary', 'status', 'requests', 'po', 'groups', 'skills'];
        tabs.forEach(t => {
            const el = document.getElementById('tab-' + t);
            if (el) {
                if (t === 'admin') el.style.display = isRealAdmin ? 'inline-block' : 'none';
                else if (t === 'summary' || t === 'status') el.style.display = (id === 'admin') ? 'inline-block' : 'none';
                else if (t === 'requests') el.style.display = (id === 'sekretariat' ? 'none' : 'inline-block');
                else if (t === 'po') el.style.display = (id === 'sekretariat' ? 'inline-block' : 'none');
                else if (t === 'groups' || t === 'skills') el.style.display = (isRealAdmin || (CONFIG.isSprecher && id === CONFIG.isSprecher)) ? 'inline-block' : 'none';
            }
            const navEl = document.getElementById('nav-' + t);
            if (navEl) {
                if (t === 'admin') navEl.style.display = isRealAdmin ? 'flex' : 'none';
                else if (t === 'requests') navEl.style.display = (id === 'sekretariat' ? 'none' : 'flex');
                else if (t === 'po') navEl.style.display = (id === 'sekretariat' ? 'flex' : 'none');
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

    checkPermission(eid, silent = false) {
        if (this.currentUser === 'admin' || this.currentUser === 'sekretariat' || eid === this.currentUser) return true;
        if (!silent) alert('Stopp! Du kannst Abwesenheiten nur in deiner eigenen Zeile eintragen oder bearbeiten.');
        return false;
    }

    render() {
        const container = document.getElementById('calendar');
        if (!container) return;
        container.innerHTML = '';
        container.style.gridTemplateColumns = '';
        container.classList.remove('view-year');
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
            h.className = `cell header-cell sticky-header day-header ${d.isWeekend ? 'weekend' : ''} ${d.holiday ? 'holiday' : ''} ${d.isSchoolHoliday ? 'school-holiday' : ''} ${d.isCongress ? 'congress-day' : ''}`;
            h.innerHTML = `<span>${d.day}</span>`;
            h.style.gridRow = 2;
            h.style.gridColumn = i + 2;
            h.dataset.date = d.dateStr;
            h.onmouseenter = (ev) => {
                const info = [d.holiday, d.schoolHoliday, d.congressName].filter(x => x).join(' & ');
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

        let emps = CONFIG.employees.filter(e => e.id !== 'admin' && e.id !== 'sekretariat' && e.active !== false);
        if (this.filterGroup && this.filterGroup !== 'All') {
            emps = emps.filter(e => {
                const grps = Array.isArray(e.groups) ? e.groups : (e.group ? [e.group] : []);
                return grps.includes(this.filterGroup) || this.getPrimaryGrp(e) === this.filterGroup;
            });
        }
        let hasMonthData = false;
        let hasAnyDataForMonth = false;
        
        if (this.isMonthSortingActive && this.monthlyDistribution && this.lastVisibleMonthStr) {
            const compactMonthStr = this.lastVisibleMonthStr.replace('month_', '');
            hasMonthData = this.monthlyDistribution.some(a => a.monat_id === this.lastVisibleMonthStr || a.mi === compactMonthStr);
        }
        if (this.monthlyDistributionFull && this.lastVisibleMonthStr) {
            const compactMonthStr = this.lastVisibleMonthStr.replace('month_', '');
            hasAnyDataForMonth = this.monthlyDistributionFull.some(a => a.monat_id === this.lastVisibleMonthStr || a.mi === compactMonthStr);
        }
        
        const effectiveMonthSorting = this.isMonthSortingActive && hasMonthData;

        emps.forEach((e, ei) => {
            const n = document.createElement('div');
            n.className = 'cell employee-row-header sticky-col';
            n.style.gridRow = ei + 4;
            n.style.gridColumn = '1';
            const displayName = e.name;
            const shortName = this.getShortName(e.name);
            
            const nameContainer = document.createElement('div');
            nameContainer.style.display = 'flex';
            nameContainer.style.flexDirection = 'column';
            nameContainer.style.gap = '2px';
            
            const desktopSpan = document.createElement('span');
            desktopSpan.className = 'desktop-name';
            desktopSpan.style.fontWeight = '700';
            desktopSpan.textContent = displayName;
            
            const mobileSpan = document.createElement('span');
            mobileSpan.className = 'mobile-name';
            mobileSpan.style.fontWeight = '700';
            mobileSpan.style.display = 'none';
            mobileSpan.textContent = shortName;
            
            nameContainer.appendChild(desktopSpan);
            nameContainer.appendChild(mobileSpan);
            n.appendChild(nameContainer);

            const vacBadge = document.createElement('span');
            vacBadge.id = `vac-badge-${e.id}`;
            vacBadge.className = 'vac-badge';
            n.appendChild(vacBadge);
            this._renderVacBadge(e.id, vacBadge);
            
            if (this.currentUser === e.id) n.style.backgroundColor = 'var(--primary-light)';
            
            let currentAreaId = 'none';
            let currentAreaName = 'Ohne Bereich';

            if (this.monthlyDistributionFull && this.lastVisibleMonthStr) {
                const areaInfo = this.getEmployeeAreaForMonth(e.id, this.lastVisibleMonthStr, this.monthlyDistributionFull);
                currentAreaId = areaInfo.id;
                currentAreaName = areaInfo.name;
            }

            const grp = this.getPrimaryGrp(e);
            let bandColor = '#e2e8f0';
            
            if (effectiveMonthSorting) {
                bandColor = window.getAreaColor(currentAreaId);
            } else if (grp) {
                bandColor = this.getGroupColor(grp);
            }

            n.style.borderLeft = `4px solid ${bandColor}`;

            const prev = emps[ei - 1];
            if (effectiveMonthSorting) {
                let prevAreaId = 'none';
                if (prev && this.monthlyDistributionFull && this.lastVisibleMonthStr) {
                    prevAreaId = this.getEmployeeAreaForMonth(prev.id, this.lastVisibleMonthStr, this.monthlyDistributionFull).id;
                }
                const isFirstInArea = !prev || prevAreaId !== currentAreaId;
                if (isFirstInArea) {
                    n.style.borderTop = `1px solid ${bandColor}88`;
                }
                
                if (hasAnyDataForMonth && CONFIG.showAreaLabels !== false) {
                    if (isFirstInArea) {
                        const stSpan = document.createElement('span');
                        stSpan.style.cssText = `position:absolute; top:2px; left:6px; font-size:0.55rem; color:${bandColor}; font-weight:bold; white-space:nowrap; pointer-events:none; z-index:2;`;
                        stSpan.innerText = currentAreaName;
                        n.appendChild(stSpan);
                    }
                    // Always make room for the badge whether rendered or not to keep alignment consistent
                    desktopSpan.style.marginTop = '14px';
                    mobileSpan.style.marginTop = '14px';
                }
            } else if (grp) {
                if (!prev || this.getPrimaryGrp(prev) !== grp) {
                    n.style.borderTop = `1px solid ${bandColor}88`;
                }
                const next = emps[ei + 1];
                if (!next || this.getPrimaryGrp(next) !== grp) n.style.borderBottom = `1px solid ${bandColor}33`;
                
                if (hasAnyDataForMonth && CONFIG.showAreaLabels !== false) {
                    const stSpan = document.createElement('span');
                    stSpan.style.cssText = `position:absolute; top:2px; left:6px; font-size:0.55rem; color:var(--text-secondary); font-weight:bold; white-space:nowrap; pointer-events:none; z-index:2;`;
                    stSpan.innerText = currentAreaName;
                    n.appendChild(stSpan);
                    desktopSpan.style.marginTop = '14px';
                    mobileSpan.style.marginTop = '14px';
                }
            }

            if (grp) {
                const shouldPrintSkill = effectiveMonthSorting || (!prev || this.getPrimaryGrp(prev) !== grp);
                if (shouldPrintSkill) {
                    const lbl = document.createElement('span');
                    lbl.innerText = grp;
                    lbl.style.cssText = `position:absolute; top:12px; right:6px; font-size:0.55rem; color:${this.getGroupColor(grp)}; font-weight:800; text-transform:uppercase; pointer-events:none; opacity:0.9; z-index:2;`;
                    n.appendChild(lbl);
                }
            }
            frag.appendChild(n);

            const wrapper = document.createElement('div');
            wrapper.id = `dw-${e.id}`;
            wrapper.className = 'employee-data-wrapper';
            wrapper.style.gridRow = ei + 4;
            wrapper.style.gridColumn = `2 / span ${this.dates.length}`;
            frag.appendChild(wrapper);
        });

        container.appendChild(frag);
        this.updateNavHighlighting();
        this._visStart = -1;
        this._visEnd = -1;
        const cw = container.clientWidth || window.innerWidth || 1024;
        const startCol = Math.max(0, Math.floor(container.scrollLeft / 40) - 10);
        const endCol = Math.min(this.dates.length, startCol + Math.ceil(cw / 40) + 20);
        this.renderVisibleCells(startCol, endCol);
    }

    renderVisibleCells(startCol, endCol) {
        const colW = this.viewMode === 'year' ? 6 : 40;
        let emps = CONFIG.employees.filter(e => e.id !== 'admin' && e.id !== 'sekretariat' && e.active !== false);
        if (this.filterGroup && this.filterGroup !== 'All') {
            emps = emps.filter(e => {
                const grps = Array.isArray(e.groups) ? e.groups : (e.group ? [e.group] : []);
                return grps.includes(this.filterGroup) || this.getPrimaryGrp(e) === this.filterGroup;
            });
        }
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
                const sLocal = this.state[e.id]?.[d.dateStr];
                let s = sLocal;
                let isExternalSource = false;
                if (!s && e.isExternal && this.externalData?.state) {
                    s = this.externalData.state[e.id]?.[d.dateStr];
                    if (s) isExternalSource = true;
                }

                const cell = document.createElement('div');
                cell.className = `cell day-cell${d.isWeekend ? ' weekend' : ''}${d.holiday ? ' holiday' : ''}${d.isSchoolHoliday ? ' school-holiday' : ''}${d.isCongress ? ' congress-day' : ''}`;
                cell.id = `cell-${e.id}-${d.dateStr}`;
                cell.dataset.eid = e.id;
                cell.dataset.date = d.dateStr;
                cell.dataset.ci = ci;
                cell.style.cssText = `position:absolute;left:${ci * colW}px;width:${colW}px;top:0;bottom:0`;
                if (s) {
                    const t = s.type || s;
                    cell.classList.add(t === 'U' || t === 'V' ? 'status-vacation' : t === 'D' ? 'status-trip' : t === 'F' ? 'status-training' : 'status-custom');
                    if (isExternalSource) cell.style.opacity = '0.7'; // Visual hint for imported data
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

    handleMouseDown(empId, dateStr, ev) {
        if (this.currentUser === 'sekretariat') { alert('Du bist als Sekretariat angemeldet und kannst keine Bearbeitungen machen'); return; }
        
        // Mobile Tooltip Logic for Pending Requests
        const isMobile = window.innerWidth <= 768;
        const req = (this.state.__REQUESTS__ || []).find(r => 
            r.empId === empId && r.dates.includes(dateStr) && (r.status === 'pending_vertreter' || r.status === 'pending_admin')
        );
        if (req && isMobile) {
            this.showTip(ev, empId, dateStr);
            return;
        }

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

    handleMouseOver(empId, dateStr, ev) {
        if (this.isDragging) {
            // Safety Check: If mouse buttons are 0 but isDragging is true, stop dragging (mouseup was missed)
            if (ev && ev.buttons === 0) {
                this.stopDrag();
                return;
            }
            this.setVacation(empId, dateStr, this.dragStartVal, true, true);
        }
    }

    stopDrag() {
        if (this.isDragging) {
            this.isDragging = false;
            const affectedEmpId = this._lastDraggedEmpId;
            this._lastDraggedEmpId = null;
            this.dragStartVal = null;
            
            if (this._hasChanged) {
                this.saveState();
                // Perform deferred updates
                if (this._affectedDates.size > 0) {
                    this._affectedDates.forEach(d => this.updateValidationUI(d));
                    if (affectedEmpId) this._renderVacBadge(affectedEmpId);
                }
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
            this._lastDraggedEmpId = empId;
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
            // Optimization: Skip expensive validation/badge updates during drag
            if (!isDrag) {
                this.updateValidationUI(dateStr);
                this._renderVacBadge(empId);
            }
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

    scrollToToday() {
        const todayStr = this.formatDate(new Date());
        const cell = document.querySelector(`.day-header[data-date="${todayStr}"]`);
        const c = document.getElementById('calendar');
        if (cell && c) {
            const offset = document.querySelector('.sticky-corner').offsetWidth;
            c.scrollTo({ left: cell.offsetLeft - offset, behavior: 'smooth' });
            this.showTodayArrow(cell);
        }
    }

    showTodayArrow(cell) {
        document.querySelectorAll('.today-arrow').forEach(a => a.remove());
        const arrow = document.createElement('div');
        arrow.className = 'today-arrow';
        cell.appendChild(arrow);
        setTimeout(() => arrow.remove(), 3000);
    }

    scrollByAmount(amount) {
        const c = document.getElementById('calendar');
        if (c) {
            c.scrollBy({ left: amount, behavior: 'smooth' });
        }
    }

    updateNavHighlighting() {
        const c = document.getElementById('calendar');
        if (!c) return;
        const colW = this.viewMode === 'year' ? 6 : 40;
        const dIdx = Math.min(Math.floor(c.scrollLeft / colW), this.dates.length - 1);
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
        this._setupVertreterSearch(eid);
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
        if (vertreterResults) { vertreterResults.innerHTML = ''; vertreterResults.style.display = 'none'; }
        const titleEl = document.querySelector('#addModal h2');
        if (titleEl) titleEl.textContent = 'Abwesenheit bearbeiten';
        if (modalStart) modalStart.value = d;
        if (modalEnd) modalEnd.value = d;
        if (addModal) addModal.style.display = 'flex';
    }

    openModal() {
        const modalEmp = document.getElementById('modalEmp');
        const eid = modalEmp?.value || (CONFIG.employees.find(e => e.active !== false && e.id !== 'admin' && e.id !== 'sekretariat')?.id) || this.currentUser;
        if (modalEmp && !modalEmp.value) modalEmp.value = eid;
        
        this._setupVertreterSearch(eid);
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
        if (vertreterResults) { vertreterResults.innerHTML = ''; vertreterResults.style.display = 'none'; }
        const titleEl = document.querySelector('#addModal h2');
        if (titleEl) titleEl.textContent = 'Abwesenheit eintragen';
        this._updateKIIIHint();
        if (addModal) addModal.style.display = 'flex';
    }

    _updateKIIIHint() {
        const type = document.getElementById('modalType')?.value;
        const hint = document.getElementById('kiii-hint');
        if (hint) {
            hint.style.display = (type === 'D' || type === 'F') ? 'block' : 'none';
        }
    }

    _setupVertreterSearch(empId) {
        const vertreterInput = document.getElementById('modalVertreterInput');
        const vertreterResults = document.getElementById('vertreterResults');
        const modalEmp = document.getElementById('modalEmp');
        const vertreterLabel = document.querySelector('#vertreterGroup label');
        if (!vertreterInput || !vertreterResults) return;

        const updateLabel = (eid) => {
            if (vertreterLabel) {
                const optional = !this.needsVertreter(eid);
                vertreterLabel.textContent = `Vertreter ${optional ? '(Optional)' : '(Pflicht)'}`;
            }
        };
        updateLabel(modalEmp?.value || empId);

        vertreterResults.style.display = 'none';
        vertreterResults.innerHTML = '';

        const showList = () => {
            const currentEid = modalEmp?.value || empId;
            const q = vertreterInput.value.toLowerCase().trim();
            const reqEmp = CONFIG.employees.find(e => e.id === currentEid);
            const reqGrps = Array.isArray(reqEmp?.groups) ? reqEmp.groups : (reqEmp?.group ? [reqEmp.group] : []);
            
            const candidates = CONFIG.employees.filter(e => {
                if (e.id === currentEid || e.id === 'admin' || e.id === 'sekretariat' || e.active === false) return false;
                if (q && !e.name.toLowerCase().includes(q)) return false;
                const eGrps = Array.isArray(e.groups) ? e.groups : (e.group ? [e.group] : []);
                
                // Normal rule: must share at least one group
                let canRepresent = reqGrps.length > 0 && eGrps.some(g => reqGrps.includes(g));
                
                // Special rule: Herzkatheter can always represent Ambulanz
                if (!canRepresent && reqGrps.includes('Ambulanz') && eGrps.includes('Herzkatheter')) {
                    canRepresent = true;
                }

                // Special rule: FOAs can always be represented by local assistants
                if (!canRepresent && reqEmp?.isExternal && !e.isExternal) {
                    canRepresent = true;
                }
                
                return canRepresent;
            });

            if (candidates.length > 0) {
                vertreterResults.innerHTML = candidates.slice(0, 100).map(e => {
                    return `<div style="padding:12px;cursor:pointer;border-bottom:1px solid #f1f5f9;" onmousedown="document.getElementById('modalVertreterInput').value='${e.name.replace(/'/g, "\\'")}';document.getElementById('modalVertreterId').value='${e.id}';document.getElementById('vertreterResults').style.display='none'">${e.name}</div>`;
                }).join('');
                vertreterResults.style.display = 'block';
            } else if (q) {
                vertreterResults.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:0.85rem">Keine passenden Kollegen gefunden</div>';
                vertreterResults.style.display = 'block';
            } else {
                vertreterResults.style.display = 'none';
            }
        };

        vertreterInput.oninput = showList;
        vertreterInput.onfocus = showList;
        vertreterInput.onclick = showList;
        vertreterInput.onblur = () => setTimeout(() => { vertreterResults.style.display = 'none'; }, 300);
        
        if (modalEmp) {
            modalEmp.onchange = () => {
                const needs = this.needsVertreter(modalEmp.value);
                const vGroup = document.getElementById('vertreterGroup');
                if (vGroup) vGroup.style.display = needs ? '' : 'none';
                vertreterInput.value = '';
                document.getElementById('modalVertreterId').value = '';
                showList();
            };
        }
    }

    openRequestModal(empId, dateStr) {
        const modal = document.getElementById('addModal');
        this._setupVertreterSearch(empId);
        document.getElementById('modalEmp').value = empId;
        document.getElementById('modalStart').value = dateStr;
        document.getElementById('modalEnd').value = dateStr;
        document.getElementById('modalType').value = 'U';
        document.getElementById('modalText').value = '';
        document.getElementById('modalVertreterInput').value = '';
        document.getElementById('modalVertreterId').value = '';
        const vResults = document.getElementById('vertreterResults');
        if (vResults) { vResults.innerHTML = ''; vResults.style.display = 'none'; }
        document.getElementById('vertreterGroup').style.display = this.needsVertreter(empId) ? '' : 'none';
        const titleEl = modal.querySelector('h2');
        if (titleEl) titleEl.textContent = 'Abwesenheitswunsch';
        this._requestModalEmpId = empId;
        this.onModalDateChange();
        this._updateKIIIHint();
        modal.style.display = 'flex';
    }

    onModalDateChange() {
        const empId = this._requestModalEmpId || document.getElementById('modalEmp').value;
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

    addRange() {
        const isAdmin = (this.currentUser === 'admin' || this.currentUser === 'sekretariat');
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

    checkVertreterAbsence(vId, dateStr) {
        // Local check
        if (this.state[vId]?.[dateStr]) return true;
        // External check (e.g. for OAs represented in Assistent-Planer)
        if (this.externalData?.state && this.externalData.state[vId]?.[dateStr]) return true;
        return false;
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
            const vertreterAbsentDates = dates.filter(d => this.checkVertreterAbsence(vertreterId, d));
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

        const emp = CONFIG.employees.find(e => e.id === eid);
        const isChef = this.getPrimaryGrp(emp) === 'Chef';

        const req = {
            id: 'req_' + Date.now(),
            empId: eid, type, text, vertreter, vertreterId, dates,
            status: isChef ? 'approved' : ((this.needsVertreter(eid) || vertreterId) ? 'pending_vertreter' : 'pending_admin'),
            createdAt: this.formatDate(new Date()),
            rejectedBy: null, rejectionNote: null,
            stamps: { submitted: this.makeStamp() }
        };

        if (isChef) {
            req.stamps.vertreter = this.makeStamp();
            req.stamps.admin = this.makeStamp();
            if (!this.state[eid]) this.state[eid] = {};
            dates.forEach(ds => {
                this.state[eid][ds] = {
                    type, text, vertreter, vertreterId,
                    status: 'confirmed'
                };
            });
        }

        if (!this.state.__REQUESTS__) this.state.__REQUESTS__ = [];
        this.state.__REQUESTS__.push(req);
        this.saveState();
        this.render();
        this.updateRequestsBadge();
        document.getElementById('addModal').style.display = 'none';
    }

    checkVertretungConflict(empId, dates) {
        const checkIn = (state, emps, dStr) => {
            if (!state) return null;
            for (const otherId of Object.keys(state)) {
                if (otherId.startsWith('__') || otherId === empId) continue;
                const entry = state[otherId]?.[dStr];
                // Check confirmed status
                if (entry && entry.vertreterId === empId && (entry.status === 'confirmed' || entry.status === 'approved')) {
                    const other = emps.find(e => e.id === otherId);
                    return { date: dStr, who: other?.name || otherId };
                }
            }
            return null;
        };

        for (const dateStr of dates) {
            let res = checkIn(this.state, CONFIG.employees, dateStr);
            if (res) return res;
            if (this.externalData?.state) {
                res = checkIn(this.externalData.state, this.externalData.employees || [], dateStr);
                if (res) return res;
            }
        }
        // Also check if there are pending requests in the external system where user is chosen as representative 
        // to prevent overlapping vacation while a request is waiting for approval
        if (this.externalData?.state?.__REQUESTS__) {
            for (const dateStr of dates) {
                const pending = this.externalData.state.__REQUESTS__.find(r => 
                    r.vertreterId === empId && 
                    r.dates.includes(dateStr) && 
                    (r.status === 'pending_vertreter' || r.status === 'pending_admin')
                );
                if (pending) {
                    const other = (this.externalData.employees || []).find(e => e.id === pending.empId);
                    return { date: dateStr, who: (other?.name || pending.empId) + " (Anfrage offen)" };
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

        const vertreterAbsentDates = req.dates.filter(d => this.checkVertreterAbsence(req.vertreterId, d));
        if (vertreterAbsentDates.length > 0) {
            alert(`Zustimmung nicht möglich: Du bist an folgenden Tagen selbst abwesend: ${vertreterAbsentDates.join(', ')}.`);
            return;
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
        this.renderRequestsTab();
        this.updateRequestsBadge();
    }

    deleteRequest(reqId) {
        if (!this.state.__REQUESTS__) return;
        const idx = this.state.__REQUESTS__.findIndex(r => r.id === reqId);
        if (idx === -1) return;
        
        this.state.__REQUESTS__.splice(idx, 1);
        this.saveState();
        this.render();
        this.renderRequestsTab();
        this.updateRequestsBadge();
    }

    updateRequestsBadge() {
        const badges = document.querySelectorAll('.requests-badge');
        if (badges.length === 0) return;
        const requests = this.state.__REQUESTS__ || [];
        const cu = this.currentUser;
        const isAdmin = cu === 'admin' || cu === CONFIG.isSprecher;
        
        let vertreterCount = requests.filter(r => r.vertreterId === cu && r.status === 'pending_vertreter').length;
        let adminCount = isAdmin ? requests.filter(r => r.status === 'pending_admin').length : 0;
        let ownPending = requests.filter(r => r.empId === cu && (r.status === 'pending_vertreter' || r.status === 'pending_admin')).length;

        let total = vertreterCount + adminCount;
        if (total === 0 && !isAdmin) total = ownPending;

        badges.forEach(badge => {
            badge.textContent = total > 0 ? String(total) : '';
        });
    }

    makeStamp() {
        const cu = this.currentUser;
        const name = this.getEmpName(cu);

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        return {
            at: new Date().toISOString(),
            uid: cu,
            name: name,
            device: isMobile ? 'Mobilgerät' : 'Desktop',
            ua: navigator.userAgent
        };
    }

    _fmtStamp(stamp, label) {
        if (!stamp) return '';
        const d = new Date(stamp.at);
        const ds = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const ts = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        const who = stamp.shortcut || stamp.name || stamp.by;
        return `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px; padding:4px 8px; background:var(--bg-color); border-radius:6px;"><strong>${label}</strong>: ${who} · ${ds}, ${ts}</div>`;
    }

    renderPOView() {
        const container = document.getElementById('poList');
        if (!container) return;
        const requests = this.state.__REQUESTS__ || [];
        const poDone = this.state.__PO_DONE__ || {};

        const approved = requests.filter(r => r.status === 'approved');
        if (approved.length === 0) {
            container.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 40px 0;">Keine genehmigten Abwesenheiten vorhanden.</p>';
            return;
        }

        const typeLabel = { U: 'Urlaub', D: 'Dienstreise', F: 'Fortbildung', T: 'Sonstiges', S: 'Sonstiges' };
        approved.sort((a, b) => (a.dates[0] || '').localeCompare(b.dates[0] || ''));

        const pending = approved.filter(r => !poDone[r.id]);
        const done = approved.filter(r => poDone[r.id]);

        let html = '<h2 style="margin-bottom:8px;">📋 PO-Übertragung</h2>';
        const stickyShortcut = localStorage.getItem('po_shortcut') || '';
        html += `<div style="margin-bottom:24px; background:var(--bg-color); padding:12px; border-radius:var(--radius-md); border:1px solid var(--border-color); display:flex; align-items:center; gap:12px;">
            <label style="font-size:0.875rem; font-weight:700;">Eingetragen von (Kürzel):</label>
            <input type="text" id="po_shortcut_sticky" value="${stickyShortcut}" 
                style="width:80px; padding:6px; border:1px solid var(--border-color); border-radius:4px; text-align:center; font-weight:700;" 
                oninput="localStorage.setItem('po_shortcut', this.value.toUpperCase()); this.value = this.value.toUpperCase();"
                placeholder="--">
        </div>`;

        if (pending.length > 0) {
            html += '<div style="overflow-x: auto; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 24px;">';
            html += '<table style="width:100%; border-collapse:collapse;">';
            html += '<thead><tr style="background:var(--bg-color); text-align:left">';
            html += '<th style="padding:12px; font-weight:700;">Person</th><th style="padding:12px; font-weight:700;">Von</th><th style="padding:12px; font-weight:700;">Bis</th><th style="padding:12px; font-weight:700;">Art</th><th style="padding:12px; font-weight:700;">Vertreter</th><th style="padding:12px; font-weight:700; text-align:center;">In PO?</th>';
            html += '</tr></thead><tbody>';

            pending.forEach(req => {
                const emp = CONFIG.employees.find(e => e.id === req.empId);
                const from = req.dates[0], to = req.dates[req.dates.length - 1];
                html += `<tr style="border-top: 1px solid var(--border-color)">`;
                html += `<td style="padding:12px; font-weight:600">${emp?.name || req.empId}</td>`;
                html += `<td style="padding:12px">${from}</td>`;
                html += `<td style="padding:12px">${to}</td>`;
                html += `<td style="padding:12px"><span style="font-size:0.75rem; background:var(--bg-color); padding:2px 8px; border-radius:10px;">${typeLabel[req.type] || req.type}</span></td>`;
                html += `<td style="padding:12px; font-size:0.85rem">${req.vertreter || '-'}</td>`;
                html += `<td style="padding:12px; text-align:center"><input type="checkbox" onchange="app.markPODone('${req.id}', this.checked)" style="width:20px; height:20px;"></td>`;
                html += '</tr>';
            });
            html += '</tbody></table></div>';
        } else {
            html += '<div style="background:var(--primary-light); color:var(--primary-color); padding:16px; border-radius:var(--radius-md); text-align:center; font-weight:700; margin-bottom:24px;">✨ Alle erledigt!</div>';
        }

        if (done.length > 0) {
            html += `<details><summary style="cursor:pointer; color:var(--text-secondary); font-weight:700; font-size:0.875rem;">Bereits eingetragen (${done.length})</summary>`;
            html += '<div style="margin-top:12px; opacity:0.7">';
            done.forEach(req => {
                const emp = CONFIG.employees.find(e => e.id === req.empId);
                html += `<div style="padding:8px; border-bottom:1px solid var(--border-color); font-size:0.85rem; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:600">${emp?.name || req.empId}: ${req.dates[0]}</div>
                        ${req.stamps?.po ? `<div style="font-size:0.75rem; color:var(--text-secondary)">Eingetragen am ${new Date(req.stamps.po.at).toLocaleDateString('de-DE')} durch ${req.stamps.po.shortcut || req.stamps.po.name || req.stamps.po.by}</div>` : ''}
                    </div>
                    <span style="color:var(--success-color)">✓</span>
                </div>`;
            });
            html += '</div></details>';
        }
        container.innerHTML = html;
    }

    markPODone(reqId, checked) {
        if (!this.state.__PO_DONE__) this.state.__PO_DONE__ = {};
        const req = (this.state.__REQUESTS__ || []).find(r => r.id === reqId);
        if (checked) {
            let shortcut = document.getElementById('po_shortcut_sticky')?.value;
            if (!shortcut) {
                const initial = localStorage.getItem('po_shortcut') || '';
                shortcut = prompt('Kürzel der eintragenden Person:', initial);
                if (!shortcut) return this.renderPOView();
                localStorage.setItem('po_shortcut', shortcut.toUpperCase());
                if (document.getElementById('po_shortcut_sticky')) document.getElementById('po_shortcut_sticky').value = shortcut.toUpperCase();
            }
            
            this.state.__PO_DONE__[reqId] = true;
            if (req) {
                if (!req.stamps) req.stamps = {};
                req.stamps.po = { at: new Date().toISOString(), by: this.currentUser, name: this.getEmpName(this.currentUser), shortcut: shortcut };
            }
        } else {
            delete this.state.__PO_DONE__[reqId];
            if (req && req.stamps) delete req.stamps.po;
        }
        this.saveState();
        this.renderPOView();
    }

    showTip(ev, eid, d) {
        if (this.isDragging) return;
        let s = eid ? this.state[eid]?.[d] : null;
        const dObj = this._datesMap.get(d);
        if (!dObj) return;
        const info = [dObj.holiday, dObj.schoolHoliday, dObj.congressName].filter(x => x).join(' & ');
        
        let isPending = false;
        if (!s && eid) {
            s = (this.state.__REQUESTS__ || []).find(r => 
                r.empId === eid && r.dates.includes(d) && (r.status === 'pending_vertreter' || r.status === 'pending_admin')
            );
            if (s) isPending = true;
        }

        if (!s && !info) return;
        const TYPE_NAMES = { U: 'Urlaub', D: 'Dienstreise', F: 'Fortbildung', T: 'Sonstiges', S: 'Sonstiges' };
        const reqLabels = { pending_vertreter: 'Vertreter-Zustimmung ausstehend', pending_admin: 'Leitender OA-Freigabe ausstehend' };
        
        let tip = '';
        if (s) {
            const empName = this.getEmpName(eid);
            const typeLabel = TYPE_NAMES[s.type] || s.type;
            tip += `<div style="margin-bottom:4px; font-size:0.85rem"><strong>${empName}</strong></div>`;
            tip += `<div style="margin-bottom:4px; font-size:0.8rem"><strong>${typeLabel}${s.text ? ': ' + s.text : ''}</strong></div>`;
            if (isPending) {
                tip += `<div style="color:var(--warning-color); font-weight:700; font-size:0.7rem; margin-bottom:4px">${reqLabels[s.status]}</div>`;
            }
            if (s.vertreter) tip += `<div style="color:var(--primary-color); font-weight:700; font-size:0.75rem">Vertreter: ${s.vertreter}</div>`;
        }
        if (info) tip += `<div style="margin-top:4px; font-size:0.7rem; opacity:0.8">${info}</div>`;
        
        this.showSimpleTip(ev, tip, true);
    }

    showSimpleTip(ev, text, isHTML = false) {
        const t = document.getElementById('custom-tooltip');
        if (!t || !ev) return;
        if (isHTML) t.innerHTML = text;
        else t.innerHTML = `<strong>${text}</strong>`;
        
        const x = ev.clientX || (ev.touches && ev.touches[0] ? ev.touches[0].clientX : 0);
        const y = ev.clientY || (ev.touches && ev.touches[0] ? ev.touches[0].clientY : 0);
        
        t.style.display = 'block';
        t.style.left = x + 10 + 'px';
        t.style.top = y + 10 + 'px';
        
        // Ensure tooltip stays within screen bounds
        requestAnimationFrame(() => {
            const rect = t.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                t.style.left = (window.innerWidth - rect.width - 10) + 'px';
            }
            if (rect.bottom > window.innerHeight) {
                t.style.top = (y - rect.height - 10) + 'px';
            }
        });
    }

    hideTip() {
        const t = document.getElementById('custom-tooltip');
        if (t) t.style.display = 'none';
    }

    switchTab(tabId) {
        const tabs = ['calendar', 'summary', 'status', 'admin', 'requests', 'po', 'groups', 'skills'];
        
        // Update Desktop Nav
        tabs.forEach(t => { 
            const btn = document.getElementById('tab-' + t); 
            if (btn) btn.classList.toggle('active', t === tabId);
        });

        // Update Bottom Nav (Mobile)
        const navItems = ['calendar', 'requests', 'admin', 'po'];
        navItems.forEach(t => {
            const item = document.getElementById('nav-' + t);
            if (item) item.classList.toggle('active', t === tabId);
        });

        const bulkPanel = document.getElementById('bulkImportPanel');
        const views = ['calendar', 'summary', 'status', 'admin', 'requests', 'po', 'groups', 'skills'];
        views.forEach(v => {
            const el = document.getElementById(v + 'View');
            if (el) el.style.display = (v === tabId) ? 'flex' : 'none';
        });

        if (bulkPanel) bulkPanel.style.display = (tabId === 'calendar' && this.currentUser === 'admin') ? 'flex' : 'none';

        if (tabId === 'admin') this.renderAdminTable();
        if (tabId === 'requests') {
            if (this.currentUser === 'admin') {
                const filterSelect = document.getElementById('requestStatusFilter');
                if (filterSelect) filterSelect.value = 'open';
            }
            this.renderRequestsTab();
        }
        if (tabId === 'po') this.renderPOView();
        if (tabId === 'groups') this.renderGroupsAdmin();
        if (tabId === 'skills') this.renderSkillsAdmin();
    }

    renderRequestsTab() {
        const container = document.getElementById('requestsList');
        if (!container) return;
        const requestsRaw = this.state.__REQUESTS__ || [];
        
        const filterSelect = document.getElementById('requestStatusFilter');
        const filterVal = filterSelect ? filterSelect.value : 'all';
        let requests = requestsRaw;
        
        if (filterVal === 'open') requests = requestsRaw.filter(r => r.status.startsWith('pending'));
        else if (filterVal === 'approved') requests = requestsRaw.filter(r => r.status === 'approved');
        else if (filterVal === 'rejected') requests = requestsRaw.filter(r => r.status === 'rejected');

        const cu = this.currentUser;
        const isAdmin = cu === 'admin';
        const isSprecher = (CONFIG.isSprecher && cu === CONFIG.isSprecher);
        let html = '';

        const typeLabel = { U: 'Urlaub', D: 'Dienstreise', F: 'Fortbildung', T: 'Sonstiges', S: 'Sonstiges' };
        const statusLabel = {
            pending_vertreter: 'Vertreter-Zustimmung ausstehend',
            pending_admin: 'Leitender OA-Freigabe ausstehend',
            approved: '✅ Genehmigt',
            rejected: '❌ Abgelehnt'
        };

        const renderCard = (req, actions = '') => {
            const emp = CONFIG.employees.find(e => e.id === req.empId);
            const from = req.dates[0], to = req.dates[req.dates.length - 1];
            const statusClass = `request-status status-${req.status}`;
            
            return `
                <div class="request-card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
                        <div style="font-weight: 800; font-size: 1.1rem; color: var(--text-main);">${emp?.name || req.empId}</div>
                        <span class="${statusClass}" style="background: var(--bg-color); color: var(--text-main); font-size: 0.7rem; white-space: nowrap;">${statusLabel[req.status]}</span>
                    </div>

                    <div style="color: var(--text-secondary); font-size: 0.85rem; font-weight: 600;">
                        📅 ${from}${from !== to ? ' bis ' + to : ''}
                    </div>

                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <span style="background: var(--bg-color); padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700;">
                            ${typeLabel[req.type] || req.type}
                        </span>
                        ${req.vertreter ? `<span style="background: var(--primary-light); color: var(--primary-color); padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700;">👤 Vertr.: ${req.vertreter}</span>` : ''}
                    </div>

                    ${req.text ? `<div style="font-style: italic; font-size: 0.85rem; color: var(--text-secondary); background: #f8fafc; padding: 8px; border-radius: 8px;">"${req.text}"</div>` : ''}

                    <div style="margin-top: 4px;">
                        ${this._fmtStamp(req.stamps?.submitted, 'Antrag')}
                        ${this._fmtStamp(req.stamps?.vertreter, 'Zustimmung Vertreter')}
                        ${req.status === 'approved' ? this._fmtStamp(req.stamps?.admin, 'Genehmigung') : ''}
                        ${this._fmtStamp(req.stamps?.po, 'In PO eingetragen')}
                        ${req.status === 'rejected' ? this._fmtStamp(req.stamps?.rejected, 'Ablehnung') : ''}
                    </div>

                    ${req.rejectionNote ? `<div style="color: var(--danger-color); font-size: 0.8rem; font-weight: 600;">Grund: ${req.rejectionNote}</div>` : ''}

                    <div style="display: flex; gap: 8px; align-items: center; justify-content: flex-start; margin-top: 8px; flex-wrap: wrap;">
                        ${actions}
                        ${req.status === 'approved' ? `<button onclick="app.generateAndDownloadPDF('${req.id}')" style="background:#dc2626; color:white; border:none; padding:8px 16px; font-weight: bold; border-radius:6px; width:auto; font-size: 0.85rem;">📄 PDF laden</button>` : ''}
                        ${(this.currentUser === 'admin' || (CONFIG.isSprecher && this.currentUser === CONFIG.isSprecher)) ? `<button onclick="if(confirm('Antrag wirklich unwiderruflich löschen?')) app.deleteRequest('${req.id}')" style="background:none; border:none; color:var(--danger-color); cursor:pointer; font-size: 0.75rem; padding: 4px; border-radius: 4px; margin-left: auto; font-weight: 700;">🗑️ Löschen</button>` : ''}
                    </div>
                </div>`;
        };

        html = '';
        const vertretenReqs = requests.filter(r => r.vertreterId === cu && r.status === 'pending_vertreter');

        if (isAdmin || isSprecher) {
            const adminReqs = requests.filter(r => r.status === 'pending_admin');
            
            // Show Representation Requests for Admin too if they exist
            if (vertretenReqs.length > 0) {
                html += '<h3 style="margin-bottom: 16px; font-size: 0.85rem; color: var(--primary-color); text-transform: uppercase;">Personale Vertretungsanfragen (für dich)</h3>';
                vertretenReqs.forEach(req => {
                    const actions = `
                        <div style="display: flex; gap: 8px;">
                            <button onclick="app.approveAsVertreter('${req.id}')" style="background:var(--success-color); color:white; border:none; padding:8px 12px;">Zustimmen</button>
                            <button onclick="let note=prompt('Grund für Ablehnung?'); if(note!==null) app.rejectRequest('${req.id}','vertreter',note)" style="background:var(--bg-color); border:1px solid var(--border-color); padding:8px 12px;">Ablehnen</button>
                        </div>
                    `;
                    html += renderCard(req, actions);
                });
                html += '<hr style="margin: 20px 0; border: none; border-top: 2px dashed var(--border-color); opacity: 0.5;">';
            }

            html += '<h3 style="margin-bottom: 16px; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase;">Offene Anträge zur Genehmigung</h3>';
            if (adminReqs.length === 0 && (filterVal === 'all' || filterVal === 'open')) {
                html += '<p style="color:var(--text-secondary); text-align:center; padding: 40px 0;">Keine offenen Anfragen zur Genehmigung.</p>';
            } else if (adminReqs.length > 0) {
                adminReqs.forEach(req => {
                    const actions = `
                        <div style="display: flex; gap: 8px;">
                            <button onclick="app.approveAsAdmin('${req.id}')" style="background:var(--success-color); color:white; border:none; padding:8px 12px;">Genehmigen</button>
                            <button onclick="let note=prompt('Grund für Ablehnung?'); if(note!==null) app.rejectRequest('${req.id}','admin',note)" style="background:var(--bg-color); border:1px solid var(--border-color); padding:8px 12px;">Ablehnen</button>
                        </div>
                    `;
                    html += renderCard(req, actions);
                });
            }
            const history = requests.filter(r => r.status === 'approved' || r.status === 'rejected');
            if (history.length > 0) {
                html += '<h3 style="margin: 32px 0 16px; font-size: 1rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Verlauf</h3>';
                history.sort((a,b) => b.id.localeCompare(a.id)).slice(0, 20).forEach(req => {
                    html += renderCard(req);
                });
            }
        } else {
            // Auto-switch to vertreter tab if there are representation requests and no pending own requests
            const ownPending = requests.filter(r => r.empId === cu && (r.status === 'pending_vertreter' || r.status === 'pending_admin'));
            if (this.currentRequestsSubTab === 'meine' && ownPending.length === 0 && vertretenReqs.length > 0) {
                this.currentRequestsSubTab = 'vertreter';
            }

            // Sub-tab Navigation
            html += `
                <div class="sub-tab-nav">
                    <div class="sub-tab-item ${this.currentRequestsSubTab === 'meine' ? 'active' : ''}" onclick="app.switchRequestsSubTab('meine')">Meine Anfragen</div>
                    <div class="sub-tab-item ${this.currentRequestsSubTab === 'vertreter' ? 'active' : ''}" onclick="app.switchRequestsSubTab('vertreter')">Vertretungen${vertretenReqs.length > 0 ? ` <span style="background:var(--danger-color); color:white; border-radius:10px; padding:0 6px; font-size:0.7rem">${vertretenReqs.length}</span>` : ''}</div>
                </div>
            `;

            if (this.currentRequestsSubTab === 'meine') {
                const ownReqs = requests.filter(r => r.empId === cu);
                if (ownReqs.length > 0) {
                    ownReqs.sort((a,b) => b.id.localeCompare(a.id)).forEach(req => {
                        html += renderCard(req);
                    });
                } else {
                    html += '<p style="color:var(--text-secondary); text-align:center; padding: 40px 0;">Keine eigenen Anfragen vorhanden.</p>';
                }
            } else {
                if (vertretenReqs.length > 0) {
                    html += '<h3 style="margin-bottom: 16px; font-size: 0.85rem; color: var(--primary-color); text-transform: uppercase;">Offene Vertretungen</h3>';
                    vertretenReqs.forEach(req => {
                        const actions = `
                            <div style="display: flex; gap: 8px;">
                                <button onclick="app.approveAsVertreter('${req.id}')" style="background:var(--success-color); color:white; border:none; padding:8px 12px;">Zustimmen</button>
                                <button onclick="let note=prompt('Grund für Ablehnung?'); if(note!==null) app.rejectRequest('${req.id}','vertreter',note)" style="background:var(--bg-color); border:1px solid var(--border-color); padding:8px 12px;">Ablehnen</button>
                            </div>
                        `;
                        html += renderCard(req, actions);
                    });
                }
                
                const vertreterHistory = requests.filter(r => r.vertreterId === cu && r.status !== 'pending_vertreter');
                if (vertreterHistory.length > 0) {
                    html += '<h3 style="margin: 32px 0 16px; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase;">Vertretungs-Verlauf</h3>';
                    vertreterHistory.sort((a,b) => b.id.localeCompare(a.id)).slice(0, 20).forEach(req => {
                        html += renderCard(req);
                    });
                }

                if (vertretenReqs.length === 0 && vertreterHistory.length === 0) {
                    html += '<p style="color:var(--text-secondary); text-align:center; padding: 40px 0;">Keine Vertretungsanfragen vorhanden.</p>';
                }
            }
        }
        container.innerHTML = html;
    }

    switchRequestsSubTab(tab) {
        this.currentRequestsSubTab = tab;
        this.renderRequestsTab();
    }

    setMode(m) { this.currentMode = m; }
    setCustomText(t) { this.currentText = t; }
    setVertreterText(t) { this.currentVertreterText = t; }

    getPrimaryGrp(e) {
        const grps = Array.isArray(e.groups) ? e.groups : (e.group ? [e.group] : []);
        if (grps.length === 0) return '';
        
        const order = CONFIG.skills || CONFIG.groupOrder || [];
        if (order.length === 0) return grps[0];

        let best = order.length, res = '';
        const realGrps = grps.filter(g => {
            const name = (typeof g === 'object' && g !== null) ? g.name : g;
            return name !== 'Kein Vertreter nötig' && name !== 'skill_keinvertreternotig';
        });
        const lookup = realGrps.length > 0 ? realGrps : grps;

        lookup.forEach(g => {
            const gId = (typeof g === 'object' && g !== null) ? g.id : g;
            const i = order.findIndex(s => s.id === gId || s.name === gId);
            if (i !== -1 && i < best) {
                best = i;
                res = (typeof order[i] === 'object') ? order[i].name : order[i];
            }
        });
        return res;
    }

    getShortName(fullName) {
        if (!fullName) return '';
        const parts = fullName.trim().split(/\s+/);
        if (parts.length <= 1) return fullName;
        
        let firstIdx = 0;
        // Skip common German titles
        while (firstIdx < parts.length - 1 && /^([Dd]r\.?|[Pp]rof\.?|[Pp][Dd]\.?|[Mm]ed\.?)$/i.test(parts[firstIdx])) {
            firstIdx++;
        }
        
        // Abbreviate the identified first name
        if (firstIdx < parts.length - 1) {
            parts[firstIdx] = parts[firstIdx].charAt(0) + '.';
        }
        return parts.join(' ');
    }

    needsVertreter(empId) {
        const emp = CONFIG.employees.find(e => e.id === empId);
        const grps = Array.isArray(emp?.groups) ? emp.groups : (emp?.group ? [emp.group] : []);
        if (grps.includes('Chef')) return false; // Chef needs no representative
        return !grps.includes('Kein Vertreter nötig');
    }

    isWorkday(dateStr) {
        if (!this._dowCache) this._dowCache = {};
        if (this._dowCache[dateStr] === undefined) {
            this._dowCache[dateStr] = new Date(dateStr).getDay();
        }
        const dow = this._dowCache[dateStr];
        return dow !== 0 && dow !== 6 && !CONFIG.holidays[dateStr];
    }

    countVacationDays(empId) {
        const year = this.currentYear || CONFIG.years[0];
        let total = 0;
        const entries = this.state[empId] || {};
        const isVac = v => (v === 'U' || v === 'V' || (v && (v.type === 'U' || v.type === 'V')));
        
        total += Object.entries(entries).filter(([d, v]) =>
            d.startsWith(String(year)) && isVac(v) && this.isWorkday(d)
        ).length;

        const emp = CONFIG.employees.find(e => e.id === empId);
        if (emp?.isExternal && this.externalData?.state?.[empId]) {
            total += Object.entries(this.externalData.state[empId]).filter(([d, v]) =>
                d.startsWith(String(year)) && isVac(v) && this.isWorkday(d) && !entries[d]
            ).length;
        }
        return total;
    }

    _renderVacBadge(empId, el) {
        if (!el) el = document.getElementById(`vac-badge-${empId}`);
        if (!el) return;
        const used = this.countVacationDays(empId);
        const quota = (this.state.__VACATION_QUOTA__ || {})[empId] ?? 30;
        const over = used > quota;
        const canEdit = (this.currentUser === 'admin' || this.currentUser === empId || (CONFIG.isSprecher && this.currentUser === CONFIG.isSprecher));
        
        el.innerHTML = `<span style="color:${over ? 'var(--danger-color)' : 'var(--primary-color)'}; font-weight:800">${used}</span><span style="color:var(--text-muted)">/</span><span class="vac-quota ${canEdit ? 'editable' : ''}" onclick="app.editVacationQuota('${empId}')" title="${canEdit ? 'Klicken zum Ändern' : ''}">${quota}</span>`;
        el.title = `${used} von ${quota} Urlaubstagen genommen`;
    }

    updateVacationBadges() {
        const emps = CONFIG.employees.filter(e => e.id !== 'admin' && e.id !== 'sekretariat' && e.active !== false);
        emps.forEach(e => this._renderVacBadge(e.id));
    }

    editVacationQuota(empId) {
        if (this.currentUser !== 'admin' && this.currentUser !== empId && (!CONFIG.isSprecher || this.currentUser !== CONFIG.isSprecher)) {
            alert('Stopp! Nur der Admin oder der Mitarbeiter selbst können das Urlaubskontingent ändern.');
            return;
        }
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
        if (!id) return '';
        if (id === 'admin') return 'Leitender OA Wagner';
        if (id === 'sekretariat') return 'Sekretariat';
        if (CONFIG.isSprecher && id === CONFIG.isSprecher) return 'Assistentensprecher';
        
        const emp = CONFIG.employees.find(e => e.id === id);
        return emp ? emp.name : id;
    }

    async generateAndDownloadPDF(reqId) {
        try {
            const req = (this.state.__REQUESTS__ || []).find(r => r.id === reqId);
            if (!req) return alert('Antrag nicht gefunden.');
            const emp = CONFIG.employees.find(e => e.id === req.empId);
            
            const isUrlaub = req.type === 'U';
            if (typeof PDF_TEMPLATE_B64 === 'undefined' || typeof PDF_TEMPLATE_DIENST_B64 === 'undefined') {
                return alert('PDF-Vorlagen nicht geladen.');
            }
            const { PDFDocument, rgb } = window.PDFLib;
            const pdfDoc = await PDFDocument.load(isUrlaub ? PDF_TEMPLATE_B64 : PDF_TEMPLATE_DIENST_B64);
            const form = pdfDoc.getForm();
            
            const formatD = (ds) => ds.split('-').reverse().join('.');
            const startStr = formatD(req.dates[0]);
            const endStr = formatD(req.dates[req.dates.length - 1]);
            
            if (isUrlaub) {
                try { form.getTextField('Text1').setText(emp ? emp.name : req.empId); } catch(e){}
                try { form.getTextField('AcroFormField_108').setText(emp ? emp.name : req.empId); } catch(e){}
                try { form.getTextField('AcroFormField_36').setText(startStr); } catch(e){}
                try { form.getTextField('AcroFormField_38').setText(endStr); } catch(e){}
                
                const workDays = req.dates.filter(d => this.isWorkday(d)).length;
                try { form.getTextField('AcroFormField_40').setText(String(workDays)); } catch(e){}
                try { form.getTextField('Text1_27').setText('Klinik und Poliklinik für Innere Medizin II'); } catch(e){}
                try { form.getCheckBox('Kontrollkästchen17').check(); } catch(e){}
                try { form.getCheckBox('Kontrollkästchen14').check(); } catch(e){}
            } else {
                try { form.getTextField('Text1').setText(emp ? emp.name : req.empId); } catch(e){}
                try { form.getTextField('AcroFormField_174').setText(emp ? emp.name : req.empId); } catch(e){}
                try { form.getTextField('AcroFormField').setText('Klinik und Poliklinik für Innere Medizin II'); } catch(e){}
                try { form.getTextField('Text4').setText(startStr); } catch(e){}
                try { form.getTextField('AcroFormField_93').setText(endStr); } catch(e){}
                try { form.getTextField('AcroFormField_48').setText(req.text || ''); } catch(e){}
                
                if (req.type === 'D') {
                    try { form.getCheckBox('1065687112').check(); } catch(e){}
                } else if (req.type === 'F') {
                    try { form.getCheckBox('1581135616').check(); } catch(e){}
                }
            }
            
            try {
                const nameField2 = isUrlaub ? form.getTextField('AcroFormField_108') : form.getTextField('AcroFormField_174');
                const widgets = nameField2.acroField.getWidgets();
                if (widgets && widgets.length > 0) {
                    const rect = widgets[0].getRectangle();
                    const pages = pdfDoc.getPages();
                    const firstPage = pages[0];
                    
                    const fmtStampText = (stamp, defaultName, label, includeName = true) => {
                        if (!stamp) return `Digital signiert (Zeitstempel fehlt)`;
                        const d = new Date(stamp.at || Date.now());
                        const ds = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        return includeName 
                            ? `${label}: ${stamp.name || defaultName} am ${ds}`
                            : `Digital signiert am ${ds}`;
                    };
                    
                    const uText = fmtStampText(req.stamps?.submitted, emp ? emp.name : req.empId, 'Beantragt', false);
                    firstPage.drawText(uText, { x: rect.x + rect.width + 10, y: rect.y, size: 10, color: rgb(0,0,1) }); // blau
                    
                    const vText = fmtStampText(req.stamps?.vertreter, req.vertreter || 'Vertreter', 'Zustimmung');
                    firstPage.drawText(vText, { x: rect.x, y: rect.y - 18, size: 10, color: rgb(1,0,0) });
                    
                    if (isUrlaub) {
                        const aText = fmtStampText(req.stamps?.admin, 'Leitender OA Wagner', 'Genehmigung');
                        firstPage.drawText(aText, { x: rect.x, y: rect.y - 75, size: 10, color: rgb(1,0,0) });
                    }
                }
            } catch(e) { console.warn("Failed to draw signatures", e); }
            
            // "Druckdatum" und QM-Kopfzeile überdecken
            try {
                const pages = pdfDoc.getPages();
                pages.forEach(page => {
                    const { width, height } = page.getSize();
                    page.drawRectangle({
                        x: 0,
                        y: height - 28, // ca. 1 cm = 28pt
                        width: width,
                        height: 28,
                        color: rgb(1, 1, 1)
                    });
                });
            } catch (e) { console.warn("Failed to hide header", e); }

            form.flatten();
            
            const pdfBytesSaved = await pdfDoc.save();
            const blob = new Blob([pdfBytesSaved], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Antrag_${emp ? emp.name.replace(/\\s+/g, '_') : req.empId}_${startStr}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('PDF Error:', e);
            alert('Fehler beim Generieren des PDFs. Siehe Konsole.');
        }
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
        if (this.currentUser !== 'admin' && empId !== this.currentUser) { alert('Bulk-Import ist nur für den eigenen Nutzer möglich.'); return; }

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
    renderSkillsAdmin() {}
    renderGroupsAdmin() {}

    exportICal() {
        if (this.currentUser !== 'admin' && this.currentUser !== 'sekretariat') { 
            alert('Nur Admin und Sekretariat können iCal exportieren.'); return; 
        }
        const container = document.getElementById('icalEmpCheckboxes');
        if (!container) return;
        
        container.innerHTML = `<div style="margin-bottom:12px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
            <label style="display:flex; align-items:center; gap:8px; font-weight:bold; cursor:pointer;">
                <input type="checkbox" id="icalSelectAll" style="width:auto;" onchange="document.querySelectorAll('.ical-emp-checkbox').forEach(cb => cb.checked = this.checked);">
                <span>Alle auswählen</span>
            </label></div>`;
            
        const sorted = [...CONFIG.employees].sort((a, b) => {
            const lastA = (a.name || '').split(' ').pop();
            const lastB = (b.name || '').split(' ').pop();
            return lastA.localeCompare(lastB, 'de');
        });
            
        sorted.forEach(emp => {
            if (emp.id === 'admin' || emp.id === 'sekretariat' || emp.active === false) return;
            const div = document.createElement('div'); div.style.padding = '4px 0';
            div.innerHTML = `<label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:normal;">
                <input type="checkbox" class="ical-emp-checkbox" value="${emp.id}" style="width:auto;" checked>
                <span>${this.getEmpName(emp.id)}</span></label>`;
            container.appendChild(div);
        });
        
        document.querySelectorAll('.ical-emp-checkbox').forEach(cb => {
            cb.addEventListener('change', () => { 
                document.getElementById('icalSelectAll').checked = Array.from(document.querySelectorAll('.ical-emp-checkbox')).every(c => c.checked); 
            });
        });
        const modal = document.getElementById('iCalExportModal');
        if (modal) modal.style.display = 'flex';
    }

    executeICalExport() {
        const startDateStr = document.getElementById('icalStart').value, endDateStr = document.getElementById('icalEnd').value;
        if (!startDateStr || !endDateStr || startDateStr > endDateStr) return alert('Bitte einen gültigen Zeitraum auswählen.');
        const startDate = new Date(startDateStr), endDate = new Date(endDateStr); endDate.setHours(23, 59, 59, 999);
        const selectedEmps = Array.from(document.querySelectorAll('.ical-emp-checkbox:checked')).map(cb => cb.value);
        if (selectedEmps.length === 0) return alert('Bitte mindestens einen Mitarbeiter auswählen.');

        let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Urlaubsplaner//DE\r\nCALSCALE:GREGORIAN\r\n";
        const events = [];
        for (const empId of selectedEmps) {
            if (!this.state[empId]) continue;
            const empName = this.getEmpName(empId), dates = Object.keys(this.state[empId]).sort();
            if (dates.length === 0) continue;
            let currentEvent = null;
            for (const dateStr of dates) {
                const eventDate = new Date(dateStr);
                if (eventDate < startDate || eventDate > endDate) continue;
                const val = this.state[empId][dateStr];
                if (!currentEvent) {
                    currentEvent = { empName, type: val.type, text: val.text, vertreter: val.vertreter, start: new Date(dateStr), end: new Date(dateStr) };
                } else {
                    const expectedNextDay = new Date(currentEvent.end); expectedNextDay.setDate(expectedNextDay.getDate() + 1);
                    if (this.formatDate(expectedNextDay) === dateStr && currentEvent.type === val.type && currentEvent.text === val.text && currentEvent.vertreter === val.vertreter) {
                        currentEvent.end = new Date(dateStr);
                    } else {
                        events.push(currentEvent); currentEvent = { empName, type: val.type, text: val.text, vertreter: val.vertreter, start: new Date(dateStr), end: new Date(dateStr) };
                    }
                }
            }
            if (currentEvent) events.push(currentEvent);
        }
        if (events.length === 0) return alert('Keine Abwesenheiten gefunden.');

        const formatDateICal = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const typeLabels = { 'U': 'Urlaub', 'D': 'Dienstreise', 'F': 'Fortbildung', 'T': 'Sonstiges', 'S': 'Sonstiges' };

        events.forEach(ev => {
            icsContent += "BEGIN:VEVENT\r\n";
            icsContent += `UID:${ev.empName.replace(/\s+/g, '')}-${formatDateICal(ev.start)}@urlaubsplaner\r\n`;
            icsContent += `DTSTAMP:${timestamp}\r\n`;
            icsContent += `DTSTART;VALUE=DATE:${formatDateICal(ev.start)}\r\n`;
            const endExclusive = new Date(ev.end); endExclusive.setDate(endExclusive.getDate() + 1);
            icsContent += `DTEND;VALUE=DATE:${formatDateICal(endExclusive)}\r\n`;
            let summary = `${typeLabels[ev.type] || 'Abwesenheit'} - ${ev.empName}`; if (ev.text) summary += ` (${ev.text})`;
            icsContent += `SUMMARY:${summary}\r\n`;
            let description = `Mitarbeiter: ${ev.empName}\\nArt: ${typeLabels[ev.type] || 'Abwesenheit'}`;
            if (ev.text) description += `\\nBeschreibung: ${ev.text}`; if (ev.vertreter) description += `\\nVertreter: ${ev.vertreter}`;
            icsContent += `DESCRIPTION:${description}\r\n`;
            icsContent += "END:VEVENT\r\n";
        });
        icsContent += "END:VCALENDAR";

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `abwesenheiten_${startDateStr}_bis_${endDateStr}.ics`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        const modal = document.getElementById('iCalExportModal');
        if (modal) modal.style.display = 'none';
    }

    _initPwaInstall() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            const lastShown = localStorage.getItem('pwa_banner_last_shown');
            if (lastShown) {
                const diff = Date.now() - parseInt(lastShown);
                if (diff < 7 * 24 * 60 * 60 * 1000) return; // Wait 7 days
            }
            const banner = document.getElementById('pwaInstallBanner');
            if (banner) banner.style.display = 'flex';
        });

        document.getElementById('btnPwaInstall')?.addEventListener('click', async () => {
            if (!this.deferredPrompt) return;
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            console.log(`PWA Install User Choice: ${outcome}`);
            this.deferredPrompt = null;
            this._hidePwaBanner();
        });

        document.getElementById('btnPwaLater')?.addEventListener('click', () => {
            localStorage.setItem('pwa_banner_last_shown', Date.now().toString());
            this._hidePwaBanner();
        });
    }

    _hidePwaBanner() {
        const banner = document.getElementById('pwaInstallBanner');
        if (banner) banner.style.display = 'none';
    }
}
