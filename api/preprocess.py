import json
import re
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler
from typing import Any, Dict, List, Tuple


VALID_MODULES = {"manpower", "equipment", "progress", "cost"}


def normalize_header(value: Any) -> str:
    text = str(value or "").strip().lower()
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")


def coerce_number(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)

    raw = str(value).strip()
    if not raw:
        return 0.0

    is_negative_wrapped = raw.startswith("(") and raw.endswith(")")
    cleaned = re.sub(r"[^0-9.\-]", "", raw)
    if not cleaned:
        return 0.0

    try:
        parsed = float(cleaned)
        return -abs(parsed) if is_negative_wrapped else parsed
    except ValueError:
        return 0.0


def coerce_iso_date(value: Any) -> str:
    if value is None:
        return ""

    if isinstance(value, (int, float)):
        # Excel serial date support.
        if 20000 <= float(value) <= 80000:
            date = datetime(1899, 12, 30) + timedelta(days=float(value))
            return date.date().isoformat()
        return ""

    raw = str(value).strip()
    if not raw:
        return ""

    # Handle ISO with time quickly.
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        pass

    for fmt in (
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%m-%d-%Y",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%d.%m.%Y",
        "%Y/%m/%d",
        "%d-%m-%y",
        "%d/%m/%y",
    ):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue

    return ""


def first_value(row: Dict[str, Any], aliases: List[str], default: Any = "") -> Any:
    for alias in aliases:
        key = normalize_header(alias)
        if key in row:
            value = row[key]
            if value is None:
                continue
            if isinstance(value, str) and not value.strip():
                continue
            return value
    return default


def normalize_status(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if "break" in raw or "down" in raw or "repair" in raw:
        return "breakdown"
    if "idle" in raw or "standby" in raw or "waiting" in raw:
        return "idle"
    if "active" in raw or "work" in raw or "running" in raw:
        return "active"
    return "unknown"


def normalize_row(module: str, source_row: Dict[str, Any], fallback_date: str) -> Dict[str, Any]:
    row = {normalize_header(k): v for k, v in source_row.items()}
    record: Dict[str, Any] = {}

    common_date = coerce_iso_date(first_value(row, ["date", "timestamp", "period_date", "datetime"]))
    record["date"] = common_date or fallback_date
    record["discipline"] = str(
        first_value(
            row,
            ["discipline", "trade", "department", "category", "project_package", "location"],
            "Unspecified",
        )
    ).strip() or "Unspecified"

    if module == "manpower":
        planned = coerce_number(first_value(row, ["planned_count", "planned_headcount", "planned", "target"]))
        actual = coerce_number(first_value(row, ["actual_count", "actual_headcount", "actual", "present", "on_site"]))
        if planned == 0 and actual > 0:
            planned = actual
        record.update(
            {
                "planned_count": planned,
                "actual_count": actual,
                "company": str(first_value(row, ["company", "contractor", "vendor"], "")).strip(),
                "nationality": str(first_value(row, ["nationality", "country"], "")).strip(),
            }
        )

    elif module == "equipment":
        record.update(
            {
                "equipment_id": str(first_value(row, ["equipment_id", "id", "asset_id", "plate_no", "reg_no"], "N/A")).strip()
                or "N/A",
                "status": normalize_status(first_value(row, ["status", "equipment_working_status", "state"], "unknown")),
                "hours_idle": coerce_number(first_value(row, ["hours_idle", "idle_hours", "idle_count", "total_monthly_hours"], 0)),
                "utilisation_rate": coerce_number(
                    first_value(row, ["utilisation_rate", "utilization_rate", "utilization", "usage"], 0)
                ),
            }
        )

    elif module == "progress":
        record.update(
            {
                "activity_id": str(first_value(row, ["activity_id", "task_id", "id", "code"], "")).strip(),
                "activity_name": str(first_value(row, ["activity_name", "activity", "task_name", "description"], "")).strip(),
                "planned_progress": coerce_number(
                    first_value(row, ["planned_progress", "planned_progress_pct", "planned_qty", "target", "scope"], 0)
                ),
                "actual_progress": coerce_number(
                    first_value(row, ["actual_progress", "actual_progress_pct", "executed_qty", "total_achieved", "actual"], 0)
                ),
            }
        )

    elif module == "cost":
        actual = coerce_number(
            first_value(row, ["actual_amount", "actual_spend", "actual", "spent", "incurred", "amount"], 0)
        )
        budget = coerce_number(first_value(row, ["budget_amount", "budget", "planned", "approved", "baseline"], actual))
        record.update(
            {
                "cost_code": str(first_value(row, ["cost_code", "code", "gl_code", "wbs"], "")).strip(),
                "category": str(first_value(row, ["category", "type", "class", "group"], "")).strip(),
                "budget_amount": budget,
                "actual_amount": actual,
                "committed_amount": coerce_number(first_value(row, ["committed_amount", "committed", "commitment"], 0)),
                "forecast_amount": coerce_number(first_value(row, ["forecast_amount", "forecast", "eac", "estimate"], 0)),
                "currency": str(first_value(row, ["currency", "ccy", "curr"], "")).strip(),
            }
        )

    return record


def infer_type(value: Any) -> str:
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, str) and re.match(r"^\d{4}-\d{2}-\d{2}$", value):
        return "date"
    return "string"


