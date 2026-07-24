/* ======================================================
   기업건강의학센터 업무 현황 대시보드 — main.js
   ====================================================== */

// ── 상수 ─────────────────────────────────────────────
// KNX 시트1: H(7)~P(15) = 9개 항목
// 자료요청 시트2: K(10)~S(18) = 9개 항목
const ITEM_LABELS = ['사후세로형','사후가로형','뇌심','직무','정신','동의자결과','사업장양식','사이트업로드','통계자료'];
const PAGE      = 50;
const API_BW    = 'tables/biweekly_report';
const API_ETC   = 'tables/etc_work';

/* ── localStorage 헬퍼 ──────────────────────────────── */
function lsUUID() {
    try {
        return crypto.randomUUID();
    } catch(e) {
        // fallback (구형 브라우저)
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
    }
}
function lsSave(key, record) {
    const arr = lsLoad(key);
    arr.push(record);
    try {
        localStorage.setItem(key, JSON.stringify(arr));
    } catch(e) {
        showToast('저장 공간이 부족합니다.', 'error');
        console.error('[lsSave] 저장 실패:', e);
    }
}
function lsLoad(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch(e) {
        console.warn('[lsLoad] 파싱 실패, 초기화:', key, e);
        return [];
    }
}
function lsDelete(key, id) {
    const arr = lsLoad(key).filter(r => r.id !== id);
    try {
        localStorage.setItem(key, JSON.stringify(arr));
    } catch(e) {
        console.error('[lsDelete] 삭제 실패:', e);
    }
}

// ── 색상 팔레트 (라이트 테마) ────────────────────────
const C = {
    blue:  'rgba(30,115,230,0.85)',   green: 'rgba(22,163,74,0.85)',
    orange:'rgba(234,88,12,0.85)',    purple:'rgba(124,58,237,0.85)',
    teal:  'rgba(13,148,136,0.85)',   red:   'rgba(220,38,38,0.85)',
    yellow:'rgba(217,119,6,0.85)',    pink:  'rgba(219,39,119,0.85)',
    sky:   'rgba(2,132,199,0.85)',
};
const PALETTE = Object.values(C);

// ── 전역 상태 ─────────────────────────────────────────
const state = {
    knx:  { raw:[], filtered:[], page:1, search:'' },
    req:  { raw:[], filtered:[], page:1, search:'' },
    bw:   { records:[], filtered:[] },
    etc:  { biman:[], swi:[], ombu:[] },
    visFilters: { year:'all', jy:'all' },
};
const CH = {};
let deleteTargetId = null;
let deleteTargetTable = null;

// ── DOM Ready ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    Chart.defaults.color = '#64748B';
    Chart.defaults.font.family = "'Noto Sans KR', sans-serif";
    Chart.defaults.font.size = 11;
    initClock();
    initTabs();
    initVisFilters();
    initBiweeklyForm();
    initSearches();
    initEtcForms();
    loadExternalData();   // window.KNX_DATA / window.REQ_DATA 로드
    loadBiweeklyData();
    loadEtcData();
});

/* =====================================================
   공통 유틸
   ===================================================== */
function initClock() {
    const el = document.getElementById('currentTime');
    const tick = () => { el.textContent = new Date().toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}); };
    tick(); setInterval(tick, 1000);
}

function showToast(msg, type='success') {
    let t = document.getElementById('__toast');
    if (!t) { t=document.createElement('div'); t.id='__toast'; t.className='toast'; document.body.appendChild(t); }
    t.className=`toast ${type}`;
    t.innerHTML=`<i class="fas fa-${type==='success'?'check-circle':'exclamation-circle'}"></i> ${msg}`;
    t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'), 3000);
}

const pad = n => String(n).padStart(2,'0');
function setEl(id, val) { const e=document.getElementById(id); if(e) e.textContent=val; }
function toggleActive(container, btn) {
    container.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
}

// ── 예/종건 → {ye, jong} 각 카운트 (종예건 = 예건1+종건1) ──
function parseJY(val) {
    const v = String(val||'').trim();
    const hasYe  = v.includes('예건') || v==='예';
    const hasJong = v.includes('종건') || v==='종';
    if (hasYe && hasJong) return { ye:1, jong:1, label:'종예건' };
    if (hasYe)            return { ye:1, jong:0, label:'예건' };
    if (hasJong)          return { ye:0, jong:1, label:'종건' };
    return { ye:0, jong:0, label:v||'기타' };
}

function jongYeBadge(val) {
    if (!val) return '<span class="badge b-etc">-</span>';
    const jy = parseJY(val);
    if (jy.ye && jy.jong) return `<span class="badge b-both">${val}</span>`;
    if (jy.ye)            return `<span class="badge b-ye">${val}</span>`;
    if (jy.jong)          return `<span class="badge b-jong">${val}</span>`;
    return `<span class="badge b-etc">${val}</span>`;
}
function provBadge(v){return v==='정기'?`<span class="badge b-reg">정기</span>`:v?`<span class="badge b-etc">${v}</span>`:'<span class="badge b-etc">-</span>';}
function ck(v){return v?'<i class="fas fa-check ck"></i>':'<i class="fas fa-minus uck"></i>';}

function destroyChart(key) { if(CH[key]){ CH[key].destroy(); delete CH[key]; } }

