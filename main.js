<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>기업건강의학센터 | 업무 현황</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link rel="stylesheet" href="css/style.css">
    <!-- 엑셀 변환 후 생성되는 데이터 파일 -->
    <script src="data/knx.js"></script>
    <script src="data/req.js"></script>
    <script src="data/hgc.js"></script>
</head>
<body>

<!-- ===== HEADER ===== -->
<header class="main-header">
    <div class="header-inner">
        <div class="header-left">
            <div class="logo-icon"><i class="fas fa-heartbeat"></i></div>
            <div class="logo-text">
                <span class="logo-main">기업건강의학센터</span>
                <span class="logo-sub">업무 현황 대시보드</span>
            </div>
        </div>
        <div class="header-right">
            <div class="data-status" id="dataStatus">
                <span class="status-dot idle"></span> 데이터 미로드
            </div>
            <div class="current-time" id="currentTime"></div>
        </div>
    </div>
    <nav class="tab-nav">
        <button class="tab-btn active" data-tab="tab-visual">
            <i class="fas fa-chart-line"></i> 시각화 현황
        </button>
        <button class="tab-btn" data-tab="tab-upload">
            <i class="fas fa-upload"></i> 데이터 입력
        </button>
        <button class="tab-btn" data-tab="tab-etc">
            <i class="fas fa-clipboard-list"></i> 기타 업무
        </button>
    </nav>
</header>

<!-- ============================================================
     TAB 1 : 시각화 현황
     ============================================================ -->
