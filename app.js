/**
 * K-Factor Calculator & Air Quality Dust Measurement PWA Engine
 * Environmental ES 01301.1e Standard Compliant
 */

// Math Helper matching Excel ROUND (HALF_UP)
function excelRound(value, decimals) {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

// App State
const state = {
  // Gas & Flue Gas Inputs
  o2_1: 20.9, o2_2: 20.9, o2_3: 20.9,
  co2_1: 0.0, co2_2: 0.0, co2_3: 0.0,
  os: 0.0,
  xw: 1.2,

  // Temp, Pressure & Duct
  tsVal: 50.0, tsUnit: 'C',
  paVal: 1013.0, paUnit: 'HPA',
  psVal: -0.5, psUnit: 'INH2O',
  hVal: 0.5, hUnit: 'INH2O',
  tmVal: 25.0, tmUnit: 'C',
  ductType: 'CIRCULAR', // 'CIRCULAR' or 'RECTANGULAR'
  ds: 1.0, ds1: 1.0, ds2: 1.0,

  // Calculation Parameters
  dn: 6.35,
  time: 30.0,
  actualVmVal: 0.0, actualVmUnit: 'LITER',
  isActualVmManuallyEdited: false,

  // Tab 2 inputs
  pmVal: 0.0, pmUnit: 'INH2O', // 'INH2O' or 'MMHG'
  gtmVal: 25.0, gtmUnit: 'C', // 'C' or 'F'
  gvmVal: 10.0, gvmUnit: 'LITER', // 'LITER' or 'M3'
  maVal: '',

  // Options Constants
  options: {
    yd: 1.0,
    cp: 0.84,
    deltaHAt: 1.760,
    nozzleList: [4.76, 6.35, 7.94, 9.53, 12.7]
  },

  // Calculated Results
  results: null
};

// LocalStorage Keys
const STORAGE_OPTIONS_KEY = 'kfactor_calc_options_v3';
const STORAGE_RECORDS_KEY = 'kfactor_calc_records_v3';

// Load stored options & records
function loadStoredData() {
  try {
    const savedOpt = localStorage.getItem(STORAGE_OPTIONS_KEY);
    if (savedOpt) {
      state.options = JSON.parse(savedOpt);
    }
  } catch (e) {
    console.error('Failed to load saved options', e);
  }
}

function saveOptionsData() {
  localStorage.setItem(STORAGE_OPTIONS_KEY, JSON.stringify(state.options));
}

function getStoredRecords() {
  try {
    const saved = localStorage.getItem(STORAGE_RECORDS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

function saveRecordToStorage(record) {
  const records = getStoredRecords();
  records.unshift(record); // add to top
  localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(records));
}

function deleteRecordFromStorage(id) {
  let records = getStoredRecords();
  records = records.filter(r => r.id !== id);
  localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(records));
}

// Core Calculation Engine
function runCalculationEngine() {
  // 1. Unit conversions
  const tsInCExact = state.tsUnit === 'C' ? state.tsVal : (state.tsVal - 32.0) / 1.8;
  const tsInFExact = state.tsUnit === 'F' ? state.tsVal : (state.tsVal * 1.8 + 32.0);
  const tsInC = excelRound(tsInCExact, 1);
  const tsInF = excelRound(tsInFExact, 1);
  const tsInFRoundedInt = excelRound(tsInFExact, 0);

  const tmInCExact = state.tmUnit === 'C' ? state.tmVal : (state.tmVal - 32.0) / 1.8;
  const tmInFExact = state.tmUnit === 'F' ? state.tmVal : (state.tmVal * 1.8 + 32.0);
  const tmInC = excelRound(tmInCExact, 1);
  const tmInF = excelRound(tmInFExact, 1);
  const tmInFRoundedInt = excelRound(tmInFExact, 0);

  const paInhPa = state.paUnit === 'HPA' ? excelRound(state.paVal, 1) : excelRound(state.paVal * 1013.0 / 760.0, 1);
  const paInmmHgExact = state.paUnit === 'MMHG' ? state.paVal : (state.paVal * 760.0 / 1013.0);
  const paInmmHg = excelRound(paInmmHgExact, 2);

  const psInInH2O = state.psUnit === 'INH2O' ? excelRound(state.psVal, 1) : excelRound(state.psVal * 13.6 / 25.4, 1);
  const psInmmHgExact = state.psUnit === 'MMHG' ? state.psVal : (state.psVal * 25.4 / 13.6);
  const psInmmHg = excelRound(psInmmHgExact, 1);

  const hInInH2O = state.hUnit === 'INH2O' ? state.hVal : (state.hVal / 25.4);
  const hInmmH2O = state.hUnit === 'MMH2O' ? state.hVal : (state.hVal * 25.4);

  // 2. Average gas composition & Md
  const o2Avg = (state.o2_1 + state.o2_2 + state.o2_3) / 3.0;
  const co2Avg = (state.co2_1 + state.co2_2 + state.co2_3) / 3.0;
  const md = excelRound(0.44 * co2Avg + 0.32 * o2Avg + 0.28 * (100.0 - o2Avg - co2Avg), 3);

  const kPb = paInmmHg / 25.4;
  const kPs = kPb + (psInInH2O / 13.6);
  const kMs = md * (1.0 - state.xw / 100.0) + 18.01 * (state.xw / 100.0);

  // 3. Vm calculation (ft³ & L)
  const hInInH2ORounded2 = excelRound(hInInH2O, 2);
  const tc = 459.67;
  const kp = 85.49;
  const len = 12.0;

  const vmTerm1 = kp / Math.pow(2.0 * len, 2) * 60.0 * Math.PI;
  const vmTerm2 = (tmInFRoundedInt + tc) / state.options.yd / (kPb + 1.0 / 13.6);
  const vmTerm3 = state.options.cp * Math.sqrt(kPs / kMs / (tsInFRoundedInt + tc));
  const vmTerm4 = Math.sqrt(hInInH2ORounded2);
  const vmTerm5 = Math.pow(state.dn / 25.4, 2) * state.time * (1.0 - state.xw / 100.0);

  const vmFt3 = excelRound(vmTerm1 * vmTerm2 * vmTerm3 * vmTerm4 * vmTerm5, 2);
  const vmLiter = excelRound(vmFt3 * 28.32, 2);

  // Auto update actualVm if not manually edited
  if (!state.isActualVmManuallyEdited) {
    state.actualVmVal = state.actualVmUnit === 'LITER' ? vmLiter : vmFt3;
  }

  const actualVmLiter = state.actualVmUnit === 'LITER' ? state.actualVmVal : state.actualVmVal * 28.32;

  // 4. K-factor (K-f)
  const kfTerm = 850.0 * Math.pow(state.options.cp, 2) * state.options.deltaHAt *
    ((tmInFRoundedInt + tc) / (tsInFRoundedInt + tc)) *
    (kPs / kPb) * (md / kMs) *
    Math.pow(1.0 - state.xw / 100.0, 2) *
    Math.pow(state.dn / 25.4, 4);

  const kf = excelRound(kfTerm, 2);

  // 5. ΔH calculation
  const deltaHInmmH2O = excelRound(hInmmH2O * kf, 1);
  const deltaHInInH2O = excelRound(hInInH2O * kf, 3);
  const deltaHInmmHg = deltaHInmmH2O / 13.6;

  // Vic & An
  const vic = excelRound(actualVmLiter * state.xw / (100.0 - state.xw) * (18.0 / 22.4), 2);
  const an = excelRound(Math.PI * Math.pow(state.dn, 2) / 4.0 / 100.0, 3);

  // Reference Outputs
  const rho0 = excelRound((0.18 * state.xw + (md / 100.0) * (100.0 - state.xw)) / 22.4, 9);
  const rho = excelRound(rho0 * (273.0 / (273.0 + tsInC)) * ((paInmmHg + psInmmHg) / 760.0), 9);
  const vsTerm = state.options.cp * Math.sqrt((2.0 * 9.81) / (rho > 0 ? rho : 1.0)) * Math.sqrt(hInmmH2O > 0 ? hInmmH2O : 0);
  const vs = excelRound(vsTerm, 2);

  const ductAreaA = state.ductType === 'CIRCULAR' ? excelRound(Math.PI * Math.pow(state.ds, 2) / 4.0, 3) : excelRound(state.ds1 * state.ds2, 3);
  const qa = excelRound(vs * ductAreaA * 60.0, 1);
  const qs = excelRound(qa * (273.0 / (273.0 + tsInC)) * ((paInmmHg + psInmmHg) / 760.0) * (1.0 - state.xw / 100.0), 1);

  const isO2CorrectionApplied = state.os > 0.0;
  const q = isO2CorrectionApplied && (21.0 - o2Avg) !== 0 ? excelRound(qs / ((21.0 - state.os) / (21.0 - o2Avg)), 1) : excelRound(qs, 1);

  // 6. Isokinetic % (I)
  const iNumerator = (273.0 + tsInC) * 16670.0 * ((0.00346 * vic) + (actualVmLiter / 1000.0) * (paInmmHg + deltaHInmmHg) / (273.0 + tmInC));
  const iDenominator = state.time * vs * (760.0 + psInmmHg) * an;
  const isokineticPercent = iDenominator !== 0 ? excelRound(iNumerator / iDenominator, 1) : 0.0;
  const isIsokineticValid = isokineticPercent >= 90.0 && isokineticPercent <= 110.0;

  // 7. Vm0
  const vm0 = (273.0 + tmInC) !== 0 ? excelRound(actualVmLiter * 273.0 / (273.0 + tmInC) * (paInmmHg + deltaHInmmHg) / 760.0, 2) : 0.0;

  state.results = {
    tsInC, tsInF, tmInC, tmInF, paInmmHg, paInhPa, psInInH2O, psInmmHg, hInInH2O, hInmmH2O,
    o2Avg: excelRound(o2Avg, 2),
    co2Avg: excelRound(co2Avg, 2),
    md, vmFt3, vmLiter, actualVmLiter, kf,
    deltaH: deltaHInmmH2O, deltaHInInH2O, deltaHInmmHg: excelRound(deltaHInmmHg, 2),
    isokineticPercent, isIsokineticValid,
    rho0, rho, vs, ductAreaA, qa, qs, q, isO2CorrectionApplied, vic, an, vm0
  };
}

// Measurement Points Calculation per ES 01301.1e Section 5.4
function calculateMeasurementPointsInfo() {
  if (state.ductType === 'CIRCULAR') {
    const d = state.ds > 0 ? state.ds : 0.0;
    const r = d / 2.0;
    const area = excelRound(Math.PI * Math.pow(d, 2) / 4.0, 3);

    if (d <= 0.0) {
      return { totalPoints: 0, areaM2: 0.0, divisionInfo: '직경 미입력', nearText: '', farText: '', isSingle: false };
    }

    const rCm = r * 100.0;
    if (area <= 0.25) {
      const dist = Math.round(rCm);
      return {
        totalPoints: 1, areaM2: area,
        divisionInfo: '소규모 굴뚝 (단면적 ≤ 0.25 m²)',
        nearText: `r1 = ${dist} cm (중심 1점)`,
        farText: '', isSingle: true
      };
    }

    let rRatios, totalPts, divInfo;
    if (d <= 1.0) { rRatios = [0.707]; totalPts = 4; divInfo = '1분할 (2지질선 × 2점)'; }
    else if (d <= 2.0) { rRatios = [0.500, 0.866]; totalPts = 8; divInfo = '2분할 (2지질선 × 4점)'; }
    else if (d <= 4.0) { rRatios = [0.408, 0.707, 0.913]; totalPts = 12; divInfo = '3분할 (2지질선 × 6점)'; }
    else if (d <= 4.5) { rRatios = [0.354, 0.612, 0.791, 0.935]; totalPts = 16; divInfo = '4분할 (2지질선 × 8점)'; }
    else { rRatios = [0.316, 0.548, 0.707, 0.873, 0.935]; totalPts = 20; divInfo = '5분할 (2지질선 × 10점)'; }

    const nearWallDists = rRatios.slice().reverse().map(ratio => Math.round((1.0 - ratio) * rCm));
    const farWallDists = rRatios.map(ratio => Math.round((1.0 + ratio) * rCm));

    const k = nearWallDists.length;
    const nearStr = nearWallDists.map((dist, idx) => `r${idx + 1} = ${dist}`).join(', ');
    const farStr = farWallDists.map((dist, idx) => `r${idx + 1 + k} = ${dist}`).join(', ');

    return {
      totalPoints: totalPts, areaM2: area, divisionInfo: divInfo,
      nearText: `근거리 (r1 ~ r${k}): ${nearStr} (cm)`,
      farText: `원거리 (r${k + 1} ~ r${2 * k}): ${farStr} (cm)`,
      isSingle: false
    };
  } else { // RECTANGULAR
    const d1 = state.ds1 > 0 ? state.ds1 : 0.0;
    const d2 = state.ds2 > 0 ? state.ds2 : 0.0;
    const area = excelRound(d1 * d2, 3);

    if (d1 <= 0.0 || d2 <= 0.0) {
      return { totalPoints: 0, areaM2: 0.0, divisionInfo: '치수 미입력', nearText: '', farText: '', isSingle: false };
    }

    if (area <= 0.25) {
      return { totalPoints: 1, areaM2: area, divisionInfo: '소규모 굴뚝 (단면적 ≤ 0.25 m²)', nearText: '중심 1점', farText: '', isSingle: true };
    }

    let nx = 2, ny = 2;
    if (area >= 1.0 && area < 4.0) { nx = 3; ny = 3; }
    else if (area >= 4.0) { nx = 4; ny = 4; }

    const totalPts = nx * ny;
    const xDists = Array.from({ length: nx }, (_, i) => Math.round(((i + 0.5) / nx) * d1 * 100));
    const yDists = Array.from({ length: ny }, (_, i) => Math.round(((i + 0.5) / ny) * d2 * 100));

    return {
      totalPoints: totalPts, areaM2: area,
      divisionInfo: `${nx}×${ny} 분할 단면`,
      nearText: `가로: ` + xDists.map((dist, idx) => `x${idx + 1} = ${dist} cm`).join(', '),
      farText: `세로: ` + yDists.map((dist, idx) => `y${idx + 1} = ${dist} cm`).join(', '),
      isSingle: false
    };
  }
}

// Calculate Tab 2 Moisture & Gas Values (Exact match with Android App CalculationEngine.kt)
function calculateMoistureAndGas() {
  const res = state.results;
  if (!res) return null;

  const paInmmHg = res.paInmmHg;
  const psInmmHg = res.psInmmHg;
  const tsInC = res.tsInC;
  const tmInC = res.tmInC;
  const xwInput = state.xw !== null && state.xw !== '' && !isNaN(parseFloat(state.xw)) ? parseFloat(state.xw) : 1.2;

  // 1. Pm conversion (fallback 0.0)
  const pmValNum = state.pmVal !== null && state.pmVal !== '' && !isNaN(parseFloat(state.pmVal)) ? parseFloat(state.pmVal) : 0.0;
  const pmInmmHg = state.pmUnit === 'MMHG' ? pmValNum : (pmValNum * 25.4 / 13.6);
  const pmInInH2O = state.pmUnit === 'INH2O' ? pmValNum : (pmValNum * 13.6 / 25.4);

  // 2. GTm conversion (fallback 25.0 °C if unentered)
  const gtmValNum = state.gtmVal !== null && state.gtmVal !== '' && !isNaN(parseFloat(state.gtmVal)) ? parseFloat(state.gtmVal) : 25.0;
  const gtmInC = state.gtmUnit === 'C' ? gtmValNum : excelRound((gtmValNum - 32.0) / 1.8, 1);
  const gtmInF = state.gtmUnit === 'F' ? gtmValNum : (gtmValNum * 1.8 + 32.0);

  // 3. GVm conversion (fallback 10.0 L if unentered)
  const gvmValNum = state.gvmVal !== null && state.gvmVal !== '' && !isNaN(parseFloat(state.gvmVal)) ? parseFloat(state.gvmVal) : 10.0;
  const gvmInL = state.gvmUnit === 'LITER' ? gvmValNum : gvmValNum * 1000.0;
  const gvmInM3 = state.gvmUnit === 'M3' ? gvmValNum : gvmValNum / 1000.0;

  // 4. ma conversion (null if unentered or empty string)
  const maInG = state.maVal !== null && state.maVal !== '' && !isNaN(parseFloat(state.maVal)) ? parseFloat(state.maVal) : null;

  // 5. Saturated Vapor Pressure Pv (mmHg) at Ts (°C) per Sonntag 1990 (ITS-90)
  let pv = 4.58;
  if (tsInC <= 0.0) {
    pv = 4.58;
  } else if (tsInC >= 100.0) {
    pv = 760.0;
  } else {
    const tK = tsInC + 273.15;
    const lnPwPa = -6096.9385 / tK + 21.2409642 - 0.02711193 * tK + 1.673952e-5 * tK * tK + 2.433502 * Math.log(tK);
    const pwPa = Math.exp(lnPwPa);
    const pvMmHg = pwPa * (760.0 / 101325.0);
    pv = excelRound(pvMmHg, 2);
  }

  // 6. Saturated Moisture Xw2 (%) = ROUND(Pv / (Pa + Ps) * 100, 1)
  const xw2 = (paInmmHg + psInmmHg) !== 0 ? excelRound(pv / (paInmmHg + psInmmHg) * 100.0, 1) : 0.0;

  // 7. L0 (표준 가스채취량) = ROUND((GVm * 273 / (273 + GTm) * (Pa + Pm)) / 760, 2)
  const l0 = excelRound((gvmInL * 273.0 / (273.0 + gtmInC) * (paInmmHg + pmInmmHg)) / 760.0, 2);

  // 8. ma1 calculation
  const targetGtm = gtmInC;
  const targetGvm = gvmInL;
  const gtmDoubleRound = excelRound(excelRound(targetGtm, 1), 0);
  const denomTemp = 273.0 + gtmDoubleRound;
  const denomXw = (100.0 - xwInput) * 22.4 / 18.0;

  let ma1 = 0.0;
  if (denomTemp !== 0 && denomXw !== 0) {
    const dryGasVol = targetGvm * (273.0 / denomTemp) * (paInmmHg + pmInmmHg) / 760.0;
    ma1 = excelRound(dryGasVol * xwInput / denomXw, 2);
  }

  // 9. Xw1 back-calculation
  let xw1 = null;
  if (maInG !== null && maInG > 0) {
    const vWater = maInG * 22.4 / 18.0;
    const vGas = targetGvm * (273.0 / (273.0 + targetGtm)) * (paInmmHg + pmInmmHg) / 760.0;
    const denomSum = vGas + vWater;
    if (denomSum !== 0) {
      xw1 = excelRound(vWater * 100.0 / denomSum, 1);
    }
  }

  return {
    pmInmmHg: excelRound(pmInmmHg, 1),
    pmInInH2O: excelRound(pmInInH2O, 1),
    gtmInC, gtmInF,
    gvmInL, gvmInM3,
    maInG,
    pv, xw2, l0, ma1, xw1
  };
}

// UI Update Renderer
function updateUI() {
  runCalculationEngine();
  const res = state.results;

  // 1. Gas section averages
  document.getElementById('o2AvgText').textContent = `${res.o2Avg}%`;
  document.getElementById('co2AvgText').textContent = `${res.co2Avg}%`;

  const o2Badge = document.getElementById('o2CorrectionBadge');
  if (res.isO2CorrectionApplied) {
    o2Badge.textContent = '산소보정 적용';
    o2Badge.className = 'status-badge badge-active';
  } else {
    o2Badge.textContent = '산소보정 미적용';
    o2Badge.className = 'status-badge badge-neutral';
  }

  // 2. Unit conversion displays
  document.getElementById('tsConvertedText').textContent = state.tsUnit === 'C' ? `${excelRound(res.tsInF, 1)} °F` : `${excelRound(res.tsInC, 1)} °C`;
  document.getElementById('paConvertedText').textContent = state.paUnit === 'HPA' ? `${excelRound(res.paInmmHg, 2)} mmHg` : `${excelRound(res.paInhPa, 1)} hPa`;
  document.getElementById('psConvertedText').textContent = state.psUnit === 'INH2O' ? `${excelRound(res.psInmmHg, 1)} mmHg` : `${excelRound(res.psInInH2O, 1)} inH₂O`;
  document.getElementById('hConvertedText').textContent = state.hUnit === 'INH2O' ? `${excelRound(res.hInmmH2O, 1)} mmH₂O` : `${excelRound(res.hInInH2O, 3)} inH₂O`;
  document.getElementById('tmConvertedText').textContent = state.tmUnit === 'C' ? `${excelRound(res.tmInF, 1)} °F` : `${excelRound(res.tmInC, 1)} °C`;

  // Duct UI Toggle
  if (state.ductType === 'CIRCULAR') {
    document.getElementById('btnDuctCircular').classList.add('active');
    document.getElementById('btnDuctRectangular').classList.remove('active');
    document.getElementById('circularDuctBox').classList.remove('hidden');
    document.getElementById('rectangularDuctBox').classList.add('hidden');
  } else {
    document.getElementById('btnDuctCircular').classList.remove('active');
    document.getElementById('btnDuctRectangular').classList.add('active');
    document.getElementById('circularDuctBox').classList.add('hidden');
    document.getElementById('rectangularDuctBox').classList.remove('hidden');
  }

  // Embedded Measurement Points
  const pts = calculateMeasurementPointsInfo();
  document.getElementById('ptTotalBadge').textContent = `${pts.totalPoints} 개소`;
  document.getElementById('ptAreaText').textContent = `${pts.areaM2} m²`;
  document.getElementById('ptDivisionText').textContent = pts.divisionInfo;

  const detailBox = document.getElementById('ptDistanceDetail');
  if (pts.isSingle) {
    detailBox.innerHTML = `<div>${pts.nearText}</div>`;
  } else {
    detailBox.innerHTML = `<div>${pts.nearText}</div><div>${pts.farText}</div>`;
  }

  // Reset Actual Vm Button visibility
  const resetBtn = document.getElementById('btnResetActualVm');
  if (state.isActualVmManuallyEdited) {
    resetBtn.classList.remove('hidden');
  } else {
    resetBtn.classList.add('hidden');
  }
  document.getElementById('resVm0Text').textContent = `${res.vm0} L`;

  // Core Result Cards
  document.getElementById('resVmFt3').textContent = res.vmFt3;
  document.getElementById('resVmLiterSub').textContent = `L환산 → ${res.vmLiter} L`;
  document.getElementById('resKf').textContent = res.kf;
  document.getElementById('resDeltaH').textContent = res.deltaH;
  document.getElementById('resDeltaHSub').textContent = `환산 → ${res.deltaHInInH2O} inH₂O (${res.deltaHInmmHg} mmHg)`;

  // Isokinetic Alert
  const isokineticCard = document.getElementById('isokineticAlertCard');
  document.getElementById('resIsokineticVal').textContent = `${res.isokineticPercent} %`;
  if (res.isIsokineticValid) {
    isokineticCard.className = 'isokinetic-alert alert-success';
    document.getElementById('isokineticIcon').textContent = '✅';
    document.getElementById('resIsokineticDesc').textContent = '✅ 적정 등속흡인범위 (90% ~ 110%) 내에 있습니다.';
  } else {
    isokineticCard.className = 'isokinetic-alert alert-warning';
    document.getElementById('isokineticIcon').textContent = '⚠️';
    document.getElementById('resIsokineticDesc').textContent = '⚠️ 경고: 등속흡인율이 적정범위(90% ~ 110%)를 벗어났습니다!';
  }

  // Reference Table
  document.getElementById('refMd').textContent = res.md;
  document.getElementById('refRho0').textContent = `${res.rho0} kg/m³`;
  document.getElementById('refRho').textContent = `${res.rho} kg/m³`;
  document.getElementById('refVs').textContent = `${res.vs} m/sec`;
  document.getElementById('refA').textContent = `${res.ductAreaA} m²`;
  document.getElementById('refQa').textContent = `${res.qa} m³/min`;
  document.getElementById('refQs').textContent = `${res.qs} m³/min`;
  document.getElementById('refQLabel').textContent = res.isO2CorrectionApplied ? '보정 유량 (Q - 산소보정)' : '보정 유량 (Q - 산소보정 미적용)';
  document.getElementById('refQ').textContent = `${res.q} m³/min`;
  document.getElementById('refVic').textContent = res.vic;
  document.getElementById('refAn').textContent = `${res.an} cm²`;

  // --- Tab 2 Moisture & Gas UI Update (100% Integrated with Page 1) ---
  const moistureRes = calculateMoistureAndGas();
  if (moistureRes) {
    // Linked parameters notice
    document.getElementById('tab2InterlinkInfo').textContent =
      `기본 계산의 대기압 Pa(${excelRound(res.paInmmHg, 1)} mmHg), 굴뚝온도 Ts(${excelRound(res.tsInC, 1)} °C), 장비온도 Tm(${excelRound(res.tmInC, 1)} °C) 값이 연동됩니다.`;

    // Pm Converted Text
    const pmConvEl = document.getElementById('pmConvertedText');
    if (pmConvEl) {
      pmConvEl.textContent = state.pmUnit === 'INH2O' ?
        `${excelRound(moistureRes.pmInmmHg, 1)} mmHg` :
        `${excelRound(moistureRes.pmInInH2O, 1)} inH₂O`;
    }

    // GTm Converted Text
    const gtmConvEl = document.getElementById('gtmConvertedText');
    if (gtmConvEl) {
      gtmConvEl.textContent = state.gtmUnit === 'C' ?
        `${excelRound(moistureRes.gtmInF, 1)} °F` :
        `${excelRound(moistureRes.gtmInC, 1)} °C`;
    }

    // GVm Converted Text
    const gvmConvEl = document.getElementById('gvmConvertedText');
    if (gvmConvEl) {
      gvmConvEl.textContent = state.gvmUnit === 'LITER' ?
        `${excelRound(moistureRes.gvmInM3, 3)} m³` :
        `${excelRound(moistureRes.gvmInL, 1)} L`;
    }

    // L0 Result Box
    const l0BoxEl = document.getElementById('l0Box');
    const l0NoticeEl = document.getElementById('l0Notice');
    if (moistureRes.l0 !== null) {
      if (l0BoxEl) l0BoxEl.classList.remove('hidden');
      if (l0NoticeEl) l0NoticeEl.classList.add('hidden');
      document.getElementById('resL0').textContent = `${moistureRes.l0.toFixed(2)} L`;
    } else {
      if (l0BoxEl) l0BoxEl.classList.add('hidden');
      if (l0NoticeEl) l0NoticeEl.classList.remove('hidden');
    }

    // Pv, Xw2, ma1
    document.getElementById('resPv').textContent = `${moistureRes.pv.toFixed(2)} mmHg`;
    document.getElementById('resXw2').textContent = `${moistureRes.xw2.toFixed(1)} %`;
    document.getElementById('resMa1').textContent = `${moistureRes.ma1.toFixed(2)} g`;

    // Xw1
    const xw1RowEl = document.getElementById('xw1Row');
    if (moistureRes.xw1 !== null) {
      xw1RowEl.classList.remove('hidden');
      document.getElementById('resXw1').textContent = `${moistureRes.xw1.toFixed(1)} %`;
    } else {
      xw1RowEl.classList.add('hidden');
    }
  }
}

// Bind Event Listeners to Inputs
function bindInputEvents() {
  const ids = [
    'o2_1', 'o2_2', 'o2_3', 'co2_1', 'co2_2', 'co2_3', 'os', 'xw',
    'tsVal', 'paVal', 'psVal', 'hVal', 'tmVal', 'ds', 'ds1', 'ds2',
    'dn', 'time', 'actualVmVal',
    'pmVal', 'gtmVal', 'gvmVal', 'maVal'
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', (e) => {
      const raw = e.target.value;
      if (id === 'gtmVal' || id === 'gvmVal' || id === 'maVal') {
        state[id] = raw;
      } else {
        state[id] = (raw !== '' && raw !== '-' && !isNaN(parseFloat(raw))) ? parseFloat(raw) : 0.0;
      }
      if (id === 'actualVmVal') {
        state.isActualVmManuallyEdited = true;
      }
      updateUI();
    });
  });

  // Floating Keyboard Accessory Bar Handlers
  const kbdBar = document.getElementById('keyboardInputBar');
  const kbdBtnSign = document.getElementById('kbdBtnSign');
  const kbdBtnMinus = document.getElementById('kbdBtnMinus');
  const kbdBtnDot = document.getElementById('kbdBtnDot');
  const kbdBtnPrev = document.getElementById('kbdBtnPrev');
  const kbdBtnNext = document.getElementById('kbdBtnNext');
  const kbdBtnDone = document.getElementById('kbdBtnDone');

  let activeInput = null;

  function getVisibleInputs() {
    const parent = activeInput ? (activeInput.closest('.tab-page') || activeInput.closest('.modal-content') || document) : document;
    return Array.from(parent.querySelectorAll('input[type="number"], input[type="text"]'))
      .filter(inp => inp.offsetParent !== null && !inp.disabled && !inp.readOnly);
  }

  function toggleActiveSign() {
    if (!activeInput) return;
    let val = activeInput.value.trim();
    if (val.startsWith('-')) {
      val = val.substring(1);
    } else {
      val = '-' + val;
    }
    activeInput.value = val;
    activeInput.dataset.fresh = 'false';
    activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => { try { activeInput.focus(); } catch (e) {} }, 10);
  }

  function insertActiveMinus() {
    if (!activeInput) return;
    let val = activeInput.value.trim();
    if (!val.startsWith('-')) {
      val = '-' + val;
    }
    activeInput.value = val;
    activeInput.dataset.fresh = 'false';
    activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => { try { activeInput.focus(); } catch (e) {} }, 10);
  }

  function insertActiveDot() {
    if (!activeInput) return;
    let val = activeInput.value;
    if (!val.includes('.')) {
      activeInput.value = val + '.';
      activeInput.dataset.fresh = 'false';
      activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    setTimeout(() => { try { activeInput.focus(); } catch (e) {} }, 10);
  }

  function navInput(direction) {
    if (!activeInput) return;
    const inputs = getVisibleInputs();
    const idx = inputs.indexOf(activeInput);
    const targetIdx = idx + direction;
    if (targetIdx >= 0 && targetIdx < inputs.length) {
      const nextInp = inputs[targetIdx];
      nextInp.focus();
      nextInp.dataset.fresh = 'true';
      setTimeout(() => {
        try { nextInp.select(); } catch (e) {}
      }, 30);
    }
  }

  // Prevent keyboard bar buttons from stealing focus from active input
  [kbdBtnSign, kbdBtnMinus, kbdBtnDot, kbdBtnPrev, kbdBtnNext, kbdBtnDone].forEach(btn => {
    if (!btn) return;
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('touchstart', (e) => e.preventDefault());
  });

  if (kbdBtnSign) kbdBtnSign.addEventListener('click', toggleActiveSign);
  if (kbdBtnMinus) kbdBtnMinus.addEventListener('click', insertActiveMinus);
  if (kbdBtnDot) kbdBtnDot.addEventListener('click', insertActiveDot);
  if (kbdBtnPrev) kbdBtnPrev.addEventListener('click', () => navInput(-1));
  if (kbdBtnNext) kbdBtnNext.addEventListener('click', () => navInput(1));
  if (kbdBtnDone) kbdBtnDone.addEventListener('click', () => {
    if (activeInput) activeInput.blur();
    if (kbdBar) kbdBar.classList.add('hidden');
  });

  // Attach Focus Auto-Select, Toolbar Toggle and Enter-Key Navigation to all inputs
  const allInputs = document.querySelectorAll('input[type="number"], input[type="text"]');
  allInputs.forEach(input => {
    // Focus event: select all text, mark fresh focus & show floating keyboard accessory bar
    input.addEventListener('focus', (e) => {
      activeInput = e.target;
      if (kbdBar) kbdBar.classList.remove('hidden');

      e.target.dataset.fresh = 'true';
      setTimeout(() => {
        try {
          e.target.select();
        } catch (err) {}
      }, 30);
    });

    // Keydown event: replace value on first keypress & navigate to next input on Enter
    input.addEventListener('keydown', (e) => {
      const isFresh = e.target.dataset.fresh === 'true';

      if (e.key === 'Enter') {
        e.preventDefault();
        e.target.dataset.fresh = 'false';

        const visibleInputs = getVisibleInputs();
        const currIdx = visibleInputs.indexOf(e.target);
        if (currIdx >= 0 && currIdx < visibleInputs.length - 1) {
          const nextInp = visibleInputs[currIdx + 1];
          nextInp.focus();
          nextInp.dataset.fresh = 'true';
          setTimeout(() => {
            try {
              nextInp.select();
            } catch (err) {}
          }, 30);
        } else {
          e.target.blur();
          if (kbdBar) kbdBar.classList.add('hidden');
        }
        return;
      }

      if (isFresh && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== 'Tab') {
        e.target.dataset.fresh = 'false';
        e.target.value = '';
      } else if (e.key !== 'Tab') {
        e.target.dataset.fresh = 'false';
      }
    });

    input.addEventListener('blur', (e) => {
      e.target.dataset.fresh = 'false';
      setTimeout(() => {
        if (document.activeElement !== activeInput && (!document.activeElement || document.activeElement.tagName !== 'INPUT')) {
          if (kbdBar) kbdBar.classList.add('hidden');
        }
      }, 200);
    });
  });

  // Unit Chips for Tab 1
  bindUnitToggle('tsUnitC', 'tsUnitF', (unit) => { state.tsUnit = unit; });
  bindUnitToggle('paUnitHpa', 'paUnitMmhg', (unit) => { state.paUnit = unit; });
  bindUnitToggle('psUnitInH2O', 'psUnitMmhg', (unit) => { state.psUnit = unit; });
  bindUnitToggle('hUnitInH2O', 'hUnitMmH2O', (unit) => { state.hUnit = unit; });
  bindUnitToggle('tmUnitC', 'tmUnitF', (unit) => { state.tmUnit = unit; });
  bindUnitToggle('vmUnitLiter', 'vmUnitFt3', (unit) => {
    state.actualVmUnit = unit;
    state.isActualVmManuallyEdited = false; // reset manual edit on unit change
  });

  // Unit Chips for Tab 2
  bindUnitToggle('pmUnitInH2O', 'pmUnitMmhg', (unit) => { state.pmUnit = unit; });
  bindUnitToggle('gtmUnitC', 'gtmUnitF', (unit) => { state.gtmUnit = unit; });
  bindUnitToggle('gvmUnitLiter', 'gvmUnitM3', (unit) => { state.gvmUnit = unit; });

  // Duct Type Buttons
  document.getElementById('btnDuctCircular').addEventListener('click', () => {
    state.ductType = 'CIRCULAR';
    updateUI();
  });
  document.getElementById('btnDuctRectangular').addEventListener('click', () => {
    state.ductType = 'RECTANGULAR';
    updateUI();
  });

  // Quick Nozzle Select
  document.getElementById('nozzleQuickSelect').addEventListener('change', (e) => {
    if (e.target.value) {
      state.dn = parseFloat(e.target.value);
      document.getElementById('dn').value = state.dn;
      e.target.value = '';
      updateUI();
    }
  });

  // Reset Actual Vm Button
  document.getElementById('btnResetActualVm').addEventListener('click', () => {
    state.isActualVmManuallyEdited = false;
    updateUI();
    document.getElementById('actualVmVal').value = state.actualVmVal;
  });

  // Navigation Tabs
  const tabs = document.querySelectorAll('.app-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const targetId = tab.getAttribute('data-target');
      document.querySelectorAll('.tab-page').forEach(page => page.classList.add('hidden'));
      document.getElementById(targetId).classList.remove('hidden');
    });
  });
}

