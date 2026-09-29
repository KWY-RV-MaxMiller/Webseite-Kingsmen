const PRODUCTS = [
  { id: 'schwarzgeld', name: 'Schwarzgeld', unit: 'Stück' },
  { id: 'eisen', name: 'Eisen', unit: 'Stück' },
  { id: 'metall', name: 'Metall', unit: 'Stück' },
  { id: 'huelsen', name: 'Hülsen', unit: 'Stück' },
  { id: 'schwarzpulver', name: 'Schwarzpulver', unit: 'Stück' },
  { id: 'munition_lang', name: 'Munition lang', unit: 'Stück' },
  { id: 'munition_kurz', name: 'Munition kurz', unit: 'Stück' },
  { id: 'ephi', name: 'EPHI', unit: 'Stück' },
  { id: 'methkisten', name: 'Methkisten', unit: 'Stück' }
];


const SELL_PRODUCTS = [
  { id: 'weed', name: 'Weed' },
  { id: 'meth', name: 'Meth' },
  { id: 'koks', name: 'Koks' },
  { id: 'mdma', name: 'MDMA' },
  { id: 'lsd', name: 'LSD' },
  { id: 'crack', name: 'Crack' },
  { id: 'methkisten', name: 'Methkisten' }
];

const WEEKLY_PRODUCT = 'schwarzgeld';
const WEEKLY_REQUIRED = 300000;
const STORAGE_KEY = 'lager-app-local-migration';
const LEGACY_KEYS = ['lager-app-v11','lager-app-v10','lager-app-v9','lager-app-v8','lager-app-v7','lager-app-v6'];

const defaultData = {
  stock: Object.fromEntries(PRODUCTS.map(p => [p.id, 0])),
  movements: [],
  users: [],
  weekly: [],
  attendance: {},
  selling: { entries: [] },
  members: [],
  memberLegend: [],
  sanctions: {
    catalog: [],
    entries: []
  },
  minimumCars: {
    daily: {}
  },
  calendar: { entries: [] }
};

let data = structuredClone(defaultData);

const $ = id => document.getElementById(id);
const stockGrid = $('stockGrid');
const movementProduct = $('movementProduct');
const activityList = $('activityList');
const peopleList = $('peopleList');
const toast = $('toast');
const weeklyWeek = $('weeklyWeek');
const productModal = $('productModal');
const productModalTitle = $('productModalTitle');
const productModalSummary = $('productModalSummary');
const productModalList = $('productModalList');

function normalizeData(p) {
  p = p && typeof p === 'object' ? p : {};
  const weekly = Array.isArray(p.weekly) ? p.weekly : [];
  const attendance = p.attendance && typeof p.attendance === 'object' ? p.attendance : {};
  const selling = p.selling && typeof p.selling === 'object' ? p.selling : {};
  const sellingEntries = Array.isArray(selling.entries) ? selling.entries : [];
  const members = Array.isArray(p.members) ? p.members : [];
  const memberLegend = Array.isArray(p.memberLegend) ? p.memberLegend : [];
  const sanctions = p.sanctions && typeof p.sanctions === 'object' ? p.sanctions : {};
  const sanctionCatalog = Array.isArray(sanctions.catalog) ? sanctions.catalog : [];
  const sanctionEntries = Array.isArray(sanctions.entries) ? sanctions.entries : [];
  const minimumCars = p.minimumCars && typeof p.minimumCars === 'object' ? p.minimumCars : {};
  const minimumCarsDaily = minimumCars.daily && typeof minimumCars.daily === 'object' ? minimumCars.daily : {};
  const calendar = p.calendar && typeof p.calendar === 'object' ? p.calendar : {};
  const calendarEntries = Array.isArray(calendar.entries) ? calendar.entries : [];
  const attendanceUsers = Array.isArray(p.attendanceUsers) ? [...new Set(p.attendanceUsers.map(String).map(x => x.trim()).filter(Boolean))] : [];
  const incomingStock = { ...(p.stock || {}) };
  if (incomingStock.munition != null) {
    if (incomingStock.munition_lang == null) incomingStock.munition_lang = Number(incomingStock.munition) || 0;
    delete incomingStock.munition;
  }
  return {
    stock: { ...defaultData.stock, ...incomingStock },
    movements: Array.isArray(p.movements) ? p.movements.map(x => ({
      ...x, user: String(x.user || x.person || '').trim()
    })) : [],
    users: [...new Set([
      ...(Array.isArray(p.users) ? p.users : []),
      ...weekly.map(x => String(x.person || '').trim())
    ].map(String).map(x => x.trim()).filter(Boolean))],
    attendance,
    attendanceUsers,
    selling: {
      entries: sellingEntries.map(x => ({
        id: String(x.id || crypto.randomUUID()),
        product: String(x.product || ''),
        amount: Math.max(0, Number(x.amount) || 0),
        user: String(x.user || '').trim(),
        createdByUserId: String(x.createdByUserId || x.createdByDiscordId || ''),
        createdByUserName: String(x.createdByUserName || x.createdByDiscordName || ''),
        createdAt: x.createdAt || new Date().toISOString()
      })).filter(x => SELL_PRODUCTS.some(p => p.id === x.product) && x.amount > 0)
    },
    members: members.map(x => ({
      id: String(x.id || crypto.randomUUID()),
      name: String(x.name || '').trim(),
      probationEnd: x.probationEnd ? String(x.probationEnd) : '',
      probationStatus: ['auto','active','passed','waived'].includes(String(x.probationStatus || 'auto')) ? String(x.probationStatus || 'auto') : 'auto',
      description: String(x.description || ''),
      createdAt: x.createdAt || new Date().toISOString(),
      updatedAt: x.updatedAt || x.createdAt || new Date().toISOString()
    })).filter(x => x.name),
    memberLegend: memberLegend.map(x => ({
      id: String(x.id || crypto.randomUUID()),
      rank: String(x.rank || '').trim(),
      description: String(x.description || '').trim()
    })).filter(x => x.rank || x.description),
    sanctions: {
      catalog: sanctionCatalog.map(x => {
        const legacyAmount = Math.max(0, Number(x.amount) || 0);
        const amounts = Array.isArray(x.amounts)
          ? x.amounts.map(v => Math.max(0, Number(v) || 0)).filter(v => v > 0)
          : (legacyAmount > 0 ? [legacyAmount] : []);
        return {
          id: String(x.id || crypto.randomUUID()),
          title: String(x.title || '').trim(),
          description: String(x.description || '').trim(),
          amounts: [...new Set(amounts)].sort((a,b)=>a-b)
        };
      }).filter(x => x.title && x.amounts.length),
      entries: sanctionEntries.map(x => ({
        id: String(x.id || crypto.randomUUID()),
        memberId: String(x.memberId || ''),
        catalogId: String(x.catalogId || ''),
        title: String(x.title || '').trim(),
        description: String(x.description || '').trim(),
        amount: Math.max(0, Number(x.amount) || 0),
        status: x.status === 'paid' ? 'paid' : 'open',
        createdAt: x.createdAt || new Date().toISOString(),
        updatedAt: x.updatedAt || x.createdAt || new Date().toISOString(),
        paidAt: x.paidAt || null
      })).filter(x => x.memberId && x.title && x.amount > 0)
    },
    minimumCars: {
      daily: Object.fromEntries(Object.entries(minimumCarsDaily).map(([date, users]) => [
        String(date),
        Object.fromEntries(Object.entries(users && typeof users === 'object' ? users : {}).map(([memberId, record]) => [
          String(memberId),
          {
            items: {
              medkits: record?.items?.medkits === true ? true : record?.items?.medkits === false ? false : null,
              repairkits: record?.items?.repairkits === true ? true : record?.items?.repairkits === false ? false : null,
              ropes: record?.items?.ropes === true ? true : record?.items?.ropes === false ? false : null,
              bags: record?.items?.bags === true ? true : record?.items?.bags === false ? false : null,
              ammo_short: record?.items?.ammo_short === true ? true : record?.items?.ammo_short === false ? false : null
            },
            penalty: record?.penalty ? {
              type: ['warning1','warning2','money'].includes(record.penalty.type) ? record.penalty.type : '',
              sanctionId: String(record.penalty.sanctionId || ''),
              createdAt: record.penalty.createdAt || new Date().toISOString()
            } : null
          }
        ]))
      ]))
    },
    weekly: weekly.map(x => ({
      ...x,
      product: WEEKLY_PRODUCT,
      required: WEEKLY_REQUIRED,
      given: Math.max(0, Number(x.given) || 0),
      free: x.free === true,
      stockImpact: Number.isFinite(Number(x.stockImpact)) ? Number(x.stockImpact) : 0,
      week: Number(x.week),
      year: Number(x.year)
    })),
    calendar: {
      entries: calendarEntries.map(x => ({
        id: String(x.id || crypto.randomUUID()),
        title: String(x.title || '').trim(),
        date: String(x.date || ''),
        startTime: String(x.startTime || '18:00'),
        endTime: String(x.endTime || '18:30'),
        note: String(x.note || '').trim(),
        createdByUserId: String(x.createdByUserId || x.createdByDiscordId || ''),
        createdByUserName: String(x.createdByUserName || x.createdByDiscordName || ''),
        createdAt: x.createdAt || new Date().toISOString(),
        updatedAt: x.updatedAt || x.createdAt || new Date().toISOString()
      })).filter(x => x.title && /^\d{4}-\d{2}-\d{2}$/.test(x.date))
    }
  };
}

function loadLocalMigration() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) for (const key of LEGACY_KEYS) {
      raw = localStorage.getItem(key);
      if (raw) break;
    }
    return raw ? normalizeData(JSON.parse(raw)) : structuredClone(defaultData);
  } catch {
    return structuredClone(defaultData);
  }
}

let cloudReady = false;
let saveTimer = null;
let syncTimer = null;
let lastCloudUpdatedAt = null;
let lastSyncedData = null;
let saveInFlight = false;
let saveQueued = false;

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    cache: 'no-store',
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function jsonEqual(a,b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function mergeArrayById(base, local, remote) {
  const hasIds = arr => Array.isArray(arr) && arr.every(x => x && typeof x === 'object' && typeof x.id === 'string');
  if (!hasIds(base) || !hasIds(local) || !hasIds(remote)) {
    if (jsonEqual(local, base)) return cloneJson(remote);
    if (jsonEqual(remote, base)) return cloneJson(local);
    return cloneJson(local);
  }

  const bm = new Map(base.map(x => [x.id, x]));
  const lm = new Map(local.map(x => [x.id, x]));
  const rm = new Map(remote.map(x => [x.id, x]));
  const ids = new Set([...bm.keys(), ...rm.keys(), ...lm.keys()]);
  const out = [];

  for (const id of ids) {
    const b = bm.get(id);
    const l = lm.get(id);
    const r = rm.get(id);

    if (b && !l) {
      // locally deleted: keep deletion unless remote created a totally different record with same id
      continue;
    }
    if (!b && l && !r) { out.push(cloneJson(l)); continue; }
    if (!b && !l && r) { out.push(cloneJson(r)); continue; }
    if (!b && l && r) { out.push(threeWayMerge({}, l, r)); continue; }
    if (b && l && !r) {
      // remotely deleted. If local changed it after base, local wins; otherwise keep deletion.
      if (!jsonEqual(l,b)) out.push(cloneJson(l));
      continue;
    }
    if (b && l && r) out.push(threeWayMerge(b,l,r));
  }

  return out;
}

function threeWayMerge(base, local, remote) {
  if (jsonEqual(local, base)) return cloneJson(remote);
  if (jsonEqual(remote, base)) return cloneJson(local);

  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    return mergeArrayById(base, local, remote);
  }

  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  if (isObj(base) && isObj(local) && isObj(remote)) {
    const out = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(remote), ...Object.keys(local)]);
    for (const key of keys) {
      const bHas = Object.prototype.hasOwnProperty.call(base,key);
      const lHas = Object.prototype.hasOwnProperty.call(local,key);
      const rHas = Object.prototype.hasOwnProperty.call(remote,key);

      if (bHas && !lHas) continue; // local deletion wins
      if (!bHas && lHas && !rHas) { out[key]=cloneJson(local[key]); continue; }
      if (!bHas && !lHas && rHas) { out[key]=cloneJson(remote[key]); continue; }
      if (!bHas && lHas && rHas) { out[key]=threeWayMerge({},local[key],remote[key]); continue; }
      if (bHas && lHas && !rHas) {
        if (!jsonEqual(local[key],base[key])) out[key]=cloneJson(local[key]);
        continue;
      }
      if (bHas && lHas && rHas) out[key]=threeWayMerge(base[key],local[key],remote[key]);
    }
    return out;
  }

  // Both sides changed the same primitive value. The currently edited device wins.
  return cloneJson(local);
}

function renderCloudSyncedViews(){
  if(typeof renderStock==='function') renderStock();
  if(typeof renderActivities==='function') renderActivities();
  if(typeof renderWeekly==='function') renderWeekly();
  if(typeof renderSelling==='function') renderSelling();
  if(typeof renderMembers==='function') renderMembers();
  if(typeof renderSanctions==='function') renderSanctions();
  if(typeof renderMinimumCars==='function') renderMinimumCars();
  if(typeof renderAttendance==='function') renderAttendance();
  if(typeof renderCalendar==='function') renderCalendar();

  if(typeof selectedSellProductId!=='undefined' && selectedSellProductId && typeof renderSellModal==='function'){
    renderSellModal();
  }
  if(typeof selectedSanctionMemberId!=='undefined' && selectedSanctionMemberId && typeof renderSanctionUserModal==='function'){
    renderSanctionUserModal();
  }
  const weekModal=document.getElementById('minimumCarsWeekModal');
  if(typeof minimumCarsWeekAnchor!=='undefined' && weekModal && !weekModal.classList.contains('hidden') && typeof renderMinimumCarsWeek==='function'){
    renderMinimumCarsWeek();
  }
  if(typeof applyAccessUi==='function') applyAccessUi();
}

async function loadCloudData() {
  const result = await apiFetch(`/api/state?load=${Date.now()}`);
  data = normalizeData(result.state || defaultData);
  lastCloudUpdatedAt = result.updatedAt || null;
  lastSyncedData = cloneJson(data);
}

async function pullCloudData() {
  if (!cloudReady || saveInFlight) return;
  try {
    // Beim Live-Poll nur updated_at abrufen. Das sind nur wenige Bytes statt
    // jedes Mal den kompletten app_state herunterzuladen.
    const version = await apiFetch(`/api/state?meta=1&t=${Date.now()}`);
    const remoteUpdatedAt = version.updatedAt || null;

    // Solange sich nichts geändert hat, ist kein weiterer Download nötig.
    if (remoteUpdatedAt === lastCloudUpdatedAt) return;

    // Erst wenn Supabase eine neue Version meldet, den kompletten State laden.
    const result = await apiFetch(`/api/state?load=${Date.now()}`);
    const remote = normalizeData(result.state || defaultData);

    data = remote;
    lastCloudUpdatedAt = result.updatedAt || remoteUpdatedAt || lastCloudUpdatedAt;
    lastSyncedData = cloneJson(remote);
    renderCloudSyncedViews();
  } catch (error) {
    // Nächster Poll versucht es automatisch erneut.
  }
}

function startCloudSync(){
  // Kein 1-Sekunden-Polling mehr.
  // Aktualisiert wird nur bei tatsächlichen Änderungen (BroadcastChannel)
  // sowie beim Zurückkehren/Fokussieren des Fensters als Sicherheitsabgleich.
  if(window.__kingsmenSyncStarted) return;
  window.__kingsmenSyncStarted=true;

  window.addEventListener('focus',()=>pullCloudData());
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible') pullCloudData();
  });

  if('BroadcastChannel' in window){
    const channel=new BroadcastChannel('kingsmen-state-v1');
    window.__kingsmenStateChannel=channel;
    channel.addEventListener('message',event=>{
      if(event.data?.type==='state-changed') pullCloudData();
    });
  }
}

async function saveData(immediate = false) {
  if (!cloudReady) return;

  const write = async () => {
    if (saveInFlight) {
      saveQueued = true;
      return;
    }

    saveInFlight = true;
    try {
      let localToSave = cloneJson(data);
      let base = lastSyncedData || cloneJson(data);
      let expectedUpdatedAt = lastCloudUpdatedAt;

      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const result = await apiFetch('/api/state', {
            method: 'PUT',
            body: JSON.stringify({
              state: localToSave,
              expectedUpdatedAt
            })
          });

          lastCloudUpdatedAt = result.updatedAt || expectedUpdatedAt;
          data = normalizeData(result.state || localToSave);
          lastSyncedData = cloneJson(data);

          // Confirm that Supabase really persisted the write before reporting success.
          const verify = await apiFetch(`/api/state?load=${Date.now()}`);
          const verified = normalizeData(verify.state || defaultData);
          if (JSON.stringify(verified) !== JSON.stringify(data)) {
            throw new Error('Supabase hat die Änderung nicht dauerhaft gespeichert.');
          }
          data = verified;
          lastCloudUpdatedAt = verify.updatedAt || lastCloudUpdatedAt;
          lastSyncedData = cloneJson(verified);
          renderCloudSyncedViews();

          // Andere offene Kingsmen-Fenster sofort über eine echte Änderung informieren.
          try{
            window.__kingsmenStateChannel?.postMessage({
              type:'state-changed',
              updatedAt:lastCloudUpdatedAt
            });
          }catch(_){}

          return;
        } catch (error) {
          if (error.status !== 409 || !error.payload?.state) throw error;

          const remote = normalizeData(error.payload.state);
          localToSave = normalizeData(threeWayMerge(base, localToSave, remote));
          expectedUpdatedAt = error.payload.updatedAt || null;
          base = remote;
        }
      }

      throw new Error('Synchronisierung konnte nach mehreren Versuchen nicht abgeschlossen werden.');
    } catch (error) {
      if (typeof showToast === 'function') showToast('Speichern fehlgeschlagen: ' + error.message);
    } finally {
      saveInFlight = false;
      if (saveQueued) {
        saveQueued = false;
        write();
      }
    }
  };

  if (immediate) {
    clearTimeout(saveTimer);
    return write();
  }

  clearTimeout(saveTimer);
  saveTimer = setTimeout(write, 120);
}

function currentIsoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { week: weekNo, year: d.getUTCFullYear() };
}

function weekIndex(year, week) { return Number(year) * 100 + Number(week); }
function formatDate(iso) { return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)); }
function formatNumber(value) { return Number(value || 0).toLocaleString('de-DE'); }
function parseNumberInput(value) {
  const normalized = String(value ?? '').replace(/\./g, '').replace(/\s+/g, '').replace(/\D/g, '');
  return normalized ? Number(normalized) : 0;
}

function attachNumberFormatter(input) {
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '');
    input.value = digits ? Number(digits).toLocaleString('de-DE') : '';
  });
  input.addEventListener('blur', () => {
    const n = parseNumberInput(input.value);
    input.value = n ? formatNumber(n) : '';
  });
}

function productName(id) { return PRODUCTS.find(p => p.id === id)?.name || id; }
function userName(value) { return String(value || '').trim(); }
function movementDirectionLabel(action) { return action === 'add' ? 'Zugang' : 'Abgang'; }