/** canvas 요소가 없으면 null 반환, 있으면 Chart 인스턴스 반환 */
function safeChart(canvasId, config) {
    const el = document.getElementById(canvasId);
    if(!el) { console.warn('[safeChart] canvas 없음:', canvasId); return null; }
    // NaN/undefined/Infinity 값 정제
    if(config?.data?.datasets) {
        config.data.datasets = config.data.datasets.map(ds=>({
            ...ds,
            data: (ds.data||[]).map(v=>(typeof v==='number'&&isFinite(v))?v:0)
        }));
    }
    return new Chart(el, config);
}

function barOpts(stacked=false, indexAxis='x') {
    return { responsive:true, maintainAspectRatio:false, indexAxis,
        plugins:{
            legend:{position:'bottom',labels:{color:'#475569',padding:10,boxWidth:10}},
            tooltip:{backgroundColor:'#1E293B',titleColor:'#F1F5F9',bodyColor:'#CBD5E1',borderColor:'#334155',borderWidth:1,padding:10}
        },
        scales:{
            x:{stacked, grid:{color:'rgba(0,0,0,.05)'}, ticks:{color:'#64748B'}},
            y:{stacked, grid:{color:'rgba(0,0,0,.06)'}, ticks:{color:'#64748B'}}
        }
    };
}
function pieOpts() {
    return { responsive:true, maintainAspectRatio:false, cutout:'55%',
        plugins:{
            legend:{position:'bottom',labels:{color:'#475569',padding:8,boxWidth:10}},
            tooltip:{backgroundColor:'#1E293B',titleColor:'#F1F5F9',bodyColor:'#CBD5E1',borderColor:'#334155',borderWidth:1}
        }
    };
}
function lineOpts() {
    return { responsive:true, maintainAspectRatio:false,
        plugins:{
            legend:{position:'bottom',labels:{color:'#475569',padding:10,boxWidth:10}},
            tooltip:{backgroundColor:'#1E293B',titleColor:'#F1F5F9',bodyColor:'#CBD5E1',borderColor:'#334155',borderWidth:1,padding:10}
        },
        scales:{
            x:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#64748B',maxTicksLimit:16}},
            y:{grid:{color:'rgba(0,0,0,.06)'},ticks:{color:'#64748B'}}
        }
    };
}

/* =====================================================
   탭 전환
   ===================================================== */
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
            document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });
}

/* =====================================================
   시각화 탭 필터
   ===================================================== */
function initVisFilters() {
    document.getElementById('visYearFilter').addEventListener('click', e=>{
        const btn=e.target.closest('.filter-btn'); if(!btn) return;
        state.visFilters.year = btn.dataset.year==='all' ? 'all' : parseInt(btn.dataset.year);
        toggleActive(document.getElementById('visYearFilter'), btn);
        applyVisFilters();
    });
    document.getElementById('visJyFilter').addEventListener('click', e=>{
        const btn=e.target.closest('.filter-btn'); if(!btn) return;
        state.visFilters.jy = btn.dataset.jy;
        toggleActive(document.getElementById('visJyFilter'), btn);
        applyVisFilters();
    });
}

function updateVisYearFilterButtons() {
    const years = new Set([
        ...state.knx.raw.map(r=>r.y),
        ...state.req.raw.map(r=>r.y),
        ...state.bw.records.map(r=>parseInt(r.send_date?.substring(0,4))||0)
    ].filter(y=>y>2000));
    const sorted = [...years].sort();
    const container = document.getElementById('visYearFilter');
    container.innerHTML='<button class="filter-btn" data-year="all">전체</button>';
    sorted.forEach(y=>{
        const b=document.createElement('button'); b.className='filter-btn'; b.dataset.year=y; b.textContent=y+'년'; container.appendChild(b);
    });
    const curY=new Date().getFullYear();
    // 데이터에 현재 연도가 있으면 자동 선택 (최초 1회만)
    if(sorted.includes(curY) && state.visFilters.year==='all') state.visFilters.year=curY;
    // 선택된 연도 버튼 하이라이트
    container.querySelectorAll('.filter-btn').forEach(b=>{
        const isAll = b.dataset.year==='all' && state.visFilters.year==='all';
        const isYear = String(b.dataset.year)===String(state.visFilters.year);
        b.classList.toggle('active', isAll || isYear);
    });
}

// ── 예/종건 필터 적용 로직 (종예건은 both=예건+종건이므로 '예건'/'종건' 모두에 포함) ──
function matchJY(jyLabel, filter) {
    if (filter==='all') return true;
    const jy = parseJY(jyLabel);
    if (filter==='예건') return jy.ye > 0;
    if (filter==='종건') return jy.jong > 0;
    return true;
}

function applyVisFilters() {
    const {year, jy} = state.visFilters;
    state.knx.filtered = state.knx.raw.filter(r=>{
        if (year!=='all' && r.y!==year) return false;
        if (!matchJY(r.jongYe, jy)) return false;
        return true;
    });
    state.req.filtered = state.req.raw.filter(r=>{
        if (year!=='all' && r.y!==year) return false;
        if (!matchJY(r.jongYe, jy)) return false;
        return true;
    });
    state.bw.filtered = state.bw.records.filter(r=>{
        if (year!=='all' && r.send_date?.substring(0,4)!==String(year)) return false;
        return true;
    });
    renderVisAll();
}

/* =====================================================
   시각화 탭 렌더링
   ===================================================== */
function renderVisAll() {
    renderVisBwKPI(); renderVisBwCharts();
    renderVisKnxKPI(); renderVisKnxCharts();
    renderVisReqKPI(); renderVisReqCharts();
    renderVisCombinedChart();
    updateDataStatus();
}

