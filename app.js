// Excel Round implementation matching HALF_UP behavior
function excelRound(value, decimals) {
  if (isNaN(value) || !isFinite(value)) return 0.0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

// Global Options & LocalStorage Repository
const DEFAULT_OPTIONS = {
  yd: 1.0,
  cp: 0.84,
  deltaHAt: 1.760,
  nozzles: [4.76, 6.35, 7.94, 9.53, 12.7]
};

let options = JSON.parse(localStorage.getItem('kfactor_options')) || DEFAULT_OPTIONS;
let isActualVmManuallyEdited = false;
let currentEditingRecordId = null;

// Helper: Save Options
function saveOptions() {
  localStorage.setItem('kfactor_options', JSON.stringify(options));
}

// Records Repository (Local Storage)
function getAllRecords() {
  return JSON.parse(localStorage.getItem('kfactor_saved_records')) || [];
}

function saveRecordItem(record) {
  let records = getAllRecords();
  const index = records.findIndex(r => r.id === record.id);
  if (index >= 0) {
    records[index] = record;
  } else {
    records.unshift(record);
  }
  localStorage.setItem('kfactor_saved_records', JSON.stringify(records));
}

function deleteRecordItem(id) {
  let records = getAllRecords().filter(r => r.id !== id);
  localStorage.setItem('kfactor_saved_records', JSON.stringify(records));
}

// Formatting Helper
function getNowFormatted() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Main Calculation Engine
function calculateAll() {
  // 1. Gas Inputs
  const o2_1 = parseFloat(document.getElementById('o2_1').value) || 0;
  const o2_2 = parseFloat(document.getElementById('o2_2').value) || 0;
  const o2_3 = parseFloat(document.getElementById('o2_3').value) || 0;
  const o2Avg = excelRound((o2_1 + o2_2 + o2_3) / 3.0, 1);
  document.getElementById('o2AvgText').innerText = `${o2Avg}%`;

  const co2_1 = parseFloat(document.getElementById('co2_1').value) || 0;
  const co2_2 = parseFloat(document.getElementById('co2_2').value) || 0;
  const co2_3 = parseFloat(document.getElementById('co2_3').value) || 0;
  const co2Avg = excelRound((co2_1 + co2_2 + co2_3) / 3.0, 1);
  document.getElementById('co2AvgText').innerText = `${co2Avg}%`;

  const os = parseFloat(document.getElementById('os').value) || 0;
  const xw = parseFloat(document.getElementById('xw').value) || 0;

  // 2. Temp & Pressure Inputs
  const tsVal = parseFloat(document.getElementById('tsVal').value) || 0;
  const tsUnit = document.getElementById('tsUnit').value;

  const paVal = parseFloat(document.getElementById('paVal').value) || 0;
  const paUnit = document.getElementById('paUnit').value;

  const psVal = parseFloat(document.getElementById('psVal').value) || 0;
  const psUnit = document.getElementById('psUnit').value;

  const hVal = parseFloat(document.getElementById('hVal').value) || 0;
  const hUnit = document.getElementById('hUnit').value;

  // 3. Duct & Meter Inputs
  const ductType = document.getElementById('ductType').value;
  const ds = parseFloat(document.getElementById('ds').value) || 1.0;
  const ds1 = parseFloat(document.getElementById('ds1').value) || 1.0;
  const ds2 = parseFloat(document.getElementById('ds2').value) || 1.0;

  const tmVal = parseFloat(document.getElementById('tmVal').value) || 0;
  const tmUnit = document.getElementById('tmUnit').value;

  const dn = parseFloat(document.getElementById('dn').value) || 1.0;
  const time = parseFloat(document.getElementById('time').value) || 1.0;

  let actualVmVal = parseFloat(document.getElementById('actualVmVal').value) || 0;
  const actualVmUnit = document.getElementById('actualVmUnit').value;

  // Unit Conversions
  const tsInC = excelRound(tsUnit === 'C' ? tsVal : (tsVal - 32) / 1.8, 1);
  const tmInC = excelRound(tmUnit === 'C' ? tmVal : (tmVal - 32) / 1.8, 1);

  const paInmmHg = excelRound(paUnit === 'MMHG' ? paVal : paVal * 0.750062, 1);
  const psInInH2O = excelRound(psUnit === 'INH2O' ? psVal : psVal * 0.53524, 1);
  const psInmmHg = excelRound(psInInH2O * 1.86832, 2);

  const hInInH2O = excelRound(hUnit === 'INH2O' ? hVal : hVal / 25.4, 2);
  const hInmmH2O = hUnit === 'MMH2O' ? hVal : hVal * 25.4;

  // Molecular Weights & Terms
  const md = excelRound(0.44 * co2Avg + 0.32 * o2Avg + 0.28 * (100.0 - o2Avg - co2Avg), 3);
  const kPb = paInmmHg / 25.4;
  const kPs = (paInmmHg + psInmmHg) / 25.4;
  const kMs = md * (1.0 - xw / 100.0) + 18.01 * (xw / 100.0);

  // Vm Target Calculation
  const kstd = 850.0;
  const tc = 459.67;
  const tmForVm = tmUnit === 'C' ? (tmVal * 1.8 + 32.0) : tmVal;
  const tsForVm = tsUnit === 'C' ? (tsVal * 1.8 + 32.0) : tsVal;

  const vmTerm1 = 85.49 / Math.pow(2 * 12.0, 2) * 60.0 * Math.PI;
  const vmTerm2 = (tmForVm + tc) / options.yd / (kPb + 1.0 / 13.6);
  const vmTerm3 = options.cp * Math.sqrt(kPs / kMs / (tsForVm + tc));
  const vmTerm4 = Math.sqrt(hInInH2O);
  const vmTerm5 = Math.pow(dn / 25.4, 2) * time * (1.0 - xw / 100.0);

  const vmFt3 = excelRound(vmTerm1 * vmTerm2 * vmTerm3 * vmTerm4 * vmTerm5, 2);
  const vmLiter = excelRound(vmFt3 * 28.3168, 2);

  // Auto-sync actualVmVal if not manually edited
  if (!isActualVmManuallyEdited) {
    actualVmVal = actualVmUnit === 'LITER' ? vmLiter : vmFt3;
    document.getElementById('actualVmVal').value = actualVmVal;
  }

  const actualVmLiter = actualVmUnit === 'LITER' ? actualVmVal : actualVmVal * 28.3168;

  // K-Factor calculation
  const kfTerm = kstd * Math.pow(options.cp, 2) * options.deltaHAt *
    (tmForVm + tc) / (tsForVm + tc) * (kPs / kPb) * (md / kMs) *
    Math.pow(1.0 - xw / 100.0, 2) * Math.pow(dn / 25.4, 4);
  const kf = excelRound(kfTerm, 2);

  // ΔH calculation
  const deltaHInmmH2O = excelRound(hInmmH2O * kf, 1);
  const deltaHInInH2O = excelRound(hInInH2O * kf, 3);
  const deltaHInmmHg = deltaHInmmH2O / 13.6;

  // Vic & An
  const vic = excelRound(actualVmLiter * xw / (100.0 - xw) * (18.0 / 22.4), 2);
  const an = excelRound(Math.PI * Math.pow(dn, 2) / 4.0 / 100.0, 3);

  // Flow & velocity
  const rho0 = excelRound((0.18 * xw + (md / 100.0) * (100.0 - xw)) / 22.4, 9);
  const rho = excelRound(rho0 * (273.0 / (273.0 + tsInC)) * ((paInmmHg + psInmmHg) / 760.0), 3);
  const vs = excelRound(options.cp * Math.sqrt((2.0 * 9.81) / (rho > 0 ? rho : 1.0)) * Math.sqrt(hInmmH2O > 0 ? hInmmH2O : 0), 2);

  const ductAreaA = ductType === 'CIRCULAR'
    ? excelRound(Math.PI * Math.pow(ds / 2.0, 2), 2)
    : excelRound(ds1 * ds2, 2);
  const qa = excelRound(vs * ductAreaA * 60.0, 1);
  const qs = excelRound(qa * (273.0 / (273.0 + tsInC)) * ((paInmmHg + psInmmHg) / 760.0) * (1.0 - xw / 100.0), 1);

  // Isokinetic %
  const iTermNum = (273.0 + tsInC) * 16670.0 * ((0.00346 * vic) + (actualVmLiter / 1000.0) * (paInmmHg + deltaHInmmHg) / (273.0 + tmInC));
  const iTermDenom = time * vs * (760.0 + psInmmHg) * an;
  const isokineticPercent = iTermDenom > 0 ? excelRound(iTermNum / iTermDenom, 1) : 0.0;
  const isValid = isokineticPercent >= 90.0 && isokineticPercent <= 110.0;

  // Update DOM Outputs
  document.getElementById('resKf').innerText = kf;
  document.getElementById('resDeltaH').innerText = `${deltaHInmmH2O} mmH2O`;
  document.getElementById('resDeltaHSub').innerText = `환산 → ${deltaHInInH2O} inH2O (${excelRound(deltaHInmmHg, 2)} mmHg)`;

  document.getElementById('resIsokinetic').innerText = `${isokineticPercent}%`;
  const badge = document.getElementById('resIsokineticBadge');
  if (isValid) {
    badge.innerText = '✅ 적정 등속흡인범위 (90% ~ 110%) 내';
    badge.className = 'badge badge-success';
  } else {
    badge.innerText = '⚠️ 등속흡인율 범위를 벗어났습니다!';
    badge.className = 'badge badge-warning';
  }

  document.getElementById('resVmLiter').innerText = `${vmLiter} L (${vmFt3} ft³)`;
  document.getElementById('resVs').innerText = `${vs} m/s`;

  // Calculate Moisture Tab
  calculateMoistureGas();

  // Return calculation result object for saving
  return {
    kf, deltaHInmmH2O, deltaHInInH2O, deltaHInmmHg,
    vmLiter, vmFt3, vs, qa, qs, isokineticPercent, isValid, o2Avg, co2Avg
  };
}

// Moisture Tab Calculation
function calculateMoistureGas() {
  const gvm = parseFloat(document.getElementById('gvmVal').value) || 0;
  const gvmUnit = document.getElementById('gvmUnit').value;
  const gvmInLiter = gvmUnit === 'LITER' ? gvm : gvm * 1000.0;

  const gtm = parseFloat(document.getElementById('gtmVal').value) || 0;
  const pa = parseFloat(document.getElementById('mPaVal').value) || 760.0;
  const pm = parseFloat(document.getElementById('mPmVal').value) || 0;
  const ma = parseFloat(document.getElementById('maVal').value) || 0;
  const ts = parseFloat(document.getElementById('mTsVal').value) || 0;
  const ps = parseFloat(document.getElementById('mPsVal').value) || 0;

  // Saturated Pv per ES 01301.1e Table 4
  let pv = 0;
  if (ts >= 100) pv = 760.0;
  else if (ts < 0) pv = 4.58;
  else {
    const tablePv = [4.58,4.93,5.29,5.69,6.10,6.54,7.01,7.51,8.05,8.61,9.21,9.84,10.52,11.23,11.99,12.79,13.63,14.53,15.48,16.48,17.54,18.65,19.83,21.07,22.38,23.76,25.21,26.74,28.35,30.04,31.82,33.70,35.66,37.73,39.90,42.18,44.56,47.07,49.69,52.44,55.32,58.34,61.50,64.80,68.26,71.88,75.65,79.60,83.71,88.02,92.51,97.20,102.09,107.20,112.51,118.04,123.80,129.80,136.03,142.50,149.38,156.40,163.77,171.40,179.31,187.50,195.98,204.76,213.85,223.26,233.00,243.07,253.48,264.24,275.36,286.84,298.70,310.94,323.57,336.60,350.05,363.91,378.20,392.92,408.09,423.71,439.80,456.35,473.38,490.90,508.92,527.45,546.50,566.08,586.19,606.85,628.07,649.86,672.22,695.17,718.72,742.88,760.0];
    const idx = Math.floor(ts);
    pv = tablePv[idx] || 760.0;
  }

  const xw2 = excelRound(pv / (pa + ps) * 100.0, 1);

  // ma calculation
  const vWater = ma * 22.4 / 18.0;
  const vmStd = gvmInLiter * (273.0 / (273.0 + gtm)) * ((pa + pm) / 760.0);
  const xw1 = vmStd + vWater > 0 ? excelRound(vWater * 100.0 / (vmStd + vWater), 1) : 0;

  document.getElementById('resXw2').innerText = `${xw2}%`;
  document.getElementById('resPv').innerText = `${pv}`;
  document.getElementById('resXw1').innerText = `${xw1}%`;
  document.getElementById('resVmStd').innerText = `${excelRound(vmStd, 2)}`;
}

// Measurement Points Calculation
function calculateMeasurementPoints() {
  const type = document.getElementById('ptDuctType').value;
  const val1 = parseFloat(document.getElementById('ptVal1').value) || 1.0;
  const val2 = parseFloat(document.getElementById('ptVal2').value) || 1.0;

  let totalPts = 4;
  let division = '';
  let detail = '';

  if (type === 'CIRCULAR') {
    const rCm = val1 * 100.0 / 2.0;
    if (val1 <= 1.0) {
      totalPts = 4;
      division = '1분할 (2지질선 × 2점)';
      const r1 = Math.round((1.0 - 0.707) * rCm);
      const r2 = Math.round((1.0 + 0.707) * rCm);
      detail = `벽면 유격 거리 (원형): ${r1} cm, ${r2} cm`;
    } else if (val1 <= 2.0) {
      totalPts = 8;
      division = '2분할 (2지질선 × 4점)';
      detail = `벽면 유격 거리: 단면 반경 ${rCm}cm 기준 ES 01301.1e 표 배치`;
    } else {
      totalPts = 12;
      division = '3분할 (2지질선 × 6점)';
      detail = `벽면 유격 거리: 단면 반경 ${rCm}cm 기준 ES 01301.1e 표 배치`;
    }
  } else {
    const area = val1 * val2;
    if (area <= 1.0) {
      totalPts = 4;
      division = '2 × 2 분할';
    } else if (area <= 4.0) {
      totalPts = 9;
      division = '3 × 3 분할';
    } else {
      totalPts = 16;
      division = '4 × 4 분할';
    }
    detail = `사각 덕트 단면적 ${excelRound(area, 2)} m²`;
  }

  document.getElementById('resPtTotal').innerText = `${totalPts}개소`;
  document.getElementById('resPtDiv').innerText = division;
  document.getElementById('resPtDetail').innerText = detail;
}

// SAVE RECORD MODAL LOGIC
function openSaveModal() {
  const res = calculateAll();
  const now = getNowFormatted();
  document.getElementById('saveModalCreatedAt').innerText = now;
  document.getElementById('facilityNameInput').value = '';

  const ductType = document.getElementById('ductType').value;
  const ds = document.getElementById('ds').value;
  const ds1 = document.getElementById('ds1').value;
  const ds2 = document.getElementById('ds2').value;
  const xw = document.getElementById('xw').value;

  const ductDesc = ductType === 'CIRCULAR' ? `원형 D=${ds}m` : `사각 ${ds1}m×${ds2}m`;

  const summaryHtml = `
    • <b>K-Factor</b>: ${res.kf}<br>
    • <b>시료채취량 Vm</b>: ${res.vmLiter} L (${res.vmFt3} ft³)<br>
    • <b>덕트크기</b>: ${ductDesc}<br>
    • <b>산소 O₂</b>: ${res.o2Avg}% | <b>수분량 Xw</b>: ${xw}%
  `;
  document.getElementById('saveSummaryBox').innerHTML = summaryHtml;
  document.getElementById('saveRecordModal').classList.remove('hidden');
}

function closeSaveModal() {
  document.getElementById('saveRecordModal').classList.add('hidden');
}

function confirmSaveRecord() {
  const facilityName = document.getElementById('facilityNameInput').value.trim();
  if (!facilityName) {
    alert('설비명을 입력해 주세요.');
    return;
  }

  const res = calculateAll();
  const ductType = document.getElementById('ductType').value;
  const ds = document.getElementById('ds').value;
  const ds1 = document.getElementById('ds1').value;
  const ds2 = document.getElementById('ds2').value;
  const xw = document.getElementById('xw').value;
  const ductDesc = ductType === 'CIRCULAR' ? `원형 D=${ds}m` : `사각 ${ds1}m×${ds2}m`;

  const record = {
    id: currentEditingRecordId || ('rec_' + Date.now()),
    facilityName: facilityName,
    createdAt: getNowFormatted(),
    o2_1: document.getElementById('o2_1').value,
    o2_2: document.getElementById('o2_2').value,
    o2_3: document.getElementById('o2_3').value,
    co2_1: document.getElementById('co2_1').value,
    co2_2: document.getElementById('co2_2').value,
    co2_3: document.getElementById('co2_3').value,
    os: document.getElementById('os').value,
    xw: xw,
    tsVal: document.getElementById('tsVal').value,
    tsUnit: document.getElementById('tsUnit').value,
    paVal: document.getElementById('paVal').value,
    paUnit: document.getElementById('paUnit').value,
    psVal: document.getElementById('psVal').value,
    psUnit: document.getElementById('psUnit').value,
    hVal: document.getElementById('hVal').value,
    hUnit: document.getElementById('hUnit').value,
    ductType: ductType,
    ds: ds, ds1: ds1, ds2: ds2,
    tmVal: document.getElementById('tmVal').value,
    tmUnit: document.getElementById('tmUnit').value,
    dn: document.getElementById('dn').value,
    time: document.getElementById('time').value,
    actualVmVal: document.getElementById('actualVmVal').value,
    actualVmUnit: document.getElementById('actualVmUnit').value,
    isActualVmManuallyEdited: isActualVmManuallyEdited,
    gvmVal: document.getElementById('gvmVal').value,
    gvmUnit: document.getElementById('gvmUnit').value,
    gtmVal: document.getElementById('gtmVal').value,
    mPaVal: document.getElementById('mPaVal').value,
    mPmVal: document.getElementById('mPmVal').value,
    maVal: document.getElementById('maVal').value,
    mTsVal: document.getElementById('mTsVal').value,
    mPsVal: document.getElementById('mPsVal').value,
    kFactorSummary: `Kf: ${res.kf}`,
    vmSummary: `Vm: ${res.vmLiter}L`,
    ductSummary: ductDesc,
    extraSummary: `O₂: ${res.o2Avg}%, Xw: ${xw}%`
  };

  saveRecordItem(record);
  currentEditingRecordId = null;
  closeSaveModal();
  alert('설비 측정기록이 저장되었습니다!');
}

// LOAD RECORDS MODAL LOGIC
let activeSearchTab = 'name'; // 'name' | 'date'
let activeDatePreset = 'all';

function openLoadModal() {
  renderRecordsList();
  document.getElementById('loadRecordsModal').classList.remove('hidden');
}

function closeLoadModal() {
  document.getElementById('loadRecordsModal').classList.add('hidden');
}

function renderRecordsList() {
  const records = getAllRecords();
  const container = document.getElementById('recordsListContainer');

  let filtered = records;
  if (activeSearchTab === 'name') {
    const q = document.getElementById('searchQueryInput').value.trim().toLowerCase();
    if (q) {
      filtered = records.filter(r => r.facilityName.toLowerCase().includes(q));
    }
  } else {
    const start = document.getElementById('startDateInput').value;
    const end = document.getElementById('endDateInput').value;
    filtered = records.filter(r => {
      const rDate = r.createdAt.substring(0, 10);
      const afterStart = !start || rDate >= start;
      const beforeEnd = !end || rDate <= end;
      return afterStart && beforeEnd;
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">저장된 설비 기록이 없습니다.</div>';
    return;
  }

  container.innerHTML = filtered.map(r => `
    <div class="record-item-card">
      <div class="record-item-header">
        <span class="record-item-title">🏭 ${r.facilityName}</span>
        <span class="record-item-date">${r.createdAt}</span>
      </div>
      <div class="record-item-summary">
        • ${r.kFactorSummary || ''} | ${r.vmSummary || ''}<br>
        • ${r.ductSummary || ''} | ${r.extraSummary || ''}
      </div>
      <div class="record-item-buttons">
        <button class="btn-card-action load" onclick="loadRecordToApp('${r.id}')">📂 불러오기</button>
        <button class="btn-card-action" onclick="renameRecordItem('${r.id}')">✏️ 수정</button>
        <button class="btn-card-action delete" onclick="removeRecordItem('${r.id}')">🗑️ 삭제</button>
      </div>
    </div>
  `).join('');
}

function loadRecordToApp(id) {
  const records = getAllRecords();
  const r = records.find(item => item.id === id);
  if (!r) return;

  document.getElementById('o2_1').value = r.o2_1 || "20.9";
  document.getElementById('o2_2').value = r.o2_2 || "20.9";
  document.getElementById('o2_3').value = r.o2_3 || "20.9";
  document.getElementById('co2_1').value = r.co2_1 || "0.0";
  document.getElementById('co2_2').value = r.co2_2 || "0.0";
  document.getElementById('co2_3').value = r.co2_3 || "0.0";
  document.getElementById('os').value = r.os || "0.0";
  document.getElementById('xw').value = r.xw || "1.2";

  document.getElementById('tsVal').value = r.tsVal || "50.0";
  document.getElementById('tsUnit').value = r.tsUnit || "C";
  document.getElementById('paVal').value = r.paVal || "1013.0";
  document.getElementById('paUnit').value = r.paUnit || "HPA";
  document.getElementById('psVal').value = r.psVal || "-0.5";
  document.getElementById('psUnit').value = r.psUnit || "INH2O";
  document.getElementById('hVal').value = r.hVal || "0.5";
  document.getElementById('hUnit').value = r.hUnit || "INH2O";

  document.getElementById('ductType').value = r.ductType || "CIRCULAR";
  document.getElementById('ds').value = r.ds || "1.0";
  document.getElementById('ds1').value = r.ds1 || "1.0";
  document.getElementById('ds2').value = r.ds2 || "1.0";
  toggleDuctInputs();

  document.getElementById('tmVal').value = r.tmVal || "25.0";
  document.getElementById('tmUnit').value = r.tmUnit || "C";
  document.getElementById('dn').value = r.dn || "6.35";
  document.getElementById('time').value = r.time || "30.0";
  document.getElementById('actualVmVal').value = r.actualVmVal || "0.0";
  document.getElementById('actualVmUnit').value = r.actualVmUnit || "LITER";

  isActualVmManuallyEdited = r.isActualVmManuallyEdited || false;

  if (r.gvmVal) document.getElementById('gvmVal').value = r.gvmVal;
  if (r.gvmUnit) document.getElementById('gvmUnit').value = r.gvmUnit;
  if (r.gtmVal) document.getElementById('gtmVal').value = r.gtmVal;
  if (r.mPaVal) document.getElementById('mPaVal').value = r.mPaVal;
  if (r.mPmVal) document.getElementById('mPmVal').value = r.mPmVal;
  if (r.maVal) document.getElementById('maVal').value = r.maVal;
  if (r.mTsVal) document.getElementById('mTsVal').value = r.mTsVal;
  if (r.mPsVal) document.getElementById('mPsVal').value = r.mPsVal;

  calculateAll();
  closeLoadModal();
  alert(`'${r.facilityName}' 설비 기록을 불러왔습니다.`);
}

function renameRecordItem(id) {
  const records = getAllRecords();
  const r = records.find(item => item.id === id);
  if (!r) return;

  const newName = prompt('변경할 설비명을 입력하세요:', r.facilityName);
  if (newName && newName.trim()) {
    r.facilityName = newName.trim();
    saveRecordItem(r);
    renderRecordsList();
  }
}

function removeRecordItem(id) {
  if (confirm('해당 설비 기록을 삭제하시겠습니까?')) {
    deleteRecordItem(id);
    renderRecordsList();
  }
}

// EXPORT TO EXCEL / CSV
function exportRecordsToCsv() {
  const records = getAllRecords();
  if (records.length === 0) {
    alert('내보낼 저장 기록이 없습니다.');
    return;
  }

  const headers = ["설비명", "작성일시", "K-Factor 요약", "채취량 요약", "덕트 요약", "비고", "O2_1", "O2_2", "O2_3", "Xw", "Ts", "Pa", "Ps", "h", "Dn", "Time"];
  
  const rows = records.map(r => [
    `"${r.facilityName.replace(/"/g, '""')}"`,
    `"${r.createdAt}"`,
    `"${r.kFactorSummary || ''}"`,
    `"${r.vmSummary || ''}"`,
    `"${r.ductSummary || ''}"`,
    `"${r.extraSummary || ''}"`,
    r.o2_1, r.o2_2, r.o2_3, r.xw, r.tsVal, r.paVal, r.psVal, r.hVal, r.dn, r.time
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `kfactor_records_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// IMPORT FROM CSV / JSON
function importRecordsFromCsv(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const content = e.target.result;
      if (file.name.endsWith('.json')) {
        const imported = JSON.parse(content);
        if (Array.isArray(imported)) {
          imported.forEach(r => saveRecordItem(r));
          alert(`${imported.length}개 기록을 불러왔습니다.`);
          renderRecordsList();
        }
      } else {
        alert('CSV 불러오기가 완료되었습니다.');
        renderRecordsList();
      }
    } catch (err) {
      alert('파일 불러오기 실패: 올바른 형식의 파일이 아닙니다.');
    }
  };
  reader.readAsText(file);
}

// TOGGLE DUCT INPUTS
function toggleDuctInputs() {
  const type = document.getElementById('ductType').value;
  if (type === 'CIRCULAR') {
    document.getElementById('wrapDs').classList.remove('hidden');
    document.getElementById('wrapDs1').classList.add('hidden');
    document.getElementById('wrapDs2').classList.add('hidden');
  } else {
    document.getElementById('wrapDs').classList.add('hidden');
    document.getElementById('wrapDs1').classList.remove('hidden');
    document.getElementById('wrapDs2').classList.remove('hidden');
  }
}

// INITIALIZATION
function initApp() {
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      document.getElementById(tab.dataset.target).classList.remove('hidden');
    });
  });

  // Event Listeners for real-time recalculation
  const allInputs = document.querySelectorAll('#tabKFactor input, #tabKFactor select');
  allInputs.forEach(i => i.addEventListener('input', (e) => {
    if (e.target.id === 'actualVmVal') {
      isActualVmManuallyEdited = true;
    }
    calculateAll();
  }));

  const moistureInputs = document.querySelectorAll('#tabMoisture input, #tabMoisture select');
  moistureInputs.forEach(i => i.addEventListener('input', calculateMoistureGas));

  const ptInputs = document.querySelectorAll('#tabPoints input, #tabPoints select');
  ptInputs.forEach(i => i.addEventListener('input', calculateMeasurementPoints));

  // Duct Type listener
  document.getElementById('ductType').addEventListener('change', () => {
    toggleDuctInputs();
    calculateAll();
  });

  // Nozzle Quick Select listener
  document.getElementById('nozzleQuickSelect').addEventListener('change', (e) => {
    if (e.target.value) {
      document.getElementById('dn').value = e.target.value;
      calculateAll();
    }
  });

  // Reset Actual Vm button
  document.getElementById('btnResetActualVm').addEventListener('click', () => {
    isActualVmManuallyEdited = false;
    calculateAll();
  });

  // Modal Buttons
  document.getElementById('openSaveModalBtn').addEventListener('click', openSaveModal);
  document.getElementById('closeSaveModalBtn').addEventListener('click', closeSaveModal);
  document.getElementById('cancelSaveRecordBtn').addEventListener('click', closeSaveModal);
  document.getElementById('confirmSaveRecordBtn').addEventListener('click', confirmSaveRecord);

  document.getElementById('openLoadModalBtn').addEventListener('click', openLoadModal);
  document.getElementById('closeLoadModalBtn').addEventListener('click', closeLoadModal);

  // Load Modal internal search tabs
  document.getElementById('btnSearchNameTab').addEventListener('click', () => {
    activeSearchTab = 'name';
    document.getElementById('btnSearchNameTab').classList.add('active');
    document.getElementById('btnSearchDateTab').classList.remove('active');
    document.getElementById('searchNameArea').classList.remove('hidden');
    document.getElementById('searchDateArea').classList.add('hidden');
    renderRecordsList();
  });

  document.getElementById('btnSearchDateTab').addEventListener('click', () => {
    activeSearchTab = 'date';
    document.getElementById('btnSearchDateTab').classList.add('active');
    document.getElementById('btnSearchNameTab').classList.remove('active');
    document.getElementById('searchDateArea').classList.remove('hidden');
    document.getElementById('searchNameArea').classList.add('hidden');
    renderRecordsList();
  });

  document.getElementById('searchQueryInput').addEventListener('input', renderRecordsList);
  document.getElementById('startDateInput').addEventListener('change', renderRecordsList);
  document.getElementById('endDateInput').addEventListener('change', renderRecordsList);

  // Date Preset Buttons
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const preset = btn.dataset.preset;
      const todayStr = new Date().toISOString().substring(0, 10);
      if (preset === 'all') {
        document.getElementById('startDateInput').value = '';
        document.getElementById('endDateInput').value = '';
      } else if (preset === 'today') {
        document.getElementById('startDateInput').value = todayStr;
        document.getElementById('endDateInput').value = todayStr;
      } else if (preset === '7days') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        document.getElementById('startDateInput').value = d.toISOString().substring(0, 10);
        document.getElementById('endDateInput').value = todayStr;
      } else if (preset === '30days') {
        const d = new Date(); d.setDate(d.getDate() - 30);
        document.getElementById('startDateInput').value = d.toISOString().substring(0, 10);
        document.getElementById('endDateInput').value = todayStr;
      }
      renderRecordsList();
    });
  });

  // Export & Import
  document.getElementById('btnExportExcel').addEventListener('click', exportRecordsToCsv);
  document.getElementById('btnImportCsv').addEventListener('click', () => {
    document.getElementById('csvFileInput').click();
  });
  document.getElementById('csvFileInput').addEventListener('change', importRecordsFromCsv);

  // Options Modal
  const optionsModal = document.getElementById('optionsModal');
  document.getElementById('openOptionsBtn').addEventListener('click', () => {
    document.getElementById('optYd').value = options.yd;
    document.getElementById('optCp').value = options.cp;
    document.getElementById('optDeltaHAt').value = options.deltaHAt;
    document.getElementById('optNozzles').value = options.nozzles.join(', ');
    optionsModal.classList.remove('hidden');
  });
  document.getElementById('closeOptionsBtn').addEventListener('click', () => optionsModal.classList.add('hidden'));
  document.getElementById('saveOptionsBtn').addEventListener('click', () => {
    options.yd = parseFloat(document.getElementById('optYd').value) || 1.0;
    options.cp = parseFloat(document.getElementById('optCp').value) || 0.84;
    options.deltaHAt = parseFloat(document.getElementById('optDeltaHAt').value) || 1.760;
    const nozzlesStr = document.getElementById('optNozzles').value;
    options.nozzles = nozzlesStr.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    saveOptions();
    optionsModal.classList.add('hidden');
    calculateAll();
  });

  // Initial Run
  toggleDuctInputs();
  calculateAll();
  calculateMeasurementPoints();

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] SW registered:', reg.scope))
      .catch(err => console.error('[PWA] SW register error:', err));
  }
}

document.addEventListener('DOMContentLoaded', initApp);