function populateProductSelect() {
  movementProduct.innerHTML = PRODUCTS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

function populateMovementUsers() {
  const users = [...new Set(data.users.filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b, 'de-DE'));
  $('movementUserSuggestions').innerHTML = users.map(user => `<option value="${escapeHtml(user)}"></option>`).join('');
}

function renderStock() {
  stockGrid.innerHTML = PRODUCTS.map(p => `
    <button class="product-card product-card-button" type="button" data-product-detail="${p.id}">
      <div class="product-card-top"><div class="product-name">${escapeHtml(p.name)}</div><span class="detail-chip">Details</span></div>
      <div class="product-bottom">
        <div class="product-amount">${formatNumber(data.stock[p.id] || 0)}</div>
        <div class="product-unit">${escapeHtml(p.unit)}</div>
      </div>
    </button>
  `).join('');
}

function renderActivities() {
  const items = [...data.movements]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 20);

  if (!items.length) {
    activityList.innerHTML = '<div class="empty-state">Noch keine Bestandsänderungen vorhanden.</div>';
    return;
  }

  activityList.innerHTML = items.map(item => `
    <div class="activity-item">
      <div class="activity-main">
        <div class="activity-title">${escapeHtml(productName(item.product))} · ${movementDirectionLabel(item.action)}</div>
        <div class="activity-meta">${item.user ? `von ${escapeHtml(item.user)} · ` : ''}${formatDate(item.timestamp)}</div>
      </div>
      <div class="activity-change ${item.action === 'add' ? 'positive' : 'negative'}" style="color:${item.action === 'add' ? '#38d878' : '#ff5a67'} !important">${item.action === 'add' ? '+' : '−'}${formatNumber(item.amount)}</div>
    </div>
  `).join('');
}

function isCurrentWeek(year, week) {
  const now = currentIsoWeek();
  return Number(year) === Number(now.year) && Number(week) === Number(now.week);
}

function applyWeeklyStockImpact(entry, delta) {
  if (!entry || !isCurrentWeek(entry.year, entry.week) || !delta) return;
  const product = WEEKLY_PRODUCT;
  const current = Math.max(0, Number(data.stock[product] || 0));
  const next = Math.max(0, current + delta);
  data.stock[product] = next;
  entry.stockImpact = Number(entry.stockImpact || 0) + (next - current);
}

function statusFor(entry) {
  const now = currentIsoWeek();
  const entryIndex = weekIndex(entry.year, entry.week);
  const nowIndex = weekIndex(now.year, now.week);
  if (entry.free === true) return { key: 'frei', label: 'Frei', className: 'status-abgegeben' };
  const fulfilled = Number(entry.given) >= WEEKLY_REQUIRED;
  if (fulfilled) return { key: 'abgegeben', label: 'Abgegeben', className: 'status-abgegeben' };
  if (entryIndex < nowIndex) return { key: 'nicht-abgegeben', label: 'Nicht abgegeben', className: 'status-nicht-abgegeben' };
  return { key: 'offen', label: 'Offen', className: 'status-offen' };
}

function makeCurrentWeekPlaceholder(user) {
  const now = currentIsoWeek();
  return { id: `placeholder-${user}-${now.year}-${now.week}`, person: user, product: WEEKLY_PRODUCT, required: WEEKLY_REQUIRED, given: 0, week: now.week, year: now.year, placeholder: true };
}


function weeklyMemberIsExcluded(member){
  const name=String(member?.name || '').trim();
  const match=name.match(/(\d+)(?!.*\d)/);
  return match ? [11,12].includes(Number(match[1])) : false;
}

function ensureCurrentWeekForMembers(){
  if(!Array.isArray(data.members) || !Array.isArray(data.weekly) || !Array.isArray(data.users)) return false;

  const now=currentIsoWeek();
  let changed=false;

  data.members.forEach(member=>{
    const person=String(member?.name || '').trim();
    if(!person || weeklyMemberIsExcluded(member)) return;

    if(!data.users.some(user=>String(user).trim().toLowerCase()===person.toLowerCase())){
      data.users.push(person);
      changed=true;
    }

    const exists=data.weekly.some(entry=>
      String(entry.person || '').trim().toLowerCase()===person.toLowerCase() &&
      Number(entry.year)===Number(now.year) &&
      Number(entry.week)===Number(now.week)
    );

    if(!exists){
      data.weekly.push({
        id:crypto.randomUUID(),
        person,
        product:WEEKLY_PRODUCT,
        required:WEEKLY_REQUIRED,
        given:0,
        free:false,
        stockImpact:0,
        week:Number(now.week),
        year:Number(now.year),
        createdAt:new Date().toISOString(),
        updatedAt:new Date().toISOString()
      });
      changed=true;
    }
  });

  return changed;
}

function populateWeekSelect() {
  const now = currentIsoWeek();
  const options = [];
  for (let offset = -52; offset <= 12; offset++) {
    const d = new Date(Date.UTC(now.year, 0, 4));
    d.setUTCDate(d.getUTCDate() + (now.week - 1 + offset) * 7);
    const w = currentIsoWeek(d);
    options.push(`<option value="${w.year}-${w.week}">KW ${String(w.week).padStart(2, '0')}/${w.year}${offset === 0 ? ' · aktuell' : ''}</option>`);
  }
  weeklyWeek.innerHTML = options.join('');
  weeklyWeek.value = `${now.year}-${now.week}`;
}

function setWeekSelect(year, week) {
  const value = `${year}-${week}`;
  if (![...weeklyWeek.options].some(option => option.value === value)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = `KW ${String(week).padStart(2, '0')}/${year}`;
    weeklyWeek.appendChild(option);
  }
  weeklyWeek.value = value;
}

function renderWeekly() {
  const weeklyAutoCreated=ensureCurrentWeekForMembers();
  if(weeklyAutoCreated) saveData();

  const users = [...data.users].sort((a,b)=>{
    const an=String(a || '');
    const bn=String(b || '');
    const am=an.match(/(\d+)(?!.*\d)/);
    const bm=bn.match(/(\d+)(?!.*\d)/);

    if(am && bm){
      const diff=Number(bm[1])-Number(am[1]);
      if(diff!==0) return diff;
    }else if(am) return -1;
    else if(bm) return 1;

    return an.localeCompare(bn,'de',{sensitivity:'base',numeric:true});
  });
  $('userSuggestions').innerHTML = users.map(user => `<option value="${escapeHtml(user)}"></option>`).join('');
  populateMovementUsers();

  if (!users.length) {
    peopleList.innerHTML = '<div class="empty-state">Noch keine Nutzer angelegt. Gib oben einen Namen ein und speichere die erste Wochenabgabe.</div>';
    return;
  }

  const now = currentIsoWeek();
  peopleList.innerHTML = users.map(person => {
    const entries = data.weekly
      .filter(entry => String(entry.person).trim().toLowerCase() === person.toLowerCase())
      .sort((a, b) => weekIndex(b.year, b.week) - weekIndex(a.year, a.week));
    const currentEntry = entries.find(entry => Number(entry.week) === now.week && Number(entry.year) === now.year);
    const currentRows = [currentEntry || makeCurrentWeekPlaceholder(person)];

    return `
      <article class="person-card" data-weekly-user-card="${escapeHtml(person)}">
        <div class="person-header">
          <button type="button" class="person-name weekly-user-open ${/(\d+)(?!.*\d)/.test(person) ? 'attendance-animated-name' : ''}" style="${attendanceAnimatedNameStyle(person)}" data-open-weekly-user="${escapeHtml(person)}">${escapeHtml(person)}</button>
          <div class="person-header-actions"><div class="person-count">${entries.length} gespeicherte${entries.length === 1 ? 'r Eintrag' : ' Einträge'} · alle im Nutzerfenster</div><button class="delete-button" type="button" data-delete-user="${escapeHtml(person)}">Gesamte Abgabe löschen</button></div>
        </div>
        <div>
          ${currentRows.map(entry => {
            const status = statusFor(entry);
            const remaining = Math.max(0, WEEKLY_REQUIRED - Number(entry.given));
            const surplus = Math.max(0, Number(entry.given) - WEEKLY_REQUIRED);
            const isPlaceholder = Boolean(entry.placeholder);
            return `
              <div class="weekly-entry">
                <div class="entry-main">
                  <div class="entry-product">Schwarzgeld</div>
                  <div class="entry-meta">KW ${String(entry.week).padStart(2, '0')}/${entry.year} · ${formatNumber(entry.given)} / ${formatNumber(WEEKLY_REQUIRED)}</div>
                </div>
                <div class="status-badge ${status.className}">${status.label}</div>
                <div class="entry-meta entry-detail">${status.key === 'frei' ? 'Frei · ohne Bestandsänderung' : status.key === 'abgegeben' ? (surplus > 0 ? `vollständig · +${formatNumber(surplus)} extra` : 'vollständig') : status.key === 'offen' ? `${formatNumber(remaining)} offen` : 'Frist verpasst'}</div>
                <div class="entry-actions">${isPlaceholder ? '<span class="placeholder-note">Noch kein Eintrag</span>' : `<button class="small-button" type="button" data-edit-weekly="${entry.id}">Bearbeiten</button><button class="small-button" type="button" data-free-weekly="${entry.id}">Frei</button><button class="delete-button" type="button" data-delete-weekly="${entry.id}">Löschen</button>`}</div>
              </div>`;
          }).join('')}
        </div>
      </article>`;
  }).join('');
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function ensureUser(person) {
  const trimmed = person.trim();
  if (!trimmed) return;
  if (!data.users.some(u => u.toLowerCase() === trimmed.toLowerCase())) data.users.push(trimmed);
}


function attendanceKey(date, user) { return `${date}|${String(user).trim().toLowerCase()}`; }

function isoDateLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function localDateFromIso(iso) { return new Date(`${iso}T12:00:00`); }

function attendanceStatus(date, user) {
  return data.attendance?.[attendanceKey(isoDateLocal(date), user)] || '';
}

function attendanceCycle(status) {
  return status === 'present' ? 'absent' : status === 'absent' ? '' : 'present';
}

function setAttendance(date, user, status) {
  const key = attendanceKey(isoDateLocal(date), user);
  if (!data.attendance) data.attendance = {};
  if (status) data.attendance[key] = status;
  else delete data.attendance[key];
  saveData(true);
  renderAttendance();
}

function currentWeekDates() {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - (day - 1));
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function monthDates() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const startDay = first.getDay() || 7;
  first.setDate(first.getDate() - (startDay - 1));
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const endDay = last.getDay() || 7;
  const count = 42;
  return Array.from({length: count}, (_, i) => {
    const d = new Date(first);
    d.setDate(first.getDate() + i);
    return d;
  });
}

function attendanceMonthLabel() {
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date());
}

function attendanceWeekLabel() {
  const dates = currentWeekDates();
  const fmt = new Intl.DateTimeFormat('de-DE', { day:'2-digit', month:'2-digit' });
  return `${fmt.format(dates[0])} – ${fmt.format(dates[6])}`;
}

function addAttendanceUser(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return showToast('Bitte einen Namen eingeben.');
  if (!Array.isArray(data.attendanceUsers)) data.attendanceUsers = [];
  if (data.attendanceUsers.some(u => u.toLowerCase() === trimmed.toLowerCase())) return showToast('Dieser Nutzer existiert bereits.');
  data.attendanceUsers.push(trimmed);
  data.attendanceUsers.sort((a,b)=>a.localeCompare(b,'de-DE'));
  saveData(true);
  $('attendanceNewUser').value = '';
  renderAttendance();
  showToast(`${trimmed} wurde angelegt.`);
}

function removeAttendanceUser(name) {
  if (!confirm(`Anwesenheits-Nutzer „${name}“ wirklich löschen?`)) return;
  const key = String(name).trim().toLowerCase();
  data.attendanceUsers = (data.attendanceUsers || []).filter(u => u.toLowerCase() !== key);
  if (data.attendance) {
    for (const k of Object.keys(data.attendance)) {
      if (k.endsWith(`|${key}`)) delete data.attendance[k];
    }
  }
  saveData(true);
  renderAttendance();
  showToast(`${name} wurde gelöscht.`);
}

function renderTodayAttendanceList() {
  const users = [...(data.attendanceUsers || [])].sort((a,b)=>a.localeCompare(b,'de-DE'));
  const today = new Date();
  const present = users.filter(u => attendanceStatus(today,u) === 'present');
  const absent = users.filter(u => attendanceStatus(today,u) !== 'present');
  const renderUser = (u, absentClass=false) => `<div class="attendance-name-row ${absentClass ? 'is-absent' : 'is-present'}">
      <button class="attendance-name-button" type="button" data-today-attendance-user="${escapeHtml(u)}">
        <span class="attendance-state-dot"></span><strong>${escapeHtml(u)}</strong>
      </button>
      <button class="attendance-remove-user" type="button" title="Nutzer löschen" data-remove-attendance-user="${escapeHtml(u)}">×</button>
    </div>`;
  $('attendancePresentCount').textContent = present.length;
  $('attendanceAbsentCount').textContent = absent.length;
  $('attendancePresentList').innerHTML = present.length ? present.map(u=>renderUser(u)).join('') : '<div class="attendance-empty-small">Niemand als anwesend markiert.</div>';
  $('attendanceAbsentList').innerHTML = absent.length ? absent.map(u=>renderUser(u,true)).join('') : '<div class="attendance-empty-small">Niemand fehlt.</div>';
}

function renderWeekCalendar() {
  const dates = currentWeekDates();
  const users = [...(data.attendanceUsers || [])].sort((a,b)=>a.localeCompare(b,'de-DE'));
  const dayNames = ['Mo','Di','Mi','Do','Fr','Sa','So'];
  $('attendanceWeekLabel').textContent = attendanceWeekLabel();
  $('attendanceWeekCalendar').innerHTML = users.length ? `
    <div class="week-calendar-grid" style="--week-cols:8">
      <div class="week-calendar-corner">Nutzer</div>
      ${dates.map((d,i)=>`<div class="week-day-head ${isoDateLocal(d)===isoDateLocal(new Date())?'is-today':''}"><span>${dayNames[i]}</span><strong>${d.getDate()}</strong></div>`).join('')}
      ${users.map(user=>`<div class="week-user-name">${escapeHtml(user)}</div>${dates.map(d=>{
        const status=attendanceStatus(d,user);
        const cls=status==='present'?'attendance-present':status==='absent'?'attendance-absent':'';
        return `<button class="week-attendance-cell ${cls}" type="button" data-attendance-date="${isoDateLocal(d)}" data-attendance-user="${escapeHtml(user)}">${status==='present'?'✓':status==='absent'?'✕':'·'}</button>`;
      }).join('')}`).join('')}
    </div>` : '<div class="attendance-empty">Lege links zuerst einen Anwesenheits-Nutzer an.</div>';
}

function renderMonthCalendar() {
  const dates = monthDates();
  const users = [...(data.attendanceUsers || [])].sort((a,b)=>a.localeCompare(b,'de-DE'));
  const now = new Date();
  const dayNames = ['Mo','Di','Mi','Do','Fr','Sa','So'];
  $('attendanceMonthLabel').textContent = attendanceMonthLabel();
  $('attendanceMonthCalendar').innerHTML = users.length ? `
    <div class="month-calendar-grid" style="--month-cols:8">
      <div class="month-corner">Nutzer</div>
      ${dates.map((d,i)=>`<div class="month-day-head ${d.getMonth()!==now.getMonth()?'outside-month':''} ${isoDateLocal(d)===isoDateLocal(now)?'is-today':''}"><span>${dayNames[i%7]}</span><strong>${d.getDate()}</strong></div>`).join('')}
      ${users.map(user=>`<div class="month-user-name">${escapeHtml(user)}</div>${dates.map(d=>{
        const status=attendanceStatus(d,user);
        const cls=status==='present'?'attendance-present':status==='absent'?'attendance-absent':'';
        return `<button class="month-attendance-cell ${cls}" type="button" data-attendance-date="${isoDateLocal(d)}" data-attendance-user="${escapeHtml(user)}">${status==='present'?'✓':status==='absent'?'✕':'·'}</button>`;
      }).join('')}`).join('')}
    </div>` : '<div class="attendance-empty">Noch keine Anwesenheits-Nutzer vorhanden.</div>';
}

function openAttendanceMonth() {
  renderMonthCalendar();
  $('attendanceMonthModal').classList.remove('hidden');
}
function closeAttendanceMonth() { $('attendanceMonthModal').classList.add('hidden'); }


function renderAttendance() {
  renderTodayAttendanceList();
  renderWeekCalendar();
  if (!$('attendanceMonthModal').classList.contains('hidden')) renderMonthCalendar();
}

let currentAccess='full';
let currentSessionUser={id:'',username:''};
let canEditCalendar=false;

function isLimitedAccess(){ return currentAccess==='limited'; }
function isCalendarOnlyAccess(){ return false; }
function canSeeCalendar(){ return currentAccess==='full' || currentAccess==='limited'; }

function limitedReadOnlyGuard(area){
  if(!isLimitedAccess()) return false;
  showToast(area ? `${area} kann mit dem Mitglieder-Passwort nur angesehen werden.` : 'Mit dem Mitglieder-Passwort ist diese Aktion nicht erlaubt.');
  return true;
}

function applyAccessUi(){
  const allowed=currentAccess==='limited'
      ? new Set(['selling','sanctions','minimum-cars','calendar'])
      : null;
  document.querySelectorAll('.tab-button').forEach(btn=>{
    btn.hidden=!!allowed && !allowed.has(btn.dataset.tab);
  });
  document.body.classList.toggle('limited-access',isLimitedAccess());
  const calendarTab=document.querySelector('.tab-button[data-tab="calendar"]');
  if(calendarTab) calendarTab.hidden=false;

  if(isLimitedAccess()){
    const catalogEdit=$('sanctionCatalogEditButton');
    const sanctionCreate=$('sanctionCreateButton');
    if(catalogEdit) catalogEdit.hidden=true;
    if(sanctionCreate) sanctionCreate.hidden=true;
    if(!allowed.has(document.querySelector('.tab-button.active')?.dataset.tab || '')){
      setTab('selling');
    }
  }
}

function setTab(tab) {
  const allowedTabs=currentAccess==='limited' ? ['selling','sanctions','minimum-cars','calendar'] : null;
  if(allowedTabs && !allowedTabs.includes(tab)) tab='selling';
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tab));
  $('pageTitle').textContent = tab === 'stock' ? 'Bestand' : tab === 'movement' ? 'Bestand ändern' : tab === 'weekly' ? 'Wochenabgabe' : tab === 'selling' ? 'Verkaufen' : tab === 'sanctions' ? 'Sanktionen' : tab === 'minimum-cars' ? 'Mindestbestand - Autos' : tab === 'attendance' ? 'Anwesenheit' : tab === 'calendar' ? 'Kalender' : 'Mitglieder';
  if (tab === 'attendance') renderAttendance();
  if (tab === 'calendar') renderCalendar();
  if (tab === 'selling') renderSelling();
  if (tab === 'members') renderMembers();
  if (tab === 'sanctions') renderSanctions();
  if (tab === 'minimum-cars') renderMinimumCars();
}

