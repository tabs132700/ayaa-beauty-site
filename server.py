#!/usr/bin/env python3
"""
Ayaa Beauty & Skin — booking backend.

Stdlib only: http.server + sqlite3. No pip install, no build step.

    python server.py            # http://localhost:5173

Serves the site and a real booking API on the same port:

    GET  /api/treatments
    GET  /api/availability?treatment=<slug>&from=<YYYY-MM-DD>&days=<n>
    POST /api/bookings
    GET  /api/bookings/<ref>
    POST /api/bookings/<ref>/cancel
    GET  /api/bookings/<ref>.ics

    GET  /api/admin/bookings?from=&to=      (X-Admin-Token)
    POST /api/admin/bookings/<id>/cancel
    GET  /api/admin/hours   |  PUT /api/admin/hours
    GET  /api/admin/closures | POST /api/admin/closures | DELETE /api/admin/closures/<id>

Free slots are computed from the opening hours minus real bookings minus
closures, every time they are asked for. The slot a client posts is always
recomputed server side before it is written, and the write happens inside an
IMMEDIATE transaction, so two people clicking the same slot cannot both get it.

All times are local to the studio (Europe/Amsterdam) and stored as a date plus
minutes-from-midnight, which keeps every comparison integer arithmetic.
"""

import json
import os
import re
import secrets
import smtplib
import sqlite3
import sys
import threading
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, "ayaa.db")
OUTBOX = os.path.join(BASE, "outbox")
PORT = int(os.environ.get("PORT", "5173"))

SLOT_STEP = 15          # granularity of offered start times, in minutes
HORIZON_DAYS = 90       # how far ahead anyone may book
MAX_PER_IP_PER_HOUR = 8

STUDIO_NAME = "Ayaa Beauty & Skin"
STUDIO_LOCATION = "Rotterdam"

# slug -> (minutes, buffer minutes after)
DEFAULT_TREATMENTS = [
    ("analyse",         30,  15),
    ("hydrofacial",     60,  15),
    ("microneedling",   75,  15),
    ("rf",              90,  15),
    ("exosomen",        45,  15),
    ("huidverbetering", 60,  15),
    ("laser",           30,  15),
    ("lipblush",       120,  30),
]

# weekday 0 = Monday
DEFAULT_HOURS = [
    (0, 600, 1080), (1, 600, 1080), (2, 600, 1080),
    (3, 600, 1080), (4, 600, 1080), (5, 600, 960),
]

_db_lock = threading.Lock()


# ─────────────────────────────── storage ───────────────────────────────

