// 메인 JS - 데이터 로드 및 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 대시보드 초기화 시작...');
    
    // file:// 환경에서 데이터 스크립트 로드가 늦을 수 있으므로 지연 실행
    setTimeout(function() {
        console.log('KNX 데이터:', window.knxData ? window.knxData.length + '건' : '없음');
        console.log('REQ 데이터:', window.reqData ? window.reqData.length + '건' : '없음');
        console.log('HGC 데이터:', window.hgcData ? window.hgcData.length + '건' : '없음');
        
        updateDataStatus();
        renderKnxTable();
        renderReqTable();
        renderHgcTable();
    }, 500);

    // 데이터 상태 업데이트
    function updateDataStatus() {
        const statusEl = document.getElementById('dataStatus');
        if (window.knxData || window.reqData || window.hgcData) {
            statusEl.innerHTML = `<span class="status-dot loaded"></span> 데이터 로드됨`;
            statusEl.classList.add('loaded');
        }
    }

    // KNX 데이터 표시
    function renderKnxTable() {
        const tbody = document.getElementById('knxTableBody');
        console.log('KNX 테이블 렌더링 시도... 데이터:', window.knxData ? window.knxData.length : 0);
        if (!window.knxData || window.knxData.length === 0) {
            console.log('⚠️ KNX 데이터 없음');
            return;
        }
        tbody.innerHTML = '';

        window.knxData.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.발송일자 || ''}</td>
                <td>${item.예종건 || ''}</td>
                <td>${item.사업장명 || ''}</td>
                <td>${item.거래처구분 || ''}</td>
                <td>${item.세로 || 0}</td>
                <td>${item.가로 || 0}</td>
                <td>${item.뇌심 || 0}</td>
                <td>${item.직무 || 0}</td>
                <td>${item.정신 || 0}</td>
                <td>${item.동의자 || 0}</td>
                <td>${item.사업장양식 || 0}</td>
                <td>${item.사이트 || 0}</td>
                <td>${item.통계 || 0}</td>
                <td><strong>${item.합계 || 0}</strong></td>
                <td>${item.제공형태 || ''}</td>
                <td>${item.발송인 || ''}</td>
                <td>${item.비고 || ''}</td>
            `;
            tbody.appendChild(tr);
        });
        document.getElementById('knxRowCount').textContent = `${window.knxData.length}건`;
    }

    // Req 데이터 표시
    function renderReqTable() {
        const tbody = document.getElementById('reqTableBody');
        if (!window.reqData || window.reqData.length === 0) return;

        tbody.innerHTML = '';
        window.reqData.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.발송일자 || ''}</td>
                <td>${item.예종건 || ''}</td>
                <td>${item.사업장명 || ''}</td>
                <td>${item.거래처구분 || ''}</td>
                <td>${item.세로 || 0}</td>
                <td>${item.가로 || 0}</td>
                <td>${item.뇌심 || 0}</td>
                <td>${item.직무 || 0}</td>
                <td>${item.정신 || 0}</td>
                <td>${item.동의자 || 0}</td>
                <td>${item.사업장양식 || 0}</td>
                <td>${item.사이트 || 0}</td>
                <td>${item.통계 || 0}</td>
                <td><strong>${item.합계 || 0}</strong></td>
                <td>${item.발송인 || ''}</td>
                <td>${item.비고 || ''}</td>
            `;
            tbody.appendChild(tr);
        });
        document.getElementById('reqRowCount').textContent = `${window.reqData.length}건`;
    }

    // HGC 테이블
    function renderHgcTable() {
        const tbody = document.getElementById('hgcTableBody');
        if (!window.hgcData) return;

        tbody.innerHTML = '';
        window.hgcData.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge ${item.상태 === '완료' ? 'badge-green' : 'badge-yellow'}">${item.상태}</span></td>
                <td>${item.파일일자}</td>
                <td>${item.종예건}</td>
                <td>${item.건진기간}</td>
                <td>${item.거래처명}</td>
                <td style="text-align:center"><strong>${item.접수건수}</strong></td>
                <td>${item.노동부보고}</td>
            `;
            tbody.appendChild(tr);
        });
        document.getElementById('bwRowCount').textContent = `${window.hgcData.length}건`;
    }

    // 간단 차트 초기화 (샘플)
    function initCharts() {
        // Chart.js 예시 (실제 데이터로 확장 가능)
        if (typeof Chart !== 'undefined') {
            console.log('📊 Chart.js 준비됨');
            // 실제 차트는 여기서 추가
        }
    }

    // 탭 전환
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    initCharts();

    console.log('✅ 대시보드 초기화 완료!');
}, 500); // setTimeout 닫기
});