// ===== Wochenkalender (18:00–24:00, 30-Minuten-Blöcke) =====
let calendarWeekAnchor = new Date();
let calendarEditingId = null;
let calendarPickerMonth = new Date();
function calendarDisplayDate(iso){ if(!iso) return 'Datum auswählen'; const [y,m,d]=iso.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}); }
function setCalendarDateValue(iso){ const input=$('calendarDate'); if(!input) return; input.value=iso; if($('calendarDateText')) $('calendarDateText').textContent=calendarDisplayDate(iso); }
function renderCalendarDatePicker(){
  const box=$('calendarDateDays'), title=$('calendarDateMonth'); if(!box||!title) return;
  const y=calendarPickerMonth.getFullYear(), m=calendarPickerMonth.getMonth();
  title.textContent=new Date(y,m,1).toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  const first=new Date(y,m,1), offset=(first.getDay()+6)%7, count=new Date(y,m+1,0).getDate();
  const selected=$('calendarDate')?.value||''; let html='';
  for(let i=0;i<offset;i++) html+='<span class="lle-date-empty"></span>';
  for(let d=1;d<=count;d++){ const iso=calendarIsoDate(new Date(y,m,d)); const today=iso===calendarIsoDate(new Date()); html+=`<button type="button" class="lle-date-day ${selected===iso?'is-selected':''} ${today?'is-today':''}" data-picker-date="${iso}">${d}</button>`; }
  box.innerHTML=html;
}
function openCalendarDatePicker(){ const current=$('calendarDate')?.value; if(current){ const [y,m]=current.split('-').map(Number); calendarPickerMonth=new Date(y,m-1,1); } else calendarPickerMonth=new Date(); renderCalendarDatePicker(); $('calendarDatePicker')?.classList.remove('hidden'); }
function closeCalendarDatePicker(){ $('calendarDatePicker')?.classList.add('hidden'); }

function calendarIsoDate(date){ const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0'); return `${y}-${m}-${d}`; }
function calendarMonday(date){ const d=new Date(date.getFullYear(),date.getMonth(),date.getDate()); const day=d.getDay()||7; d.setDate(d.getDate()-day+1); return d; }
function calendarAddDays(date,n){ const d=new Date(date); d.setDate(d.getDate()+n); return d; }
function calendarTimeToMinutes(t){ const [h,m]=String(t).split(':').map(Number); return h*60+(m||0); }
function calendarMinutesToTime(min){ return `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`; }
function calendarEscape(v){ return escapeHtml(String(v ?? '')); }
function calendarEntries(){ if(!data.calendar||typeof data.calendar!=='object') data.calendar={entries:[]}; if(!Array.isArray(data.calendar.entries)) data.calendar.entries=[]; return data.calendar.entries; }
function calendarWeekLabel(monday){ const sunday=calendarAddDays(monday,6); const fmt=d=>d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}); return `${fmt(monday)} – ${fmt(sunday)}.${sunday.getFullYear()}`; }
function renderCalendar(){
  const grid=$('calendarWeekGrid'); if(!grid) return;
  const monday=calendarMonday(calendarWeekAnchor), days=Array.from({length:7},(_,i)=>calendarAddDays(monday,i));
  const names=['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'], entries=calendarEntries(), canEdit=canEditCalendar;
  if($('calendarWeekTitle')) $('calendarWeekTitle').textContent=calendarWeekLabel(monday);
  if($('calendarAddButton')) $('calendarAddButton').hidden=!canEdit;
  let html='<div class="schedule-corner">Zeit</div>';
  days.forEach((day,i)=>html+=`<div class="schedule-day-head"><strong>${names[i]}</strong><span>${day.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})}</span></div>`);
  for(let min=1080;min<1440;min+=30){
    const start=calendarMinutesToTime(min);
    html+=`<div class="schedule-time">${start}</div>`;
    days.forEach(day=>{
      const iso=calendarIsoDate(day);
      const matches=entries.filter(e=>e.date===iso&&calendarTimeToMinutes(e.startTime)<min+30&&calendarTimeToMinutes(e.endTime)>min);
      const chips=matches.map(e=>`<button type="button" class="schedule-entry" data-calendar-entry-id="${calendarEscape(e.id)}" ${canEdit?'':'disabled'} title="${calendarEscape(e.title)}"><strong>${calendarEscape(e.title)}</strong><span>${calendarEscape(e.startTime)}–${calendarEscape(e.endTime)}</span>${e.note?`<small>${calendarEscape(e.note)}</small>`:''}</button>`).join('');
      html+=`<div class="schedule-cell ${canEdit?'schedule-cell-editable':''}" data-calendar-date="${iso}" data-calendar-time="${start}">${chips}</div>`;
    });
  }
  // Abschlusszeile für das Ende des Tages anzeigen. 24:00 ist nur die
  // sichtbare Endmarke des Zeitraums und kein zusätzlicher Termin-Slot.
  html+=`<div class="schedule-time schedule-time-end">24:00</div>`;
  days.forEach(()=>html+=`<div class="schedule-cell schedule-cell-end" aria-hidden="true"></div>`);
  grid.innerHTML=html;
}
function openCalendarModal(entry=null,date='',startTime='18:00'){
  if(!canEditCalendar) return;
  calendarEditingId=entry?.id||null;
  $('calendarModalTitle').textContent=entry?'Termin bearbeiten':'Termin erstellen';
  $('calendarTitle').value=entry?.title||''; setCalendarDateValue(entry?.date||date||calendarIsoDate(new Date()));
  $('calendarStart').value=entry?.startTime||startTime; $('calendarEnd').value=entry?.endTime||calendarMinutesToTime(Math.min(1440,calendarTimeToMinutes(startTime)+30));
  $('calendarNote').value=entry?.note||''; $('calendarDeleteButton').hidden=!entry; $('calendarModal').classList.remove('hidden');
}
function closeCalendarModal(){ $('calendarModal')?.classList.add('hidden'); calendarEditingId=null; }
function calendarValidTime(t){ const m=calendarTimeToMinutes(t); return m>=1080&&m<=1440&&m%30===0; }
async function saveCalendarEntry(event){
  event.preventDefault(); if(!canEditCalendar) return;
  const title=$('calendarTitle').value.trim(),date=$('calendarDate').value,startTime=$('calendarStart').value,endTime=$('calendarEnd').value,note=$('calendarNote').value.trim();
  if(!title||!date) return showToast('Bitte Titel und Datum angeben.');
  if(!calendarValidTime(startTime)||!calendarValidTime(endTime)||calendarTimeToMinutes(endTime)<=calendarTimeToMinutes(startTime)) return showToast('Nur 30-Minuten-Zeiten von 18:00 bis 24:00.');
  const entries=calendarEntries(),now=new Date().toISOString(),wasEditing=Boolean(calendarEditingId);
  if(calendarEditingId){ const entry=entries.find(x=>x.id===calendarEditingId); if(entry) Object.assign(entry,{title,date,startTime,endTime,note,updatedAt:now}); }
  else entries.push({id:crypto.randomUUID(),title,date,startTime,endTime,note,createdByUserId:String(currentSessionUser.id||''),createdByUserName:String(currentSessionUser.username||''),createdAt:now,updatedAt:now});
  closeCalendarModal(); await saveData(true); renderCalendar(); showToast(wasEditing?'Termin gespeichert.':'Termin erstellt.');
}
async function deleteCalendarEntry(){
  if(!canEditCalendar||!calendarEditingId) return; if(!confirm('Diesen Termin wirklich löschen?')) return;
  data.calendar.entries=calendarEntries().filter(x=>x.id!==calendarEditingId); closeCalendarModal(); await saveData(true); renderCalendar(); showToast('Termin gelöscht.');
}
function initCalendar(){
  $('calendarPrevWeek')?.addEventListener('click',()=>{calendarWeekAnchor=calendarAddDays(calendarWeekAnchor,-7);renderCalendar();});
  $('calendarNextWeek')?.addEventListener('click',()=>{calendarWeekAnchor=calendarAddDays(calendarWeekAnchor,7);renderCalendar();});
  $('calendarTodayButton')?.addEventListener('click',()=>{calendarWeekAnchor=new Date();renderCalendar();});
  $('calendarAddButton')?.addEventListener('click',()=>openCalendarModal());
  $('calendarWeekGrid')?.addEventListener('click',event=>{ if(!canEditCalendar) return; const b=event.target.closest('[data-calendar-entry-id]'); if(b){const e=calendarEntries().find(x=>x.id===b.dataset.calendarEntryId);if(e)openCalendarModal(e);return;} const c=event.target.closest('[data-calendar-date][data-calendar-time]');if(c)openCalendarModal(null,c.dataset.calendarDate,c.dataset.calendarTime); });
  $('calendarForm')?.addEventListener('submit',saveCalendarEntry); $('calendarDeleteButton')?.addEventListener('click',deleteCalendarEntry);
  document.querySelectorAll('[data-close-calendar]').forEach(x=>x.addEventListener('click',closeCalendarModal));
  $('calendarDateButton')?.addEventListener('click',()=>{ if($('calendarDatePicker')?.classList.contains('hidden')) openCalendarDatePicker(); else closeCalendarDatePicker(); });
  $('calendarDatePrev')?.addEventListener('click',()=>{ calendarPickerMonth=new Date(calendarPickerMonth.getFullYear(),calendarPickerMonth.getMonth()-1,1); renderCalendarDatePicker(); });
  $('calendarDateNext')?.addEventListener('click',()=>{ calendarPickerMonth=new Date(calendarPickerMonth.getFullYear(),calendarPickerMonth.getMonth()+1,1); renderCalendarDatePicker(); });
  $('calendarDateDays')?.addEventListener('click',e=>{ const b=e.target.closest('[data-picker-date]'); if(!b)return; setCalendarDateValue(b.dataset.pickerDate); closeCalendarDatePicker(); });
  document.addEventListener('click',e=>{ const picker=$('calendarDatePicker'), field=e.target.closest('.lle-date-field'); if(picker&&!picker.classList.contains('hidden')&&!field) closeCalendarDatePicker(); });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1900);
}

function refresh() {
  renderStock();
  renderActivities();
  renderWeekly();
  renderSelling();
  renderMembers();
  renderSanctions();
  renderMinimumCars();
  renderAttendance();
  renderCalendar();
}

function initWeekDefaults() {
  const now = currentIsoWeek();
  $('currentWeekBadge').textContent = `KW ${String(now.week).padStart(2, '0')}/${now.year}`;
  setWeekSelect(now.year, now.week);
}


let selectedWeeklyUser = '';

function weeklyUserEntries(person){
  const key=String(person || '').trim().toLowerCase();
  return data.weekly
    .filter(entry=>String(entry.person || '').trim().toLowerCase()===key)
    .sort((a,b)=>weekIndex(b.year,b.week)-weekIndex(a.year,a.week));
}

function renderWeeklyUserModal(){
  if(!selectedWeeklyUser) return;
  const entries=weeklyUserEntries(selectedWeeklyUser);
  const hasNumber=/(\d+)(?!.*\d)/.test(selectedWeeklyUser);

  $('weeklyUserModalTitle').innerHTML=`<span class="${hasNumber ? 'attendance-animated-name' : ''}" style="${attendanceAnimatedNameStyle(selectedWeeklyUser)}">${escapeHtml(selectedWeeklyUser)}</span>`;
  $('weeklyUserNameInput').value=selectedWeeklyUser;

  const total=entries.reduce((sum,entry)=>sum+Math.max(0,Number(entry.given)||0),0);
  const complete=entries.filter(entry=>entry.free===true || Number(entry.given)>=WEEKLY_REQUIRED).length;
  $('weeklyUserSummary').innerHTML=`
    <div class="summary-card"><span>Gespeicherte Wochen</span><strong>${entries.length}</strong></div>
    <div class="summary-card"><span>Davon vollständig</span><strong>${complete}</strong></div>
    <div class="summary-card"><span>Gesamtabgabe</span><strong>${formatNumber(total)}</strong></div>`;

  $('weeklyUserHistory').innerHTML=entries.length ? entries.map(entry=>{
    const status=statusFor(entry);
    const remaining=Math.max(0,WEEKLY_REQUIRED-Number(entry.given));
    const surplus=Math.max(0,Number(entry.given)-WEEKLY_REQUIRED);
    return `
      <div class="weekly-user-history-row">
        <div>
          <div class="entry-product">KW ${String(entry.week).padStart(2,'0')}/${entry.year}</div>
          <div class="entry-meta">${formatNumber(entry.given)} / ${formatNumber(WEEKLY_REQUIRED)} Schwarzgeld</div>
        </div>
        <div class="status-badge ${status.className}">${status.label}</div>
        <div class="entry-meta">${status.key==='frei' ? 'Frei · ohne Bestandsänderung' : status.key==='abgegeben' ? (surplus>0 ? `+${formatNumber(surplus)} extra` : 'vollständig') : status.key==='offen' ? `${formatNumber(remaining)} offen` : 'Frist verpasst'}</div>
        <div class="entry-actions">
          <button class="small-button" type="button" data-weekly-modal-edit="${entry.id}">Bearbeiten</button>
          <button class="small-button" type="button" data-weekly-modal-free="${entry.id}">Frei</button>
          <button class="delete-button" type="button" data-weekly-modal-delete="${entry.id}">Löschen</button>
        </div>
      </div>`;
  }).join('') : '<div class="empty-state">Für diesen Nutzer gibt es noch keine gespeicherten Wochenabgaben.</div>';
}

function openWeeklyUserModal(person){
  if(!person) return;
  selectedWeeklyUser=person;
  renderWeeklyUserModal();
  $('weeklyUserModal')?.classList.remove('hidden');
  document.body.classList.add('weekly-user-modal-open');
}

function closeWeeklyUserModal(){
  $('weeklyUserModal')?.classList.add('hidden');
  document.body.classList.remove('weekly-user-modal-open');
}

async function renameWeeklyUser(){
  const oldName=selectedWeeklyUser;
  const newName=String($('weeklyUserNameInput')?.value || '').trim();
  if(!oldName || !newName) return showToast('Bitte einen Nutzernamen eingeben.');

  const collision=data.users.some(user=>
    String(user).trim().toLowerCase()===newName.toLowerCase() &&
    String(user).trim().toLowerCase()!==oldName.toLowerCase()
  );
  if(collision) return showToast('Dieser Nutzer existiert bereits.');

  data.users=data.users.map(user=>
    String(user).trim().toLowerCase()===oldName.toLowerCase() ? newName : user
  );
  data.weekly.forEach(entry=>{
    if(String(entry.person || '').trim().toLowerCase()===oldName.toLowerCase()){
      entry.person=newName;
      entry.updatedAt=new Date().toISOString();
    }
  });

  selectedWeeklyUser=newName;
  await saveData(true);
  renderWeekly();
  renderWeeklyUserModal();
  showToast('Nutzername geändert.');
}

async function deleteWeeklyUserFromModal(){
  const person=selectedWeeklyUser;
  if(!person) return;
  if(!confirm(`Nutzer „${person}“ und alle seine Wochenabgaben wirklich löschen?`)) return;

  const entries=weeklyUserEntries(person);
  for(const entry of entries){
    if(isCurrentWeek(entry.year,entry.week) && Number(entry.stockImpact || 0)){
      const current=Math.max(0,Number(data.stock[WEEKLY_PRODUCT] || 0));
      data.stock[WEEKLY_PRODUCT]=Math.max(0,current-Number(entry.stockImpact || 0));
    }
  }

  data.weekly=data.weekly.filter(entry=>String(entry.person || '').trim().toLowerCase()!==person.toLowerCase());
  data.users=data.users.filter(user=>String(user).trim().toLowerCase()!==person.toLowerCase());

  selectedWeeklyUser='';
  await saveData(true);
  closeWeeklyUserModal();
  refresh();
  showToast('Nutzer und Wochenabgaben gelöscht.');
}


async function markWeeklyEntryFree(entryId){
  const entry=data.weekly.find(item=>item.id===entryId);
  if(!entry) return;

  if(entry.free===true){
    showToast('Diese Wochenabgabe ist bereits auf Frei gesetzt.');
    return;
  }

  if(!confirm(`KW ${String(entry.week).padStart(2,'0')}/${entry.year} von „${entry.person}“ auf Frei setzen? Der Schwarzgeld-Bestand wird dadurch nicht erhöht.`)) return;

  // Falls diese aktuelle Wochenabgabe vorher bereits Bestand erzeugt hat,
  // wird genau dieser frühere Einfluss wieder entfernt.
  if(isCurrentWeek(entry.year,entry.week) && Number(entry.stockImpact || 0)){
    const current=Math.max(0,Number(data.stock[WEEKLY_PRODUCT] || 0));
    data.stock[WEEKLY_PRODUCT]=Math.max(0,current-Number(entry.stockImpact || 0));
  }

  // Frei erfüllt die Wochenpflicht, zählt aber NICHT als Geldabgabe
  // und verändert den gesamten Schwarzgeld-Bestand nicht.
  entry.given=0;
  entry.free=true;
  entry.stockImpact=0;
  entry.updatedAt=new Date().toISOString();

  await saveData(true);
  refresh();
  if(selectedWeeklyUser) renderWeeklyUserModal();
  showToast('Wochenabgabe auf Frei gesetzt – kein Schwarzgeld zum Bestand hinzugefügt.');
}

function resetWeeklyForm() {
  $('weeklyEditingId').value = '';
  $('personName').value = '';
  $('givenAmount').value = '0';
  $('weeklyModeLabel').textContent = 'Neuer Eintrag';
  $('weeklySaveButton').textContent = 'Eintrag speichern';
  $('weeklyCancelEdit').classList.add('hidden');
  initWeekDefaults();
}