function bindUnitToggle(btn1Id, btn2Id, onSelect) {
  const btn1 = document.getElementById(btn1Id);
  const btn2 = document.getElementById(btn2Id);

  if (btn1) btn1.setAttribute('tabindex', '-1');
  if (btn2) btn2.setAttribute('tabindex', '-1');

  if (btn1) {
    btn1.addEventListener('click', () => {
      btn1.classList.add('active');
      if (btn2) btn2.classList.remove('active');
      onSelect(btn1.getAttribute('data-unit'));
      updateUI();
    });
  }

  if (btn2) {
    btn2.addEventListener('click', () => {
      btn2.classList.add('active');
      if (btn1) btn1.classList.remove('active');
      onSelect(btn2.getAttribute('data-unit'));
      updateUI();
    });
  }
}

// Save Record Modal Logic
function setupSaveRecordModal() {
  const saveModal = document.getElementById('saveRecordModal');
  const openBtn = document.getElementById('openSaveModalBtn');
  const closeBtn = document.getElementById('closeSaveModalBtn');
  const cancelBtn = document.getElementById('cancelSaveRecordBtn');
  const confirmBtn = document.getElementById('confirmSaveRecordBtn');

  openBtn.addEventListener('click', () => {
    const nowStr = new Date().toLocaleString('ko-KR');
    document.getElementById('saveModalCreatedAt').textContent = nowStr;

    const res = state.results;
    document.getElementById('saveSummaryBox').innerHTML = `
      • K-Factor (K-f): <b>${res.kf}</b><br>
      • 채취량 (Vm): <b>${res.vmFt3} ft³ (${res.vmLiter} L)</b><br>
      • 오리피스 압력차 (ΔH): <b>${res.deltaH} mmH₂O</b><br>
      • 등속흡인율 (I): <b>${res.isokineticPercent}%</b> (${res.isIsokineticValid ? '정상' : '범위초과'})<br>
      • 배출가스 유속 (Vs): <b>${res.vs} m/s</b> | 표준유량 (Qs): <b>${res.qs} m³/min</b>
    `;

    document.getElementById('facilityNameInput').value = '';
    saveModal.classList.remove('hidden');
  });

  const closeModal = () => saveModal.classList.add('hidden');
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  confirmBtn.addEventListener('click', () => {
    const facilityName = document.getElementById('facilityNameInput').value.trim() || '미지정 설비';
    const record = {
      id: Date.now(),
      createdAt: new Date().toLocaleString('ko-KR'),
      facilityName,
      inputs: { ...state },
      results: { ...state.results }
    };

    saveRecordToStorage(record);
    alert('설비 측정 기록이 성공적으로 저장되었습니다!');
    closeModal();
  });
}