// A. 정기 발송
function renderVisBwKPI() {
    const now = new Date();
    const curY = now.getFullYear(), curM = now.getMonth()+1, curD = now.getDate();
    const all  = state.bw.records.filter(r=>r.send_date?.startsWith(String(curY)));
    setEl('v_bw_total',   all.length);
    setEl('v_bw_sogyeon', all.reduce((sum,r)=> sum + Number(r.jong_count||0)+ Number(r.ye_count||0),0));
    setEl('v_bw_noesim',  all.filter(r=>r.report_type==='뇌심·직무').reduce((sum,r)=>sum+Number(r.jong_count||0)+Number(r.ye_count||0),0));
    const latest = state.bw.records.length ? state.bw.records[0].send_date : '-';
    setEl('v_bw_month', latest);
}
function renderVisBwCharts() {
    const data=state.bw.filtered;
    const months=Array.from({length:12},(_,i)=>`${i+1}월`);
    const ye = Array (12).fill(0);
    const jong = Array (23).fill(0);
    data.forEach(r=>{ const m=parseInt(r.send_date?.substring(5,7)||'')-1; if(!isNaN(m)&&m>=0&&m<12){ jong[m] += Number(r.jong_count || 0); ye[m] += Number(r.ye_count || 0); } });
    destroyChart('v_bwMonthly');
    CH.v_bwMonthly = safeChart('v_bwMonthlyChart',{
        type:'bar',
        data:{labels:months,datasets:[{label:'종건',data:jong,backgroundColor:C.green,borderRadius:4},{label:'예건',data:ye,backgroundColor:C.yellow,borderRadius:4}]},
        options:barOpts(true)
    });
}

// B. KNX — 예/종건 카운트 시 종예건은 ye+jong 각 1씩
function renderVisKnxKPI() {
    const curY=new Date().getFullYear(), curM=new Date().getMonth()+1;
    const all  = state.knx.raw.filter(r=>r.y===curY);
    const filt = state.knx.filtered;
    const month= filt.filter(r=>r.y===curY&&r.m===curM);
    const clients = new Set(filt.map(r=>(r.workplace||r.group||'').trim()).filter(Boolean));
    const items   = filt.reduce((s,r)=>s+r.itemSum,0);
    setEl('v_knx_total',   all.length.toLocaleString());
    setEl('v_knx_month',   month.length.toLocaleString());
    setEl('v_knx_clients', clients.size.toLocaleString());
    setEl('v_knx_items',   items.toLocaleString());
    setEl('knxSheetStatus', all.length>0 ? `✓ ${all.length}건` : '미로드');
}
function renderVisKnxCharts() {
    const data = state.knx.filtered;
    const months = Array.from({length:12},(_,i)=>`${i+1}월`);
    // 예건/종건 각각 카운트 (종예건 = 각 1씩)
    const yeC=Array(12).fill(0), jC=Array(12).fill(0);
    data.forEach(r=>{ const m=r.m-1; if(m<0||m>11||isNaN(m)) return; const jy=parseJY(r.jongYe); yeC[m]+=jy.ye; jC[m]+=jy.jong; });
    destroyChart('v_knxMonthly');
    CH.v_knxMonthly = safeChart('v_knxMonthlyChart',{
        type:'bar',
        data:{labels:months,datasets:[{label:'예건',data:yeC,backgroundColor:C.blue,borderRadius:4},{label:'종건',data:jC,backgroundColor:C.green,borderRadius:4}]},
        options:barOpts(true)
    });

    // 거래처별 Top10 (사업장명 기준)
    const gMap={};
    data.forEach(r=>{ const g=r.workplace||r.group||'미지정'; gMap[g]=(gMap[g]||0)+1; });
    const sorted=Object.entries(gMap).sort((a,b)=>b[1]-a[1]).slice(0,10);
    destroyChart('v_knxGroup');
    CH.v_knxGroup = safeChart('v_knxGroupChart',{
        type:'bar',
        data:{labels:sorted.map(e=>e[0]),datasets:[{label:'건수',data:sorted.map(e=>e[1]),backgroundColor:C.purple,borderRadius:4}]},
        options:{...barOpts(false,'y'),plugins:{...barOpts().plugins,legend:{display:false}}}
    });

    // 항목별
    const itemT=ITEM_LABELS.map((_,i)=>data.reduce((s,r)=>{
        if(!Array.isArray(r.items)||r.items.length<=i) return s;
        return s+(r.items[i]||0);
    },0));
    destroyChart('v_knxItem');
    CH.v_knxItem = safeChart('v_knxItemChart',{
        type:'bar',
        data:{labels:ITEM_LABELS,datasets:[{label:'건수',data:itemT,backgroundColor:PALETTE,borderRadius:4}]},
        options:{...barOpts(),plugins:{...barOpts().plugins,legend:{display:false}}}
    });

    // 요청 자료 Top10 (KNX 비고 기준)
    renderMemoTop10Chart(data, 'v_knxMemoChart', 'v_knxMemo', C.teal);
}

