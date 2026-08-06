// Excel Round implementation matching HALF_UP behavior
function excelRound(value, decimals) {
  if (isNaN(value) || !isFinite(value)) return 0.0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

// State & Options
const defaultOptions = {
  yd: 1.0,
  cp: 0.84,
  deltaHAt: 1.760,
  nozzles: [4.76, 6.35, 7.94, 9.53, 12.7]
};

let options = JSON.parse(localStorage.getItem('kfactor_options')) || defaultOptions;

// Tab Switcher
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.target;
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      document.getElementById(target).classList.remove('hidden');
    });
  });
}

// Modal handling
function initModal() {
  const modal = document.getElementById('optionsModal');
  const openBtn = document.getElementById('openOptionsBtn');
  const closeBtn = document.getElementById('closeOptionsBtn');
  const saveBtn = document.getElementById('saveOptionsBtn');

  openBtn.addEventListener('click', () => {
    document.getElementById('optYd').value = options.yd;
    document.getElementById('optCp').value = options.cp;
    document.getElementById('optDeltaHAt').value = options.deltaHAt;
    document.getElementById('optNozzles').value = options.nozzles.join(', ');
    modal.classList.remove('hidden');
  });

  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

  saveBtn.addEventListener('click', () => {
    options.yd = parseFloat(document.getElementById('optYd').value) || 1.0;
    options.cp = parseFloat(document.getElementById('optCp').value) || 0.84;
    options.deltaHAt = parseFloat(document.getElementById('optDeltaHAt').value) || 1.760;
    const nozzlesStr = document.getElementById('optNozzles').value;
    options.nozzles = nozzlesStr.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (options.nozzles.length === 0) options.nozzles = [4.76, 6.35, 7.94, 9.53, 12.7];

    localStorage.setItem('kfactor_options', JSON.stringify(options));
    modal.classList.add('hidden');
    calculateKFactor();
  });
}

// 1. K-Factor & Isokinetic Main Calculation Engine
function calculateKFactor() {
  // Inputs
  const o2_1 = parseFloat(document.getElementById('o2_1').value) || 0;
  const o2_2 = parseFloat(document.getElementById('o2_2').value) || 0;
  const o2_3 = parseFloat(document.getElementById('o2_3').value) || 0;
  const co2_1 = parseFloat(document.getElementById('co2_1').value) || 0;
  const co2_2 = parseFloat(document.getElementById('co2_2').value) || 0;
  const co2_3 = parseFloat(document.getElementById('co2_3').value) || 0;

  const o2Avg = excelRound((o2_1 + o2_2 + o2_3) / 3.0, 1);
  const co2Avg = excelRound((co2_1 + co2_2 + co2_3) / 3.0, 1);

  const xw = parseFloat(document.getElementById('xw').value) || 0;
  const tsVal = parseFloat(document.getElementById('tsVal').value) || 0;
  const tsUnit = document.getElementById('tsUnit').value;

  const paVal = parseFloat(document.getElementById('paVal').value) || 0;
  const paUnit = document.getElementById('paUnit').value;

  const psVal = parseFloat(document.getElementById('psVal').value) || 0;
  const psUnit = document.getElementById('psUnit').value;

  const hVal = parseFloat(document.getElementById('hVal').value) || 0;
  const hUnit = document.getElementById('hUnit').value;

  const ductType = document.getElementById('ductType').value;
  const ds = parseFloat(document.getElementById('ds').value) || 1.0;
  const ds1 = parseFloat(document.getElementById('ds1').value) || 1.0;
  const ds2 = parseFloat(document.getElementById('ds2').value) || 1.0;

  const tmVal = parseFloat(document.getElementById('tmVal').value) || 0;
  const tmUnit = document.getElementById('tmUnit').value;

  const dn = parseFloat(document.getElementById('dn').value) || 1.0;
  const time = parseFloat(document.getElementById('time').value) || 1.0;

  const actualVmVal = parseFloat(document.getElementById('actualVmVal').value) || 0;
  const actualVmUnit = document.getElementById('actualVmUnit').value;

  // Conversions
  const tsInC = excelRound(tsUnit === 'C' ? tsVal : (tsVal - 32) / 1.8, 1);
  const tmInC = excelRound(tmUnit === 'C' ? tmVal : (tmVal - 32) / 1.8, 1);

  const paInmmHg = excelRound(paUnit === 'MMHG' ? paVal : paVal * 0.750062, 1);
  const psInInH2O = excelRound(psUnit === 'INH2O' ? psVal : psVal / 1.86832, 1);
  const psInmmHg = excelRound(psInInH2O * 1.86832, 2);

  const hInInH2O = excelRound(hUnit === 'INH2O' ? hVal : hVal / 25.4, 2);
  const hInmmH2O = hUnit === 'MMH2O' ? hVal : hVal * 25.4;

  const actualVmLiter = actualVmUnit === 'LITER' ? actualVmVal : actualVmVal * 28.3168;

  // Molecular Weights
  const md = excelRound(0.44 * co2Avg + 0.32 * o2Avg + 0.28 * (100.0 - o2Avg - co2Avg), 3);
  const kPb = paInmmHg / 25.4;
  const kPs = (paInmmHg + psInmmHg) / 25.4;
  const kMs = md * (1.0 - xw / 100.0) + 18.01 * (xw / 100.0);

  // Vm target calculation
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

  // Render Core Results
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
  document.getElementById('resQs').innerText = `${qs} m³/min`;
  document.getElementById('resVic').innerText = `${vic} mL`;
}

// 2. Moisture Gas Calculation
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
  document.getElementById('resPv').innerText = `${pv} mmHg`;
  document.getElementById('resXw1').innerText = `${xw1}%`;
  document.getElementById('resVmStd').innerText = `${excelRound(vmStd, 2)} L`;
}

// 3. Measurement Points Engine
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

// Register Event Listeners
function initApp() {
  initTabs();
  initModal();

  // Inputs change listeners for real-time recalculation
  const inputs = document.querySelectorAll('#tabKFactor input, #tabKFactor select');
  inputs.forEach(i => i.addEventListener('input', calculateKFactor));

  const moistureInputs = document.querySelectorAll('#tabMoisture input, #tabMoisture select');
  moistureInputs.forEach(i => i.addEventListener('input', calculateMoistureGas));

  const ptInputs = document.querySelectorAll('#tabPoints input, #tabPoints select');
  ptInputs.forEach(i => i.addEventListener('input', calculateMeasurementPoints));

  // Initial calculations
  calculateKFactor();
  calculateMoistureGas();
  calculateMeasurementPoints();

  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] Service Worker registered:', reg.scope))
      .catch(err => console.error('[PWA] SW register error:', err));
  }

  // PWA Install Prompt handling
  let deferredPrompt;
  const installBanner = document.getElementById('pwaInstallBanner');
  const installBtn = document.getElementById('pwaInstallBtn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBanner.classList.remove('hidden');
  });

  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA install outcome: ${outcome}`);
      deferredPrompt = null;
      installBanner.classList.add('hidden');
    }
  });
}

document.addEventListener('DOMContentLoaded', initApp);