function startWeeklyEdit(id) {
  const entry = data.weekly.find(item => item.id === id);
  if (!entry) return;
  $('weeklyEditingId').value = id;
  $('personName').value = entry.person;
  $('givenAmount').value = formatNumber(entry.given);
  setWeekSelect(entry.year, entry.week);
  $('weeklyModeLabel').textContent = 'Eintrag bearbeiten';
  $('weeklySaveButton').textContent = 'Änderung speichern';
  $('weeklyCancelEdit').classList.remove('hidden');
  setTab('weekly');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function movementEntriesForProduct(productId) {
  const entries = data.movements.filter(item => item.product === productId).map(item => ({
    timestamp: item.timestamp,
    action: item.action,
    amount: Number(item.amount || 0),
    person: item.user || '',
    source: item.source || 'Bestand ändern',
    detail: item.user ? `von ${item.user}` : 'ohne Benutzer'
  }));

  if (productId === WEEKLY_PRODUCT) {
    data.weekly.filter(entry => isCurrentWeek(entry.year, entry.week) && Number(entry.stockImpact || 0) !== 0).forEach(entry => {
      const impact = Number(entry.stockImpact || 0);
      entries.push({
        timestamp: entry.updatedAt || entry.createdAt || new Date().toISOString(),
        action: impact >= 0 ? 'add' : 'subtract',
        amount: Math.abs(impact),
        person: entry.person || '',
        source: `Wochenabgabe · KW ${String(entry.week).padStart(2, '0')}/${entry.year}`,
        detail: entry.person ? `von ${entry.person}` : 'ohne Benutzer'
      });
    });
  }
  return entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function openProductDetail(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;
  const entries = movementEntriesForProduct(productId);
  productModalTitle.textContent = product.name;
  productModalSummary.innerHTML = `
    <div class="summary-card"><span>Aktueller Bestand</span><strong>${formatNumber(data.stock[productId] || 0)}</strong></div>`;

  productModalList.innerHTML = entries.length ? entries.map(entry => `
    <div class="detail-row">
      <div>
        <div class="detail-row-title">${entry.action === 'add' ? 'Zugang' : 'Abgang'} · ${escapeHtml(entry.source)}</div>
        <div class="detail-row-meta">${entry.source?.startsWith('Sanktion von ') ? '' : (entry.person ? escapeHtml(entry.person) + ' · ' : '')}${formatDate(entry.timestamp)}</div>
      </div>
      <div class="detail-row-amount ${entry.action === 'add' ? 'positive' : 'negative'}">${entry.action === 'add' ? '+' : '−'}${formatNumber(entry.amount)}</div>
    </div>`).join('') : '<div class="empty-state">Für dieses Produkt gibt es noch keine gespeicherten Änderungen.</div>';
  productModal.classList.remove('hidden');
}

function closeProductDetail() { productModal.classList.add('hidden'); }

for (const input of document.querySelectorAll('.number-input')) attachNumberFormatter(input);
document.querySelectorAll('.tab-button').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
stockGrid.addEventListener('click', event => {
  const button = event.target.closest('[data-product-detail]');
  if (button) openProductDetail(button.dataset.productDetail);
});
productModal.addEventListener('click', event => { if (event.target.closest('[data-close-modal]')) closeProductDetail(); });
window.addEventListener('keydown', event => { if (event.key === 'Escape') closeProductDetail(); });

/* v44: explicit handlers for Bestand ändern + Wochenabgabe.
   They prevent the browser's native form submit/reload and save directly to the shared state. */
const movementFormEl = $('movementForm');
if (movementFormEl) {
  movementFormEl.addEventListener('submit', async event => {
    event.preventDefault();

    const action = event.submitter?.dataset?.action || 'add';
    const product = $('movementProduct').value;
    const amount = parseNumberInput($('movementAmount').value);
    const user = userName($('movementUser').value);

    if (!product || amount <= 0) {
      showToast('Bitte eine gültige Menge eingeben.');
      return;
    }

    const current = Math.max(0, Number(data.stock[product] || 0));
    const actualAmount = action === 'subtract' ? Math.min(current, amount) : amount;

    if (action === 'subtract' && actualAmount <= 0) {
      showToast('Von diesem Produkt ist kein Bestand vorhanden.');
      return;
    }

    data.stock[product] = action === 'subtract'
      ? Math.max(0, current - actualAmount)
      : current + actualAmount;

    if (user) ensureUser(user);

    data.movements.push({
      id: crypto.randomUUID(),
      product,
      action,
      amount: actualAmount,
      user,
      timestamp: new Date().toISOString()
    });

    $('movementAmount').value = '';
    $('movementUser').value = '';

    await saveData(true);
    refresh();
    showToast(`${productName(product)} wurde ${action === 'add' ? 'hinzugefügt' : 'abgezogen'}.`);
  });
}

function weeklySelection() {
  const [year, week] = String($('weeklyWeek').value || '').split('-').map(Number);
  return { year, week };
}

function findWeeklyEntry(person, year, week) {
  const key = String(person || '').trim().toLowerCase();
  return data.weekly.find(entry =>
    String(entry.person || '').trim().toLowerCase() === key &&
    Number(entry.year) === Number(year) &&
    Number(entry.week) === Number(week)
  );
}

function createWeeklyEntry(person, year, week) {
  const entry = {
    id: crypto.randomUUID(),
    person: person.trim(),
    product: WEEKLY_PRODUCT,
    required: WEEKLY_REQUIRED,
    given: 0,
    free: false,
    stockImpact: 0,
    week: Number(week),
    year: Number(year),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.weekly.push(entry);
  ensureUser(person);
  return entry;
}

async function adjustWeeklyFromForm(action) {
  const person = userName($('personName').value);
  const amount = parseNumberInput($('givenAmount').value);
  const {year, week} = weeklySelection();

  if (!person) {
    showToast('Bitte ein Mitglied auswählen.');
    return;
  }
  if (!year || !week) {
    showToast('Bitte eine Kalenderwoche auswählen.');
    return;
  }
  if (amount <= 0) {
    showToast('Bitte eine gültige Menge eingeben.');
    return;
  }

  let entry = findWeeklyEntry(person, year, week);
  if (!entry) entry = createWeeklyEntry(person, year, week);

  const before = Math.max(0, Number(entry.given || 0));
  const after = action === 'subtract'
    ? Math.max(0, before - amount)
    : before + amount;
  const delta = after - before;

  entry.given = after;
  entry.free = false;
  entry.updatedAt = new Date().toISOString();
  applyWeeklyStockImpact(entry, delta);

  $('weeklyEditingId').value = entry.id;
  $('givenAmount').value = formatNumber(entry.given);
  $('weeklyModeLabel').textContent = 'Eintrag bearbeiten';
  $('weeklySaveButton').textContent = 'Änderung speichern';
  $('weeklyCancelEdit').classList.remove('hidden');

  await saveData(true);
  refresh();
  showToast(`Wochenabgabe wurde ${delta >= 0 ? 'erhöht' : 'verringert'}.`);
}

const weeklyFormEl = $('weeklyForm');
if (weeklyFormEl) {
  weeklyFormEl.addEventListener('submit', async event => {
    event.preventDefault();
    const action = event.submitter?.dataset?.weeklyAction;
    if (!action) return;
    await adjustWeeklyFromForm(action);
  });
}

$('weeklySaveButton')?.addEventListener('click', async () => {
  const person = userName($('personName').value);
  const given = parseNumberInput($('givenAmount').value);
  const {year, week} = weeklySelection();

  if (!person) {
    showToast('Bitte einen Nutzer eingeben.');
    return;
  }
  if (!year || !week) {
    showToast('Bitte eine Kalenderwoche auswählen.');
    return;
  }

  const editingId = $('weeklyEditingId').value;
  let entry = editingId ? data.weekly.find(item => item.id === editingId) : null;
  if (!entry) entry = findWeeklyEntry(person, year, week);
  if (!entry) entry = createWeeklyEntry(person, year, week);

  const oldImpact = Number(entry.stockImpact || 0);
  const oldGiven = Math.max(0, Number(entry.given || 0));
  const wasCurrent = isCurrentWeek(entry.year, entry.week);

  // Undo the old current-week stock effect before moving/editing the entry.
  if (wasCurrent && oldImpact) {
    const currentStock = Math.max(0, Number(data.stock[WEEKLY_PRODUCT] || 0));
    data.stock[WEEKLY_PRODUCT] = Math.max(0, currentStock - oldImpact);
  }

  entry.person = person;
  entry.year = Number(year);
  entry.week = Number(week);
  entry.given = Math.max(0, given);
  entry.free = false;
  entry.product = WEEKLY_PRODUCT;
  entry.required = WEEKLY_REQUIRED;
  entry.stockImpact = 0;
  entry.updatedAt = new Date().toISOString();
  ensureUser(person);

  if (isCurrentWeek(entry.year, entry.week)) {
    applyWeeklyStockImpact(entry, entry.given);
  }

  await saveData(true);
  resetWeeklyForm();
  refresh();
  showToast('Wochenabgabe gespeichert.');
});

$('weeklyCancelEdit')?.addEventListener('click', () => {
  resetWeeklyForm();
});

peopleList?.addEventListener('click', async event => {
  const openUser=event.target.closest('[data-open-weekly-user]');
  if(openUser){
    openWeeklyUserModal(openUser.dataset.openWeeklyUser);
    return;
  }

  const edit = event.target.closest('[data-edit-weekly]');
  if (edit) {
    startWeeklyEdit(edit.dataset.editWeekly);
    return;
  }

  const free = event.target.closest('[data-free-weekly]');
  if (free) {
    await markWeeklyEntryFree(free.dataset.freeWeekly);
    return;
  }

  const del = event.target.closest('[data-delete-weekly]');
  if (del) {
    const entry = data.weekly.find(item => item.id === del.dataset.deleteWeekly);
    if (!entry) return;
    if (!confirm(`Eintrag von „${entry.person}“ wirklich löschen?`)) return;

    if (isCurrentWeek(entry.year, entry.week) && Number(entry.stockImpact || 0)) {
      const current = Math.max(0, Number(data.stock[WEEKLY_PRODUCT] || 0));
      data.stock[WEEKLY_PRODUCT] = Math.max(0, current - Number(entry.stockImpact || 0));
    }

    data.weekly = data.weekly.filter(item => item.id !== entry.id);
    await saveData(true);
    refresh();
    showToast('Wochenabgabe gelöscht.');
    return;
  }

  const delUser = event.target.closest('[data-delete-user]');
  if (delUser) {
    const person = delUser.dataset.deleteUser;
    if (!confirm(`Alle Wochenabgaben von „${person}“ wirklich löschen?`)) return;

    const entries = data.weekly.filter(item =>
      String(item.person || '').trim().toLowerCase() === String(person).trim().toLowerCase()
    );

    for (const entry of entries) {
      if (isCurrentWeek(entry.year, entry.week) && Number(entry.stockImpact || 0)) {
        const current = Math.max(0, Number(data.stock[WEEKLY_PRODUCT] || 0));
        data.stock[WEEKLY_PRODUCT] = Math.max(0, current - Number(entry.stockImpact || 0));
      }
    }

    data.weekly = data.weekly.filter(item =>
      String(item.person || '').trim().toLowerCase() !== String(person).trim().toLowerCase()
    );
    data.users = data.users.filter(user =>
      String(user).trim().toLowerCase() !== String(person).trim().toLowerCase()
    );

    await saveData(true);
    refresh();
    showToast('Wochenabgaben des Nutzers wurden gelöscht.');
  }
});







document.querySelectorAll('[data-close-weekly-user]').forEach(el=>el.addEventListener('click',closeWeeklyUserModal));
$('weeklyUserRenameButton')?.addEventListener('click',renameWeeklyUser);
$('weeklyUserDeleteButton')?.addEventListener('click',deleteWeeklyUserFromModal);
$('weeklyUserHistory')?.addEventListener('click',async event=>{
  const edit=event.target.closest('[data-weekly-modal-edit]');
  if(edit){
    const id=edit.dataset.weeklyModalEdit;
    closeWeeklyUserModal();
    startWeeklyEdit(id);
    return;
  }

  const free=event.target.closest('[data-weekly-modal-free]');
  if(free){
    await markWeeklyEntryFree(free.dataset.weeklyModalFree);
    return;
  }

  const del=event.target.closest('[data-weekly-modal-delete]');
  if(del){
    const entry=data.weekly.find(item=>item.id===del.dataset.weeklyModalDelete);
    if(!entry) return;
    if(!confirm(`KW ${String(entry.week).padStart(2,'0')}/${entry.year} von „${entry.person}“ wirklich löschen?`)) return;

    if(isCurrentWeek(entry.year,entry.week) && Number(entry.stockImpact || 0)){
      const current=Math.max(0,Number(data.stock[WEEKLY_PRODUCT] || 0));
      data.stock[WEEKLY_PRODUCT]=Math.max(0,current-Number(entry.stockImpact || 0));
    }

    data.weekly=data.weekly.filter(item=>item.id!==entry.id);
    await saveData(true);
    renderWeekly();
    renderWeeklyUserModal();
    renderStock();
    showToast('Wochenabgabe gelöscht.');
  }
});




/* v60: Sanktionen */
let selectedSanctionMemberId = null;
let editingSanctionEntryId = null;
let editingSanctionCatalogId = null;


function sanctionCatalogAmountsText(amounts){
  return (Array.isArray(amounts) ? amounts : []).map(formatNumber).join(', ');
}

function sanctionCatalogAmountEditorValues(){
  return [...document.querySelectorAll('[data-sanction-catalog-amount-input]')]
    .map(input => parseNumberInput(input.value))
    .filter(value => value > 0);
}

function addSanctionCatalogAmountRow(value=''){
  const editor=$('sanctionCatalogAmountsEditor');
  if(!editor) return;
  const row=document.createElement('div');
  row.className='sanction-catalog-amount-row';
  row.innerHTML=`
    <input class="number-input" type="text" inputmode="numeric" data-sanction-catalog-amount-input placeholder="z. B. 50.000" value="${value ? formatNumber(value) : ''}" />
    <button class="delete-button sanction-remove-amount" type="button" data-remove-sanction-catalog-amount>Entfernen</button>`;
  editor.appendChild(row);
  const input=row.querySelector('[data-sanction-catalog-amount-input]');
  if(input) attachNumberFormatter(input);
}

function setSanctionCatalogAmountRows(amounts=[]){
  const editor=$('sanctionCatalogAmountsEditor');
  if(!editor) return;
  editor.innerHTML='';
  const values=(Array.isArray(amounts) && amounts.length) ? amounts : [''];
  values.forEach(value => addSanctionCatalogAmountRow(value));
}

function sanctionsEnsureData(){
  if(!data.sanctions || typeof data.sanctions !== 'object') data.sanctions = {};
  if(!Array.isArray(data.sanctions.catalog)) data.sanctions.catalog = [];
  if(!Array.isArray(data.sanctions.entries)) data.sanctions.entries = [];
}

function sanctionMember(memberId){
  return data.members?.find(member => member.id === memberId) || null;
}

function openSanctionsForMember(memberId){
  const member = sanctionMember(memberId);
  if(!member) return;
  selectedSanctionMemberId = memberId;
  $('sanctionUserModalTitle').textContent = member.name;
  renderSanctionUserModal();
  $('sanctionUserModal')?.classList.remove('hidden');
}

function closeSanctionUserModal(){
  $('sanctionUserModal')?.classList.add('hidden');
  selectedSanctionMemberId = null;
}

function sanctionOpenEntriesForMember(memberId){
  sanctionsEnsureData();
  return data.sanctions.entries
    .filter(entry => entry.memberId === memberId && entry.status === 'open')
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function sanctionOpenTotalForMember(memberId){
  return sanctionOpenEntriesForMember(memberId)
    .reduce((sum,entry) => sum + Math.max(0,Number(entry.amount || 0)),0);
}


function forceSanctionsOverviewRefresh(){
  sanctionsEnsureData();

  const openEntries=data.sanctions.entries.filter(entry=>entry.status==='open');
  const openMemberIds=[...new Set(openEntries.map(entry=>entry.memberId))];
  const openTotal=openEntries.reduce((sum,entry)=>sum+Math.max(0,Number(entry.amount||0)),0);

  const count=$('sanctionsOpenCount');
  if(count) count.textContent=`${openMemberIds.length} ${openMemberIds.length===1 ? 'User' : 'User'} · ${formatNumber(openTotal)}`;

  const openList=$('sanctionsOpenList');
  if(openList){
    const rows=openMemberIds
      .map(memberId=>({member:sanctionMember(memberId),total:sanctionOpenTotalForMember(memberId)}))
      .filter(x=>x.member)
      .sort((a,b)=>memberSort(a.member,b.member));

    openList.innerHTML=rows.length ? rows.map(({member,total})=>{
      const hasNumber=/(\d+)(?!.*\d)/.test(member.name);
      return `
        <button type="button" class="sanctions-open-row" data-sanction-member="${member.id}">
          <span class="sanctions-open-name ${hasNumber ? 'attendance-animated-name' : ''}" style="${attendanceAnimatedNameStyle(member.name)}">${attendanceEsc(member.name)}</span>
          <span class="sanctions-open-status">Offen</span>
          <strong>${formatNumber(total)}</strong>
          <span class="member-chevron">›</span>
        </button>`;
    }).join('') : '<div class="empty-state">Aktuell sind keine Sanktionen offen.</div>';
  }

  const userList=$('sanctionsUserList');
  if(userList){
    const members=[...(data.members||[])].sort(memberSort);
    userList.innerHTML=members.length ? members.map(member=>{
      const total=sanctionOpenTotalForMember(member.id);
      const hasNumber=/(\d+)(?!.*\d)/.test(member.name);
      return `
        <button type="button" class="sanctions-user-row" data-sanction-member="${member.id}">
          <span class="sanctions-user-name ${hasNumber ? 'attendance-animated-name' : ''}" style="${attendanceAnimatedNameStyle(member.name)}">${attendanceEsc(member.name)}</span>
          <span class="sanctions-user-state ${total>0 ? 'open' : 'clear'}">${total>0 ? `Offen · ${formatNumber(total)}` : 'Keine offene Sanktion'}</span>
          <span class="member-chevron">›</span>
        </button>`;
    }).join('') : '<div class="empty-state">Noch keine Mitglieder vorhanden. Mitglieder werden automatisch aus dem Reiter „Mitglieder“ übernommen.</div>';
  }
}

function renderSanctions(){
  sanctionsEnsureData();
  const members = [...(data.members || [])].sort(memberSort);
  const openEntries = data.sanctions.entries.filter(entry => entry.status === 'open');
  const openMemberIds = [...new Set(openEntries.map(entry => entry.memberId))];
  const openTotal = openEntries.reduce((sum,entry) => sum + Number(entry.amount || 0),0);

  if($('sanctionsOpenCount')){
    $('sanctionsOpenCount').textContent = `${openMemberIds.length} ${openMemberIds.length === 1 ? 'User' : 'User'} · ${formatNumber(openTotal)}`;
  }

  if($('sanctionsOpenList')){
    const rows = openMemberIds
      .map(memberId => ({member:sanctionMember(memberId), total:sanctionOpenTotalForMember(memberId)}))
      .filter(x => x.member)
      .sort((a,b) => memberSort(a.member,b.member));

    $('sanctionsOpenList').innerHTML = rows.length ? rows.map(({member,total}) => {
      const hasNumber = /(\d+)(?!.*\d)/.test(member.name);
      return `
        <button type="button" class="sanctions-open-row" data-sanction-member="${member.id}">
          <span class="sanctions-open-name ${hasNumber ? 'attendance-animated-name' : ''}" style="${attendanceAnimatedNameStyle(member.name)}">${attendanceEsc(member.name)}</span>
          <span class="sanctions-open-status">Offen</span>
          <strong>${formatNumber(total)}</strong>
          <span class="member-chevron">›</span>
        </button>`;
    }).join('') : '<div class="empty-state">Aktuell sind keine Sanktionen offen.</div>';
  }

  if($('sanctionsUserList')){
    $('sanctionsUserList').innerHTML = members.length ? members.map(member => {
      const total = sanctionOpenTotalForMember(member.id);
      const hasNumber = /(\d+)(?!.*\d)/.test(member.name);
      return `
        <button type="button" class="sanctions-user-row" data-sanction-member="${member.id}">
          <span class="sanctions-user-name ${hasNumber ? 'attendance-animated-name' : ''}" style="${attendanceAnimatedNameStyle(member.name)}">${attendanceEsc(member.name)}</span>
          <span class="sanctions-user-state ${total > 0 ? 'open' : 'clear'}">${total > 0 ? `Offen · ${formatNumber(total)}` : 'Keine offene Sanktion'}</span>
          <span class="member-chevron">›</span>
        </button>`;
    }).join('') : '<div class="empty-state">Noch keine Mitglieder vorhanden. Mitglieder werden automatisch aus dem Reiter „Mitglieder“ übernommen.</div>';
  }

  renderSanctionCatalog();

  // Die beiden Übersichtsbereiche werden bewusst noch einmal direkt
  // aus dem aktuellen State aufgebaut, damit nach Löschen kein alter DOM-Inhalt bleibt.
  forceSanctionsOverviewRefresh();
}

function renderSanctionCatalog(){
  sanctionsEnsureData();
  const list=$('sanctionsCatalogList');
  if(!list) return;
  const entries=[...data.sanctions.catalog].sort((a,b)=>a.title.localeCompare(b.title,'de',{sensitivity:'base'}));
  list.innerHTML=entries.length ? entries.map(entry=>`
    <div class="sanctions-catalog-row">
      <div class="sanctions-catalog-row-top">
        <strong>${attendanceEsc(entry.title)}</strong>
        <span>${sanctionCatalogAmountsText(entry.amounts)}</span>
      </div>
      <div class="sanctions-catalog-description-text">${attendanceEsc(entry.description)}</div>
    </div>
  `).join('') : '<div class="empty-state">Der Sanktionskatalog ist noch leer.</div>';
}

function renderSanctionUserModal(){
  if(!selectedSanctionMemberId) return;
  const member=sanctionMember(selectedSanctionMemberId);
  if(!member) return closeSanctionUserModal();

  const entries=sanctionOpenEntriesForMember(selectedSanctionMemberId);
  $('sanctionUserModalTitle').textContent=member.name;
  $('sanctionUserOpenTotal').textContent=formatNumber(sanctionOpenTotalForMember(selectedSanctionMemberId));

  $('sanctionUserOpenList').innerHTML=entries.length ? entries.map(entry=>`
    <div class="sanction-user-entry">
      <div class="sanction-user-entry-main">
        <div class="sanction-user-entry-title">${attendanceEsc(entry.title)}</div>
        <div class="sanction-user-entry-description">${attendanceEsc(entry.description)}</div>
        <div class="entry-meta">${formatDate(entry.createdAt)}</div>
      </div>
      <strong class="sanction-user-entry-amount">${formatNumber(entry.amount)}</strong>
      ${isLimitedAccess() ? '' : `<div class="sanction-user-entry-actions">
        <button class="small-button" type="button" data-edit-sanction="${entry.id}">Bearbeiten</button>
        <button class="small-button sanction-paid-button" type="button" data-pay-sanction="${entry.id}">✓ Gezahlt</button>
        <button class="delete-button" type="button" data-delete-sanction="${entry.id}">Löschen</button>
      </div>`}
    </div>
  `).join('') : '<div class="empty-state">Für dieses Mitglied sind keine Sanktionen offen.</div>';
}

function openSanctionAssignModal(entryId=null){
  if(isLimitedAccess()) return showToast('Sanktionen können mit dieser Rolle nur angesehen werden.');
  if(!selectedSanctionMemberId) return;
  const member=sanctionMember(selectedSanctionMemberId);
  if(!member) return;

  editingSanctionEntryId=entryId;
  $('sanctionAssignModalTitle').textContent=entryId ? 'Sanktion bearbeiten' : 'Sanktion erstellen';
  $('sanctionAssignMember').textContent=`Für ${member.name}`;
  renderSanctionPicker();
  $('sanctionAssignModal')?.classList.remove('hidden');
}

function closeSanctionAssignModal(){
  $('sanctionAssignModal')?.classList.add('hidden');
  editingSanctionEntryId=null;
}

function renderSanctionPicker(){
  sanctionsEnsureData();
  const list=$('sanctionPickerList');
  if(!list) return;
  const entries=[...data.sanctions.catalog].sort((a,b)=>a.title.localeCompare(b.title,'de',{sensitivity:'base'}));
  list.innerHTML=entries.length ? entries.map(entry=>`
    <div class="sanction-picker-row sanction-picker-card">
      <div class="sanction-picker-copy">
        <strong>${attendanceEsc(entry.title)}</strong>
        <div>${attendanceEsc(entry.description)}</div>
      </div>
      <div class="sanction-amount-options">
        ${(entry.amounts || []).map(amount=>`
          <button type="button" class="sanction-amount-option" data-pick-sanction="${entry.id}" data-pick-sanction-amount="${amount}">
            ${formatNumber(amount)}
          </button>
        `).join('')}
      </div>
    </div>
  `).join('') : '<div class="empty-state">Bitte zuerst rechts im Sanktionskatalog über „Anpassen“ mindestens eine Sanktion anlegen.</div>';
}

async function applySanctionCatalogToMember(catalogId, selectedAmount){
  const catalog=data.sanctions.catalog.find(x=>x.id===catalogId);
  const member=sanctionMember(selectedSanctionMemberId);
  const amount=Math.max(0,Number(selectedAmount)||0);
  if(!catalog || !member || !catalog.amounts?.includes(amount)) return;

  if(editingSanctionEntryId){
    const entry=data.sanctions.entries.find(x=>x.id===editingSanctionEntryId && x.status==='open');
    if(!entry) return;
    entry.catalogId=catalog.id;
    entry.title=catalog.title;
    entry.description=catalog.description;
    entry.amounts=amounts;
    entry.updatedAt=new Date().toISOString();
  } else {
    data.sanctions.entries.push({
      id:crypto.randomUUID(),
      memberId:member.id,
      catalogId:catalog.id,
      title:catalog.title,
      description:catalog.description,
      amount,
      status:'open',
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      paidAt:null
    });
  }

  await saveData(true);
  closeSanctionAssignModal();
  renderSanctions();
  renderSanctionUserModal();
  showToast(editingSanctionEntryId ? 'Sanktion geändert.' : 'Sanktion erstellt.');
}

async function markSanctionPaid(entryId){
  sanctionsEnsureData();
  const entry=data.sanctions.entries.find(x=>x.id===entryId);
  if(!entry || entry.status!=='open') return;
  const member=sanctionMember(entry.memberId);
  if(!member) return;
  if(!confirm(`${formatNumber(entry.amount)} Schwarzgeld von „${member.name}“ als gezahlt markieren?`)) return;

  entry.status='paid';
  entry.paidAt=new Date().toISOString();
  entry.updatedAt=entry.paidAt;

  const amount=Math.max(0,Number(entry.amount||0));
  data.stock[WEEKLY_PRODUCT]=Math.max(0,Number(data.stock[WEEKLY_PRODUCT]||0))+amount;
  data.movements.push({
    id:crypto.randomUUID(),
    product:WEEKLY_PRODUCT,
    action:'add',
    amount,
    user:member.name,
    source:`Sanktion von ${member.name}`,
    sanctionId:entry.id,
    timestamp:entry.paidAt
  });

  await saveData(true);
  refresh();
  renderSanctionUserModal();
  showToast(`Sanktion bezahlt: +${formatNumber(amount)} Schwarzgeld.`);
}


async function deleteSanctionEntryCompletely(entryId){
  sanctionsEnsureData();
  const originalEntry=data.sanctions.entries.find(x=>x.id===entryId);
  if(!originalEntry) return false;

  const deletedMemberId=originalEntry.memberId;

  // 1) Sofort lokal wirklich entfernen. Dadurch verschwindet auch der offene Betrag,
  // weil alle Summen ausschließlich aus den noch vorhandenen offenen Einträgen entstehen.
  data.sanctions.entries=data.sanctions.entries.filter(x=>x.id!==entryId);

  // Verknüpfte Mindestbestand-Geldstrafe ebenfalls lösen.
  Object.values(data.minimumCars?.daily || {}).forEach(day=>{
    Object.values(day || {}).forEach(record=>{
      if(record?.penalty?.sanctionId===entryId) record.penalty=null;
    });
  });

  forceSanctionsOverviewRefresh();
  renderSanctions();
  renderMinimumCars();
  renderSanctionUserModal();

  // 2) Löschung direkt gegen den aktuellsten Cloud-State durchsetzen.
  // Nicht mehr über einen alten lokalen Snapshot speichern, damit der offene Betrag
  // nicht durch einen Konflikt/alten Stand wieder auftauchen kann.
  let confirmed=false;

  for(let attempt=0; attempt<6; attempt++){
    try{
      const latest=await apiFetch(`/api/state?deleteSanction=${Date.now()}-${attempt}`);
      const latestState=normalizeData(latest.state || defaultData);

      latestState.sanctions.entries=latestState.sanctions.entries.filter(x=>x.id!==entryId);

      Object.values(latestState.minimumCars?.daily || {}).forEach(day=>{
        Object.values(day || {}).forEach(record=>{
          if(record?.penalty?.sanctionId===entryId) record.penalty=null;
        });
      });

      const result=await apiFetch('/api/state',{
        method:'PUT',
        body:JSON.stringify({
          state:latestState,
          expectedUpdatedAt:latest.updatedAt || null
        })
      });

      const saved=normalizeData(result.state || latestState);

      // Nur als bestätigt behandeln, wenn der gelöschte Eintrag wirklich weg ist.
      if(!saved.sanctions.entries.some(x=>x.id===entryId)){
        data=saved;
        lastCloudUpdatedAt=result.updatedAt || latest.updatedAt || lastCloudUpdatedAt;
        lastSyncedData=cloneJson(data);
        confirmed=true;
        break;
      }
    }catch(error){
      // Bei 409 oder kurzem Netzwerkproblem direkt mit dem neuesten Stand erneut versuchen.
    }
  }

  // 3) Falls die Cloud-Bestätigung nicht geklappt hat, den Eintrag lokal trotzdem
  // gelöscht halten. Der Live-Poll übernimmt danach den bestätigten Cloud-Stand.
  if(!confirmed){
    data.sanctions.entries=data.sanctions.entries.filter(x=>x.id!==entryId);
    Object.values(data.minimumCars?.daily || {}).forEach(day=>{
      Object.values(day || {}).forEach(record=>{
        if(record?.penalty?.sanctionId===entryId) record.penalty=null;
      });
    });
  }

  // 4) Alle sichtbaren Beträge/Listen zwingend neu aus dem aktuellen State berechnen.
  forceSanctionsOverviewRefresh();
  renderSanctions();
  renderMinimumCars();
  renderSanctionUserModal();

  requestAnimationFrame(()=>{
    forceSanctionsOverviewRefresh();
    renderSanctionUserModal();
  });

  return confirmed || !data.sanctions.entries.some(x=>x.id===entryId);
}

function openSanctionCatalogModal(){
  resetSanctionCatalogForm();
  renderSanctionCatalogEditor();
  $('sanctionCatalogModal')?.classList.remove('hidden');
}

function closeSanctionCatalogModal(){
  $('sanctionCatalogModal')?.classList.add('hidden');
  resetSanctionCatalogForm();
}

function resetSanctionCatalogForm(){
  editingSanctionCatalogId=null;
  if($('sanctionCatalogTitle')) $('sanctionCatalogTitle').value='';
  setSanctionCatalogAmountRows();
  if($('sanctionCatalogDescription')) $('sanctionCatalogDescription').value='';
  if($('sanctionCatalogSaveButton')) $('sanctionCatalogSaveButton').textContent='Eintrag hinzufügen';
  $('sanctionCatalogCancelEdit')?.classList.add('hidden');
}

function renderSanctionCatalogEditor(){
  sanctionsEnsureData();
  const list=$('sanctionCatalogEditorList');
  if(!list) return;
  const entries=[...data.sanctions.catalog].sort((a,b)=>a.title.localeCompare(b.title,'de',{sensitivity:'base'}));
  list.innerHTML=entries.length ? entries.map(entry=>`
    <div class="sanction-catalog-editor-row">
      <div class="sanction-catalog-editor-copy">
        <div class="sanctions-catalog-row-top">
          <strong>${attendanceEsc(entry.title)}</strong>
          <span>${formatNumber(entry.amount)}</span>
        </div>
        <div>${attendanceEsc(entry.description)}</div>
      </div>
      <div class="sanction-catalog-editor-actions">
        <button class="small-button" type="button" data-edit-sanction-catalog="${entry.id}">Bearbeiten</button>
        <button class="delete-button" type="button" data-delete-sanction-catalog="${entry.id}">Löschen</button>
      </div>
    </div>
  `).join('') : '<div class="empty-state">Noch keine Sanktionen im Katalog.</div>';
}

$('sanctionsOpenList')?.addEventListener('click',event=>{
  const row=event.target.closest('[data-sanction-member]');
  if(row) openSanctionsForMember(row.dataset.sanctionMember);
});
$('sanctionsUserList')?.addEventListener('click',event=>{
  const row=event.target.closest('[data-sanction-member]');
  if(row) openSanctionsForMember(row.dataset.sanctionMember);
});

document.querySelectorAll('[data-close-sanction-user]').forEach(el=>el.addEventListener('click',closeSanctionUserModal));
document.querySelectorAll('[data-close-sanction-assign]').forEach(el=>el.addEventListener('click',closeSanctionAssignModal));
document.querySelectorAll('[data-close-sanction-catalog]').forEach(el=>el.addEventListener('click',closeSanctionCatalogModal));

$('sanctionCreateButton')?.addEventListener('click',()=>{
  if(isLimitedAccess()) return showToast('Nur ansehen.');
  openSanctionAssignModal();
});

$('sanctionPickerList')?.addEventListener('click',event=>{
  if(limitedReadOnlyGuard('Sanktionen')) return;
  const button=event.target.closest('[data-pick-sanction][data-pick-sanction-amount]');
  if(button) applySanctionCatalogToMember(button.dataset.pickSanction, Number(button.dataset.pickSanctionAmount));
});

$('sanctionUserOpenList')?.addEventListener('click',async event=>{
  if(isLimitedAccess()) return limitedReadOnlyGuard('Sanktionen');
  const editButton=event.target.closest('[data-edit-sanction]');
  if(editButton){
    openSanctionAssignModal(editButton.dataset.editSanction);
    return;
  }

  const payButton=event.target.closest('[data-pay-sanction]');
  if(payButton){
    await markSanctionPaid(payButton.dataset.paySanction);
    return;
  }

  const deleteButton=event.target.closest('[data-delete-sanction]');
  if(deleteButton){
    const entry=data.sanctions.entries.find(x=>x.id===deleteButton.dataset.deleteSanction);
    if(!entry) return;
    if(!confirm(`Sanktion „${entry.title}“ wirklich löschen?`)) return;

    const deleted=await deleteSanctionEntryCompletely(entry.id);
    showToast(deleted ? 'Sanktion vollständig gelöscht.' : 'Sanktion gelöscht – Cloud-Sync wird erneut geprüft.');
  }
});

$('sanctionCatalogEditButton')?.addEventListener('click',openSanctionCatalogModal);
$('sanctionCatalogCancelEdit')?.addEventListener('click',resetSanctionCatalogForm);

$('sanctionCatalogAddAmount')?.addEventListener('click',()=>{
  addSanctionCatalogAmountRow();
  const inputs=[...document.querySelectorAll('[data-sanction-catalog-amount-input]')];
  inputs.at(-1)?.focus();
});

$('sanctionCatalogAmountsEditor')?.addEventListener('click',event=>{
  const removeButton=event.target.closest('[data-remove-sanction-catalog-amount]');
  if(!removeButton) return;
  const row=removeButton.closest('.sanction-catalog-amount-row');
  const rows=[...document.querySelectorAll('.sanction-catalog-amount-row')];
  if(rows.length<=1){
    const input=row?.querySelector('[data-sanction-catalog-amount-input]');
    if(input) input.value='';
    return;
  }
  row?.remove();
});

$('sanctionCatalogForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  sanctionsEnsureData();

  const title=String($('sanctionCatalogTitle').value||'').trim();
  const amounts=[...new Set(sanctionCatalogAmountEditorValues())].sort((a,b)=>a-b);
  const description=String($('sanctionCatalogDescription').value||'').trim();

  if(!title || !amounts.length || !description){
    showToast('Bitte Sanktion, mindestens eine Höhe und Beschreibung vollständig eingeben.');
    return;
  }

  if(editingSanctionCatalogId){
    const entry=data.sanctions.catalog.find(x=>x.id===editingSanctionCatalogId);
    if(entry){
      entry.title=title;
      entry.amount=amount;
      entry.description=description;
    }
  } else {
    data.sanctions.catalog.push({
      id:crypto.randomUUID(),
      title,
      amounts,
      description
    });
  }

  await saveData(true);
  renderSanctionCatalog();
  renderSanctionCatalogEditor();
  resetSanctionCatalogForm();
  showToast('Sanktionskatalog gespeichert.');
});

$('sanctionCatalogEditorList')?.addEventListener('click',async event=>{
  const editButton=event.target.closest('[data-edit-sanction-catalog]');
  if(editButton){
    const entry=data.sanctions.catalog.find(x=>x.id===editButton.dataset.editSanctionCatalog);
    if(!entry) return;
    editingSanctionCatalogId=entry.id;
    $('sanctionCatalogTitle').value=entry.title;
    setSanctionCatalogAmountRows(entry.amounts);
    $('sanctionCatalogDescription').value=entry.description;
    $('sanctionCatalogSaveButton').textContent='Änderung speichern';
    $('sanctionCatalogCancelEdit')?.classList.remove('hidden');
    return;
  }

  const deleteButton=event.target.closest('[data-delete-sanction-catalog]');
  if(deleteButton){
    const entry=data.sanctions.catalog.find(x=>x.id===deleteButton.dataset.deleteSanctionCatalog);
    if(!entry) return;
    if(!confirm(`Katalogeintrag „${entry.title}“ wirklich löschen? Bereits verteilte Sanktionen bleiben erhalten.`)) return;
    data.sanctions.catalog=data.sanctions.catalog.filter(x=>x.id!==entry.id);
    await saveData(true);
    renderSanctionCatalog();
    renderSanctionCatalogEditor();
    if(editingSanctionCatalogId===entry.id) resetSanctionCatalogForm();
    showToast('Katalogeintrag gelöscht.');
  }
});


/* v66: Mindestbestand - Autos */
const MINIMUM_CAR_PRODUCTS = [
  { id:'medkits', label:'5 Medkits', short:'Medkits' },
  { id:'repairkits', label:'5 Repairkits', short:'Repairkits' },
  { id:'ropes', label:'5 Seile', short:'Seile' },
  { id:'bags', label:'3 Säcke', short:'Säcke' },
  { id:'ammo_short', label:'min. 250 Schuss kurz', short:'Kurz-Munition' }
];

let minimumCarsSelectedDate = '';
let minimumCarsPenaltyMemberId = null;
let minimumCarsWeekAnchor = '';

function minimumCarsLocalDate(value=new Date()){
  const d=new Date(value);
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function minimumCarsEnsureData(){
  if(!data.minimumCars || typeof data.minimumCars !== 'object') data.minimumCars={};
  if(!data.minimumCars.daily || typeof data.minimumCars.daily !== 'object') data.minimumCars.daily={};
}

function minimumCarsDateLabel(dateValue){
  const d=new Date(`${dateValue}T12:00:00`);
  return Number.isNaN(d.getTime()) ? dateValue : d.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
}

function minimumCarsGetRecord(memberId, create=false){
  minimumCarsEnsureData();
  const date=minimumCarsSelectedDate || minimumCarsLocalDate();
  if(!data.minimumCars.daily[date] && create) data.minimumCars.daily[date]={};
  const day=data.minimumCars.daily[date] || {};
  if(!day[memberId] && create){
    day[memberId]={
      items:{medkits:null,repairkits:null,ropes:null,bags:null,ammo_short:null},
      penalty:null
    };
  }
  return day[memberId] || null;
}

function minimumCarsMissingProducts(memberId){
  const record=minimumCarsGetRecord(memberId,false);
  if(!record) return [];
  return MINIMUM_CAR_PRODUCTS.filter(product=>record.items?.[product.id]===false);
}

function minimumCarsPenaltyLabel(record){
  const type=record?.penalty?.type;
  if(type==='warning1') return '1. Verwarnung';
  if(type==='warning2') return '2. Verwarnung';
  if(type==='money'){
    const sanction=data.sanctions?.entries?.find(x=>x.id===record.penalty.sanctionId);
    return sanction?.status==='paid' ? '50.000 · bezahlt' : '50.000 · offen';
  }
  return '';
}

function minimumCarsStatusButton(memberId, product){
  const record=minimumCarsGetRecord(memberId,false);
  const state=record?.items?.[product.id];
  const disabled=isLimitedAccess() ? 'disabled aria-disabled="true"' : '';
  return `<div class="minimum-car-status-choice">
    <button type="button" class="minimum-car-status yes ${state===true ? 'selected' : ''}" data-minimum-car-member="${memberId}" data-minimum-car-product="${product.id}" data-minimum-car-value="true" ${disabled}>✓ Hat</button>
    <button type="button" class="minimum-car-status no ${state===false ? 'selected' : ''}" data-minimum-car-member="${memberId}" data-minimum-car-product="${product.id}" data-minimum-car-value="false" ${disabled}>✕ Fehlt</button>
  </div>`;
}

function renderMinimumCars(){
  minimumCarsEnsureData();
  if(!minimumCarsSelectedDate) minimumCarsSelectedDate=minimumCarsLocalDate();
  if($('minimumCarsDate')) $('minimumCarsDate').value=minimumCarsSelectedDate;

  const list=$('minimumCarsList');
  if(!list) return;
  const members=[...(data.members || [])].sort(memberSort);

  if(!members.length){
    list.innerHTML='<div class="empty-state">Noch keine Mitglieder vorhanden. Die User werden automatisch aus „Mitglieder“ übernommen.</div>';
    return;
  }

  list.innerHTML=members.map(member=>{
    const record=minimumCarsGetRecord(member.id,false);
    const missing=minimumCarsMissingProducts(member.id);
    const penaltyLabel=minimumCarsPenaltyLabel(record);
    const sanctionPaid=record?.penalty?.type==='money' && data.sanctions?.entries?.find(x=>x.id===record.penalty.sanctionId)?.status==='paid';
    const hasNumber=/(\d+)(?!.*\d)/.test(member.name);

    return `
      <div class="minimum-car-row">
        <div class="minimum-car-member">
          <span class="minimum-car-member-name ${hasNumber ? 'attendance-animated-name' : ''}" style="${attendanceAnimatedNameStyle(member.name)}">${attendanceEsc(member.name)}</span>
        </div>
        ${MINIMUM_CAR_PRODUCTS.map(product=>`<div class="minimum-car-cell">${minimumCarsStatusButton(member.id,product)}</div>`).join('')}
        <div class="minimum-car-penalty-cell">
          ${penaltyLabel ? `<span class="minimum-car-penalty-badge ${record?.penalty?.type==='money' ? 'money' : 'warning'}">${attendanceEsc(penaltyLabel)}</span>` : ''}
          ${isLimitedAccess() ? '' : `<button type="button" class="small-button ${missing.length ? 'orange-small' : ''}" data-minimum-car-penalty-member="${member.id}" ${!missing.length || sanctionPaid ? 'disabled' : ''}>
            ${penaltyLabel ? 'Ändern' : 'Strafe'}
          </button>`}
        </div>
      </div>`;
  }).join('');
}

async function minimumCarsSetStatus(memberId, productId, value){
  if(isLimitedAccess()) return limitedReadOnlyGuard('Mindestbestand - Autos');
  const record=minimumCarsGetRecord(memberId,true);
  record.items[productId]=record.items[productId]===value ? null : value;
  await saveData(true);
  renderMinimumCars();
}

function openMinimumCarsPenalty(memberId){
  if(isLimitedAccess()) return limitedReadOnlyGuard('Mindestbestand - Autos');
  const member=data.members?.find(x=>x.id===memberId);
  const missing=minimumCarsMissingProducts(memberId);
  if(!member || !missing.length) return;

  minimumCarsPenaltyMemberId=memberId;
  const record=minimumCarsGetRecord(memberId,false);
  $('minimumCarsPenaltyTitle').textContent=`Strafe · ${member.name}`;
  $('minimumCarsPenaltyInfo').innerHTML=`
    <div><span>Tag</span><strong>${attendanceEsc(minimumCarsDateLabel(minimumCarsSelectedDate))}</strong></div>
    <div><span>Fehlt</span><strong>${attendanceEsc(missing.map(x=>x.label).join(', '))}</strong></div>
    ${record?.penalty ? `<div><span>Aktuell</span><strong>${attendanceEsc(minimumCarsPenaltyLabel(record))}</strong></div>` : ''}`;
  $('minimumCarsPenaltyRemove')?.classList.toggle('hidden', !record?.penalty);
  $('minimumCarsPenaltyModal')?.classList.remove('hidden');
}

function closeMinimumCarsPenalty(){
  $('minimumCarsPenaltyModal')?.classList.add('hidden');
  minimumCarsPenaltyMemberId=null;
}

async function setMinimumCarsPenalty(type){
  const memberId=minimumCarsPenaltyMemberId;
  const member=data.members?.find(x=>x.id===memberId);
  const record=minimumCarsGetRecord(memberId,true);
  const missing=minimumCarsMissingProducts(memberId);
  if(!member || !record || !missing.length) return;

  const oldSanctionId=record.penalty?.sanctionId || '';
  if(oldSanctionId){
    const oldSanction=data.sanctions?.entries?.find(x=>x.id===oldSanctionId);
    if(oldSanction?.status==='paid'){
      showToast('Diese Schwarzgeld-Sanktion wurde bereits bezahlt und kann hier nicht mehr geändert werden.');
      return;
    }
    data.sanctions.entries=data.sanctions.entries.filter(x=>x.id!==oldSanctionId);
  }

  let sanctionId='';
  if(type==='money'){
    sanctionsEnsureData();
    sanctionId=crypto.randomUUID();
    data.sanctions.entries.push({
      id:sanctionId,
      memberId:member.id,
      catalogId:'',
      title:'Mindestbestand - Auto',
      description:`${minimumCarsDateLabel(minimumCarsSelectedDate)} · Fehlend: ${missing.map(x=>x.label).join(', ')}`,
      amount:50000,
      status:'open',
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      paidAt:null
    });
  }

  record.penalty={
    type,
    sanctionId,
    createdAt:new Date().toISOString()
  };

  await saveData(true);
  renderMinimumCars();
  renderSanctions();
  closeMinimumCarsPenalty();
  showToast(type==='money' ? '50.000 Schwarzgeld als offene Sanktion eingetragen.' : `${type==='warning1' ? '1.' : '2.'} Verwarnung gespeichert.`);
}

async function removeMinimumCarsPenalty(){
  const memberId=minimumCarsPenaltyMemberId;
  const record=minimumCarsGetRecord(memberId,false);
  if(!record?.penalty) return;

  const sanctionId=record.penalty.sanctionId || '';
  if(sanctionId){
    const sanction=data.sanctions?.entries?.find(x=>x.id===sanctionId);
    if(sanction?.status==='paid'){
      showToast('Eine bereits bezahlte Schwarzgeld-Sanktion kann hier nicht entfernt werden.');
      return;
    }
    data.sanctions.entries=(data.sanctions?.entries || []).filter(x=>x.id!==sanctionId);
  }

  record.penalty=null;
  await saveData(true);
  renderMinimumCars();
  renderSanctions();
  closeMinimumCarsPenalty();
  showToast('Strafe entfernt.');
}


function minimumCarsWeekStart(dateValue){
  const d=new Date(`${dateValue}T12:00:00`);
  if(Number.isNaN(d.getTime())) return new Date();
  const day=(d.getDay()+6)%7;
  d.setDate(d.getDate()-day);
  return d;
}

function minimumCarsIsoDate(date){
  return minimumCarsLocalDate(date);
}

function minimumCarsWeekDates(anchor){
  const start=minimumCarsWeekStart(anchor);
  return Array.from({length:7},(_,index)=>{
    const d=new Date(start);
    d.setDate(start.getDate()+index);
    return d;
  });
}

function minimumCarsWeekCell(memberId,dateValue){
  const day=data.minimumCars?.daily?.[dateValue];
  const record=day?.[memberId];
  if(!record){
    return {state:'open',label:'Nicht geprüft',missing:[],penalty:''};
  }

  const values=MINIMUM_CAR_PRODUCTS.map(product=>record.items?.[product.id]);
  const missing=MINIMUM_CAR_PRODUCTS.filter(product=>record.items?.[product.id]===false);
  const penalty=minimumCarsPenaltyLabel(record);

  if(missing.length){
    return {
      state:'missing',
      label:missing.map(product=>product.short).join(', '),
      missing,
      penalty:penalty || 'Keine Strafe'
    };
  }

  if(values.every(value=>value===true)){
    return {state:'ok',label:'Alles da',missing:[],penalty:''};
  }

  return {state:'open',label:'Nicht vollständig geprüft',missing:[],penalty:''};
}

function renderMinimumCarsWeek(){
  minimumCarsEnsureData();
  if(!minimumCarsWeekAnchor){
    minimumCarsWeekAnchor=minimumCarsSelectedDate || minimumCarsLocalDate();
  }

  const grid=$('minimumCarsWeekGrid');
  if(!grid) return;

  const dates=minimumCarsWeekDates(minimumCarsWeekAnchor);
  const start=dates[0];
  const end=dates[6];
  $('minimumCarsWeekTitle').textContent=`Wochenansicht · ${start.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})} – ${end.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})}`;

  const members=[...(data.members || [])].sort(memberSort);
  const dayNames=['Mo','Di','Mi','Do','Fr','Sa','So'];

  if(!members.length){
    grid.innerHTML='<div class="empty-state">Noch keine Mitglieder vorhanden.</div>';
    return;
  }

  grid.innerHTML=`
    <div class="minimum-week-head minimum-week-member-head">Mitglied</div>
    ${dates.map((date,index)=>`
      <div class="minimum-week-head">
        <strong>${dayNames[index]}</strong>
        <span>${date.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})}</span>
      </div>
    `).join('')}
    ${members.map(member=>{
      const hasNumber=/(\d+)(?!.*\d)/.test(member.name);
      return `
        <div class="minimum-week-member">
          <span class="${hasNumber ? 'attendance-animated-name' : ''}" style="${attendanceAnimatedNameStyle(member.name)}">${attendanceEsc(member.name)}</span>
        </div>
        ${dates.map(date=>{
          const dateValue=minimumCarsIsoDate(date);
          const cell=minimumCarsWeekCell(member.id,dateValue);
          return `
            <button type="button" class="minimum-week-cell ${cell.state}" data-minimum-week-date="${dateValue}">
              <strong>${cell.state==='ok' ? '✓ Alles da' : cell.state==='missing' ? '✕ Fehlt' : '— Offen'}</strong>
              <span>${attendanceEsc(cell.label)}</span>
              ${cell.state==='missing' ? `<span class="minimum-week-penalty">Strafe: ${attendanceEsc(cell.penalty)}</span>` : ''}
            </button>`;
        }).join('')}`;
    }).join('')}`;
}

function openMinimumCarsWeek(){
  minimumCarsWeekAnchor=minimumCarsSelectedDate || minimumCarsLocalDate();
  renderMinimumCarsWeek();
  $('minimumCarsWeekModal')?.classList.remove('hidden');
}

function closeMinimumCarsWeek(){
  $('minimumCarsWeekModal')?.classList.add('hidden');
}

function minimumCarsShiftWeek(days){
  if(!minimumCarsWeekAnchor) minimumCarsWeekAnchor=minimumCarsSelectedDate || minimumCarsLocalDate();
  const d=new Date(`${minimumCarsWeekAnchor}T12:00:00`);
  d.setDate(d.getDate()+days);
  minimumCarsWeekAnchor=minimumCarsLocalDate(d);
  renderMinimumCarsWeek();
}

function minimumCarsShiftDate(days){
  if(!minimumCarsSelectedDate) minimumCarsSelectedDate=minimumCarsLocalDate();
  const d=new Date(`${minimumCarsSelectedDate}T12:00:00`);
  d.setDate(d.getDate()+days);
  minimumCarsSelectedDate=minimumCarsLocalDate(d);
  renderMinimumCars();
}

$('minimumCarsList')?.addEventListener('click',async event=>{
  const status=event.target.closest('[data-minimum-car-member][data-minimum-car-product][data-minimum-car-value]');
  if(status){
    if(isLimitedAccess()) return showToast('Mindestbestand kann mit dieser Rolle nur angesehen werden.');
    await minimumCarsSetStatus(
      status.dataset.minimumCarMember,
      status.dataset.minimumCarProduct,
      status.dataset.minimumCarValue === 'true'
    );
    return;
  }
  const penalty=event.target.closest('[data-minimum-car-penalty-member]');
  if(penalty && !penalty.disabled) openMinimumCarsPenalty(penalty.dataset.minimumCarPenaltyMember);
});

$('minimumCarsWeekOverviewButton')?.addEventListener('click',openMinimumCarsWeek);
$('minimumCarsWeekPrev')?.addEventListener('click',()=>minimumCarsShiftWeek(-7));
$('minimumCarsWeekNext')?.addEventListener('click',()=>minimumCarsShiftWeek(7));
$('minimumCarsWeekCurrent')?.addEventListener('click',()=>{
  minimumCarsWeekAnchor=minimumCarsLocalDate();
  renderMinimumCarsWeek();
});
document.querySelectorAll('[data-close-minimum-cars-week]').forEach(el=>el.addEventListener('click',closeMinimumCarsWeek));
$('minimumCarsWeekGrid')?.addEventListener('click',event=>{
  const cell=event.target.closest('[data-minimum-week-date]');
  if(!cell) return;
  minimumCarsSelectedDate=cell.dataset.minimumWeekDate;
  renderMinimumCars();
  closeMinimumCarsWeek();
});

$('minimumCarsPrevDay')?.addEventListener('click',()=>minimumCarsShiftDate(-1));
$('minimumCarsNextDay')?.addEventListener('click',()=>minimumCarsShiftDate(1));
$('minimumCarsToday')?.addEventListener('click',()=>{
  minimumCarsSelectedDate=minimumCarsLocalDate();
  renderMinimumCars();
});
$('minimumCarsDate')?.addEventListener('change',event=>{
  if(event.target.value){
    minimumCarsSelectedDate=event.target.value;
    renderMinimumCars();
  }
});

document.querySelectorAll('[data-close-minimum-cars-penalty]').forEach(el=>el.addEventListener('click',closeMinimumCarsPenalty));
$('minimumCarsPenaltyRemove')?.addEventListener('click',removeMinimumCarsPenalty);
$('minimumCarsPenaltyModal')?.addEventListener('click',async event=>{
  const button=event.target.closest('[data-minimum-cars-penalty]');
  if(button) await setMinimumCarsPenalty(button.dataset.minimumCarsPenalty);
});

/* v52: Mitglieder – unabhängig von allen anderen Nutzern */
let editingMemberId = null;

function membersEnsureData(){
  if(!Array.isArray(data.members)) data.members = [];
}

function memberSort(a,b){
  const an = String(a?.name || '');
  const bn = String(b?.name || '');
  const am = an.match(/(\d+)(?!.*\d)/);
  const bm = bn.match(/(\d+)(?!.*\d)/);
  if(am && bm){
    const diff = Number(bm[1]) - Number(am[1]);
    if(diff !== 0) return diff;
  } else if(am) return -1;
  else if(bm) return 1;
  return an.localeCompare(bn, 'de', { sensitivity:'base', numeric:true });
}

function memberDateOnly(value){
  if(!value) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function memberProbationInfo(endValue, manualStatus='auto'){
  const status = ['auto','active','passed','waived'].includes(manualStatus) ? manualStatus : 'auto';
  const end = memberDateOnly(endValue);

  if(status === 'waived'){
    return {
      has:true,
      status:'waived',
      text:'',
      detail:'Entfällt'
    };
  }

  if(status === 'passed'){
    return {
      has:true,
      status:'passed',
      text:end ? `Probezeit bis ${end.toLocaleDateString('de-DE')}` : '',
      detail:'Bestanden'
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);

  if(status === 'active'){
    if(end){
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12);
      const diff = Math.ceil((endDay - today) / 86400000);
      const remaining = diff > 0 ? `noch ${diff} ${diff === 1 ? 'Tag' : 'Tage'}` : diff === 0 ? 'endet heute' : 'manuell aktiv';
      return {
        has:true,
        status:'active',
        text:`Probezeit bis ${endDay.toLocaleDateString('de-DE')}`,
        detail:`Aktiv · ${remaining}`
      };
    }
    return {
      has:true,
      status:'active',
      text:'',
      detail:'Aktiv'
    };
  }

  if(!end) return { has:false, text:'Keine Probezeit', status:'none', days:0 };

  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12);
  const diff = Math.ceil((endDay - today) / 86400000);
  const dateText = endDay.toLocaleDateString('de-DE');

  if(diff >= 0){
    const remaining = diff === 0 ? 'endet heute' : `noch ${diff} ${diff === 1 ? 'Tag' : 'Tage'}`;
    return {
      has:true,
      status:'active',
      days:diff,
      text:`Probezeit bis ${dateText}`,
      detail:`Aktiv · ${remaining}`
    };
  }

  return {
    has:true,
    status:'passed',
    days:diff,
    text:`Probezeit bis ${dateText}`,
    detail:'Bestanden'
  };
}

function renderMembers(){
  membersEnsureData();
  renderMemberLegend();
  const list = $('membersList');
  if(!list) return;

  const members = [...data.members].sort(memberSort);
  if(!members.length){
    list.innerHTML = '<div class="empty-state members-empty">Noch keine Mitglieder angelegt.</div>';
    return;
  }

  list.innerHTML = members.map(member => {
    const info = memberProbationInfo(member.probationEnd, member.probationStatus);
    const hasNumber = /(\d+)(?!.*\d)/.test(member.name);
    return `
      <button type="button" class="member-row" data-member-id="${member.id}">
        <div class="member-main">
          <span class="member-name ${hasNumber ? 'attendance-animated-name' : ''}" style="${attendanceAnimatedNameStyle(member.name)}">${attendanceEsc(member.name)}</span>
        </div>
        <div class="member-probation ${info.status}">
          ${info.text ? `<span class="member-probation-date">${attendanceEsc(info.text)}</span>` : ''}
          ${info.has ? `<span class="member-probation-badge ${info.status}">${attendanceEsc(info.detail)}</span>` : ''}
        </div>
        <span class="member-chevron">›</span>
      </button>`;
  }).join('');
}



let editingMemberLegendId = null;

function memberLegendEnsureData(){
  if(!Array.isArray(data.memberLegend)) data.memberLegend = [];
}

function memberLegendNumber(value){
  const match = String(value || '').match(/-?\d+/);
  return match ? Number(match[0]) : Number.NEGATIVE_INFINITY;
}

function memberLegendSort(a,b){
  const diff = memberLegendNumber(b.rank) - memberLegendNumber(a.rank);
  if(Number.isFinite(diff) && diff !== 0) return diff;
  return String(a.rank || '').localeCompare(String(b.rank || ''), 'de', {numeric:true});
}

function renderMemberLegend(){
  memberLegendEnsureData();
  const list = $('memberLegendList');
  if(!list) return;
  const entries = [...data.memberLegend].sort(memberLegendSort);

  if(!entries.length){
    list.innerHTML = '<div class="member-legend-empty">Noch keine Rang-Erklärungen angelegt.</div>';
    return;
  }

  list.innerHTML = entries.map(entry => {
    const rankName = `Rang ${entry.rank}`;
    return `
      <div class="member-legend-row">
        <span class="member-legend-rank attendance-animated-name" style="${attendanceAnimatedNameStyle(rankName)}">${attendanceEsc(entry.rank)}</span>
        <span class="member-legend-description">${attendanceEsc(entry.description)}</span>
      </div>`;
  }).join('');
}

function renderMemberLegendEditor(){
  memberLegendEnsureData();
  const list = $('memberLegendEditorList');
  if(!list) return;
  const entries = [...data.memberLegend].sort(memberLegendSort);

  list.innerHTML = entries.length ? entries.map(entry => {
    const rankName = `Rang ${entry.rank}`;
    return `
      <div class="member-legend-editor-row">
        <div class="member-legend-editor-main">
          <span class="member-legend-rank attendance-animated-name" style="${attendanceAnimatedNameStyle(rankName)}">${attendanceEsc(entry.rank)}</span>
          <span>${attendanceEsc(entry.description)}</span>
        </div>
        <div class="member-legend-editor-actions">
          <button class="small-button" type="button" data-edit-member-legend="${entry.id}">Bearbeiten</button>
          <button class="delete-button" type="button" data-delete-member-legend="${entry.id}">Löschen</button>
        </div>
      </div>`;
  }).join('') : '<div class="empty-state">Noch keine Legendeneinträge vorhanden.</div>';
}

function resetMemberLegendForm(){
  editingMemberLegendId = null;
  if($('memberLegendRank')) $('memberLegendRank').value = '';
  if($('memberLegendDescription')) $('memberLegendDescription').value = '';
  if($('memberLegendSaveButton')) $('memberLegendSaveButton').textContent = 'Eintrag hinzufügen';
  $('memberLegendCancelEdit')?.classList.add('hidden');
}

function openMemberLegendModal(){
  resetMemberLegendForm();
  renderMemberLegendEditor();
  $('memberLegendModal')?.classList.remove('hidden');
}

function closeMemberLegendModal(){
  $('memberLegendModal')?.classList.add('hidden');
  resetMemberLegendForm();
}

$('memberLegendEditButton')?.addEventListener('click', openMemberLegendModal);

document.querySelectorAll('[data-close-member-legend]').forEach(el => {
  el.addEventListener('click', closeMemberLegendModal);
});

$('memberLegendCancelEdit')?.addEventListener('click', resetMemberLegendForm);

$('memberLegendForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  memberLegendEnsureData();

  const rank = String($('memberLegendRank').value || '').trim();
  const description = String($('memberLegendDescription').value || '').trim();

  if(!rank || !description){
    showToast('Bitte Zahl/Rang und Bedeutung eingeben.');
    return;
  }

  if(editingMemberLegendId){
    const entry = data.memberLegend.find(x => x.id === editingMemberLegendId);
    if(entry){
      entry.rank = rank;
      entry.description = description;
    }
  } else {
    data.memberLegend.push({
      id: crypto.randomUUID(),
      rank,
      description
    });
  }

  await saveData(true);
  renderMemberLegend();
  renderMemberLegendEditor();
  resetMemberLegendForm();
  showToast('Legende gespeichert.');
});

$('memberLegendEditorList')?.addEventListener('click', async event => {
  const editButton = event.target.closest('[data-edit-member-legend]');
  if(editButton){
    const entry = data.memberLegend.find(x => x.id === editButton.dataset.editMemberLegend);
    if(!entry) return;
    editingMemberLegendId = entry.id;
    $('memberLegendRank').value = entry.rank;
    $('memberLegendDescription').value = entry.description;
    $('memberLegendSaveButton').textContent = 'Änderung speichern';
    $('memberLegendCancelEdit')?.classList.remove('hidden');
    $('memberLegendRank')?.focus();
    return;
  }

  const deleteButton = event.target.closest('[data-delete-member-legend]');
  if(deleteButton){
    const entry = data.memberLegend.find(x => x.id === deleteButton.dataset.deleteMemberLegend);
    if(!entry) return;
    if(!confirm(`Legendeneintrag „${entry.rank} – ${entry.description}“ wirklich löschen?`)) return;
    data.memberLegend = data.memberLegend.filter(x => x.id !== entry.id);
    await saveData(true);
    renderMemberLegend();
    renderMemberLegendEditor();
    if(editingMemberLegendId === entry.id) resetMemberLegendForm();
    showToast('Legendeneintrag gelöscht.');
  }
});


const MEMBER_PROBATION_STATUS_LABELS = {
  auto: 'Automatisch nach Datum',
  active: 'Aktiv',
  passed: 'Bestanden',
  waived: 'Entfällt'
};

function setMemberProbationStatus(value){
  const next = ['auto','active','passed','waived'].includes(value) ? value : 'auto';
  if($('memberProbationStatus')) $('memberProbationStatus').value = next;
  if($('memberProbationStatusButtonText')) $('memberProbationStatusButtonText').textContent = MEMBER_PROBATION_STATUS_LABELS[next];
  if($('memberProbationStatusButton')){
    $('memberProbationStatusButton').dataset.status = next;
  }
  document.querySelectorAll('[data-member-status-value]').forEach(button => {
    button.classList.toggle('selected', button.dataset.memberStatusValue === next);
  });
}

function openMemberStatusModal(){
  const current = String($('memberProbationStatus')?.value || 'auto');
  setMemberProbationStatus(current);
  $('memberStatusModal')?.classList.remove('hidden');
}

function closeMemberStatusModal(){
  $('memberStatusModal')?.classList.add('hidden');
}

function openMemberModal(memberId=null){
  membersEnsureData();
  editingMemberId = memberId;
  const member = memberId ? data.members.find(x => x.id === memberId) : null;

  $('memberModalTitle').textContent = member ? 'Mitglied bearbeiten' : 'Mitglied hinzufügen';
  $('memberName').value = member?.name || '';
  $('memberProbationEnd').value = member?.probationEnd || '';
  setMemberProbationStatus(member?.probationStatus || 'auto');
  $('memberDescription').value = member?.description || '';
  $('memberDeleteButton')?.classList.toggle('hidden', !member);
  $('memberModal')?.classList.remove('hidden');
  setTimeout(() => $('memberName')?.focus(), 50);
}

function closeMemberModal(){
  $('memberModal')?.classList.add('hidden');
  editingMemberId = null;
}

$('memberAddButton')?.addEventListener('click', () => openMemberModal());

$('membersList')?.addEventListener('click', event => {
  const row = event.target.closest('[data-member-id]');
  if(row) openMemberModal(row.dataset.memberId);
});

document.querySelectorAll('[data-close-member]').forEach(el => {
  el.addEventListener('click', closeMemberModal);
});


$('memberProbationStatusButton')?.addEventListener('click', openMemberStatusModal);

document.querySelectorAll('[data-close-member-status]').forEach(el => {
  el.addEventListener('click', closeMemberStatusModal);
});

$('memberStatusModal')?.addEventListener('click', event => {
  const option = event.target.closest('[data-member-status-value]');
  if(!option) return;
  setMemberProbationStatus(option.dataset.memberStatusValue);
  closeMemberStatusModal();
});

$('memberForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  membersEnsureData();

  const name = String($('memberName').value || '').trim();
  const probationEnd = String($('memberProbationEnd').value || '').trim();
  const probationStatus = String($('memberProbationStatus').value || 'auto');
  const description = String($('memberDescription').value || '').trim();

  if(!name){
    showToast('Bitte einen Namen eingeben.');
    return;
  }

  if(editingMemberId){
    const member = data.members.find(x => x.id === editingMemberId);
    if(!member) return;
    member.name = name;
    member.probationEnd = probationEnd;
    member.probationStatus = probationStatus;
    member.description = description;
    member.updatedAt = new Date().toISOString();
    showToast('Mitglied aktualisiert.');
  } else {
    data.members.push({
      id: crypto.randomUUID(),
      name,
      probationEnd,
      probationStatus,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    showToast('Mitglied hinzugefügt.');
  }

  await saveData(true);
  renderMembers();
  closeMemberModal();
});

$('memberDeleteButton')?.addEventListener('click', async () => {
  if(!editingMemberId) return;
  const member = data.members.find(x => x.id === editingMemberId);
  if(!member) return;
  if(!confirm(`Mitglied „${member.name}“ wirklich löschen?`)) return;

  data.members = data.members.filter(x => x.id !== editingMemberId);
  await saveData(true);
  renderMembers();
  closeMemberModal();
  showToast('Mitglied gelöscht.');
});


/* v50: Verkaufen */
let selectedSellProductId = null;

function sellEnsureData(){
  if(!data.selling || typeof data.selling !== 'object') data.selling = {};
  if(!Array.isArray(data.selling.entries)) data.selling.entries = [];
}

function sellProductName(id){
  return SELL_PRODUCTS.find(p => p.id === id)?.name || id;
}

function sellProductTotal(productId){
  sellEnsureData();
  return data.selling.entries
    .filter(entry => entry.product === productId)
    .reduce((sum, entry) => sum + Math.max(0, Number(entry.amount || 0)), 0);
}

function sellGrandTotal(){
  sellEnsureData();
  return data.selling.entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.amount || 0)), 0);
}