// C. 자료요청
function renderVisReqKPI() {
    const curY=new Date().getFullYear(), curM=new Date().getMonth()+1;
    const all  = state.req.raw.filter(r=>r.y===curY);
    const filt = state.req.filtered;
    const month= filt.filter(r=>r.y===curY&&r.m===curM);
    const clients=new Set(filt.map(r=>(r.workplace||r.group||'').trim()).filter(Boolean));
    const items  =filt.reduce((s,r)=>s+r.itemSum,0);
    setEl('v_req_total',   all.length.toLocaleString());
    setEl('v_req_month',   month.length.toLocaleString());
    setEl('v_req_clients', clients.size.toLocaleString());
    setEl('v_req_items',   items.toLocaleString());
    setEl('reqSheetStatus', all.length>0 ? `✓ ${all.length}건` : '미로드');
}
function renderVisReqCharts() {
    const data=state.req.filtered;
    const months=Array.from({length:12},(_,i)=>`${i+1}월`);
    const mC=Array(12).fill(0);
    data.forEach(r=>{ const mi=r.m-1; if(mi>=0&&mi<12&&!isNaN(mi)) mC[mi]++; });
    destroyChart('v_reqMonthly');
    CH.v_reqMonthly = safeChart('v_reqMonthlyChart',{
        type:'bar',
        data:{labels:months,datasets:[{label:'회신 건수',data:mC,backgroundColor:C.orange,borderRadius:4}]},
        options:{...barOpts(),plugins:{...barOpts().plugins,legend:{display:false}}}
    });

    const gMap={};
    data.forEach(r=>{ const g=r.workplace||r.group||'미지정'; gMap[g]=(gMap[g]||0)+1; });
    const sorted=Object.entries(gMap).sort((a,b)=>b[1]-a[1]).slice(0,10);
    destroyChart('v_reqGroup');
    CH.v_reqGroup = safeChart('v_reqGroupChart',{
        type:'bar',
        data:{labels:sorted.map(e=>e[0]),datasets:[{label:'건수',data:sorted.map(e=>e[1]),backgroundColor:C.blue,borderRadius:4}]},
        options:{...barOpts(false,'y'),plugins:{...barOpts().plugins,legend:{display:false}}}
    });

    const itemT=ITEM_LABELS.map((_,i)=>data.reduce((s,r)=>{
        if(!Array.isArray(r.items)||r.items.length<=i) return s;
        return s+(r.items[i]||0);
    },0));
    destroyChart('v_reqItem');
    CH.v_reqItem = safeChart('v_reqItemChart',{
        type:'bar',
        data:{labels:ITEM_LABELS,datasets:[{label:'건수',data:itemT,backgroundColor:PALETTE,borderRadius:4}]},
        options:{...barOpts(),plugins:{...barOpts().plugins,legend:{display:false}}}
    });

    // 요청 자료 Top10 (자료요청서 비고 기준)
    renderMemoTop10Chart(data, 'v_reqMemoChart', 'v_reqMemo', C.orange);
}

/* =====================================================
   공통: 비고 기반 요청 자료 Top10 차트
   비고 필드(memo/note)를 쉼표·슬래시·공백으로 split →
   빈도순 정렬 후 상위 10개 수평 막대 차트
   ===================================================== */
function parseMemoTokens(str) {
    if(!str || typeof str !== 'string') return [];
    // 쉼표, 슬래시, ·, &, +, 공백(2개 이상) 기준 split, 앞뒤 공백 제거
    return str.split(/[,\/·&+]|  +/)
        .map(t=>t.trim())
        .filter(t=>t.length >= 2);   // 1자 이하 토큰 제외
}

function renderMemoTop10Chart(data, canvasId, chartKey, color) {
    // 비고: KNX는 r.memo, 요청서는 r.note 사용 (둘 다 fallback)
    const freq = {};
    data.forEach(r=>{
        const raw = r.memo || r.note || '';
        parseMemoTokens(raw).forEach(token=>{
            const k = token;
            freq[k] = (freq[k]||0) + 1;
        });
    });
    const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,10);
    destroyChart(chartKey);
    if(!sorted.length) {
        CH[chartKey] = safeChart(canvasId, {
            type:'bar',
            data:{labels:['비고 데이터 없음'],datasets:[{label:'건수',data:[0],backgroundColor:'rgba(100,116,139,.15)',borderRadius:4}]},
            options:{...barOpts(false,'y'),plugins:{...barOpts().plugins,legend:{display:false}}}
        });
        return;
    }
    CH[chartKey] = safeChart(canvasId, {
        type: 'bar',
        data: {
            labels: sorted.map(e=>e[0]),
            datasets: [{
                label: '건수',
                data:   sorted.map(e=>e[1]),
                backgroundColor: color,
                borderRadius: 4,
            }]
        },
        options: {
            ...barOpts(false,'y'),
            plugins: { ...barOpts().plugins, legend:{display:false} }
        }
    });
}