<main class="tab-content active" id="tab-visual">
<div class="page-container">


    <!-- ══ 섹션 A : 정기 전송 ══ -->
    <div class="section-title-bar">
        <div class="section-tag tag-green">정기 전송</div>
    </div>
    <div class="kpi-grid four-col mb16">
        <div class="kpi-card accent-green">
            <div class="kpi-icon"><i class="fas fa-layer-group"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="v_bw_total">-</div>
                <div class="kpi-label">올해 총 발송 회차</div>
            </div>
        </div>
        <div class="kpi-card accent-teal">
            <div class="kpi-icon"><i class="fas fa-file-medical"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="v_bw_sogyeon">-</div>
                <div class="kpi-label">사후관리 소견서 발송</div>
                <div class="kpi-sub">누적</div>
            </div>
        </div>
        <div class="kpi-card accent-yellow">
            <div class="kpi-icon"><i class="fas fa-brain"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="v_bw_noesim">-</div>
                <div class="kpi-label">뇌심·직무 발송</div>
                <div class="kpi-sub">누적</div>
            </div>
        </div>
        <div class="kpi-card accent-purple">
            <div class="kpi-icon"><i class="fas fa-calendar-week"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="v_bw_month">-</div>
                <div class="kpi-label" id="v_bw_month_label">최근 발송일</div>
            </div>
        </div>
    </div>
    <div class="charts-grid mb24">
        <div class="chart-card wide">
            <div class="chart-header">
                <h3><i class="fas fa-chart-bar"></i> 월별 정기 사후관리 발송 현황</h3>
            </div>
            <div style="height:240px"><canvas id="v_bwMonthlyChart"></canvas></div>
        </div>
    </div>



    <!-- ══ 섹션 B : KNX 발송 ══ -->
    <div class="section-title-bar">
        <div class="section-tag tag-blue">KNX 발송</div>
        <span class="sheet-status" id="knxSheetStatus">미로드</span>
    </div>
    
    <!-- 통합 필터 -->
    <div class="filter-bar">
        <div class="filter-group">
            <label><i class="fas fa-calendar-alt"></i> 연도</label>
            <div class="filter-buttons" id="visYearFilter">
                <button class="filter-btn active" data-year="all">전체</button>
            </div>
        </div>
        <div class="filter-group">
            <label><i class="fas fa-stethoscope"></i> 예/종건</label>
            <div class="filter-buttons" id="visJyFilter">
                <button class="filter-btn active" data-jy="all">전체</button>
                <button class="filter-btn" data-jy="예건">예건</button>
                <button class="filter-btn" data-jy="종건">종건</button>
            </div>
        </div>
    </div>
    
    
    <div class="kpi-grid four-col mb16">
        <div class="kpi-card accent-blue">
            <div class="kpi-icon"><i class="fas fa-paper-plane"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="v_knx_total">-</div>
                <div class="kpi-label">올해 총 전송</div>
            </div>
        </div>
        <div class="kpi-card accent-green">
            <div class="kpi-icon"><i class="fas fa-calendar-check"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="v_knx_month">-</div>
                <div class="kpi-label">이번 달</div>
            </div>
        </div>
        <div class="kpi-card accent-teal">
            <div class="kpi-icon"><i class="fas fa-building"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="v_knx_clients">-</div>
                <div class="kpi-label">거래처 수</div>
            </div>
        </div>
        <div class="kpi-card accent-red">
            <div class="kpi-icon"><i class="fas fa-database"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="v_knx_items">-</div>
                <div class="kpi-label">항목 합계</div>
            </div>
        </div>
    </div>
    <div class="charts-grid three-col mb8">
        <div class="chart-card wide-2">
            <div class="chart-header">
                <h3><i class="fas fa-chart-bar"></i> KNX 월별 전송 건수</h3>
            </div>
            <div style="height:240px"><canvas id="v_knxMonthlyChart"></canvas></div>
        </div>
        <div class="chart-card">
            <div class="chart-header">
                <h3><i class="fas fa-layer-group"></i> 거래처별 Top 10</h3>
            </div>
            <div style="height:240px"><canvas id="v_knxGroupChart"></canvas></div>
        </div>
    </div>
    <div class="charts-grid mb24">
        <div class="chart-card">
            <div class="chart-header">
                <h3><i class="fas fa-boxes"></i> 항목별 건수</h3>
            </div>
            <div style="height:260px"><canvas id="v_knxItemChart"></canvas></div>
        </div>
        <div class="chart-card">
            <div class="chart-header">
                <h3><i class="fas fa-file-alt"></i> 요청 자료 Top 10 <span class="chart-sub">(비고 기준)</span></h3>
            </div>
            <div style="height:260px"><canvas id="v_knxMemoChart"></canvas></div>
        </div>
    </div>

    <!-- ══ 섹션 C : 자료요청 회신 ══ -->
    <div class="section-title-bar">
        <div class="section-tag tag-orange">자료요청 회신</div>
        <span class="sheet-status" id="reqSheetStatus">미로드</span>
    </div>
    <div class="kpi-grid four-col mb16">
        <div class="kpi-card accent-orange">
            <div class="kpi-icon"><i class="fas fa-inbox"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="v_req_total">-</div>
                <div class="kpi-label">올해 총 회신</div>
            </div>
        </div>
        <div class="kpi-card accent-green">
            <div class="kpi-icon"><i class="fas fa-calendar-check"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="v_req_month">-</div>
                <div class="kpi-label">이번 달 회신</div>
            </div>
        </div>
        <div class="kpi-card accent-blue">
            <div class="kpi-icon"><i class="fas fa-building"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="v_req_clients">-</div>
                <div class="kpi-label">거래처 수</div>
            </div>
        </div>
        <div class="kpi-card accent-purple">
            <div class="kpi-icon"><i class="fas fa-database"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="v_req_items">-</div>
                <div class="kpi-label">항목 합계</div>
            </div>
        </div>
    </div>
    <div class="charts-grid three-col mb8">
        <div class="chart-card wide-2">
            <div class="chart-header">
                <h3><i class="fas fa-chart-bar"></i> 자료요청 월별 회신 건수</h3>
            </div>
            <div style="height:240px"><canvas id="v_reqMonthlyChart"></canvas></div>
        </div>
        <div class="chart-card">
            <div class="chart-header">
                <h3><i class="fas fa-layer-group"></i> 거래처별 Top 10</h3>
            </div>
            <div style="height:240px"><canvas id="v_reqGroupChart"></canvas></div>
        </div>
    </div>
    <div class="charts-grid mb24">
        <div class="chart-card">
            <div class="chart-header">
                <h3><i class="fas fa-boxes"></i> 항목별 건수</h3>
            </div>
            <div style="height:260px"><canvas id="v_reqItemChart"></canvas></div>
        </div>
        <div class="chart-card">
            <div class="chart-header">
                <h3><i class="fas fa-file-alt"></i> 요청 자료 Top 10 <span class="chart-sub">(비고 기준)</span></h3>
            </div>
            <div style="height:260px"><canvas id="v_reqMemoChart"></canvas></div>
        </div>
    </div>

    <!-- ══ 섹션 D : 종합 비교 ══ -->
    <div class="section-title-bar">
        <div class="section-tag tag-purple">종합 비교</div>
    </div>
    <div class="charts-grid mb24">
        <div class="chart-card wide">
            <div class="chart-header">
                <h3><i class="fas fa-chart-line"></i> 월별 통합 건수 추이</h3>
                <div class="chart-legend">
                    <span class="legend-item"><span class="dot green"></span>정기 발송</span>
                    <span class="legend-item"><span class="dot blue"></span>KNX</span>
                    <span class="legend-item"><span class="dot orange"></span>자료요청</span>
                </div>
            </div>
            <div style="height:280px"><canvas id="v_combinedChart"></canvas></div>
        </div>
    </div>