def connect():
    conn = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = connect()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS treatments (
            slug     TEXT PRIMARY KEY,
            minutes  INTEGER NOT NULL,
            buffer   INTEGER NOT NULL DEFAULT 15,
            active   INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS hours (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            weekday  INTEGER NOT NULL,
            start    INTEGER NOT NULL,
            end      INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS closures (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            date     TEXT NOT NULL,
            start    INTEGER NOT NULL DEFAULT 0,
            end      INTEGER NOT NULL DEFAULT 1440,
            note     TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS bookings (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            ref        TEXT NOT NULL UNIQUE,
            treatment  TEXT NOT NULL,
            date       TEXT NOT NULL,
            start      INTEGER NOT NULL,
            end        INTEGER NOT NULL,
            name       TEXT NOT NULL,
            email      TEXT NOT NULL,
            phone      TEXT DEFAULT '',
            notes      TEXT DEFAULT '',
            lang       TEXT DEFAULT 'nl',
            status     TEXT NOT NULL DEFAULT 'confirmed',
            created_at TEXT NOT NULL,
            created_ip TEXT DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_bookings_day ON bookings(date, status);
        CREATE INDEX IF NOT EXISTS idx_closures_day ON closures(date);
    """)

    if not conn.execute("SELECT 1 FROM treatments LIMIT 1").fetchone():
        conn.executemany(
            "INSERT INTO treatments (slug, minutes, buffer) VALUES (?,?,?)",
            DEFAULT_TREATMENTS)
    if not conn.execute("SELECT 1 FROM hours LIMIT 1").fetchone():
        conn.executemany(
            "INSERT INTO hours (weekday, start, end) VALUES (?,?,?)",
            DEFAULT_HOURS)
    conn.close()


def admin_token():
    tok = os.environ.get("AYAA_ADMIN_TOKEN")
    if tok:
        return tok
    path = os.path.join(BASE, "admin-token.txt")
    if os.path.exists(path):
        return open(path, encoding="utf-8").read().strip()
    tok = secrets.token_urlsafe(24)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(tok + "\n")
    return tok


ADMIN_TOKEN = None  # set in main()


# ─────────────────────────────── availability ───────────────────────────────

def overlaps(a_start, a_end, b_start, b_end):
    return a_start < b_end and b_start < a_end


def busy_for_day(conn, day):
    """Every interval that blocks the diary on `day`, booking buffers included."""
    blocks = []
    rows = conn.execute(
        "SELECT b.start, b.end, t.buffer FROM bookings b "
        "LEFT JOIN treatments t ON t.slug = b.treatment "
        "WHERE b.date = ? AND b.status = 'confirmed'", (day,)).fetchall()
    for r in rows:
        blocks.append((r["start"], r["end"] + (r["buffer"] or 0)))
    for r in conn.execute(
            "SELECT start, end FROM closures WHERE date = ?", (day,)).fetchall():
        blocks.append((r["start"], r["end"]))
    return blocks


def slots_for_day(conn, treatment, day, now=None):
    """Valid start times (minutes from midnight) for `treatment` on `day`."""
    total = treatment["minutes"] + treatment["buffer"]
    weekday = datetime.strptime(day, "%Y-%m-%d").date().weekday()
    windows = conn.execute(
        "SELECT start, end FROM hours WHERE weekday = ? ORDER BY start",
        (weekday,)).fetchall()
    if not windows:
        return []

    blocks = busy_for_day(conn, day)
    today = (now or datetime.now()).date().isoformat()
    cutoff = -1
    if day == today:
        n = now or datetime.now()
        cutoff = n.hour * 60 + n.minute + 60      # one hour of lead time

    out = []
    for w in windows:
        first = w["start"]
        if first % SLOT_STEP:
            first += SLOT_STEP - (first % SLOT_STEP)
        t = first
        while t + total <= w["end"]:
            if t > cutoff and not any(overlaps(t, t + total, b0, b1)
                                      for b0, b1 in blocks):
                out.append(t)
            t += SLOT_STEP
    return out


def availability(conn, slug, start_day, days):
    tr = conn.execute(
        "SELECT * FROM treatments WHERE slug = ? AND active = 1", (slug,)).fetchone()
    if not tr:
        return None
    today = date.today()
    d0 = max(start_day, today)
    out = []
    for i in range(days):
        d = d0 + timedelta(days=i)
        if (d - today).days > HORIZON_DAYS:
            break
        iso = d.isoformat()
        out.append({"date": iso, "slots": slots_for_day(conn, tr, iso)})
    return {
        "treatment": slug,
        "minutes": tr["minutes"],
        "buffer": tr["buffer"],
        "days": out,
    }


# ─────────────────────────────── booking ───────────────────────────────

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")


def create_booking(conn, data, ip):
    slug = (data.get("treatment") or "").strip()
    day = (data.get("date") or "").strip()
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    phone = (data.get("phone") or "").strip()
    notes = (data.get("notes") or "").strip()
    lang = "ar" if data.get("lang") == "ar" else "nl"

    if data.get("website"):                       # honeypot
        return 400, {"error": "invalid"}
    try:
        start = int(data.get("start"))
    except (TypeError, ValueError):
        return 400, {"error": "invalid_start"}
    if not name or len(name) > 120:
        return 400, {"error": "invalid_name"}
    if not EMAIL_RE.match(email) or len(email) > 160:
        return 400, {"error": "invalid_email"}
    if len(phone) > 40 or len(notes) > 1000:
        return 400, {"error": "invalid"}
    try:
        d = datetime.strptime(day, "%Y-%m-%d").date()
    except ValueError:
        return 400, {"error": "invalid_date"}
    if d < date.today() or (d - date.today()).days > HORIZON_DAYS:
        return 400, {"error": "invalid_date"}

    tr = conn.execute(
        "SELECT * FROM treatments WHERE slug = ? AND active = 1", (slug,)).fetchone()
    if not tr:
        return 400, {"error": "unknown_treatment"}

    since = (datetime.now() - timedelta(hours=1)).isoformat()
    recent = conn.execute(
        "SELECT COUNT(*) c FROM bookings WHERE created_ip = ? AND created_at > ?",
        (ip, since)).fetchone()["c"]
    if recent >= MAX_PER_IP_PER_HOUR:
        return 429, {"error": "too_many"}

    end = start + tr["minutes"]
    ref = secrets.token_urlsafe(9)

    # recompute the slot under a write lock: the client's offer is never trusted,
    # and nobody can slip a conflicting booking in between check and insert
    with _db_lock:
        conn.execute("BEGIN IMMEDIATE")
        try:
            if start not in slots_for_day(conn, tr, day):
                conn.execute("ROLLBACK")
                return 409, {"error": "slot_taken"}
            conn.execute(
                "INSERT INTO bookings (ref, treatment, date, start, end, name, email,"
                " phone, notes, lang, status, created_at, created_ip)"
                " VALUES (?,?,?,?,?,?,?,?,?,?, 'confirmed', ?, ?)",
                (ref, slug, day, start, end, name, email, phone, notes, lang,
                 datetime.now().isoformat(timespec="seconds"), ip))
            conn.execute("COMMIT")
        except Exception:
            conn.execute("ROLLBACK")
            raise

    booking = conn.execute("SELECT * FROM bookings WHERE ref = ?", (ref,)).fetchone()
    send_confirmation(dict(booking))
    return 201, public_booking(booking)


def public_booking(row):
    return {
        "ref": row["ref"], "treatment": row["treatment"], "date": row["date"],
        "start": row["start"], "end": row["end"], "name": row["name"],
        "status": row["status"],
    }


def hhmm(m):
    return "%02d:%02d" % (m // 60, m % 60)


# ─────────────────────────────── notification ───────────────────────────────

def ics_for(row):
    d = datetime.strptime(row["date"], "%Y-%m-%d")
    s = d + timedelta(minutes=row["start"])
    e = d + timedelta(minutes=row["end"])
    fmt = "%Y%m%dT%H%M%S"
    return "\r\n".join([
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ayaa Beauty & Skin//NL",
        "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
        "UID:%s@ayaa-beauty" % row["ref"],
        "DTSTAMP:%s" % datetime.utcnow().strftime("%Y%m%dT%H%M%SZ"),
        "DTSTART;TZID=Europe/Amsterdam:%s" % s.strftime(fmt),
        "DTEND;TZID=Europe/Amsterdam:%s" % e.strftime(fmt),
        "SUMMARY:%s — %s" % (STUDIO_NAME, row["treatment"]),
        "LOCATION:%s" % STUDIO_LOCATION,
        "DESCRIPTION:Referentie %s" % row["ref"],
        "END:VEVENT", "END:VCALENDAR", ""])


def confirmation_text(row):
    if row.get("lang") == "ar":
        return ("تأكيد موعد — %s\n\n"
                "العلاج: %s\nالتاريخ: %s\nالوقت: %s – %s\nالاسم: %s\n\n"
                "رقم الحجز: %s\n"
                "للإلغاء أو التعديل استخدمي رقم الحجز على الموقع.\n") % (
            STUDIO_NAME, row["treatment"], row["date"],
            hhmm(row["start"]), hhmm(row["end"]), row["name"], row["ref"])
    return ("Afspraak bevestigd — %s\n\n"
            "Behandeling: %s\nDatum: %s\nTijd: %s – %s\nNaam: %s\n\n"
            "Referentie: %s\n"
            "Annuleren of verzetten kan met deze referentie op de site.\n") % (
        STUDIO_NAME, row["treatment"], row["date"],
        hhmm(row["start"]), hhmm(row["end"]), row["name"], row["ref"])


def send_confirmation(row):
    """SMTP when configured; otherwise the mail is written to outbox/ so that a
    confirmation is never silently lost."""
    subject = ("تأكيد موعد — " if row.get("lang") == "ar" else
               "Afspraak bevestigd — ") + STUDIO_NAME
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = os.environ.get("SMTP_FROM", "no-reply@ayaa-beauty.local")
    msg["To"] = row["email"]
    msg.set_content(confirmation_text(row))
    msg.add_attachment(ics_for(row).encode("utf-8"),
                       maintype="text", subtype="calendar",
                       filename="afspraak.ics")

    host = os.environ.get("SMTP_HOST")
    if host:
        try:
            port = int(os.environ.get("SMTP_PORT", "587"))
            with smtplib.SMTP(host, port, timeout=15) as srv:
                srv.starttls()
                user = os.environ.get("SMTP_USER")
                if user:
                    srv.login(user, os.environ.get("SMTP_PASS", ""))
                srv.send_message(msg)
            return
        except Exception as exc:                        # noqa: BLE001
            sys.stderr.write("SMTP failed (%s); writing to outbox\n" % exc)

    os.makedirs(OUTBOX, exist_ok=True)
    with open(os.path.join(OUTBOX, "%s.eml" % row["ref"]), "wb") as fh:
        fh.write(bytes(msg))


# ─────────────────────────────── http ───────────────────────────────

class Handler(SimpleHTTPRequestHandler):
    server_version = "AyaaBooking/1.0"

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=BASE, **kw)

    # keep the console readable
    def log_message(self, fmt, *args):
        if self.path.startswith("/api/"):
            sys.stderr.write("%s %s\n" % (self.command, self.path))

    # ---- helpers -------------------------------------------------------
    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > 64_000:
                return None
            return json.loads(self.rfile.read(n).decode("utf-8"))
        except Exception:                                # noqa: BLE001
            return None

    def client_ip(self):
        return self.client_address[0] if self.client_address else ""

    def is_admin(self):
        return secrets.compare_digest(
            self.headers.get("X-Admin-Token", ""), ADMIN_TOKEN or "")

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        super().end_headers()

    # ---- routing -------------------------------------------------------
    def do_GET(self):
        p = urlparse(self.path)
        if not p.path.startswith("/api/"):
            return super().do_GET()
        conn = connect()
        try:
            self.api_get(p, conn)
        finally:
            conn.close()

    def do_POST(self):
        p = urlparse(self.path)
        if not p.path.startswith("/api/"):
            return self.send_error(HTTPStatus.NOT_FOUND)
        conn = connect()
        try:
            self.api_post(p, conn)
        finally:
            conn.close()

    def do_PUT(self):
        return self.do_POST()

    def do_DELETE(self):
        p = urlparse(self.path)
        m = re.fullmatch(r"/api/admin/closures/(\d+)", p.path)
        if not m:
            return self.send_error(HTTPStatus.NOT_FOUND)
        if not self.is_admin():
            return self.send_json(401, {"error": "unauthorised"})
        conn = connect()
        try:
            conn.execute("DELETE FROM closures WHERE id = ?", (int(m.group(1)),))
            self.send_json(200, {"ok": True})
        finally:
            conn.close()

    # ---- GET -----------------------------------------------------------
    def api_get(self, p, conn):
        path, q = p.path, parse_qs(p.query)

        if path == "/api/treatments":
            rows = conn.execute(
                "SELECT slug, minutes, buffer FROM treatments"
                " WHERE active = 1 ORDER BY rowid").fetchall()
            return self.send_json(200, {"treatments": [dict(r) for r in rows]})

        if path == "/api/availability":
            slug = (q.get("treatment") or [""])[0]
            try:
                start_day = datetime.strptime(
                    (q.get("from") or [date.today().isoformat()])[0],
                    "%Y-%m-%d").date()
            except ValueError:
                return self.send_json(400, {"error": "invalid_from"})
            days = max(1, min(int((q.get("days") or ["21"])[0] or 21), 60))
            data = availability(conn, slug, start_day, days)
            if data is None:
                return self.send_json(404, {"error": "unknown_treatment"})
            return self.send_json(200, data)

        m = re.fullmatch(r"/api/bookings/([A-Za-z0-9_-]{6,40})(\.ics)?", path)
        if m:
            row = conn.execute(
                "SELECT * FROM bookings WHERE ref = ?", (m.group(1),)).fetchone()
            if not row:
                return self.send_json(404, {"error": "not_found"})
            if m.group(2):
                body = ics_for(row).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/calendar; charset=utf-8")
                self.send_header("Content-Disposition",
                                 'attachment; filename="afspraak.ics"')
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                return self.wfile.write(body)
            return self.send_json(200, public_booking(row))

        if path.startswith("/api/admin/"):
            if not self.is_admin():
                return self.send_json(401, {"error": "unauthorised"})
            if path == "/api/admin/bookings":
                frm = (q.get("from") or [date.today().isoformat()])[0]
                to = (q.get("to") or [(date.today() + timedelta(days=120)).isoformat()])[0]
                rows = conn.execute(
                    "SELECT * FROM bookings WHERE date BETWEEN ? AND ?"
                    " ORDER BY date, start", (frm, to)).fetchall()
                return self.send_json(200, {"bookings": [dict(r) for r in rows]})
            if path == "/api/admin/hours":
                rows = conn.execute(
                    "SELECT weekday, start, end FROM hours"
                    " ORDER BY weekday, start").fetchall()
                return self.send_json(200, {"hours": [dict(r) for r in rows]})
            if path == "/api/admin/closures":
                rows = conn.execute(
                    "SELECT * FROM closures WHERE date >= ? ORDER BY date",
                    (date.today().isoformat(),)).fetchall()
                return self.send_json(200, {"closures": [dict(r) for r in rows]})

        return self.send_json(404, {"error": "not_found"})

    # ---- POST / PUT ----------------------------------------------------
    def api_post(self, p, conn):
        path = p.path
        data = self.read_json()

        if path == "/api/bookings":
            if data is None:
                return self.send_json(400, {"error": "invalid_body"})
            status, payload = create_booking(conn, data, self.client_ip())
            return self.send_json(status, payload)

        m = re.fullmatch(r"/api/bookings/([A-Za-z0-9_-]{6,40})/cancel", path)
        if m:
            row = conn.execute(
                "SELECT * FROM bookings WHERE ref = ?", (m.group(1),)).fetchone()
            if not row:
                return self.send_json(404, {"error": "not_found"})
            conn.execute(
                "UPDATE bookings SET status = 'cancelled' WHERE ref = ?",
                (m.group(1),))
            return self.send_json(200, {"ok": True, "ref": row["ref"]})

        if path.startswith("/api/admin/"):
            if not self.is_admin():
                return self.send_json(401, {"error": "unauthorised"})

            m = re.fullmatch(r"/api/admin/bookings/(\d+)/cancel", path)
            if m:
                conn.execute(
                    "UPDATE bookings SET status = 'cancelled' WHERE id = ?",
                    (int(m.group(1)),))
                return self.send_json(200, {"ok": True})

            if path == "/api/admin/hours" and isinstance(data, dict):
                rows = data.get("hours") or []
                clean = []
                for r in rows:
                    try:
                        wd, s0, e0 = int(r["weekday"]), int(r["start"]), int(r["end"])
                    except (KeyError, TypeError, ValueError):
                        return self.send_json(400, {"error": "invalid_hours"})
                    if not (0 <= wd <= 6 and 0 <= s0 < e0 <= 1440):
                        return self.send_json(400, {"error": "invalid_hours"})
                    clean.append((wd, s0, e0))
                with _db_lock:
                    conn.execute("BEGIN IMMEDIATE")
                    conn.execute("DELETE FROM hours")
                    conn.executemany(
                        "INSERT INTO hours (weekday, start, end) VALUES (?,?,?)",
                        clean)
                    conn.execute("COMMIT")
                return self.send_json(200, {"ok": True, "count": len(clean)})

            if path == "/api/admin/closures" and isinstance(data, dict):
                try:
                    day = datetime.strptime(data["date"], "%Y-%m-%d").date().isoformat()
                    s0 = int(data.get("start", 0))
                    e0 = int(data.get("end", 1440))
                except (KeyError, TypeError, ValueError):
                    return self.send_json(400, {"error": "invalid_closure"})
                if not (0 <= s0 < e0 <= 1440):
                    return self.send_json(400, {"error": "invalid_closure"})
                cur = conn.execute(
                    "INSERT INTO closures (date, start, end, note) VALUES (?,?,?,?)",
                    (day, s0, e0, str(data.get("note", ""))[:200]))
                return self.send_json(201, {"ok": True, "id": cur.lastrowid})

        return self.send_json(404, {"error": "not_found"})


def main():
    global ADMIN_TOKEN
    init_db()
    ADMIN_TOKEN = admin_token()
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("Ayaa Beauty & Skin — booking server")
    print("  site   http://localhost:%d" % PORT)
    print("  admin  http://localhost:%d/admin.html" % PORT)
    print("  token  %s" % ADMIN_TOKEN)
    if not os.environ.get("SMTP_HOST"):
        print("  mail   SMTP not configured — confirmations land in outbox/")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        srv.shutdown()


if __name__ == "__main__":
    main()