// D. 종합 비교
function renderVisCombinedChart() {
    const ymBw  = state.bw.filtered.map(r=>{const y=r.send_date?.substring(0,4),m=r.send_date?.substring(5,7);return y&&m?`${y}-${m}`:null;}).filter(Boolean);
    const ymKnx = state.knx.filtered.map(r=>`${r.y}-${pad(r.m)}`);
    const ymReq = state.req.filtered.map(r=>`${r.y}-${pad(r.m)}`);
    const ymSet = [...new Set([...ymBw,...ymKnx,...ymReq])].sort();
    const bwD  =ymSet.map(ym=>state.bw.filtered.filter(r=>{const[y,m]=ym.split('-');return r.send_date?.startsWith(y+'-'+m);}).length);
    const knxD =ymSet.map(ym=>{const[y,m]=ym.split('-').map(Number);return state.knx.filtered.filter(r=>r.y===y&&r.m===m).length;});
    const reqD =ymSet.map(ym=>{const[y,m]=ym.split('-').map(Number);return state.req.filtered.filter(r=>r.y===y&&r.m===m).length;});
    destroyChart('v_combined');
    CH.v_combined = safeChart('v_combinedChart',{
        type:'line',
        data:{labels:ymSet,datasets:[
            {label:'정기 발송',data:bwD, borderColor:C.green, backgroundColor:'rgba(22,163,74,.10)',  fill:true,tension:.4,pointRadius:4,pointBackgroundColor:C.green},
            {label:'KNX 발송', data:knxD,borderColor:C.blue,  backgroundColor:'rgba(30,115,230,.10)', fill:true,tension:.4,pointRadius:4,pointBackgroundColor:C.blue},
            {label:'자료요청', data:reqD,borderColor:C.orange,backgroundColor:'rgba(234,88,12,.10)',  fill:true,tension:.4,pointRadius:4,pointBackgroundColor:C.orange},
        ]},
        options:lineOpts()
    });
}

function updateDataStatus() {
    const knxOk=state.knx.raw.length>0, reqOk=state.req.raw.length>0;
    const dot=document.querySelector('.status-dot'), text=document.getElementById('dataStatus');
    if (knxOk&&reqOk) {
        dot.className='status-dot loaded';
        text.innerHTML=`<span class="status-dot loaded"></span> KNX ${state.knx.raw.length}건 · 요청서 ${state.req.raw.length}건`;
    } else if (knxOk||reqOk) {
        dot.className='status-dot partial';
        text.innerHTML=`<span class="status-dot partial"></span> 일부 로드됨`;
    }
}

/* =====================================================
   외부 데이터 로드 (data/knx.js, data/req.js)
   convert.exe 실행 후 생성된 전역변수 사용
   ===================================================== */
function loadExternalData() {
    // ── KNX 데이터 ──────────────────────────────────────
    const knxRaw = window.KNX_DATA || [];
    state.knx.raw = knxRaw.filter(r => {
        // 방어: y/m 유효성 확인
        return r && r.date && r.y >= 2020 && r.y <= 2050
            && r.m >= 1 && r.m <= 12
            && Array.isArray(r.items) && r.items.length === 9;
    });
    // itemSum 재계산 (누락 방어)
    state.knx.raw.forEach(r => {
        r.itemSum = r.items.reduce((s, v) => s + (v || 0), 0);
    });

    const knxOk = state.knx.raw.length > 0;
    setEl('sheet1Count',  state.knx.raw.length + '건');
    setEl('sheet1Status', knxOk ? '로드 완료 ✓' : 'data/knx.js 없음');
    const s1 = document.getElementById('sheetResult1');
    if(s1) s1.classList.toggle('loaded', knxOk);

    // ── REQ 데이터 ──────────────────────────────────────
    const reqRaw = window.REQ_DATA || [];
    state.req.raw = reqRaw.filter(r => {
        return r && r.date && r.y >= 2020 && r.y <= 2050
            && r.m >= 1 && r.m <= 12
            && Array.isArray(r.items) && r.items.length === 9;
    });
    state.req.raw.forEach(r => {
        r.itemSum = r.items.reduce((s, v) => s + (v || 0), 0);
    });

    const reqOk = state.req.raw.length > 0;
    setEl('sheet2Count',  state.req.raw.length + '건');
    setEl('sheet2Status', reqOk ? '로드 완료 ✓' : 'data/req.js 없음');
    const s2 = document.getElementById('sheetResult2');
    if(s2) s2.classList.toggle('loaded', reqOk);

    console.log(`[DATA] KNX ${state.knx.raw.length}건, REQ ${state.req.raw.length}건 로드`);

    updateVisYearFilterButtons();
    applyVisFilters();
    renderUploadKnxTable();
    renderUploadReqTable();
}

/* =====================================================
   데이터 입력 탭 — 업로드 테이블
   ===================================================== */
function initSearches() {
    document.getElementById('knxSearch').addEventListener('input', e=>{ state.knx.search=e.target.value.toLowerCase(); state.knx.page=1; renderUploadKnxTable(); });
    document.getElementById('reqSearch').addEventListener('input', e=>{ state.req.search=e.target.value.toLowerCase(); state.req.page=1; renderUploadReqTable(); });
}

function renderUploadKnxTable() {
    let data=[...state.knx.raw].sort((a,b)=>b.date.localeCompare(a.date));
    if(state.knx.search){const q=state.knx.search; data=data.filter(r=>r.date.includes(q)||(r.workplace||'').toLowerCase().includes(q)||(r.group||'').toLowerCase().includes(q)||(r.staff||'').toLowerCase().includes(q)||(r.memo||'').toLowerCase().includes(q));}
    setEl('knxRowCount', data.length.toLocaleString()+'건');
    const total=Math.ceil(data.length/PAGE)||1;
    const page=data.slice((state.knx.page-1)*PAGE, state.knx.page*PAGE);
    const tbody=document.getElementById('knxTableBody');
    if(!page.length){ tbody.innerHTML=`<tr><td colspan="17"><div class="empty-state sm"><i class="fas fa-file-upload"></i><p>엑셀을 업로드해 주세요</p></div></td></tr>`; }
    else {
        tbody.innerHTML=page.map(r=>`<tr>
            <td style="font-family:var(--mono);color:var(--blue)">${r.date}</td>
            <td>${jongYeBadge(r.jongYe)}</td>
            <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis" title="${r.workplace}">${r.workplace||'-'}</td>
            <td>${r.group||'-'}</td>
            ${r.items.map(v=>ck(v)).map(s=>`<td style="text-align:center">${s}</td>`).join('')}
            <td style="font-family:var(--mono);text-align:center;color:var(--teal)">${r.itemSum}</td>
            <td>${provBadge(r.provType)}</td>
            <td style="color:var(--purple)">${r.staff||'-'}</td>
            <td style="color:var(--sub);max-width:120px;overflow:hidden;text-overflow:ellipsis" title="${r.memo}">${r.memo||'-'}</td>
        </tr>`).join('');
    }
    renderPagination('knxPagination', total, state.knx.page, p=>{ state.knx.page=p; renderUploadKnxTable(); });
}