def build_schema(rows: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    if not rows:
        return []

    sample = rows[0]
    schema: List[Dict[str, str]] = []
    for key in sample.keys():
        value = sample.get(key)
        schema.append({"name": key, "type": infer_type(value)})
    return schema


def build_profile(rows: List[Dict[str, Any]], module: str) -> Dict[str, Any]:
    dates = sorted({r.get("date", "") for r in rows if r.get("date")})
    disciplines = sorted({str(r.get("discipline", "")).strip() for r in rows if r.get("discipline")})
    numeric_totals: Dict[str, float] = {}

    numeric_fields = {
        "manpower": ["planned_count", "actual_count"],
        "equipment": ["hours_idle", "utilisation_rate"],
        "progress": ["planned_progress", "actual_progress"],
        "cost": ["budget_amount", "actual_amount", "committed_amount", "forecast_amount"],
    }[module]

    for field in numeric_fields:
        numeric_totals[field] = round(sum(coerce_number(r.get(field)) for r in rows), 2)

    return {
        "rowCount": len(rows),
        "dateMin": dates[0] if dates else "",
        "dateMax": dates[-1] if dates else "",
        "disciplineCount": len(disciplines),
        "disciplines": disciplines[:20],
        "numericTotals": numeric_totals,
    }


def parse_body(req: BaseHTTPRequestHandler) -> Tuple[Dict[str, Any], str]:
    content_length = int(req.headers.get("content-length", "0") or "0")
    if content_length <= 0:
        return {}, "Request body is empty."

    try:
        payload_raw = req.rfile.read(content_length).decode("utf-8")
        payload = json.loads(payload_raw)
        if not isinstance(payload, dict):
            return {}, "Payload must be a JSON object."
        return payload, ""
    except json.JSONDecodeError:
        return {}, "Invalid JSON body."


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: Dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self._send_json(200, {"ok": True})

    def do_POST(self) -> None:
        payload, err = parse_body(self)
        if err:
            self._send_json(400, {"ok": False, "error": err})
            return

        module = str(payload.get("module", "")).strip().lower()
        rows = payload.get("rows", [])
        if module not in VALID_MODULES:
            self._send_json(400, {"ok": False, "error": "Invalid module."})
            return
        if not isinstance(rows, list) or len(rows) == 0:
            self._send_json(400, {"ok": False, "error": "Rows must be a non-empty array."})
            return

        fallback_date = datetime.utcnow().date().isoformat()
        normalized: List[Dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            record = normalize_row(module, row, fallback_date)
            if record:
                normalized.append(record)

        if len(normalized) == 0:
            self._send_json(400, {"ok": False, "error": "No valid rows after normalization."})
            return

        schema = build_schema(normalized)
        profile = build_profile(normalized, module)

        self._send_json(
            200,
            {
                "ok": True,
                "module": module,
                "normalizedRows": normalized,
                "powerBi": {
                    "tableName": f"{module}_normalized",
                    "columns": schema,
                },
                "profile": profile,
            },
        )