function renderSelling(){
  sellEnsureData();
  const grid = $('sellProductGrid');
  if(!grid) return;

  grid.innerHTML = SELL_PRODUCTS.map(product => {
    const total = sellProductTotal(product.id);
    const count = data.selling.entries.filter(entry => entry.product === product.id).length;
    return `
      <button type="button" class="sell-product-card" data-sell-product="${product.id}">
        <div class="sell-product-card-top">
          <span class="sell-product-name">${escapeHtml(product.name)}</span>
          <span class="sell-product-arrow">›</span>
        </div>
        <div class="sell-product-amount">${formatNumber(total)}</div>
        <div class="sell-product-meta">${count} ${count === 1 ? 'Eintrag' : 'Einträge'}</div>
      </button>`;
  }).join('');

}


function sellMemberPickerMembers(){
  return [...(data.members || [])].sort(memberSort);
}

function renderSellMemberPicker(){
  const menu=$('sellEntryUserMenu');
  const selected=$('sellEntryUserSelected');
  const input=$('sellEntryUser');
  if(!menu || !selected || !input) return;

  const members=sellMemberPickerMembers();
  menu.innerHTML=members.length ? members.map(member=>{
    const hasNumber=/(\d+)(?!.*\d)/.test(member.name);
    return `
      <button type="button" class="sell-user-picker-option" role="option"
        data-sell-member-id="${attendanceEsc(member.id)}"
        data-sell-member-name="${attendanceEsc(member.name)}">
        <span class="sell-user-picker-option-name ${hasNumber ? 'attendance-animated-name' : ''}"
          style="${attendanceAnimatedNameStyle(member.name)}">${attendanceEsc(member.name)}</span>
      </button>`;
  }).join('') : '<div class="sell-user-picker-empty">Keine Mitglieder vorhanden.</div>';

  const currentName=String(input.value || '').trim();
  const current=members.find(member=>member.name===currentName);
  if(current){
    const hasNumber=/(\d+)(?!.*\d)/.test(current.name);
    selected.className=`sell-user-picker-selected ${hasNumber ? 'attendance-animated-name' : ''}`;
    selected.setAttribute('style',attendanceAnimatedNameStyle(current.name));
    selected.textContent=current.name;
  }else{
    selected.className='sell-user-picker-placeholder';
    selected.removeAttribute('style');
    selected.textContent='Mitglied auswählen';
    input.value='';
  }
}