function renderUploadReqTable() {
    let data=[...state.req.raw].sort((a,b)=>b.date.localeCompare(a.date));
    if(state.req.search){const q=state.req.search; data=data.filter(r=>r.date.includes(q)||(r.workplace||'').toLowerCase().includes(q)||(r.group||'').toLowerCase().includes(q)||(r.sender||'').toLowerCase().includes(q)||(r.note||'').toLowerCase().includes(q));}
    setEl('reqRowCount', data.length.toLocaleString()+'건');
    const total=Math.ceil(data.length/PAGE)||1;
    const page=data.slice((state.req.page-1)*PAGE, state.req.page*PAGE);
    const tbody=document.getElementById('reqTableBody');
    if(!page.length){ tbody.innerHTML=`<tr><td colspan="16"><div class="empty-state sm"><i class="fas fa-file-upload"></i><p>엑셀을 업로드해 주세요</p></div></td></tr>`; }
    else {
        tbody.innerHTML=page.map(r=>`<tr>
            <td style="font-family:var(--mono);color:var(--blue)">${r.date}</td>
            <td>${jongYeBadge(r.jongYe)}</td>
            <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis" title="${r.workplace}">${r.workplace||'-'}</td>
            <td>${r.group||'-'}</td>
            ${r.items.map(v=>ck(v)).map(s=>`<td style="text-align:center">${s}</td>`).join('')}
            <td style="font-family:var(--mono);text-align:center;color:var(--teal)">${r.itemSum}</td>
            <td style="color:var(--purple)">${r.sender||'-'}</td>
            <td style="color:var(--sub);max-width:120px;overflow:hidden;text-overflow:ellipsis" title="${r.note}">${r.note||'-'}</td>
        </tr>`).join('');
    }
    renderPagination('reqPagination', total, state.req.page, p=>{ state.req.page=p; renderUploadReqTable(); });
}

/* =====================================================
   데이터 입력 탭 — 정기 발송 폼
   ===================================================== */
function initBiweeklyForm() {
    document.querySelectorAll('.quick-btn').forEach(btn=>btn.addEventListener('click',()=>setQuickPeriod(btn.dataset.period)));
    document.querySelectorAll('.count-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
            const id=btn.dataset.target; const input=document.getElementById(id);
            let v=parseInt(input.value)||0;
            if(btn.classList.contains('plus')) v=Math.max(0,v+1);
            if(btn.classList.contains('minus')) v=Math.max(0,v-1);
            input.value=v; updateCountTotal();
        });
    });
    document.getElementById('jongCount').addEventListener('input', updateCountTotal);
    document.getElementById('yeCount').addEventListener('input', updateCountTotal);
    document.getElementById('biweeklyForm').addEventListener('submit', e=>{ e.preventDefault(); saveBiweekly(); });
    document.getElementById('clearFormBtn').addEventListener('click', clearBwForm);
    document.getElementById('upBwYearFilter').addEventListener('click', e=>{
        const btn=e.target.closest('.filter-btn'); if(!btn) return;
        toggleActive(document.getElementById('upBwYearFilter'), btn);
        renderBwTable(btn.dataset.year==='all'?'all':parseInt(btn.dataset.year));
    });
    // 삭제 모달
    document.getElementById('cancelDelete').addEventListener('click',()=>document.getElementById('deleteModal').style.display='none');
    document.getElementById('confirmDelete').addEventListener('click', ()=>{
        if(!deleteTargetId) return;
        lsDelete(deleteTargetTable, deleteTargetId);
        document.getElementById('deleteModal').style.display='none';
        showToast('삭제되었습니다.');
        if(deleteTargetTable===API_BW) loadBiweeklyData();
        else loadEtcData();
    });
    document.getElementById('sendDate').value=new Date().toISOString().split('T')[0];
}