</div>
</main>

<!-- ============================================================
     TAB 2 : 데이터 입력
     ============================================================ -->
<main class="tab-content" id="tab-upload">
<div class="page-container">
    <div class="upload-page-grid">

        <!-- 좌: 정기 발송 입력 -->
        <section class="upload-section-card">
            <div class="upload-section-header green">
                <i class="fas fa-calendar-week"></i>
                <div>
                    <strong>2주 정기 발송 입력</strong>
                    <span>이메일 대신 여기에 기록하세요</span>
                </div>
            </div>
            <div class="mini-kpi-row">
                <div class="mini-kpi"><span class="mini-val" id="up_bw_total">-</span><span class="mini-label">올해 총 회차</span></div>
                <div class="mini-kpi"><span class="mini-val green" id="up_bw_sogyeon">-</span><span class="mini-label">사후관리 소견서</span></div>
                <div class="mini-kpi"><span class="mini-val yellow" id="up_bw_noesim">-</span><span class="mini-label">뇌심·직무</span></div>
                <div class="mini-kpi"><span class="mini-val blue" id="up_bw_month">-</span><span class="mini-label">이번 달</span></div>
            </div>
            <form class="report-form" id="biweeklyForm">
                <div class="form-group">
                    <label><i class="fas fa-tag"></i> 발송 항목 구분 <span class="required">*</span></label>
                    <div class="radio-group">
                        <label class="radio-label">
                            <input type="radio" name="report_type" value="사후관리 소견서" checked>
                            <span class="radio-custom"></span><span>사후관리 소견서</span>
                        </label>
                        <label class="radio-label">
                            <input type="radio" name="report_type" value="뇌심·직무">
                            <span class="radio-custom"></span><span>뇌심·직무</span>
                        </label>
                    </div>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-calendar-alt"></i> 대상 기간 <span class="required">*</span></label>
                    <div class="date-range-row">
                        <input type="date" id="periodStart" class="form-input" required>
                        <span class="date-sep">~</span>
                        <input type="date" id="periodEnd" class="form-input" required>
                    </div>
                    <div class="period-quick">
                        <button type="button" class="quick-btn" data-period="first">이번달 1~15일</button>
                        <button type="button" class="quick-btn" data-period="second">이번달 16~말일</button>
                        <button type="button" class="quick-btn" data-period="prev-first">저번달 1~15일</button>
                        <button type="button" class="quick-btn" data-period="prev-second">저번달 16~말일</button>
                    </div>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-calendar-check"></i> 발송일 <span class="required">*</span></label>
                    <input type="date" id="sendDate" class="form-input" required>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-building"></i> 대상 사업장 수 <span class="required">*</span></label>
                    <div class="count-row">
                        <div class="count-box">
                            <span class="count-label">종건</span>
                            <div class="count-input-wrap">
                                <button type="button" class="count-btn minus" data-target="jongCount">−</button>
                                <input type="number" id="jongCount" class="count-input" value="0" min="0">
                                <button type="button" class="count-btn plus" data-target="jongCount">+</button>
                            </div>
                            <span class="count-unit">개소</span>
                        </div>
                        <div class="count-box">
                            <span class="count-label">예건</span>
                            <div class="count-input-wrap">
                                <button type="button" class="count-btn minus" data-target="yeCount">−</button>
                                <input type="number" id="yeCount" class="count-input" value="0" min="0">
                                <button type="button" class="count-btn plus" data-target="yeCount">+</button>
                            </div>
                            <span class="count-unit">개소</span>
                        </div>
                    </div>
                    <div class="count-total">합계: <strong id="totalCount">0</strong> 개소</div>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-sticky-note"></i> 메모 (선택)</label>
                    <textarea id="reportNote" class="form-textarea" placeholder="특이사항 등" rows="2"></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" id="clearFormBtn"><i class="fas fa-undo"></i> 초기화</button>
                    <button type="submit" class="btn-primary" id="saveReportBtn"><i class="fas fa-save"></i> 저장</button>
                </div>
            </form>
            <div class="bw-list-header">
                <h4><i class="fas fa-list-alt"></i> 발송 보고 목록</h4>
                <div class="filter-buttons" id="upBwYearFilter"><button class="filter-btn active" data-year="all">전체</button></div>
                <span class="row-count" id="bwRowCount">0건</span>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr><th>발송일</th><th>항목</th><th>대상 기간</th><th>종건</th><th>예건</th><th>합계</th><th>메모</th><th></th></tr>
                    </thead>
                    <tbody id="biweeklyTableBody">
                        <tr><td colspan="8"><div class="empty-state sm"><i class="fas fa-plus-circle"></i><p>폼으로 입력해 주세요</p></div></td></tr>
                    </tbody>
                </table>
            </div>
        </section>

        <!-- 우: 데이터 현황 -->
        <section class="upload-section-card">
            <div class="upload-section-header blue">
                <i class="fas fa-database"></i>
                <div>
                    <strong>KNX / 자료요청 데이터 현황</strong>
                    <span>convert.exe 실행 후 data/ 폴더를 NAS에 복사하세요</span>
                </div>
            </div>

            <!-- 로드 상태 카드 -->
            <div class="sheet-result-row">
                <div class="sheet-result-card" id="sheetResult1">
                    <div class="sheet-result-icon blue"><i class="fas fa-paper-plane"></i></div>
                    <div class="sheet-result-body">
                        <div class="sheet-result-name">KNX 발송</div>
                        <div class="sheet-result-count" id="sheet1Count">-</div>
                        <div class="sheet-result-status" id="sheet1Status">확인 중</div>
                    </div>
                </div>
                <div class="sheet-result-card" id="sheetResult2">
                    <div class="sheet-result-icon orange"><i class="fas fa-inbox"></i></div>
                    <div class="sheet-result-body">
                        <div class="sheet-result-name">자료요청서</div>
                        <div class="sheet-result-count" id="sheet2Count">-</div>
                        <div class="sheet-result-status" id="sheet2Status">확인 중</div>
                    </div>
                </div>
            </div>

            <!-- 사용 안내 -->
            <div class="upload-guide">
                <div class="guide-title"><i class="fas fa-terminal"></i> 데이터 갱신 방법</div>
                <ol class="guide-steps">
                    <li><i class="fas fa-file-excel" style="color:#1d6f42"></i> <strong>업무현황.xlsx</strong> 편집 후 저장</li>
                    <li><i class="fas fa-cog" style="color:var(--blue)"></i> <strong>convert.exe</strong> 더블클릭 실행</li>
                    <li><i class="fas fa-copy" style="color:var(--teal)"></i> <strong>data/</strong> 폴더를 NAS에 덮어쓰기 복사</li>
                    <li><i class="fas fa-sync" style="color:var(--green)"></i> 브라우저에서 <kbd>F5</kbd> 새로고침</li>
                </ol>
            </div>

            <!-- KNX 테이블 -->
            <div class="mini-table-section">
                <div class="table-header">
                    <h4><i class="fas fa-paper-plane" style="color:var(--blue)"></i> KNX 발송 상세</h4>
                    <div class="table-controls">
                        <input type="text" id="knxSearch" placeholder="검색..." class="search-input sm">
                        <span class="row-count" id="knxRowCount">0건</span>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table id="knxTable">
                        <thead>
                            <tr>
                                <th>발송일자</th><th>예/종건</th><th>사업장명</th><th>거래처구분</th>
                                <th>세로</th><th>가로</th><th>뇌심</th><th>직무</th><th>정신</th><th>동의자</th><th>사업장양식</th><th>사이트</th><th>통계</th>
                                <th>합계</th><th>제공형태</th><th>발송인</th><th>비고</th>
                            </tr>
                        </thead>
                        <tbody id="knxTableBody">
                            <tr><td colspan="17"><div class="empty-state sm"><i class="fas fa-cog"></i><p>convert.exe 실행 후 data/ 복사 → F5</p></div></td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="table-footer"><div class="pagination" id="knxPagination"></div></div>
            </div>

            <!-- 자료요청 테이블 -->
            <div class="mini-table-section">
                <div class="table-header">
                    <h4><i class="fas fa-inbox" style="color:var(--orange)"></i> 자료요청서 회신 상세</h4>
                    <div class="table-controls">
                        <input type="text" id="reqSearch" placeholder="검색..." class="search-input sm">
                        <span class="row-count" id="reqRowCount">0건</span>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table id="reqTable">
                        <thead>
                            <tr>
                                <th>발송일자</th><th>예/종건</th><th>사업장명</th><th>거래처구분</th>
                                <th>세로</th><th>가로</th><th>뇌심</th><th>직무</th><th>정신</th><th>동의자</th><th>사업장양식</th><th>사이트</th><th>통계</th>
                                <th>합계</th><th>발송인</th><th>비고</th>
                            </tr>
                        </thead>
                        <tbody id="reqTableBody">
                            <tr><td colspan="16"><div class="empty-state sm"><i class="fas fa-cog"></i><p>convert.exe 실행 후 data/ 복사 → F5</p></div></td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="table-footer"><div class="pagination" id="reqPagination"></div></div>
            </div>
        </section>
    </div>
