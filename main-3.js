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

  function lineChart(canvasId, key, labels, datasets) {
    const ctx = $(canvasId); if (!ctx) return;
    destroyChart(key);
    charts[key] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: datasets.map((ds, i) => ({ tension: 0.3, borderWidth: 2, ...ds })) },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: datasets.length > 1 } },
        scales: { y: { beginAtZero: true } }
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
    [...knxData, ...reqData, ...hgcData].forEach(d => { if (d.y) years.add(Number(d.y)); });
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
  // 5. 섹션 A: 정기 전송 (HGC_DATA 기반)
  // ============================================================
  function renderSectionA() {
    const complete = hgcData.filter(d => d.status === 'complete');
    const target = hgcData.filter(d => d.status === 'target');

    // 총 발송 회차: 완료 건수를 메인으로, 대상 건수는 괄호로 함께 표기
    const totalEl = $('v_bw_total');
    if (totalEl) {
      totalEl.innerHTML = `${fmt(complete.length)} <span style="font-size:12px;color:var(--muted,#888)">(대상 ${fmt(target.length)})</span>`;
    }

    // ⚠ 사후관리 소견서 발송: report === true 인 완료 건수로 집계
    const sogyeonCount = complete.filter(d => d.report === true).length;
    setText('v_bw_sogyeon', fmt(sogyeonCount));

    // ⚠ 뇌심·직무 발송: items[0](뇌심) 또는 items[1](직무) 가 true인 완료 건수
    const noesimCount = complete.filter(d => (d.items || [])[0] || (d.items || [])[1]).length;
    setText('v_bw_noesim', fmt(noesimCount));

    // ⚠ 최근 발송일: fileDate 기준 최신값 (완료 건 중)
    const lastDate = complete.map(d => d.fileDate).filter(Boolean).sort().slice(-1)[0];
    setText('v_bw_month', lastDate || '-');

    // 월별 정기 사후관리 발송 현황 (완료 건, fileDate의 월 기준, 선택된 연도만)
    const yearFiltered = complete.filter(d => filterState.year === 'all' || (d.fileDate || '').startsWith(String(filterState.year)));
    const monthArr = Array(12).fill(0);
    yearFiltered.forEach(d => {
      const mo = Number((d.fileDate || '').split('-')[1]);
      if (mo >= 1 && mo <= 12) monthArr[mo - 1]++;
    });
    barChart('v_bwMonthlyChart', 'bwMonthly', ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'], monthArr, PALETTE[1]);

    // 상단 "데이터 입력" 탭 미니 KPI도 동일 값으로 동기화 (2주 정기발송 수동 입력 폼은 HGC_DATA로 대체됨)
    setText('up_bw_total', fmt(complete.length));
    setText('up_bw_sogyeon', fmt(sogyeonCount));
    setText('up_bw_noesim', fmt(noesimCount));
    setText('up_bw_month', lastDate || '-');
  }

  // ============================================================
  // 6. 섹션 B/C 공용 렌더러 (KNX, 자료요청 구조 동일)
  // ============================================================
  function renderKpiSection(prefix, rawData, memoField) {
    const arr = applyFilter(rawData);
    const thisMonth = arr.filter(d => d.y === CURRENT_YEAR && d.m === CURRENT_MONTH);

    setText(`v_${prefix}_total`, fmt(arr.length));
    setText(`v_${prefix}_month`, fmt(thisMonth.length));
    setText(`v_${prefix}_clients`, fmt(new Set(arr.map(d => d.group)).size));
    setText(`v_${prefix}_items`, fmt(arr.reduce((s, d) => s + (Number(d.itemSum) || 0), 0)));

    const months = monthlyCounts(arr);
    barChart(`v_${prefix}MonthlyChart`, `${prefix}Monthly`,
      ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'], months, PALETTE[0]);

    const groups = topNGroups(arr, 'group', 10);
    barChart(`v_${prefix}GroupChart`, `${prefix}Group`, groups.map(g => g[0]), groups.map(g => g[1]), PALETTE[4], true);

    const items = sumItems(arr, 9);
    barChart(`v_${prefix}ItemChart`, `${prefix}Item`, ITEM_LABELS, items, PALETTE[2]);

    const memoTop = tokenizeTop(arr, memoField, 10);
    barChart(`v_${prefix}MemoChart`, `${prefix}Memo`, memoTop.map(m => m[0]), memoTop.map(m => m[1]), PALETTE[3], true);
  }

  // ============================================================
  // 7. 섹션 D: 종합 비교 (정기/KNX/자료요청 월별 통합)
  // ============================================================
  function renderCombined() {
    const knxArr = applyFilter(knxData);
    const reqArr = applyFilter(reqData);
    const hgcComplete = hgcData.filter(d => d.status === 'complete' &&
      (filterState.year === 'all' || (d.fileDate || '').startsWith(String(filterState.year))));
    const hgcMonths = Array(12).fill(0);
    hgcComplete.forEach(d => { const mo = Number((d.fileDate || '').split('-')[1]); if (mo >= 1 && mo <= 12) hgcMonths[mo - 1]++; });

    lineChart('v_combinedChart', 'combined',
      ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
      [
        { label: '정기 발송', data: hgcMonths, borderColor: PALETTE[1], backgroundColor: PALETTE[1] },
        { label: 'KNX', data: monthlyCounts(knxArr), borderColor: PALETTE[0], backgroundColor: PALETTE[0] },
        { label: '자료요청', data: monthlyCounts(reqArr), borderColor: PALETTE[2], backgroundColor: PALETTE[2] }
      ]);
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
  function initBiweeklySection() {
    // 수동 입력 폼은 HGC_DATA로 대체되어 더 이상 사용하지 않음 → 비활성화 + 안내 문구
    const form = $('biweeklyForm');
    if (form) {
      form.style.display = 'none';
      const note = document.createElement('div');
      note.className = 'empty-state sm';
      note.innerHTML = '<i class="fas fa-info-circle"></i><p>정기 전송 데이터는 이제 HGC 데이터로 자동 집계됩니다.</p>';
      form.parentNode.insertBefore(note, form);
    }

    // 목록 테이블을 HGC_DATA 구조에 맞게 헤더/본문 재구성
    const table = form ? form.parentElement.querySelector('table') : null;
    // biweeklyTableBody의 상위 table을 못 찾으면 id로 직접 탐색
    const tbody = $('biweeklyTableBody');
    const theadRow = tbody && tbody.closest('table') ? tbody.closest('table').querySelector('thead tr') : null;
    if (theadRow) {
      theadRow.innerHTML = '<th>파일일자</th><th>대상기간</th><th>예/종건</th><th>사업장</th><th>상태</th><th>항목</th>';
    }
    if (tbody) {
      const sorted = hgcData.slice().sort((a, b) => (b.fileDate || '').localeCompare(a.fileDate || ''));
      tbody.innerHTML = sorted.length ? sorted.map(d => {
        const items = (d.items || []).map((v, i) => v ? HGC_ITEM_LABELS[i] : null).filter(Boolean).join(', ') || '-';
        const statusLabel = d.status === 'complete' ? '<span style="color:var(--green,#22c55e)">완료</span>' : '<span style="color:var(--orange,#f97316)">대상</span>';
        return `<tr><td>${d.fileDate || '-'}</td><td>${d.periodStart || ''} ~ ${d.periodEnd || ''}</td><td>${d.jongYe || '-'}</td><td>${d.workplace || '-'}</td><td>${statusLabel}</td><td>${items}</td></tr>`;
      }).join('') : '<tr><td colspan="6"><div class="empty-state sm"><i class="fas fa-inbox"></i><p>데이터 없음</p></div></td></tr>';
    }
    setText('bwRowCount', `${fmt(hgcData.length)}건`);
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
  // 11. 전체 렌더 (필터 변경 시 재호출)
  // ============================================================
  function renderAll() {
    renderSectionA();
    renderKpiSection('knx', knxData, 'memo');
    renderKpiSection('req', reqData, 'note');
    renderCombined();
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
    initDeleteModal();
    renderAll();
  });
})();