function openSellMemberPicker(){
  renderSellMemberPicker();
  const menu=$('sellEntryUserMenu');
  const button=$('sellEntryUserButton');
  if(!menu || !button) return;
  const willOpen=menu.classList.contains('hidden');
  menu.classList.toggle('hidden',!willOpen);
  button.setAttribute('aria-expanded',willOpen ? 'true' : 'false');
}

function closeSellMemberPicker(){
  $('sellEntryUserMenu')?.classList.add('hidden');
  $('sellEntryUserButton')?.setAttribute('aria-expanded','false');
}

function selectSellMember(memberId){
  const member=(data.members || []).find(x=>x.id===memberId);
  if(!member) return;
  $('sellEntryUser').value=member.name;
  renderSellMemberPicker();
  closeSellMemberPicker();
  $('sellEntryAmount')?.focus();
}

function openSellProduct(productId){
  sellEnsureData();
  selectedSellProductId = productId;
  const product = SELL_PRODUCTS.find(p => p.id === productId);
  if(!product) return;
  $('sellModalTitle').textContent = product.name;
  $('sellEntryUser').value = '';
  $('sellEntryAmount').value = '';
  renderSellMemberPicker();
  closeSellMemberPicker();
  if($('sellTransportResult')){
    $('sellTransportResult').classList.add('hidden');
    $('sellTransportResult').innerHTML = '';
  }
  renderSellModal();
  $('sellProductModal').classList.remove('hidden');
  setTimeout(() => $('sellEntryUserButton')?.focus(), 50);
}

