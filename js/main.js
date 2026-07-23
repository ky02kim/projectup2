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
        updateHgcMetrics();  // 정기 전송 KPI 업데이트 추가
    }, 500);

    // 데이터 상태 업데이트
    function updateDataStatus() {
        const statusEl = document.getElementById('dataStatus');
        if (window.knxData || window.reqData || window.hgcData) {
            statusEl.innerHTML = `<span class="status-dot loaded"></span> 데이터 로드됨`;
            statusEl.classList.add('loaded');
        }
    }

    // HGC 데이터 기반 정기 전송 KPI 업데이트 (TO BE: 자동 생성)
    function updateHgcMetrics() {
        if (!window.hgcData || window.hgcData.length === 0) {
            console.log('⚠️ HGC 데이터 없음 - 정기 전송 KPI 업데이트 스킵');
            return;
        }

        console.log('📊 정기 전송 KPI 자동 업데이트 시작...');

        // 1. 올해 총 발송 회차 (고유 파일일자 수)
        const uniqueDates = new Set(window.hgcData.map(item => item.파일일자));
        const totalSendCount = uniqueDates.size;

        // 2. 사후관리 소견서 발송 누적 (접수건수의 합)
        const totalReceived = window.hgcData.reduce((sum, item) => {
            const count = parseInt(item.접수건수) || 0;
            return sum + count;
        }, 0);

        // 3. 뇌심·직무 발송 누적 (상태가 '완료'인 것만 계산)
        const completeCount = window.hgcData.filter(item => item.상태 === '완료').length;

        // 4. 최근 발송일
        const dates = window.hgcData
            .map(item => item.파일일자)
            .filter(d => d)
            .sort()
            .reverse();
        const latestDate = dates[0] || '-';

        // KPI 요소 업데이트
        const elementsToUpdate = {
            'v_bw_total': totalSendCount,
            'v_bw_sogyeon': totalReceived,
            'v_bw_noesim': completeCount,
            'v_bw_month': latestDate
        };

        Object.entries(elementsToUpdate).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = value;
                console.log(`✅ ${id}: ${value}`);
            }
        });

        // 월별 차트 데이터 준비
        initBwMonthlyChart();
    }

    // 월별 정기 사후관리 발송 현황 차트 (HGC 데이터 기반)
    function initBwMonthlyChart() {
        if (!window.hgcData || window.hgcData.length === 0) return;
        
        if (typeof Chart === 'undefined') {
            console.log('⚠️ Chart.js 로드 안됨');
            return;
        }

        // 월별 데이터 집계
        const monthlyData = {};
        window.hgcData.forEach(item => {
            const date = item.파일일자; // "2025-03-01" 형식 가정
            if (!date) return;
            
            const month = date.substring(0, 7); // "2025-03"
            if (!monthlyData[month]) {
                monthlyData[month] = 0;
            }
            monthlyData[month] += parseInt(item.접수건수) || 0;
        });

        const months = Object.keys(monthlyData).sort();
        const counts = months.map(m => monthlyData[m]);

        const ctx = document.getElementById('v_bwMonthlyChart');
        if (!ctx) return;

        // 기존 차트 제거
        if (window.bwChart) {
            window.bwChart.destroy();
        }

        window.bwChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [{
                    label: '월별 발송 건수',
                    data: counts,
                    backgroundColor: 'rgba(76, 175, 80, 0.8)',
                    borderColor: 'rgba(76, 175, 80, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        console.log('✅ 월별 차트 생성 완료');
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

    // 초�� 렌더링 (setTimeout 안에서 호출됨)
    console.log('✅ 대시보드 초기화 완료!');
}); // DOMContentLoaded 끝