</div>
</main>

<!-- ============================================================
     TAB 3 : 기타 업무 (비만·SWI·옴부즈만)
     ============================================================ -->
<main class="tab-content" id="tab-etc">
<div class="page-container">

    <!-- 상단 요약 KPI -->
    <div class="kpi-grid three-col mb16">
        <div class="kpi-card accent-blue">
            <div class="kpi-icon"><i class="fas fa-weight"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="etc_kpi_biman">-</div>
                <div class="kpi-label">비만 관리 (올해)</div>
            </div>
        </div>
        <div class="kpi-card accent-green">
            <div class="kpi-icon"><i class="fas fa-heartbeat"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="etc_kpi_swi">-</div>
                <div class="kpi-label">SWI (올해)</div>
            </div>
        </div>
        <div class="kpi-card accent-purple">
            <div class="kpi-icon"><i class="fas fa-comments"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="etc_kpi_ombu">-</div>
                <div class="kpi-label">옴부즈만 (올해)</div>
            </div>
        </div>
    </div>

    <div class="etc-grid">

        <!-- ── 비만 ── -->
        <div class="etc-card">
            <div class="etc-card-header biman">
                <i class="fas fa-weight"></i>
                <div><strong>비만 관리</strong><span>건수 직접 입력</span></div>
                <div class="etc-kpi-inline">
                    <span id="etc_biman_total_inline">0건</span>
                </div>
            </div>
            <form class="etc-form" id="bimanForm" data-type="biman">
                <div class="etc-form-row">
                    <div class="form-group">
                        <label><i class="fas fa-calendar"></i> 날짜 <span class="required">*</span></label>
                        <input type="date" class="form-input" name="date" required>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-building"></i> 사업장명</label>
                        <input type="text" class="form-input" name="workplace" placeholder="사업장명">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-stethoscope"></i> 예/종건</label>
                        <select class="form-input" name="jongye">
                            <option value="">-</option>
                            <option value="예건">예건</option>
                            <option value="종건">종건</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-hashtag"></i> 건수 <span class="required">*</span></label>
                        <input type="number" class="form-input" name="count" value="1" min="1" required>
                    </div>
                    <div class="form-group full-row">
                        <label><i class="fas fa-sticky-note"></i> 메모</label>
                        <input type="text" class="form-input" name="note" placeholder="메모">
                    </div>
                </div>
                <button type="submit" class="btn-primary sm-btn"><i class="fas fa-plus"></i> 추가</button>
            </form>
            <div class="etc-table-wrap">
                <div class="etc-table-header">
                    <span class="row-count" id="bimanRowCount">0건</span>
                </div>
                <div class="table-wrapper">
                    <table><thead>
                        <tr><th>날짜</th><th>사업장</th><th>예/종건</th><th>건수</th><th>메모</th><th></th></tr>
                    </thead>
                    <tbody id="bimanTableBody">
                        <tr><td colspan="6"><div class="empty-state sm"><i class="fas fa-plus-circle"></i><p>입력해 주세요</p></div></td></tr>
                    </tbody></table>
                </div>
            </div>
            <div class="etc-chart-wrap">
                <div class="chart-header"><h3><i class="fas fa-chart-bar"></i> 월별 추이</h3></div>
                <div style="height:180px"><canvas id="bimanChart"></canvas></div>
            </div>
        </div>

        <!-- ── SWI ── -->
        <div class="etc-card">
            <div class="etc-card-header swi">
                <i class="fas fa-heartbeat"></i>
                <div><strong>SWI</strong><span>건수 직접 입력</span></div>
                <div class="etc-kpi-inline">
                    <span id="etc_swi_total_inline">0건</span>
                </div>
            </div>
            <form class="etc-form" id="swiForm" data-type="swi">
                <div class="etc-form-row">
                    <div class="form-group">
                        <label><i class="fas fa-calendar"></i> 날짜 <span class="required">*</span></label>
                        <input type="date" class="form-input" name="date" required>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-building"></i> 사업장명</label>
                        <input type="text" class="form-input" name="workplace" placeholder="사업장명">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-stethoscope"></i> 예/종건</label>
                        <select class="form-input" name="jongye">
                            <option value="">-</option>
                            <option value="예건">예건</option>
                            <option value="종건">종건</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-hashtag"></i> 건수 <span class="required">*</span></label>
                        <input type="number" class="form-input" name="count" value="1" min="1" required>
                    </div>
                    <div class="form-group full-row">
                        <label><i class="fas fa-sticky-note"></i> 메모</label>
                        <input type="text" class="form-input" name="note" placeholder="메모">
                    </div>
                </div>
                <button type="submit" class="btn-primary sm-btn"><i class="fas fa-plus"></i> 추가</button>
            </form>
            <div class="etc-table-wrap">
                <div class="etc-table-header">
                    <span class="row-count" id="swiRowCount">0건</span>
                </div>
                <div class="table-wrapper">
                    <table><thead>
                        <tr><th>날짜</th><th>사업장</th><th>예/종건</th><th>건수</th><th>메모</th><th></th></tr>
                    </thead>
                    <tbody id="swiTableBody">
                        <tr><td colspan="6"><div class="empty-state sm"><i class="fas fa-plus-circle"></i><p>입력해 주세요</p></div></td></tr>
                    </tbody></table>
                </div>
            </div>
            <div class="etc-chart-wrap">
                <div class="chart-header"><h3><i class="fas fa-chart-bar"></i> 월별 추이</h3></div>
                <div style="height:180px"><canvas id="swiChart"></canvas></div>
            </div>
        </div>

        <!-- ── 옴부즈만 ── -->
        <div class="etc-card">
            <div class="etc-card-header ombu">
                <i class="fas fa-comments"></i>
                <div><strong>옴부즈만</strong><span>건수 직접 입력</span></div>
                <div class="etc-kpi-inline">
                    <span id="etc_ombu_total_inline">0건</span>
                </div>
            </div>
            <form class="etc-form" id="ombuForm" data-type="ombu">
                <div class="etc-form-row">
                    <div class="form-group">
                        <label><i class="fas fa-calendar"></i> 날짜 <span class="required">*</span></label>
                        <input type="date" class="form-input" name="date" required>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-building"></i> 사업장명</label>
                        <input type="text" class="form-input" name="workplace" placeholder="사업장명">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-stethoscope"></i> 예/종건</label>
                        <select class="form-input" name="jongye">
                            <option value="">-</option>
                            <option value="예건">예건</option>
                            <option value="종건">종건</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-hashtag"></i> 건수 <span class="required">*</span></label>
                        <input type="number" class="form-input" name="count" value="1" min="1" required>
                    </div>
                    <div class="form-group full-row">
                        <label><i class="fas fa-sticky-note"></i> 메모</label>
                        <input type="text" class="form-input" name="note" placeholder="메모">
                    </div>
                </div>
                <button type="submit" class="btn-primary sm-btn"><i class="fas fa-plus"></i> 추가</button>
            </form>
            <div class="etc-table-wrap">
                <div class="etc-table-header">
                    <span class="row-count" id="ombuRowCount">0건</span>
                </div>
                <div class="table-wrapper">
                    <table><thead>
                        <tr><th>날짜</th><th>사업장</th><th>예/종건</th><th>건수</th><th>메모</th><th></th></tr>
                    </thead>
                    <tbody id="ombuTableBody">
                        <tr><td colspan="6"><div class="empty-state sm"><i class="fas fa-plus-circle"></i><p>입력해 주세요</p></div></td></tr>
                    </tbody></table>
                </div>
            </div>
            <div class="etc-chart-wrap">
                <div class="chart-header"><h3><i class="fas fa-chart-bar"></i> 월별 추이</h3></div>
                <div style="height:180px"><canvas id="ombuChart"></canvas></div>
            </div>
        </div>

    </div><!-- /etc-grid -->
</div>
</main>

<!-- ===== 삭제 확인 모달 ===== -->
<div class="modal-overlay" id="deleteModal" style="display:none">
    <div class="modal small">
        <div class="modal-header">
            <h3><i class="fas fa-trash-alt" style="color:var(--red)"></i> 삭제 확인</h3>
        </div>
        <div class="modal-body"><p>이 항목을 삭제하시겠습니까?</p></div>
        <div class="modal-footer">
            <button class="btn-secondary" id="cancelDelete">취소</button>
            <button class="btn-danger" id="confirmDelete">삭제</button>
        </div>
    </div>
</div>

<script src="js/main.js"></script>
</body>
</html>