function closeSellProduct(){
  $('sellProductModal')?.classList.add('hidden');
  selectedSellProductId = null;
}

function renderSellModal(){
  if(!selectedSellProductId) return;
  sellEnsureData();
  renderSellMemberPicker();
  const entries = data.selling.entries
    .filter(entry => entry.product === selectedSellProductId)
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  $('sellModalTotal').textContent = formatNumber(sellProductTotal(selectedSellProductId));
  $('sellEntryList').innerHTML = entries.length ? entries.map(entry => `
    <div class="sell-entry-row">
      <div>
        <strong>${escapeHtml(entry.user || 'Ohne Nutzer')}</strong>
        <div class="entry-meta">${formatDate(entry.createdAt)}</div>
      </div>
      <div class="sell-entry-right">
        <strong>${formatNumber(entry.amount)}</strong>
        ${!isLimitedAccess() || (entry.createdByUserId && entry.createdByUserId===String(currentSessionUser.id || ''))
          ? `<button class="delete-button" type="button" data-delete-sell-entry="${entry.id}">Löschen</button>`
          : ''}
      </div>
    </div>
  `).join('') : '<div class="empty-state">Für dieses Produkt wurde noch keine Menge eingetragen.</div>';
}

function showSellTransport(type){
  if(!selectedSellProductId) return;
  const total = sellProductTotal(selectedSellProductId);
  const capacity = type === 'mule' ? 800 : 500;
  const label = type === 'mule' ? 'Mulen' : 'Guardien';
  const needed = total > 0 ? Math.ceil(total / capacity) : 0;
  const result = $('sellTransportResult');
  if(!result) return;
  result.classList.remove('hidden');
  result.innerHTML = `
    <div class="sell-result-number">${needed}</div>
    <div>
      <strong>${label} benötigt</strong>
      <div class="entry-meta">${formatNumber(total)} ${sellProductName(selectedSellProductId)} ÷ ${formatNumber(capacity)} Platz = ${needed}</div>
    </div>`;
}

$('sellProductGrid')?.addEventListener('click', event => {
  const button = event.target.closest('[data-sell-product]');
  if(button) openSellProduct(button.dataset.sellProduct);
});

document.querySelectorAll('[data-close-sell-product]').forEach(el => {
  el.addEventListener('click', closeSellProduct);
});


$('sellEntryUserButton')?.addEventListener('click',event=>{
  event.stopPropagation();
  openSellMemberPicker();
});

$('sellEntryUserMenu')?.addEventListener('click',event=>{
  const option=event.target.closest('[data-sell-member-id]');
  if(option) selectSellMember(option.dataset.sellMemberId);
});

document.addEventListener('click',event=>{
  if(!event.target.closest('#sellUserPicker')) closeSellMemberPicker();
});

$('sellEntryForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  if(!selectedSellProductId) return;
  const user = String($('sellEntryUser').value || '').trim();
  const amount = parseNumberInput($('sellEntryAmount').value);
  if(!user){
    showToast('Bitte einen Nutzer eingeben.');
    return;
  }
  if(amount <= 0){
    showToast('Bitte eine gültige Menge eingeben.');
    return;
  }

  sellEnsureData();
  data.selling.entries.push({
    id: crypto.randomUUID(),
    product: selectedSellProductId,
    amount,
    user,
    createdByUserId:String(currentSessionUser.id || ''),
    createdByUserName:String(currentSessionUser.username || ''),
    createdAt: new Date().toISOString()
  });

  $('sellEntryUser').value = '';
  $('sellEntryAmount').value = '';
  renderSellMemberPicker();
  closeSellMemberPicker();
  await saveData(true);
  renderSelling();
  renderSellModal();
  showToast(`${formatNumber(amount)} ${sellProductName(selectedSellProductId)} eingetragen.`);
});

$('sellEntryList')?.addEventListener('click', async event => {
  const button = event.target.closest('[data-delete-sell-entry]');
  if(!button) return;
  const entry = data.selling.entries.find(x => x.id === button.dataset.deleteSellEntry);
  if(!entry) return;
  if(isLimitedAccess() && (!entry.createdByUserId || entry.createdByUserId!==String(currentSessionUser.id || ''))){
    showToast('Du kannst nur deine eigenen Verkaufseinträge löschen.');
    return;
  }
  if(!confirm(`Eintrag von „${entry.user}“ mit ${formatNumber(entry.amount)} wirklich löschen?`)) return;
  data.selling.entries = data.selling.entries.filter(x => x.id !== entry.id);
  await saveData(true);
  renderSelling();
  renderSellModal();
  showToast('Verkaufseintrag gelöscht.');
});

$('sellMuleButton')?.addEventListener('click', () => showSellTransport('mule'));
$('sellGuardianButton')?.addEventListener('click', () => showSellTransport('guardian'));