function setQuickPeriod(period) {
    const now=new Date(),y=now.getFullYear(),m=now.getMonth();
    let s,e;
    if(period==='first')         {s=new Date(y,m,2);   e=new Date(y,m,16);}
    else if(period==='second')   {s=new Date(y,m,17);  e=new Date(y,m+1,1);}
    else if(period==='prev-first'){s=new Date(y,m-1,2); e=new Date(y,m-1,16);}
    else                          {s=new Date(y,m-1,17);e=new Date(y,m,1);}
    document.getElementById('periodStart').value=s.toISOString().split('T')[0];
    document.getElementById('periodEnd').value  =e.toISOString().split('T')[0];
}
function updateCountTotal() {
    const j=parseInt(document.getElementById('jongCount').value)||0;
    const y=parseInt(document.getElementById('yeCount').value)||0;
    setEl('totalCount',(j+y).toLocaleString());
}
function clearBwForm() {
    document.querySelectorAll('input[name=report_type]')[0].checked=true;
    document.getElementById('periodStart').value='';
    document.getElementById('periodEnd').value='';
    document.getElementById('sendDate').value=new Date().toISOString().split('T')[0];
    document.getElementById('jongCount').value='0';
    document.getElementById('yeCount').value='0';
    document.getElementById('reportNote').value='';
    updateCountTotal();
}
function saveBiweekly() {
    const rtype    = document.querySelector('input[name=report_type]:checked').value;
    const pStart   = document.getElementById('periodStart').value;
    const pEnd     = document.getElementById('periodEnd').value;
    const sendDate = document.getElementById('sendDate').value;
    const jongCount= parseInt(document.getElementById('jongCount').value)||0;
    const yeCount  = parseInt(document.getElementById('yeCount').value)||0;
    const note     = document.getElementById('reportNote').value.trim();
    if(!pStart||!pEnd||!sendDate){showToast('대상기간과 발송일을 입력해 주세요.','error');return;}
    const record = {
        id: lsUUID(),
        report_type: rtype,
        period_start: pStart, period_end: pEnd,
        send_date: sendDate,
        jong_count: jongCount, ye_count: yeCount,
        note,
        created_at: Date.now()
    };
    lsSave(API_BW, record);
    showToast('저장되었습니다.');
    clearBwForm();
    loadBiweeklyData();
}
function loadBiweeklyData() {
    state.bw.records = lsLoad(API_BW).sort((a,b)=>(b.send_date||'').localeCompare(a.send_date||''));
    const years=[...new Set(state.bw.records.map(r=>r.send_date?.substring(0,4)).filter(Boolean))].sort();
    const yf=document.getElementById('upBwYearFilter');
    const curAct=yf.querySelector('.filter-btn.active')?.dataset.year||'all';
    yf.innerHTML='<button class="filter-btn" data-year="all">전체</button>';
    years.forEach(y=>{const b=document.createElement('button');b.className='filter-btn';b.dataset.year=y;b.textContent=y+'년';yf.appendChild(b);});
    yf.querySelectorAll('.filter-btn').forEach(b=>b.classList.toggle('active',b.dataset.year===String(curAct)));
    const curY=String(new Date().getFullYear()), curM=new Date().getMonth()+1;
    const all=state.bw.records.filter(r=>r.send_date?.startsWith(curY));
    setEl('up_bw_total',   all.length);
    setEl('up_bw_sogyeon', all.filter(r=>r.report_type==='사후관리 소견서').length);
    setEl('up_bw_noesim',  all.filter(r=>r.report_type==='뇌심·직무').length);
    setEl('up_bw_month',   state.bw.records.filter(r=>r.send_date?.startsWith(curY+'-'+pad(curM))).length);
    updateVisYearFilterButtons();
    applyVisFilters();
    renderBwTable('all');
}
function renderBwTable(yearFilter='all') {
    let data=state.bw.records.filter(r=>yearFilter==='all'||r.send_date?.startsWith(String(yearFilter)));
    setEl('bwRowCount',data.length+'건');
    const tbody=document.getElementById('biweeklyTableBody');
    if(!data.length){tbody.innerHTML=`<tr><td colspan="8"><div class="empty-state sm"><i class="fas fa-plus-circle"></i><p>폼으로 입력해 주세요</p></div></td></tr>`;return;}
    tbody.innerHTML=data.map(r=>{
        const total=(r.jong_count||0)+(r.ye_count||0);
        const badge=r.report_type==='사후관리 소견서'?'<span class="badge b-sogyeon">사후관리 소견서</span>':'<span class="badge b-noesim">뇌심·직무</span>';
        const period=r.period_start&&r.period_end?`${r.period_start.substring(5)} ~ ${r.period_end.substring(5)}`:'-';
        return `<tr>
            <td style="font-family:var(--mono);color:var(--blue)">${r.send_date||'-'}</td>
            <td>${badge}</td><td>${period}</td>
            <td style="font-family:var(--mono);text-align:center;color:var(--green)">${r.jong_count||0}</td>
            <td style="font-family:var(--mono);text-align:center;color:var(--blue)">${r.ye_count||0}</td>
            <td style="font-family:var(--mono);text-align:center;color:var(--teal);font-weight:700">${total}</td>
            <td style="color:var(--sub);max-width:120px;overflow:hidden;text-overflow:ellipsis" title="${r.note||''}">${r.note||'-'}</td>
            <td><button class="act-btn act-delete" data-id="${r.id}" data-table="${API_BW}"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    }).join('');
    tbody.querySelectorAll('.act-delete').forEach(btn=>btn.addEventListener('click',()=>{
        deleteTargetId=btn.dataset.id; deleteTargetTable=btn.dataset.table;
        document.getElementById('deleteModal').style.display='flex';
    }));
}

/* =====================================================
   기타 업무 탭 (비만 / SWI / 옴부즈만)
   ===================================================== */
const ETC_CONFIG = {
    biman: { label:'비만 관리', color:C.blue,   chartColor:'rgba(0,217,255,0.7)' },
    swi:   { label:'SWI',       color:C.green,  chartColor:'rgba(0,255,163,0.7)' },
    ombu:  { label:'옴부즈만',  color:C.purple, chartColor:'rgba(167,139,250,0.7)' },
};

function initEtcForms() {
    const today = new Date().toISOString().split('T')[0];
    ['biman','swi','ombu'].forEach(type=>{
        const form = document.getElementById(`${type}Form`);
        // 날짜 초기값 = 오늘
        const dateInput = form.querySelector('[name=date]');
        if(dateInput) dateInput.value = today;
        form.addEventListener('submit', e=>{
            e.preventDefault();
            saveEtcRecord(type, e.target);
        });
    });
}

function saveEtcRecord(type, form) {
    const date      = form.querySelector('[name=date]').value;
    const workplace = form.querySelector('[name=workplace]').value.trim();
    const jongye    = form.querySelector('[name=jongye]').value;
    const count     = parseInt(form.querySelector('[name=count]').value)||1;
    const note      = form.querySelector('[name=note]').value.trim();
    if(!date){showToast('날짜를 입력해 주세요.','error');return;}
    const record = { id:lsUUID(), work_type:type, date, workplace, jongye, count, note, created_at:Date.now() };
    lsSave(API_ETC, record);
    showToast('추가되었습니다.');
    form.querySelector('[name=date]').value=new Date().toISOString().split('T')[0];
    form.querySelector('[name=workplace]').value='';
    form.querySelector('[name=jongye]').value='';
    form.querySelector('[name=count]').value='1';
    form.querySelector('[name=note]').value='';
    loadEtcData();
}

function loadEtcData() {
    const all = lsLoad(API_ETC).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    state.etc.biman = all.filter(r=>r.work_type==='biman');
    state.etc.swi   = all.filter(r=>r.work_type==='swi');
    state.etc.ombu  = all.filter(r=>r.work_type==='ombu');
    renderEtcAll();
}

function renderEtcAll() {
    const curY=String(new Date().getFullYear());
    ['biman','swi','ombu'].forEach(type=>{
        const data=state.etc[type];
        const yearData=data.filter(r=>r.date?.startsWith(curY));
        const totalCount=yearData.reduce((s,r)=>s+(r.count||0),0);
        // 상단 KPI
        setEl(`etc_kpi_${type}`, totalCount+'건');
        setEl(`etc_${type}_total_inline`, totalCount+'건');
        setEl(`${type}RowCount`, data.length+'건');
        renderEtcTable(type, data);
        renderEtcChart(type, data, curY);
    });
}

function renderEtcTable(type, data) {
    const tbody=document.getElementById(`${type}TableBody`);
    if(!data.length){tbody.innerHTML=`<tr><td colspan="6"><div class="empty-state sm"><i class="fas fa-plus-circle"></i><p>입력해 주세요</p></div></td></tr>`;return;}
    tbody.innerHTML=data.slice(0,30).map(r=>`<tr>
        <td style="font-family:var(--mono);color:var(--blue)">${r.date||'-'}</td>
        <td style="max-width:100px;overflow:hidden;text-overflow:ellipsis">${r.workplace||'-'}</td>
        <td>${r.jongye?jongYeBadge(r.jongye):'<span class="badge b-etc">-</span>'}</td>
        <td style="font-family:var(--mono);text-align:center;color:var(--teal);font-weight:700">${r.count||1}</td>
        <td style="color:var(--sub);max-width:100px;overflow:hidden;text-overflow:ellipsis" title="${r.note||''}">${r.note||'-'}</td>
        <td><button class="act-btn act-delete" data-id="${r.id}" data-table="${API_ETC}"><i class="fas fa-trash"></i></button></td>
    </tr>`).join('');
    tbody.querySelectorAll('.act-delete').forEach(btn=>btn.addEventListener('click',()=>{
        deleteTargetId=btn.dataset.id; deleteTargetTable=btn.dataset.table;
        document.getElementById('deleteModal').style.display='flex';
    }));
}

function renderEtcChart(type, data, curY) {
    const months=Array.from({length:12},(_,i)=>`${i+1}월`);
    const mC=Array(12).fill(0);
    data.filter(r=>r.date?.startsWith(curY)).forEach(r=>{
        const m=parseInt(r.date?.substring(5,7)||'')-1;
        if(!isNaN(m)&&m>=0&&m<12) mC[m]+=(r.count||1);
    });
    const cfg=ETC_CONFIG[type];
    destroyChart(`etc_${type}`);
    CH[`etc_${type}`]=safeChart(`${type}Chart`,{
        type:'bar',
        data:{labels:months,datasets:[{label:cfg.label,data:mC,backgroundColor:cfg.chartColor,borderRadius:4}]},
        options:{...barOpts(),plugins:{...barOpts().plugins,legend:{display:false}}}
    });
}

/* =====================================================
   공통 페이지네이션
   ===================================================== */
function renderPagination(cid, total, current, onPage) {
    const c=document.getElementById(cid);
    if(total<=1){c.innerHTML='';return;}
    const s=Math.max(1,current-3), e=Math.min(total,current+3);
    let h='';
    if(current>1) h+=`<button class="page-btn" data-p="${current-1}">‹</button>`;
    for(let p=s;p<=e;p++) h+=`<button class="page-btn${p===current?' active':''}" data-p="${p}">${p}</button>`;
    if(current<total) h+=`<button class="page-btn" data-p="${current+1}">›</button>`;
    c.innerHTML=h;
    c.querySelectorAll('.page-btn').forEach(btn=>btn.addEventListener('click',()=>onPage(parseInt(btn.dataset.p))));
}