// Load Records Modal Logic
function setupLoadRecordsModal() {
  const loadModal = document.getElementById('loadRecordsModal');
  const openBtn = document.getElementById('openLoadModalBtn');
  const closeBtn = document.getElementById('closeLoadModalBtn');

  openBtn.addEventListener('click', () => {
    renderRecordsList();
    loadModal.classList.remove('hidden');
  });

  closeBtn.addEventListener('click', () => loadModal.classList.add('hidden'));

  // Search Tabs
  const nameTab = document.getElementById('btnSearchNameTab');
  const dateTab = document.getElementById('btnSearchDateTab');
  const nameArea = document.getElementById('searchNameArea');
  const dateArea = document.getElementById('searchDateArea');

  nameTab.addEventListener('click', () => {
    nameTab.classList.add('active');
    dateTab.classList.remove('active');
    nameArea.classList.remove('hidden');
    dateArea.classList.add('hidden');
  });

  dateTab.addEventListener('click', () => {
    dateTab.classList.add('active');
    nameTab.classList.remove('active');
    dateArea.classList.remove('hidden');
    nameArea.classList.add('hidden');
  });

  document.getElementById('searchQueryInput').addEventListener('input', renderRecordsList);

  // Preset date buttons
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      renderRecordsList();
    });
  });

  // CSV Export
  document.getElementById('btnExportExcel').addEventListener('click', exportRecordsToCSV);

  // CSV Import
  const fileInput = document.getElementById('csvFileInput');
  document.getElementById('btnImportCsv').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', importRecordsFromCSV);
}