/* Attendance module: daily status is separate from calendar absences. */
function attendanceEnsureData() {
  if (!data.attendance || typeof data.attendance !== 'object') data.attendance = {};
  if (!Array.isArray(data.attendance.users)) data.attendance.users = [];
  if (!data.attendance.daily || typeof data.attendance.daily !== 'object') data.attendance.daily = {};
  if (!Array.isArray(data.attendance.absences)) data.attendance.absences = [];
}
function attendanceDateKey(date = new Date()) {
  const d = new Date(date);
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function attendanceAnimatedNameStyle(name){
  const match = String(name || '').match(/(\d+)(?!.*\d)/);
  if(!match) return '';
  const number = Number(match[1]);
  const hue1 = Math.round((number * 137.508) % 360);
  const hue2 = Math.round((hue1 + 52) % 360);
  const hue3 = Math.round((hue1 + 108) % 360);
  return `--att-name-1:hsl(${hue1} 92% 68%);--att-name-2:hsl(${hue2} 96% 72%);--att-name-3:hsl(${hue3} 92% 65%);--att-name-glow:hsl(${hue1} 95% 60% / .38);`;
}

function attendanceEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function attendanceOpen(id){ $(id).classList.remove('hidden'); }
function attendanceClose(id){ $(id).classList.add('hidden'); }

let attendanceMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function renderAttendance() {
  attendanceEnsureData();
  const today=attendanceDateKey();
  const label=$('attendanceTodayLabel');
  if(label) label.textContent = new Date().toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
  const list=$('attendanceUsersList');
  if(!list) return;
  if(!data.attendance.users.length){
    list.innerHTML='<div class="empty-state">Noch keine Anwesenheits-Nutzer angelegt.</div>';
  } else {
    const sortedAttendanceUsers = [...data.attendance.users].sort(attendanceNameNumberSort);
    list.innerHTML=sortedAttendanceUsers.map(u=>{
      const status=data.attendance.daily[`${today}:${u.id}`]||'';
      return `<div class="attendance-user-row" data-manage-att-user="${u.id}" title="Klicken, um den Nutzer zu bearbeiten oder zu löschen">
        <div class="attendance-user-name">
          <span class="${/(\d+)(?!.*\d)/.test(u.name) ? 'attendance-animated-name' : ''}" style="${attendanceAnimatedNameStyle(u.name)}">${attendanceEsc(u.name)}</span>
        </div>
        <div class="attendance-status-buttons">
          <button type="button" class="attendance-status ${status==='present'?'selected present':''}" data-att-user="${u.id}" data-att-status="present">✓ Anwesend</button>
          <button type="button" class="attendance-status ${status==='excused'?'selected excused':''}" data-att-user="${u.id}" data-att-status="excused">− Abgemeldet</button>
          <button type="button" class="attendance-status ${status==='unexcused'?'selected unexcused':''}" data-att-user="${u.id}" data-att-status="unexcused">! Unabgemeldet</button>
        </div>
      </div>`;
    }).join('');
  }
  renderAttendanceCalendar();
  fillAbsenceUsers();
  renderAbsenceList();
  if(!$('attendanceWeekOverviewModal')?.classList.contains('hidden')) renderAttendanceWeekOverview();
}
function renderAttendanceCalendar(){
  const grid=$('attendanceCalendar'), title=$('attendanceMonthTitle');
  if(!grid) return;
  const y=attendanceMonth.getFullYear(), m=attendanceMonth.getMonth();
  title.textContent=new Date(y,m,1).toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  const first=new Date(y,m,1);
  const mondayIndex=(first.getDay()+6)%7;
  const days=new Date(y,m+1,0).getDate();
  const cells=[];
  ['Mo','Di','Mi','Do','Fr','Sa','So'].forEach(d=>cells.push(`<div class="calendar-weekday">${d}</div>`));
  for(let i=0;i<mondayIndex;i++) cells.push('<div class="calendar-day empty"></div>');
  for(let day=1;day<=days;day++){
    const key=attendanceDateKey(new Date(y,m,day));
    const abs=data.attendance.absences.filter(item=>item.start<=key && item.end>=key);
    const isToday = key === attendanceDateKey();
    cells.push(`<div class="calendar-day ${abs.length?'has-absence':''} ${isToday?'is-today':''}">
      <span class="calendar-day-number">${day}</span>
      ${abs.slice(0,3).map(item=>{
        const u=data.attendance.users.find(x=>x.id===item.userId);
        const label=u?`${u.name}: ${item.reason}`:item.reason;
        return `<span class="calendar-absence" data-calendar-absence-id="${item.id}">${attendanceEsc(label)}</span>`;
      }).join('')}
      ${abs.length>3?`<span class="calendar-absence more">+${abs.length-3} weitere</span>`:''}
    </div>`);
  }
  grid.innerHTML=cells.join('');
}
function fillAbsenceUsers(){
  const s=$('absenceUser'); if(!s) return;
  const sortedAttendanceUsers = [...data.attendance.users].sort(attendanceNameNumberSort);
  s.innerHTML=sortedAttendanceUsers.map(u=>`<option value="${u.id}">${attendanceEsc(u.name)}</option>`).join('');
}
function renderAbsenceList(){
  const el=$('absenceList'); if(!el) return;
  const arr=[...data.attendance.absences].sort((a,b)=>a.start.localeCompare(b.start));
  if(!arr.length){el.innerHTML='<div class="empty-state">Keine Abwesenheiten eingetragen.</div>';return;}
  el.innerHTML=arr.map(a=>{
    const u=data.attendance.users.find(x=>x.id===a.userId);
    return `<div class="absence-list-row">
      <div><strong>${attendanceEsc(u?.name||'Unbekannt')}</strong><div class="entry-meta">${a.start} – ${a.end} · ${attendanceEsc(a.reason)}</div></div>
      <div class="absence-actions">
        <button class="small-button" type="button" data-edit-absence="${a.id}">Bearbeiten</button>
        <button class="delete-button" type="button" data-delete-absence="${a.id}">Löschen</button>
      </div>
    </div>`;
  }).join('');
}

function editAbsence(id){
  const item=data.attendance.absences.find(x=>x.id===id);
  if(!item)return;
  fillAbsenceUsers();
  $('absenceUser').value=item.userId;
  $('absenceStart').value=item.start;
  $('absenceEnd').value=item.end;
  $('absenceReason').value=item.reason;
  $('absenceForm').dataset.editingId=id;
  const submit=$('absenceForm').querySelector('button[type="submit"]');
  if(submit)submit.textContent='Änderung speichern';
  attendanceOpen('absenceModal');
}
function resetAbsenceForm(){
  $('absenceForm').removeAttribute('data-editing-id');
  $('absenceForm').reset();
  const submit=$('absenceForm').querySelector('button[type="submit"]');
  if(submit)submit.textContent='Abwesenheit speichern';
}

let selectedAttendanceUserId = null;

function openAttendanceUserManage(id){
  const user=data.attendance.users.find(x=>x.id===id);
  if(!user)return;
  selectedAttendanceUserId=id;
  $('manageAttendanceUserTitle').textContent=user.name;
  attendanceOpen('attendanceUserManageModal');
}

async function editAttendanceUser(id){
  const user=data.attendance.users.find(x=>x.id===id);
  if(!user)return;
  const newName=prompt('Neuer Name:', user.name);
  if(newName===null)return;
  const name=newName.trim();
  if(!name){alert('Der Name darf nicht leer sein.');return;}
  if(data.attendance.users.some(x=>x.id!==id && x.name.toLowerCase()===name.toLowerCase())){
    alert('Diesen Anwesenheits-Nutzer gibt es bereits.');return;
  }
  user.name=name;
  attendanceClose('attendanceUserManageModal');
  await saveData(true);
  renderAttendance();
}

async function deleteAttendanceUser(id){
  const user=data.attendance.users.find(x=>x.id===id);
  if(!user)return;
  if(!confirm(`"${user.name}" wirklich komplett löschen?`))return;
  data.attendance.users=data.attendance.users.filter(x=>x.id!==id);
  Object.keys(data.attendance.daily).forEach(key=>{
    if(key.endsWith(`:${id}`))delete data.attendance.daily[key];
  });
  data.attendance.absences=data.attendance.absences.filter(x=>x.userId!==id);
  attendanceClose('attendanceUserManageModal');
  await saveData(true);
  renderAttendance();
}


function attendanceNameNumberSort(a,b){
  const getName = value => typeof value === 'string' ? value : (value?.name || '');
  const an = getName(a);
  const bn = getName(b);
  const am = an.match(/(\d+)(?!.*\d)/);
  const bm = bn.match(/(\d+)(?!.*\d)/);

  if(am && bm){
    const diff = Number(bm[1]) - Number(am[1]);
    if(diff !== 0) return diff;
  } else if(am) {
    return -1;
  } else if(bm) {
    return 1;
  }

  return an.localeCompare(bn, 'de', { sensitivity:'base', numeric:true });
}

let attendanceWeekViewDate = new Date();

function attendanceWeekDates(baseDate = new Date()){
  const d = new Date(baseDate);
  const day = d.getDay() || 7;
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - day + 1);
  return Array.from({length:7}, (_,i)=>{
    const x = new Date(d);
    x.setDate(d.getDate()+i);
    return x;
  });
}

function attendanceStatusFor(userId, date){
  const key = `${attendanceDateKey(date)}:${userId}`;
  return data.attendance.daily[key] || '';
}

function attendanceStatusLabel(status){
  if(status==='present') return 'Anwesend';
  if(status==='excused') return 'Abgemeldet';
  if(status==='unexcused') return 'Unabgemeldet';
  return 'Nicht markiert';
}

function attendanceStatusSymbol(status){
  if(status==='present') return '✓';
  if(status==='excused') return '−';
  if(status==='unexcused') return '!';
  return '·';
}

function renderAttendanceWeekOverview(){
  attendanceEnsureData();
  const host = $('attendanceWeekOverview');
  const label = $('attendanceWeekOverviewLabel');
  if(!host) return;

  const dates = attendanceWeekDates(attendanceWeekViewDate);
  const dayNames = ['Mo','Di','Mi','Do','Fr','Sa','So'];
  const users = [...data.attendance.users].sort(attendanceNameNumberSort);

  if(label){
    const from = dates[0].toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
    const to = dates[6].toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
    label.textContent = `${from} – ${to}`;
  }

  if(!users.length){
    host.innerHTML = '<div class="empty-state">Noch keine Anwesenheits-Nutzer angelegt.</div>';
    return;
  }

  host.innerHTML = `
    <div class="attendance-week-table">
      <div class="attendance-week-head user-head">Nutzer</div>
      ${dates.map((d,i)=>`
        <div class="attendance-week-head ${attendanceDateKey(d)===attendanceDateKey()?'is-today':''}">
          <span>${dayNames[i]}</span>
          <strong>${String(d.getDate()).padStart(2,'0')}</strong>
        </div>`).join('')}
      ${users.map(user=>`
        <div class="attendance-week-user">${attendanceEsc(user.name)}</div>
        ${dates.map(d=>{
          const status = attendanceStatusFor(user.id,d);
          return `
            <button type="button"
              class="attendance-week-cell ${status ? 'status-'+status : ''}"
              data-week-status-user="${user.id}"
              data-week-status-date="${attendanceDateKey(d)}"
              title="${attendanceEsc(attendanceStatusLabel(status))}">
              <span class="week-symbol">${attendanceStatusSymbol(status)}</span>
              <span class="week-label">${attendanceEsc(attendanceStatusLabel(status))}</span>
            </button>`;
        }).join('')}
      `).join('')}
    </div>`;
}

function openAttendanceWeekOverview(){
  attendanceWeekViewDate = new Date();
  renderAttendanceWeekOverview();
  attendanceOpen('attendanceWeekOverviewModal');
}
function initAttendance(){
  attendanceEnsureData();
  $('addAttendanceUserButton')?.addEventListener('click',()=>{attendanceOpen('attendanceUserModal');$('attendanceUserName').focus();});
  $('attendanceWeekOverviewButton')?.addEventListener('click',openAttendanceWeekOverview);
  $('addAbsenceButton')?.addEventListener('click',()=>{resetAbsenceForm();fillAbsenceUsers();attendanceOpen('absenceModal');$('absenceUser').focus();});
  document.addEventListener('click', async e=>{
    const leftCard = e.target.closest('.attendance-list-card');
    if(leftCard &&
       !e.target.closest('button') &&
       !e.target.closest('[data-manage-att-user]') &&
       !e.target.closest('input,select,form')){
      openAttendanceWeekOverview();
      return;
    }
    const weekCell=e.target.closest('[data-week-status-user][data-week-status-date]');
    if(weekCell){
      const key=`${weekCell.dataset.weekStatusDate}:${weekCell.dataset.weekStatusUser}`;
      const current=data.attendance.daily[key]||'';
      const next=current===''?'present':current==='present'?'excused':current==='excused'?'unexcused':'';
      if(next) data.attendance.daily[key]=next; else delete data.attendance.daily[key];
      await saveData(true);
      renderAttendance();
      renderAttendanceWeekOverview();
      return;
    }
    const managedUser=e.target.closest('[data-manage-att-user]');
    if(managedUser && !e.target.closest('[data-att-status]')){
      openAttendanceUserManage(managedUser.dataset.manageAttUser);
      return;
    }
    const statusBtn=e.target.closest('[data-att-user][data-att-status]');
    if(statusBtn){
      const key=`${attendanceDateKey()}:${statusBtn.dataset.attUser}`;
      const clickedStatus = statusBtn.dataset.attStatus;
      const currentStatus = data.attendance.daily[key] || '';
      if (currentStatus === clickedStatus) {
        delete data.attendance.daily[key];
      } else {
        data.attendance.daily[key] = clickedStatus;
      }
      await saveData(true); renderAttendance(); return;
    }
    const absence=e.target.closest('[data-calendar-absence-id]');
    if(absence){ editAbsence(absence.dataset.calendarAbsenceId); return; }
    const edit=e.target.closest('[data-edit-absence]');
    if(edit){ editAbsence(edit.dataset.editAbsence); return; }
    const del=e.target.closest('[data-delete-absence]');
    if(del){
      if(!confirm('Diese Abwesenheit wirklich löschen?')) return;
      data.attendance.absences=data.attendance.absences.filter(a=>a.id!==del.dataset.deleteAbsence);
      await saveData(true); renderAttendance();
    }
  });
  document.querySelectorAll('[data-close-absence]').forEach(x=>x.addEventListener('click',()=>attendanceClose('absenceModal')));
  document.querySelectorAll('[data-close-attendance-user]').forEach(x=>x.addEventListener('click',()=>attendanceClose('attendanceUserModal')));
  
$('attendanceWeekPrevButton')?.addEventListener('click',()=>{
  const d = new Date(attendanceWeekViewDate);
  d.setDate(d.getDate() - 7);
  attendanceWeekViewDate = d;
  renderAttendanceWeekOverview();
});

$('attendanceWeekNextButton')?.addEventListener('click',()=>{
  const d = new Date(attendanceWeekViewDate);
  d.setDate(d.getDate() + 7);
  attendanceWeekViewDate = d;
  renderAttendanceWeekOverview();
});

$('attendanceWeekTodayButton')?.addEventListener('click',()=>{
  attendanceWeekViewDate = new Date();
  renderAttendanceWeekOverview();
});

document.querySelectorAll('[data-close-attendance-week]').forEach(x=>x.addEventListener('click',()=>attendanceClose('attendanceWeekOverviewModal')));
  $('attendancePrevMonth')?.addEventListener('click',()=>{attendanceMonth=new Date(attendanceMonth.getFullYear(),attendanceMonth.getMonth()-1,1);renderAttendance();});
  $('attendanceNextMonth')?.addEventListener('click',()=>{attendanceMonth=new Date(attendanceMonth.getFullYear(),attendanceMonth.getMonth()+1,1);renderAttendance();});
  $('attendanceTodayButton')?.addEventListener('click',()=>{
    const now=new Date();
    attendanceMonth=new Date(now.getFullYear(),now.getMonth(),1);
    renderAttendance();
  });
  $('attendanceUserForm')?.addEventListener('submit',async e=>{
    e.preventDefault(); attendanceEnsureData();
    const name=$('attendanceUserName').value.trim();
    if(!name)return;
    if(data.attendance.users.some(u=>u.name.toLowerCase()===name.toLowerCase())){alert('Diesen Anwesenheits-Nutzer gibt es bereits.');return;}
    data.attendance.users.push({id:crypto.randomUUID(),name});
    $('attendanceUserName').value='';
    attendanceClose('attendanceUserModal'); await saveData(true); renderAttendance();
  });
  $('absenceForm')?.addEventListener('submit',async e=>{
    e.preventDefault(); attendanceEnsureData();
    const start=$('absenceStart').value, end=$('absenceEnd').value, userId=$('absenceUser').value, reason=$('absenceReason').value.trim();
    if(!start||!end||start>end){alert('Der Zeitraum ist ungültig.');return;}
    if(!userId||!reason)return;
    const editingId=e.currentTarget.dataset.editingId;
    if(editingId){
      const item=data.attendance.absences.find(x=>x.id===editingId);
      if(item){item.userId=userId;item.start=start;item.end=end;item.reason=reason;}
    }else{
      data.attendance.absences.push({id:crypto.randomUUID(),userId,start,end,reason});
    }
    resetAbsenceForm();
    attendanceClose('absenceModal'); await saveData(true); renderAttendance();
  });
  $('editAttendanceUserButton')?.addEventListener('click',()=>{
    if(selectedAttendanceUserId) editAttendanceUser(selectedAttendanceUserId);
  });
  $('deleteAttendanceUserButton')?.addEventListener('click',()=>{
    if(selectedAttendanceUserId) deleteAttendanceUser(selectedAttendanceUserId);
  });
  document.querySelectorAll('[data-close-attendance-manage]').forEach(x=>x.addEventListener('click',()=>{
    attendanceClose('attendanceUserManageModal');
    selectedAttendanceUserId=null;
  }));
  renderAttendance();
}
async function startOnlineApp() {
  const overlay = $('authOverlay');
  const loginForm = $('passwordLoginForm');
  const passwordInput = $('loginPassword');
  const loginButton = $('passwordLoginButton');
  const message = $('authMessage');

  async function openAppWithSession(session){
    currentAccess=session.access==='full' ? 'full' : 'limited';
    canEditCalendar=currentAccess==='full';
    currentSessionUser=session.user || {id:currentAccess,username:currentAccess==='full' ? 'Admin' : 'Mitglied'};
    applyAccessUi();
    if(isLimitedAccess()) setTab('selling');

    await loadCloudData();
    cloudReady=true;
    startCloudSync();

    if(overlay) overlay.classList.add('hidden');
    populateProductSelect();
    populateWeekSelect();
    initWeekDefaults();
    refresh();
    initAttendance();
    initCalendar();
    applyAccessUi();
    if(isLimitedAccess()) setTab('selling');
  }

  async function checkSession(){
    const response=await fetch('/api/session',{credentials:'same-origin',cache:'no-store'});
    if(!response.ok) return null;
    const session=await response.json().catch(()=>({}));
    return session.authenticated ? session : null;
  }

  loginForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    const password=String(passwordInput?.value || '');
    if(!password) return;

    if(loginButton) loginButton.disabled=true;
    if(message) message.textContent='Anmeldung wird geprüft …';

    try{
      const response=await fetch('/api/login',{
        method:'POST',
        credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({password})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok || !result.authenticated){
        if(message) message.textContent=result.error || 'Falsches Passwort.';
        if(loginButton) loginButton.disabled=false;
        if(passwordInput){ passwordInput.value=''; passwordInput.focus(); }
        return;
      }
      await openAppWithSession(result);
    }catch(error){
      if(message) message.textContent='Anmeldung fehlgeschlagen: '+error.message;
      if(loginButton) loginButton.disabled=false;
    }
  });

  try{
    const session=await checkSession();
    if(session){
      await openAppWithSession(session);
      return;
    }
    if(overlay) overlay.classList.remove('hidden');
    if(message) message.textContent='Bitte Passwort eingeben.';
    passwordInput?.focus();
  }catch(error){
    cloudReady=false;
    if(overlay) overlay.classList.remove('hidden');
    if(message) message.textContent='Verbindung fehlgeschlagen: '+error.message;
  }
}

startOnlineApp();

$('attendanceWeekCalendar').addEventListener('click', event => {
  const button = event.target.closest('[data-attendance-date]');
  if (!button) return;
  const date = localDateFromIso(button.dataset.attendanceDate);
  const user = button.dataset.attendanceUser;
  setAttendance(date, user, attendanceCycle(attendanceStatus(date,user)));
});

$('attendanceMonthCalendar').addEventListener('click', event => {
  const button = event.target.closest('[data-attendance-date]');
  if (!button) return;
  const date = localDateFromIso(button.dataset.attendanceDate);
  const user = button.dataset.attendanceUser;
  setAttendance(date, user, attendanceCycle(attendanceStatus(date,user)));
});

$('attendancePresentList').addEventListener('click', event => {
  const remove = event.target.closest('[data-remove-attendance-user]');
  if (remove) return removeAttendanceUser(remove.dataset.removeAttendanceUser);
  const userButton = event.target.closest('[data-today-attendance-user]');
  if (userButton) {
    const user = userButton.dataset.todayAttendanceUser;
    setAttendance(new Date(), user, attendanceCycle(attendanceStatus(new Date(), user)));
  }
});

$('attendanceAbsentList').addEventListener('click', event => {
  const remove = event.target.closest('[data-remove-attendance-user]');
  if (remove) return removeAttendanceUser(remove.dataset.removeAttendanceUser);
  const userButton = event.target.closest('[data-today-attendance-user]');
  if (userButton) {
    const user = userButton.dataset.todayAttendanceUser;
    setAttendance(new Date(), user, attendanceCycle(attendanceStatus(new Date(), user)));
  }
});

$('attendanceAddUserForm').addEventListener('submit', event => {
  event.preventDefault();
  addAttendanceUser($('attendanceNewUser').value);
});
$('openAttendanceMonth').addEventListener('click', openAttendanceMonth);
$('closeAttendanceMonth').addEventListener('click', closeAttendanceMonth);
$('attendanceMonthModal').addEventListener('click', event => {
  if (event.target.closest('[data-close-attendance-month]')) closeAttendanceMonth();
});
window.addEventListener('keydown', event => { if (event.key === 'Escape') closeAttendanceMonth(); });


// KINGSMEN V6: offene Debounce-Speicherung beim Verlassen sofort anstoßen.
window.addEventListener('pagehide',()=>{
  if(cloudReady && saveTimer){
    clearTimeout(saveTimer);
    saveTimer=null;
    saveData(true);
  }
});
