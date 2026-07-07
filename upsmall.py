"""
hgc.js 읽기 -> 사후/뇌심직무/Item1~4 집계 -> 발송현황.xlsx 생성

사용법:
    python3 make_report.py data/hgc.js [출력경로.xlsx]
    (출력경로 생략 시 ./발송현황.xlsx 로 저장)
"""

import sys
import json
import re
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# 발송항목 정의: (표시 이름, 레코드 필터 함수)
CATEGORIES = [
    ("사후", lambda r: True),
    ("뇌심 직무", lambda r: r["items"][0] or r["items"][1]),
    ("Item1", lambda r: r["items"][0]),
    ("Item2", lambda r: r["items"][1]),
    ("Item3", lambda r: r["items"][2]),
    ("Item4", lambda r: r["items"][3]),
]


def load_records_from_js(path):
    """'const 변수 = [ {...} ];' 형태 js 파일 또는 순수 JSON 배열 파일을 읽어 레코드 리스트 반환"""
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()

    start, end = text.find("["), text.rfind("]")
    if start == -1 or end == -1:
        raise ValueError("배열 형태([...])를 파일에서 찾지 못했습니다.")

    array_text = re.sub(r",\s*([\]}])", r"\1", text[start:end + 1])  # trailing comma 제거
    return json.loads(array_text)


def _fmt_period(records):
    if not records:
        return ""
    d1 = datetime.strptime(records[0]["periodStart"], "%Y-%m-%d")
    d2 = datetime.strptime(records[0]["periodEnd"], "%Y-%m-%d")
    return f"{d1.month}/{d1.day}~{d2.month}/{d2.day}"


def _count_by_jongye(records):
    counts = {"종건": {"complete": 0, "total": 0}, "예건": {"complete": 0, "total": 0}}
    for r in records:
        jy = r["jongYe"]
        counts[jy]["total"] += 1
        if r["status"] == "complete":
            counts[jy]["complete"] += 1
    return counts


def aggregate(records):
    """CATEGORIES 별로 종건/예건 완료·대상 건수를 집계해서 표 행 리스트로 반환"""
    rows = []
    for label, cond in CATEGORIES:
        filtered = [r for r in records if cond(r)]
        counts = _count_by_jongye(filtered)
        has_complete = any(r["status"] == "complete" for r in filtered)

        lines = []
        for jy in ("종건", "예건"):
            c = counts[jy]
            if c["total"] == 0:
                continue
            lines.append(f"{jy} {c['complete']}/{c['total']}")

        status = "-" if not filtered else ("발송완료" if has_complete else "발송예정")

        rows.append({
            "발송항목": label,
            "대상 기간": _fmt_period(filtered) or _fmt_period(records),
            "대상 사업장": lines if lines else ["-"],
            "진행 상태": status,
        })
    return rows


def write_excel(rows, path="발송현황.xlsx", sheet_title="발송현황"):
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_title

    thin = Side(style="thin", color="000000")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    center = Alignment(horizontal="center", vertical="center", wrap_text=True)

    headers = ["발송항목", "대상 기간", "대상 사업장", "진행 상태"]
    for col, text in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col, value=text)
        cell.font = Font(bold=True)
        cell.alignment = center
        cell.border = border

    r = 2
    for row in rows:
        entries = row["대상 사업장"]
        span = len(entries)
        start_row, end_row = r, r + span - 1

        for col, val in ((1, row["발송항목"]), (2, row["대상 기간"]), (4, row["진행 상태"])):
            ws.cell(row=start_row, column=col, value=val)
            if span > 1:
                ws.merge_cells(start_row=start_row, start_column=col, end_row=end_row, end_column=col)

        for i, entry in enumerate(entries):
            c = ws.cell(row=start_row + i, column=3, value=entry)
            c.alignment = center
            c.border = border

        for rr in range(start_row, end_row + 1):
            for col in (1, 2, 4):
                cell = ws.cell(row=rr, column=col)
                cell.alignment = center
                cell.border = border

        r = end_row + 1

    for i, w in enumerate([14, 16, 18, 14], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    wb.save(path)
    return path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법: python3 make_report.py hgc.js경로 [출력xlsx경로]")
        sys.exit(1)

    js_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else "발송현황.xlsx"

    records = load_records_from_js(js_path)
    rows = aggregate(records)
    saved = write_excel(rows, out_path)
    print(f"완료: {saved}")