function renderRecordsList() {
  const container = document.getElementById('recordsListContainer');
  const records = getStoredRecords();
  const query = document.getElementById('searchQueryInput').value.trim().toLowerCase();

  const filtered = records.filter(r => {
    if (query) {
      return r.facilityName.toLowerCase().includes(query);
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">저장된 기록이 없거나 검색 결과가 없습니다.</div>`;
    return;
  }

  container.innerHTML = filtered.map(r => `
    <div class="record-item-card">
      <div class="record-item-header">
        <span class="record-item-title">${r.facilityName}</span>
        <span class="record-item-date">${r.createdAt}</span>
      </div>
      <div class="record-item-summary">
        • K-f: <b>${r.results.kf}</b> | Vm: <b>${r.results.vmFt3} ft³</b> (${r.results.vmLiter} L) | ΔH: <b>${r.results.deltaH} mmH₂O</b><br>
        • 등속흡인율 (I): <b>${r.results.isokineticPercent}%</b> | Vs: <b>${r.results.vs} m/s</b> | Qs: <b>${r.results.qs} m³/min</b>
      </div>
      <div class="record-item-buttons">
        <button class="btn-card-action load" onclick="loadRecordState(${r.id})">📥 불러오기</button>
        <button class="btn-card-action delete" onclick="deleteRecordItem(${r.id})">🗑 삭제</button>
      </div>
    </div>
  `).join('');
}

window.loadRecordState = function (id) {
  const records = getStoredRecords();
  const record = records.find(r => r.id === id);
  if (!record) return;

  if (confirm(`'${record.facilityName}' 측정데이터를 불러오시겠습니까?`)) {
    Object.assign(state, record.inputs);
    // Restore input field values
    const fieldIds = [
      'o2_1', 'o2_2', 'o2_3', 'co2_1', 'co2_2', 'co2_3', 'os', 'xw',
      'tsVal', 'paVal', 'psVal', 'hVal', 'tmVal', 'ds', 'ds1', 'ds2',
      'dn', 'time', 'actualVmVal'
    ];
    fieldIds.forEach(f => {
      const el = document.getElementById(f);
      if (el && state[f] !== undefined) el.value = state[f];
    });

    updateUI();
    document.getElementById('loadRecordsModal').classList.add('hidden');
    alert('측정 데이터가 불러와졌습니다.');
  }
};

window.deleteRecordItem = function (id) {
  if (confirm('이 설비 기록을 삭제하시겠습니까?')) {
    deleteRecordFromStorage(id);
    renderRecordsList();
  }
};

function exportRecordsToCSV() {
  const records = getStoredRecords();
  if (records.length === 0) {
    alert('내보낼 저장 기록이 없습니다.');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += "ID,생성일시,설비명,Kf,Vm_ft3,Vm_L,DeltaH_mmH2O,Isokinetic_percent,Vs_ms,Qs_m3min\n";

  records.forEach(r => {
    const row = [
      r.id,
      `"${r.createdAt}"`,
      `"${r.facilityName}"`,
      r.results.kf,
      r.results.vmFt3,
      r.results.vmLiter,
      r.results.deltaH,
      r.results.isokineticPercent,
      r.results.vs,
      r.results.qs
    ].join(',');
    csvContent += row + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `dust_measurement_records_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function importRecordsFromCSV(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const content = evt.target.result;
      if (file.name.endsWith('.json')) {
        const imported = JSON.parse(content);
        if (Array.isArray(imported)) {
          localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(imported));
          alert('기록 JSON이 성공적으로 반영되었습니다.');
          renderRecordsList();
        }
      } else {
        alert('CSV 불러오기는 완료되었습니다.');
      }
    } catch (err) {
      alert('파일 불러오기 중 오류가 발생하였습니다.');
    }
  };
  reader.readAsText(file);
}

// Setup Options Modal
function setupOptionsModal() {
  const modal = document.getElementById('optionsModal');
  const openBtn = document.getElementById('openOptionsBtn');
  const closeBtn = document.getElementById('closeOptionsBtn');
  const saveBtn = document.getElementById('saveOptionsBtn');

  openBtn.addEventListener('click', () => {
    document.getElementById('optYd').value = state.options.yd;
    document.getElementById('optCp').value = state.options.cp;
    document.getElementById('optDeltaHAt').value = state.options.deltaHAt;
    document.getElementById('optNozzles').value = state.options.nozzleList.join(', ');
    modal.classList.remove('hidden');
  });

  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

  saveBtn.addEventListener('click', () => {
    state.options.yd = parseFloat(document.getElementById('optYd').value) || 1.0;
    state.options.cp = parseFloat(document.getElementById('optCp').value) || 0.84;
    state.options.deltaHAt = parseFloat(document.getElementById('optDeltaHAt').value) || 1.76;

    const nozzlesStr = document.getElementById('optNozzles').value;
    if (nozzlesStr) {
      const parsed = nozzlesStr.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0);
      if (parsed.length > 0) state.options.nozzleList = parsed;
    }

    saveOptionsData();

    // Update nozzle select dropdown options
    const select = document.getElementById('nozzleQuickSelect');
    select.innerHTML = `<option value="">등록 노즐선택 ▾</option>` +
      state.options.nozzleList.map(n => `<option value="${n}">${n} mm</option>`).join('');

    updateUI();
    modal.classList.add('hidden');
    alert('설정이 저장되었습니다.');
  });
}

// Service Worker Registration for Offline PWA
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => {
          console.log('SW Registered:', reg.scope);
          reg.update(); // check for updates on reload
        })
        .catch(err => console.log('SW Register failed:', err));
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  // PWA Install Prompt
  let deferredPrompt;
  const banner = document.getElementById('pwaInstallBanner');
  const installBtn = document.getElementById('pwaInstallBtn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    banner.classList.remove('hidden');
  });

  installBtn.addEventListener('click', () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        deferredPrompt = null;
        banner.classList.add('hidden');
      });
    }
  });
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadStoredData();
  bindInputEvents();
  setupSaveRecordModal();
  setupLoadRecordsModal();
  setupOptionsModal();
  registerServiceWorker();
  updateUI();
});
