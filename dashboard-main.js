/* ============================================================================
   기업건강의학센터 | 업무 현황 대시보드 - main.js
   ----------------------------------------------------------------------------
   읽는 데이터(전역 변수, data/*.js 에서 정의됨):
     - KNX_DATA : KNX 발송 배열
     - REQ_DATA : 자료요청 회신 배열
     - HGC_DATA : 정기 전송(사후관리) 배열

   ⚠ 아래 표시(⚠)된 부분은 요구사항이 명확치 않아 임의로 정한 부분입니다.
     다르면 알려주시면 바로 수정할게요.
   ============================================================================ */

(() => {
  'use strict';

  // ============================================================
  // 0. 데이터 로드 & 상수
  // ============================================================
  const knxData = (typeof KNX_DATA !== 'undefined' && Array.isArray(KNX_DATA)) ? KNX_DATA : [];
  const reqData = (typeof REQ_DATA !== 'undefined' && Array.isArray(REQ_DATA)) ? REQ_DATA : [];
  const hgcData = (typeof HGC_DATA !== 'undefined' && Array.isArray(HGC_DATA)) ? HGC_DATA : [];

  // KNX/REQ items[9] 순서 - 표 헤더(세로,가로,뇌심,직무,정신,동의자,사업장양식,사이트,통계) 기준
  const ITEM_LABELS = ['세로', '가로', '뇌심', '직무', '정신', '동의자', '사업장양식', '사이트', '통계'];

  // ⚠ HGC items[4] 순서: 뇌심, 직무, 감정노동, 건진데이터 (사용자 확인 내용 그대로 적용)
  const HGC_ITEM_LABELS = ['뇌심', '직무', '감정노동', '건진데이터'];

  const today = new Date();
  const CURRENT_YEAR = today.getFullYear();
  const CURRENT_MONTH = today.getMonth() + 1;

  const PALETTE = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#14b8a6', '#eab308', '#ef4444', '#6366f1', '#ec4899'];

  const charts = {}; // Chart.js 인스턴스 캐시

  // 필터 상태 (섹션 B/C/D 공용)
  const filterState = { year: 'all', jongYe: 'all' };

  // 기타업무(비만/SWI/옴부즈만) - 세션 중 메모리 저장, JSON 내보내기/가져오기로 관리
  const etcData = { biman: [], swi: [], ombu: [] };
  const ETC_TYPES = [
    { key: 'biman', name: '비만 관리' },
    { key: 'swi', name: 'SWI' },
    { key: 'ombu', name: '옴부즈만' }
  ];

  let pendingDelete = null; // {type:'etc', kind, id} - 삭제 확인 모달용

  // [DEFERRED-STUBS] 새로 추가되면서 아직 미구현된 기능 플래그 (UI에는 렌더되되 동작은 stub)
  // 발송인별 업무량 통계 / 다음 정기 발송 D-day 알림 / 모바일 최적화 / JSON I/O 스키마 통일
  const DEFERRED_STUBS = { senderStats: false, ddayNotify: false, mobileOptimize: false, jsonSchema: false };

  // ============================================================
  // 1. 공용 유틸
  // ============================================================
  const $ = (id) => document.getElementById(id);
  const setText = (id, val) => { const e = $(id); if (e) e.textContent = val; };
  const fmt = (n) => (n || 0).toLocaleString('ko-KR');

  function byYear(arr, y) { return y === 'all' ? arr : arr.filter(d => Number(d.y) === Number(y)); }
  function byJongYe(arr, jy) { return jy === 'all' ? arr : arr.filter(d => d.jongYe === jy); }
  function applyFilter(arr) { return byJongYe(byYear(arr, filterState.year), filterState.jongYe); }

  function monthlyCounts(arr, dateField = 'm') {
    const m = Array(12).fill(0);
    arr.forEach(d => { const mo = Number(d[dateField]); if (mo >= 1 && mo <= 12) m[mo - 1]++; });
    return m;
  }

  function sumItems(arr, len = 9) {
    const s = Array(len).fill(0);
    arr.forEach(d => (d.items || []).forEach((v, i) => { if (i < len) s[i] += (typeof v === 'boolean' ? (v ? 1 : 0) : (Number(v) || 0)); }));
    return s;
  }

  function topNGroups(arr, field, n = 10) {
    const map = {};
    arr.forEach(d => { const k = d[field] || '(미상)'; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n);
  }

  // 비고/메모 텍스트를 구분자 기준 토큰화 후 빈도 Top N (요청 자료 Top10 차트용)
  // [P1-1] 데이터에 workplace 필드가 있으면 우선 사용, 없으면 group으로 폴백
  function getNameField(rawData) {
    const sample = rawData.find(d => d && (d.workplace || d.group));
    if (!sample) return 'group';
    return ('workplace' in sample) ? 'workplace' : 'group';
  }

  function tokenizeTop(arr, field, n = 10) {
    const map = {};
    arr.forEach(d => {
      const raw = d[field];
      if (!raw) return;
      String(raw).split(/[,\/·、\n]+/).map(s => s.trim()).filter(Boolean)
        .forEach(tok => { map[tok] = (map[tok] || 0) + 1; });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n);
  }

  function destroyChart(key) { if (charts[key]) { charts[key].destroy(); delete charts[key]; } }

  function barChart(canvasId, key, labels, data, color, horizontal = false) {
    const ctx = $(canvasId); if (!ctx) return;
    destroyChart(key);
    charts[key] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: color, borderRadius: 4 }] },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true }, y: { beginAtZero: true } }
      }
    });
  }

  function lineChart(canvasId, key, labels, datasets, extraOpts = {}) {
    const ctx = $(canvasId); if (!ctx) return;
    destroyChart(key);
    const yExtra = extraOpts.yMax ? { max: extraOpts.yMax, ticks: { callback: v => v + (extraOpts.yLabel || '') } } : {};
    charts[key] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: datasets.map((ds) => ({ tension: 0.3, borderWidth: 2, fill: false, ...ds })) },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: datasets.length > 1 } },
        scales: { y: Object.assign({ beginAtZero: true }, yExtra) }
      }
    });
  }

  function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // 2. 탭 전환
  // ============================================================
  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        const target = $(btn.dataset.tab);
        if (target) target.classList.add('active');
      });
    });
  }

  // ============================================================
  // 3. 헤더 상태 & 시계
  // ============================================================
  function initHeaderStatus() {
    const loaded = knxData.length || reqData.length || hgcData.length;
    const statusEl = $('dataStatus');
    if (statusEl) {
      statusEl.innerHTML = loaded
        ? '<span class="status-dot ok"></span> 데이터 로드됨'
        : '<span class="status-dot idle"></span> 데이터 미로드';
    }
    const tick = () => setText('currentTime', new Date().toLocaleString('ko-KR', { hour12: false }));
    tick(); setInterval(tick, 1000);

    setText('knxSheetStatus', knxData.length ? `${fmt(knxData.length)}건 로드됨` : '데이터 없음');
    setText('reqSheetStatus', reqData.length ? `${fmt(reqData.length)}건 로드됨` : '데이터 없음');

    setText('sheet1Count', fmt(knxData.length));
    setText('sheet1Status', knxData.length ? '정상' : '데이터 없음');
    setText('sheet2Count', fmt(reqData.length));
    setText('sheet2Status', reqData.length ? '정상' : '데이터 없음');
  }

  // ============================================================
  // 4. 연도 필터 버튼 동적 생성
  // ============================================================
  function initFilters() {
    const years = new Set();
    [...knxData, ...reqData].forEach(d => { if (d.y) years.add(Number(d.y)); });
    hgcData.forEach(d => { const yr = hgcRecordYear(d); if (yr) years.add(yr); });
    const sortedYears = [...years].sort((a, b) => b - a);

    const yearBox = $('visYearFilter');
    if (yearBox) {
      sortedYears.forEach(y => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn'; btn.dataset.year = y; btn.textContent = `${y}년`;
        yearBox.appendChild(btn);
      });
      yearBox.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn'); if (!btn) return;
        yearBox.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterState.year = btn.dataset.year;
        renderAll();
      });
    }

    const jyBox = $('visJyFilter');
    if (jyBox) {
      jyBox.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn'); if (!btn) return;
        jyBox.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterState.jongYe = btn.dataset.jy;
        renderAll();
      });
    }
  }

  // ============================================================
  // 5. 섹션 A: 정기 전송 (HGC_DATA 기반) - 사용자 제공 스펙 그대로 구현
  // ============================================================
  // 날짜 기준: periodStart ~ periodEnd (fileDate 사용 안 함)
  function hgcRecordYear(d) { return Number(((d.periodStart || '') + '').slice(0, 4)); }

  // 전역 연도/예종건 필터를 HGC_DATA에도 동일하게 적용
  function applyHgcFilter(arr) {
    return arr.filter(d => {
      const yearOk = filterState.year === 'all' || hgcRecordYear(d) === Number(filterState.year);
      const jyOk = filterState.jongYe === 'all' || d.jongYe === filterState.jongYe;
      return yearOk && jyOk;
    });
  }

  // 6개 고정 카테고리 (items = [뇌심, 직무, 감정노동, 건진데이터])
  const HGC_CATEGORIES = [
    { name: '사후관리소견서', match: () => true },
    { name: '뇌심·직무', match: (it) => it[0] || it[1] },
    { name: '뇌심', match: (it) => it[0] },
    { name: '직무', match: (it) => it[1] },
    { name: '감정노동', match: (it) => it[2] },
    { name: '건진데이터', match: (it) => it[3] }
  ];

  const fmtMD = (s) => { if (!s) return '-'; const [, m, d] = s.split('-'); return `${Number(m)}/${Number(d)}`; };
  const fmtSheetName = (s) => { if (!s) return '-'; const [, m, d] = s.split('-'); return `${Number(m)}.${Number(d)}`; };

  // periodStart+periodEnd 기준 그룹화(=엑셀 시트 1개), periodStart 내림차순 정렬
  function groupHgcByPeriod(arr) {
    const map = new Map();
    arr.forEach(d => {
      const key = `${d.periodStart}_${d.periodEnd}`;
      if (!map.has(key)) map.set(key, { periodStart: d.periodStart, periodEnd: d.periodEnd, records: [] });
      map.get(key).records.push(d);
    });
    return [...map.values()].sort((a, b) => (b.periodStart || '').localeCompare(a.periodStart || ''));
  }

  // 카테고리 하나에 대한 종건/예건 집계: total=target 수, complete=complete 수
  function summarizeCategory(records) {
    const hasComplete = records.some(d => d.status === 'complete');
    const statusText = records.length === 0 ? '-' : (hasComplete ? '발송완료' : '발송예정');
    const jyLines = [];
    ['종건', '예건'].forEach(jy => {
      const jyRecords = records.filter(d => d.jongYe === jy);
      const total = jyRecords.filter(d => d.status === 'target').length;
      const complete = jyRecords.filter(d => d.status === 'complete').length;
      if (total > 0) jyLines.push(complete > 0 ? `${jy} ${complete}/${total}` : `${jy} ${total}`);
    });
    return { statusText, workplaceText: jyLines.length ? jyLines.join('<br>') : '-' };
  }

  // 스펙대로 시트(기간)별 x 카테고리별 표 데이터 생성
  function buildHgcReportSheets(filteredRecords) {
    return groupHgcByPeriod(filteredRecords).map(group => {
      const periodText = `${fmtMD(group.periodStart)}~${fmtMD(group.periodEnd)}`;
      const rows = HGC_CATEGORIES.map(cat => {
        const matched = group.records.filter(d => cat.match(d.items || []));
        const { statusText, workplaceText } = summarizeCategory(matched);
        return { category: cat.name, periodText, workplaceText, statusText };
      });
      return { sheetName: `${fmtSheetName(group.periodStart)}-${fmtSheetName(group.periodEnd)}`, periodStart: group.periodStart, rows };
    });
  }

  function countByJongYe(arr) {
    return { 예건: arr.filter(d => d.jongYe === '예건').length, 종건: arr.filter(d => d.jongYe === '종건').length };
  }
  function jySubLabel(counts) {
    return `<span style="font-size:12px;color:var(--muted,#888)">예건 ${fmt(counts.예건)} / 종건 ${fmt(counts.종건)}</span>`;
  }
  // 카드 라벨 텍스트를 동적으로 교체 (값 요소 바로 앞 형제 요소에 "발송"이 포함되면 교체)
  function relabelKpi(valueId, newLabel) {
    const valEl = $(valueId);
    const labelEl = valEl && valEl.previousElementSibling;
    if (labelEl && /발송/.test(labelEl.textContent)) labelEl.textContent = newLabel;
  }

  function renderSectionA() {
    const filtered = applyHgcFilter(hgcData);
    const complete = filtered.filter(d => d.status === 'complete');
    const target = filtered.filter(d => d.status === 'target');

    // 총 발송 회차: 완료 건수(메인) + 대상 건수(괄호) + 예/종건 구분
    const totalEl = $('v_bw_total');
    if (totalEl) {
      totalEl.innerHTML = `${fmt(complete.length)} <span style="font-size:12px;color:var(--muted,#888)">(대상 ${fmt(target.length)})</span><br>${jySubLabel(countByJongYe(complete))}`;
    }

    // 사후관리소견서 = 전체 레코드, 뇌심·직무 = items[0]뇌심 또는 items[1]직무 (스펙과 동일한 필터)
    const sogyeonRows = complete;
    const sogyeonEl = $('v_bw_sogyeon');
    if (sogyeonEl) sogyeonEl.innerHTML = `${fmt(sogyeonRows.length)}<br>${jySubLabel(countByJongYe(sogyeonRows))}`;

    const noesimRows = complete.filter(d => (d.items || [])[0] || (d.items || [])[1]);
    const noesimEl = $('v_bw_noesim');
    if (noesimEl) noesimEl.innerHTML = `${fmt(noesimRows.length)}<br>${jySubLabel(countByJongYe(noesimRows))}`;

    // 최근 발송 데이터: 가장 최근 target 레코드의 대상기간(periodStart~periodEnd)
    const latestTarget = target.slice().sort((a, b) => (b.periodStart || '').localeCompare(a.periodStart || ''))[0];
    const dateRangeText = latestTarget ? `${latestTarget.periodStart || '-'} ~ ${latestTarget.periodEnd || '-'}` : '-';
    setText('v_bw_month', dateRangeText);
    relabelKpi('v_bw_month', '최근 발송 데이터');

    // 월별 정기 전송 현황 - 예건/종건 구분 그래프 (periodStart의 월 기준)
    const monthOf = (d) => Number(((d.periodStart || '') + '').split('-')[1]);
    const months12 = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const yeMonths = Array(12).fill(0), jgMonths = Array(12).fill(0);
    complete.forEach(d => {
      const mo = monthOf(d);
      if (mo >= 1 && mo <= 12) {
        if (d.jongYe === '예건') yeMonths[mo - 1]++;
        else if (d.jongYe === '종건') jgMonths[mo - 1]++;
      }
    });
    destroyChart('bwMonthly');
    const ctx = $('v_bwMonthlyChart');
    if (ctx) {
      charts.bwMonthly = new Chart(ctx, {
        type: 'bar',
        data: { labels: months12, datasets: [
          { label: '예건', data: yeMonths, backgroundColor: PALETTE[0], borderRadius: 4 },
          { label: '종건', data: jgMonths, backgroundColor: PALETTE[2], borderRadius: 4 }
        ] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } }, scales: { y: { beginAtZero: true } } }
      });
    }

    // 상단 "데이터 입력" 탭 미니 KPI도 동일 값으로 동기화 (2주 정기발송 수동 입력 폼은 HGC_DATA로 대체됨)
    setText('up_bw_total', fmt(complete.length));
    setText('up_bw_sogyeon', fmt(sogyeonRows.length));
    setText('up_bw_noesim', fmt(noesimRows.length));
    setText('up_bw_month', dateRangeText);
    relabelKpi('up_bw_month', '최근 발송 데이터');

    renderBiweeklyList(filtered);
  }

  // ============================================================
  // 6. 섹션 B/C 공용 렌더러 (KNX, 자료요청 구조 동일)
  // ============================================================
  function renderKpiSection(prefix, rawData, memoField) {
    const arr = applyFilter(rawData);
    const thisMonth = arr.filter(d => d.y === CURRENT_YEAR && d.m === CURRENT_MONTH);

    setText(`v_${prefix}_total`, fmt(arr.length));
    setText(`v_${prefix}_month`, fmt(thisMonth.length));
    // [P1-1] workplace 우선 집계, 없으면 group로 폴백
    const nameField = getNameField(rawData);
    setText(`v_${prefix}_clients`, fmt(new Set(arr.map(d => d[nameField])).size));
    setText(`v_${prefix}_items`, fmt(arr.reduce((s, d) => s + (Number(d.itemSum) || 0), 0)));

    const months = monthlyCounts(arr);
    barChart(`v_${prefix}MonthlyChart`, `${prefix}Monthly`,
      ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'], months, PALETTE[0]);

    // [P1-1] 주요 사업장 Top 10 (workplace 기준)
    const groups = topNGroups(arr, nameField, 10);
    barChart(`v_${prefix}GroupChart`, `${prefix}Group`, groups.map(g => g[0]), groups.map(g => g[1]), PALETTE[4], true);

    const items = sumItems(arr, 9);
    barChart(`v_${prefix}ItemChart`, `${prefix}Item`, ITEM_LABELS, items, PALETTE[2]);

    const memoTop = tokenizeTop(arr, memoField, 10);
    barChart(`v_${prefix}MemoChart`, `${prefix}Memo`, memoTop.map(m => m[0]), memoTop.map(m => m[1]), PALETTE[3], true);
  }

  // ============================================================
  // 7. 섹션 D: 종합 비교 (정기/KNX/자료요청 월별 통합)
  // ============================================================
  // [P1-6] 종합 비교 — 시리즈별 라벨 빈도 차이가 커서 단일 원시 라인 차트는 한 시리즈만 평평해짐.
  // 해결책 동시 적용:
  //   (A) small multiples — 각 시리즈 자기 y축으로 그려서 형태/계절성 비교
  //   (B) 정규화 라인 — 최댓값 = 100 기준 % 추이로 시리즈 간 상대 변동 비교 가능
  function renderCombined() {
    const knxArr = applyFilter(knxData);
    const reqArr = applyFilter(reqData);
    const hgcComplete = applyHgcFilter(hgcData).filter(d => d.status === 'complete');
    const hgcMonths = Array(12).fill(0);
    hgcComplete.forEach(d => { const mo = Number(((d.periodStart || '') + '').split('-')[1]); if (mo >= 1 && mo <= 12) hgcMonths[mo - 1]++; });
    const knxMonths = monthlyCounts(knxArr);
    const reqMonths = monthlyCounts(reqArr);
    const labels = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

    // (A) small multiples
    lineChart('v_sm_bw',  'sm_bw',  labels, [{ label: '정기',    data: hgcMonths, borderColor: PALETTE[1], borderWidth: 2 }]);
    lineChart('v_sm_knx', 'sm_knx', labels, [{ label: 'KNX',     data: knxMonths, borderColor: PALETTE[0], borderWidth: 2 }]);
    lineChart('v_sm_req', 'sm_req', labels, [{ label: '자료요청', data: reqMonths, borderColor: PALETTE[2], borderWidth: 2 }]);
    setText('v_sm_bw_max',  `최대 ${fmt(Math.max(...hgcMonths))}건`);
    setText('v_sm_knx_max', `최대 ${fmt(Math.max(...knxMonths))}건`);
    setText('v_sm_req_max', `최대 ${fmt(Math.max(...reqMonths))}건`);

    // (B) 정규화 추이 (각 최댓값 = 100)
    const norm = (m) => { const mx = Math.max(...m, 0); return mx ? m.map(v => Math.round((v / mx) * 100)) : m.slice(); };
    lineChart('v_combinedChart', 'combinedNorm',
      labels,
      [
        { label: '정기 발송 (정규화)',  data: norm(hgcMonths), borderColor: PALETTE[1], backgroundColor: PALETTE[1] + '22', fill: true, borderWidth: 2 },
        { label: 'KNX (정규화)',         data: norm(knxMonths), borderColor: PALETTE[0], backgroundColor: PALETTE[0] + '22', fill: true, borderWidth: 2 },
        { label: '자료요청 (정규화)',     data: norm(reqMonths), borderColor: PALETTE[2], backgroundColor: PALETTE[2] + '22', fill: true, borderWidth: 2 }
      ],
      { yMax: 100, yLabel: '%' });
  }

  // ============================================================
  // 8. 데이터 입력 탭 - KNX/자료요청 상세 테이블 (검색 + 페이지네이션)
  // ============================================================
  const tableState = {
    knx: { page: 1, size: 20, q: '' },
    req: { page: 1, size: 20, q: '' }
  };

  function knxRowHTML(d) {
    const items = d.items || [];
    return `<tr>
      <td>${d.date || '-'}</td><td>${d.jongYe || '-'}</td><td>${d.workplace || '-'}</td><td>${d.group || '-'}</td>
      ${ITEM_LABELS.map((_, i) => `<td>${items[i] || 0}</td>`).join('')}
      <td><strong>${d.itemSum || 0}</strong></td><td>${d.provType || '-'}</td><td>${d.staff || '-'}</td><td>${d.memo || ''}</td>
    </tr>`;
  }
  function reqRowHTML(d) {
    const items = d.items || [];
    return `<tr>
      <td>${d.date || '-'}</td><td>${d.jongYe || '-'}</td><td>${d.workplace || '-'}</td><td>${d.group || '-'}</td>
      ${ITEM_LABELS.map((_, i) => `<td>${items[i] || 0}</td>`).join('')}
      <td><strong>${d.itemSum || 0}</strong></td><td>${d.sender || '-'}</td><td>${d.note || ''}</td>
    </tr>`;
  }

  function filterBySearch(arr, q) {
    if (!q) return arr;
    const s = q.toLowerCase();
    return arr.filter(d => [d.workplace, d.group, d.staff, d.sender, d.memo, d.note]
      .some(v => v && String(v).toLowerCase().includes(s)));
  }

  function renderDetailTable(type) {
    const raw = type === 'knx' ? knxData : reqData;
    const st = tableState[type];
    const filtered = filterBySearch(raw, st.q).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const totalPages = Math.max(1, Math.ceil(filtered.length / st.size));
    st.page = Math.min(st.page, totalPages);
    const pageItems = filtered.slice((st.page - 1) * st.size, st.page * st.size);

    const tbody = $(`${type}TableBody`);
    const colCount = type === 'knx' ? 17 : 16;
    if (tbody) {
      tbody.innerHTML = pageItems.length
        ? pageItems.map(type === 'knx' ? knxRowHTML : reqRowHTML).join('')
        : `<tr><td colspan="${colCount}"><div class="empty-state sm"><i class="fas fa-search"></i><p>결과 없음</p></div></td></tr>`;
    }
    setText(`${type}RowCount`, `${fmt(filtered.length)}건`);
    renderPagination(`${type}Pagination`, st.page, totalPages, (p) => { st.page = p; renderDetailTable(type); });
  }

  function renderPagination(containerId, page, totalPages, onGo) {
    const box = $(containerId); if (!box) return;
    if (totalPages <= 1) { box.innerHTML = ''; return; }
    let html = '';
    const mk = (p, label, active, disabled) =>
      `<button class="page-btn${active ? ' active' : ''}" ${disabled ? 'disabled' : ''} data-page="${p}">${label}</button>`;
    html += mk(page - 1, '‹', false, page <= 1);
    const start = Math.max(1, page - 2), end = Math.min(totalPages, page + 2);
    for (let p = start; p <= end; p++) html += mk(p, p, p === page, false);
    html += mk(page + 1, '›', false, page >= totalPages);
    box.innerHTML = html;
    box.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => { if (!btn.disabled) onGo(Number(btn.dataset.page)); });
    });
  }

  function initDetailTables() {
    ['knx', 'req'].forEach(type => {
      const search = $(`${type}Search`);
      if (search) search.addEventListener('input', () => {
        tableState[type].q = search.value.trim(); tableState[type].page = 1; renderDetailTable(type);
      });
      renderDetailTable(type);
    });
  }

  // ============================================================
  // 9. 데이터 입력 탭 - 정기 발송 목록(HGC_DATA 표시, 입력폼은 비활성화)
  // ============================================================
  // DOM 구조 변경(폼 숨김, 표 헤더 교체)은 최초 1회만 수행
  function initBiweeklySection() {
    const form = $('biweeklyForm');
    if (form) {
      form.style.display = 'none';
      const note = document.createElement('div');
      note.className = 'empty-state sm';
      note.innerHTML = '<i class="fas fa-info-circle"></i><p>정기 전송 데이터는 이제 HGC 데이터로 자동 집계됩니다.</p>';
      form.parentNode.insertBefore(note, form);
    }
    const tbody = $('biweeklyTableBody');
    const theadRow = tbody && tbody.closest('table') ? tbody.closest('table').querySelector('thead tr') : null;
    if (theadRow) {
      theadRow.innerHTML = '<th>발송항목</th><th>대상기간</th><th>대상 사업장</th><th>진행상태</th>';
    }
  }

  // 필터 변경 시마다 재호출 - R 엑셀 리포트와 동일한 형식(기간별 시트 → 카테고리별 1행)
  function renderBiweeklyList(filtered) {
    const sheets = buildHgcReportSheets(filtered);
    const tbody = $('biweeklyTableBody');
    let rowCount = 0;
    if (tbody) {
      let html = '';
      sheets.forEach(sheet => {
        sheet.rows.forEach((r, i) => {
          rowCount++;
          const color = r.statusText === '발송완료' ? 'var(--green,#22c55e)'
            : r.statusText === '발송예정' ? 'var(--orange,#f97316)' : 'var(--muted,#888)';
          // 시트(기간)가 바뀌는 첫 행에 구분선을 넣어 시트 단위를 시각적으로 구분
          const dividerStyle = i === 0 ? ' style="border-top:2px solid var(--border,#ddd)"' : '';
          html += `<tr${dividerStyle}>
            <td>${r.category}</td>
            <td>${r.periodText}</td>
            <td>${r.workplaceText}</td>
            <td><span style="color:${color}">${r.statusText}</span></td>
          </tr>`;
        });
      });
      tbody.innerHTML = html || '<tr><td colspan="4"><div class="empty-state sm"><i class="fas fa-inbox"></i><p>데이터 없음</p></div></td></tr>';
    }
    setText('bwRowCount', `${fmt(rowCount)}건`);
  }

  // ============================================================
  // 10. 기타 업무 탭 (비만/SWI/옴부즈만) - 직접 입력 + JSON 내보내기/가져오기
  // ============================================================
  function etcMonthly(arr) {
    const m = Array(12).fill(0);
    arr.forEach(d => { if (d.m >= 1 && d.m <= 12) m[d.m - 1] += (Number(d.count) || 0); });
    return m;
  }

  function renderEtc(key) {
    const arr = etcData[key];
    const tbody = $(`${key}TableBody`);
    if (tbody) {
      tbody.innerHTML = arr.length ? arr.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(d => `
        <tr>
          <td>${d.date}</td><td>${d.workplace || '-'}</td><td>${d.jongYe || '-'}</td><td>${d.count}</td><td>${d.note || ''}</td>
          <td><button class="btn-icon danger" data-del="${key}:${d.id}"><i class="fas fa-trash-alt"></i></button></td>
        </tr>`).join('') : '<tr><td colspan="6"><div class="empty-state sm"><i class="fas fa-plus-circle"></i><p>입력해 주세요</p></div></td></tr>';
    }
    const total = arr.reduce((s, d) => s + (Number(d.count) || 0), 0);
    setText(`${key}RowCount`, `${fmt(arr.length)}건`);
    setText(`etc_${key}_total_inline`, `${fmt(total)}건`);
    setText(`etc_kpi_${key}`, fmt(total));
    barChart(`${key}Chart`, `${key}Chart`, ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'], etcMonthly(arr), PALETTE[5]);
  }

  function addEtcToolbar(key) {
    const header = document.querySelector(`#${key}TableBody`)?.closest('.etc-table-wrap')?.querySelector('.etc-table-header');
    if (!header || header.querySelector('.etc-io-btns')) return;
    const wrap = document.createElement('div');
    wrap.className = 'etc-io-btns';
    wrap.style.cssText = 'display:flex;gap:6px;margin-left:auto;';
    wrap.innerHTML = `
      <button type="button" class="btn-secondary sm-btn" data-io="export" data-key="${key}"><i class="fas fa-download"></i> 내보내기</button>
      <label class="btn-secondary sm-btn" style="cursor:pointer;margin:0">
        <i class="fas fa-upload"></i> 가져오기
        <input type="file" accept="application/json" data-io="import" data-key="${key}" style="display:none">
      </label>`;
    header.appendChild(wrap);

    wrap.querySelector('[data-io="export"]').addEventListener('click', () => {
      downloadJSON(`${key}_${todayStamp()}.json`, etcData[key]);
    });
    wrap.querySelector('[data-io="import"]').addEventListener('change', (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result);
          if (Array.isArray(imported)) {
            const existingIds = new Set(etcData[key].map(d => d.id));
            imported.forEach(d => { if (!existingIds.has(d.id)) etcData[key].push(d); });
            renderEtc(key);
          }
        } catch (err) { alert('JSON 형식을 읽을 수 없습니다.'); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  function todayStamp() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }

  function initEtcForms() {
    ETC_TYPES.forEach(({ key }) => {
      addEtcToolbar(key);
      const form = $(`${key}Form`);
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          const date = fd.get('date');
          if (!date) return;
          const [y, m, d] = date.split('-').map(Number);
          etcData[key].push({
            id: `${key}_${Date.now()}`,
            date, y, m, d,
            workplace: fd.get('workplace') || '',
            jongYe: fd.get('jongye') || '',
            count: Number(fd.get('count')) || 1,
            note: fd.get('note') || ''
          });
          form.reset();
          renderEtc(key);
        });
      }
      renderEtc(key);
    });

    // 삭제 버튼(테이블 내) 위임 처리
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-del]');
      if (!btn) return;
      const [type, id] = btn.dataset.del.split(':');
      pendingDelete = { type, id };
      const modal = $('deleteModal');
      if (modal) modal.style.display = 'flex';
    });
  }

  function initDeleteModal() {
    const modal = $('deleteModal');
    $('cancelDelete')?.addEventListener('click', () => { pendingDelete = null; if (modal) modal.style.display = 'none'; });
    $('confirmDelete')?.addEventListener('click', () => {
      if (pendingDelete) {
        const { type, id } = pendingDelete;
        etcData[type] = etcData[type].filter(d => d.id !== id);
        renderEtc(type);
      }
      pendingDelete = null;
      if (modal) modal.style.display = 'none';
    });
  }

  // ============================================================
  // 10.5 월간 업무 요약 패널 (이전 요청 반영)
  // ============================================================
  function hgcMonthsOf(arr) {
    const m = Array(12).fill(0);
    arr.forEach(d => { const mo = Number(((d.periodStart || '') + '').split('-')[1]); if (mo >= 1 && mo <= 12) m[mo - 1]++; });
    return m;
  }
  function etcMonthsSum(key) {
    const m = Array(12).fill(0);
    (etcData[key] || []).forEach(d => { if (d.m >= 1 && d.m <= 12) m[d.m - 1] += (Number(d.count) || 0); });
    return m;
  }
  function renderMonthSummary() {
    const bwM = hgcMonthsOf(applyHgcFilter(hgcData).filter(d => d.status === 'complete'));
    const knxM = monthlyCounts(applyFilter(knxData));
    const reqM = monthlyCounts(applyFilter(reqData));
    const etcM = Array(12).fill(0);
    ETC_TYPES.forEach(t => { const m = etcMonthsSum(t.key); for (let i = 0; i < 12; i++) etcM[i] += m[i]; });

    const moIdx = CURRENT_MONTH - 1;
    const prevIdx = moIdx === 0 ? 11 : moIdx - 1;

    const fmtDelta = (curr, prev) => {
      if (prev === 0 && curr === 0) return '— 변동없음';
      if (prev === 0) return `▲ 신규 ${curr}`;
      const pct = Math.round(((curr - prev) / prev) * 100);
      if (pct === 0) return '— 변동없음';
      return `${pct > 0 ? '▲' : '▼'} ${pct > 0 ? '+' : ''}${pct}%`;
    };

    setText('v_monthLabel', `${CURRENT_MONTH}월`);
    setText('ms_bw',  fmt(bwM[moIdx]));
    setText('ms_knx', fmt(knxM[moIdx]));
    setText('ms_req', fmt(reqM[moIdx]));
    setText('ms_etc', fmt(etcM[moIdx]));
    setText('ms_bw_delta',  fmtDelta(bwM[moIdx],  bwM[prevIdx]));
    setText('ms_knx_delta', fmtDelta(knxM[moIdx], knxM[prevIdx]));
    setText('ms_req_delta', fmtDelta(reqM[moIdx], reqM[prevIdx]));
    setText('ms_etc_delta', fmtDelta(etcM[moIdx], etcM[prevIdx]));
  }

  function updateFilterMeta() {
    const el = $('filterMeta'); if (!el) return;
    const yLabel  = filterState.year === 'all' ? '전체' : `${filterState.year}년`;
    const jyLabel = filterState.jongYe === 'all' ? '전체' : filterState.jongYe;
    el.textContent = `필터: ${yLabel} / ${jyLabel}`;
  }

  // ============================================================
  // 10.6 비만·SWI·옴부즈만 시각화 (Tab 1 섹션 E)
  // ============================================================
  function renderEtcViz(key, totalId, prevId, currId, chartId) {
    const arr = etcData[key] || [];
    const m = etcMonthsSum(key);
    const moIdx = CURRENT_MONTH - 1;
    const prevIdx = moIdx === 0 ? 11 : moIdx - 1;
    const total = m.reduce((s, v) => s + v, 0);
    setText(totalId, fmt(total));
    setText(prevId,  `전월 ${fmt(m[prevIdx])}`);
    setText(currId,  `이번 달 ${fmt(m[moIdx])}`);
    barChart(chartId, `etc_viz_${key}`, ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'], m, PALETTE[5]);
  }
  function renderEtcVisualization() {
    renderEtcViz('biman', 'v_etc_biman_total', 'v_etc_biman_prev', 'v_etc_biman_curr', 'v_etc_biman_chart');
    renderEtcViz('swi',   'v_etc_swi_total',   'v_etc_swi_prev',   'v_etc_swi_curr',   'v_etc_swi_chart');
    renderEtcViz('ombu',  'v_etc_ombu_total',  'v_etc_ombu_prev',  'v_etc_ombu_curr',  'v_etc_ombu_chart');
  }

  // ============================================================
  // 10.7 비만·SWI·옴부즈만 입력 — Tab 2 카드 3개
  //    etcData[key] 저장소를 그대로 사용(JSON I/O 일관된 스키마는 후순위)
  // ============================================================
  function bindEtcTab2Form(formId, key) {
    const form = $(formId); if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const date = fd.get('date'); if (!date) return;
      const [y, m, d] = date.split('-').map(Number);
      etcData[key].push({
        id: `${key}_t2_${Date.now()}`,
        date, y, m, d,
        workplace: fd.get('workplace') || '',
        jongYe: fd.get('jongye') || '',
        count: Number(fd.get('count')) || 1,
        note: fd.get('note') || ''
      });
      form.reset();
      renderMonthSummary();
      renderEtcVisualization();
      try { renderEtc(key); } catch (_) {}
    });
  }

  // ============================================================
  // 10.8 Tab 3 legacy 영역 — 마이그레이션 안내
  // ============================================================
  function disableTab3EtcForms() {
    ETC_TYPES.forEach(t => {
      const form = $(`${t.key}Form`);
      if (form) {
        form.style.display = 'none';
        const note = document.createElement('div');
        note.className = 'empty-state sm';
        note.innerHTML = `<i class="fas fa-info-circle"></i><p>이미 <strong>데이터 입력(Tab 2)</strong> 하단으로 이동했습니다.</p>`;
        form.parentNode.insertBefore(note, form);
      }
    });
  }

  // ============================================================
  // 11. 전체 렌더 (필터 변경 시 재호출)
  // ============================================================
  function renderAll() {
    renderSectionA();
    renderKpiSection('knx', knxData, 'memo');
    renderKpiSection('req', reqData, 'note');
    renderCombined();
    renderMonthSummary();
    renderEtcVisualization();
    updateFilterMeta();
  }

  // ============================================================
  // 12. 초기화
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initHeaderStatus();
    initFilters();
    initBiweeklySection();
    initDetailTables();
    initEtcForms();
    // [P4] Tab 2 비만/SWI/옴부즈만 입력 폼 바인딩
    bindEtcTab2Form('bimanFormTab2', 'biman');
    bindEtcTab2Form('swiFormTab2',   'swi');
    bindEtcTab2Form('ombuFormTab2',  'ombu');
    // [P4] Tab 3 legacy 폼 비활성화
    disableTab3EtcForms();
    initDeleteModal();
    renderAll();
  });
})();
