"""
JS 배열(발송 대상 레코드) -> 엑셀 요약표 형식으로 자동 집계

규칙
----
1. '사후' 행: 전체 레코드를 종건/예건으로 나눠 집계
2. '뇌심 직무' 행: items[0] 또는 items[1] 이 True 인 레코드만 필터링 후 집계
3. 레코드에 status='complete' 가 하나라도 있으면 "완료수/전체수" 형식 + 진행상태 '발송완료'
   전부 status='target' 이면 "전체수" 형식만 + 진행상태 '발송예정'
"""

from datetime import datetime


def _fmt_date(iso_date: str) -> str:
    d = datetime.strptime(iso_date, "%Y-%m-%d")
    return f"{d.month}/{d.day}"


def _count_by_jongye(records):
    counts = {
        "종건": {"complete": 0, "total": 0},
        "예건": {"complete": 0, "total": 0},
    }
    for r in records:
        jy = r["jongYe"]
        counts[jy]["total"] += 1
        if r["status"] == "complete":
            counts[jy]["complete"] += 1
    return counts


def _build_row(label, records, period_start, period_end):
    counts = _count_by_jongye(records)
    has_complete = any(r["status"] == "complete" for r in records)

    lines = []
    for jy in ("종건", "예건"):
        c = counts[jy]
        if c["total"] == 0:
            continue
        if has_complete:
            lines.append(f"{jy} {c['complete']}/{c['total']}")
        else:
            lines.append(f"{jy} {c['total']}")

    return {
        "발송항목": label,
        "대상 기간": f"{_fmt_date(period_start)}~{_fmt_date(period_end)}",
        "대상 사업장": lines,  # 리스트로 반환 (엑셀 셀에서는 줄바꿈으로 표시)
        "진행 상태": "발송완료" if has_complete else "발송예정",
    }


def aggregate(records, period_start=None, period_end=None):
    """records: JS에서 넘어온 dict 리스트 (status/jongYe/workplace/items 등 포함)"""
    if not records:
        return []

    ps = period_start or records[0]["periodStart"]
    pe = period_end or records[0]["periodEnd"]

    rows = []
    rows.append(_build_row("사후", records, ps, pe))

    noesim = [r for r in records if r["items"][0] or r["items"][1]]
    rows.append(_build_row("뇌심 직무", noesim, ps, pe))

    return rows


def print_table(rows):
    """콘솔에서 이미지 표처럼 미리보기"""
    for row in rows:
        print(f"[{row['발송항목']}] 기간: {row['대상 기간']}  상태: {row['진행 상태']}")
        for line in row["대상 사업장"]:
            print(f"   {line}")
        print()


def to_paste_text(rows):
    """
    엑셀/워드에 그대로 복붙 가능한 tab-separated 텍스트로 변환.
    발송항목/대상기간/진행상태는 첫 줄에만 쓰고, 종건/예건은 두 줄로 나눠
    대상 사업장 칸만 채운다. (엑셀에 붙여넣은 뒤 세로 병합만 수동으로 하면 이미지와 동일)
    """
    lines = ["발송항목\t대상 기간\t대상 사업장\t진행 상태"]
    for row in rows:
        entries = row["대상 사업장"] if row["대상 사업장"] else ["-"]
        for i, entry in enumerate(entries):
            if i == 0:
                lines.append(f"{row['발송항목']}\t{row['대상 기간']}\t{entry}\t{row['진행 상태']}")
            else:
                lines.append(f"\t\t{entry}\t")
    return "\n".join(lines)


if __name__ == "__main__":
    # 사용자가 준 예시 데이터
    sample_records = [
        {
            "status": "complete",
            "fileDate": "2026-07-12",
            "fileTimestamp": "2026-07-12 13:29:39",
            "periodStart": "2026-06-15",
            "periodEnd": "2026-06-30",
            "jongYe": "종건",
            "workplace": "애플/직원",
            "receive": 5,
            "report": True,
            "items": [False, False, False, False],
        },
        {
            "status": "target",
            "fileDate": "2026-07-11",
            "fileTimestamp": "2026-07-11 13:29:39",
            "periodStart": "2026-06-15",
            "periodEnd": "2026-06-30",
            "jongYe": "종건",
            "workplace": "구글/직원",
            "receive": 19,
            "report": True,
            "items": [True, True, False, False],
        },
    ]

    result = aggregate(sample_records)
    print_table(result)
    print("--- 복붙용 (탭 구분) ---")
    print(to_paste_text(result))
