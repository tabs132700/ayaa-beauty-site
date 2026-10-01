# Ayaa Beauty & Skin — website + booking system

Site and booking backend for [@ayaa_beauty.skin](https://www.instagram.com/ayaa_beauty.skin/)
(Samar Tinawi, schoonheidsspecialist, Rotterdam).

| file | what it is |
|---|---|
| `index.html` | the site — markup, styles, Dutch + Arabic copy, all motion, booking UI |
| `server.py` | the booking backend: availability, bookings, admin API, static serving |
| `admin.html` | Samar's agenda: bookings, opening hours, blocked time |
| `ayaa.db` | SQLite database, created on first run |
| `img/` | photos from the Instagram account |
| `admin-token.txt` | generated on first run — this is the admin password |

## Run it

```bash
python "C:/project wee/ayaa-beauty/server.py"
```

Site on http://localhost:5173, agenda on http://localhost:5173/admin.html.
Python 3.9+, standard library only — nothing to install, no build step.

---

## How the booking works

The customer picks a treatment, then a day, then a time, then leaves her name and
e-mail. The times she sees are generated from the opening hours minus the real
bookings minus anything blocked, recalculated on every request.

**A slot cannot be sold twice.** The time the browser sends back is never trusted:
the server recomputes the free slots and writes the booking inside a single
`BEGIN IMMEDIATE` transaction. Eight simultaneous requests for the same slot produce
exactly one `201` and seven `409`s — that is a test that was actually run, not a
hope. On a `409` the page reloads the times and tells her to pick another.

Each booking blocks its own duration **plus the buffer after it**, and the block
applies across all treatments, so a 90-minute RF session also removes that morning's
hydrofacial slots.

Other rules, all enforced server side: no dates in the past, nothing beyond 90 days,
at least an hour of lead time for same-day bookings, a valid e-mail, a hidden
honeypot field against bots, and a cap of 8 bookings per IP per hour.

### After booking

She gets a confirmation mail with an `.ics` attachment, and a reference code. The
reference cancels the appointment from the site itself, which frees the slot
immediately.

### Mail

Without SMTP the confirmation is written to `outbox/<ref>.eml` so nothing is ever
silently lost. To send for real, set these before starting the server:

```bash
SMTP_HOST=smtp.example.com SMTP_PORT=587 \
SMTP_USER=... SMTP_PASS=... SMTP_FROM="Ayaa Beauty <hallo@…>" \
python server.py
```

---

## The agenda (`admin.html`)

Log in with the token from `admin-token.txt` (or set `AYAA_ADMIN_TOKEN` yourself).
Everything is protected by it, and the page remembers it on that device.

- **Afspraken** — every booking with name, contact and notes; cancel any of them.
- **Openingstijden** — per weekday, or uncheck a day to close it. Saved hours take
  effect on the site immediately.
- **Vrij / gesloten** — block a whole day or part of one (holiday, course, lunch).
  That time disappears from the site straight away.

Default hours are Mon–Fri 10:00–18:00 and Sat 10:00–16:00; change them here.

Treatment durations live in `DEFAULT_TREATMENTS` in `server.py` and in the
`treatments` table:

| Treatment | slug | duration | buffer |
|---|---|---|---|
| 3D huid- & haaranalyse | `analyse` | 30 | 15 |
| Hydrofacial | `hydrofacial` | 60 | 15 |
| Microneedling | `microneedling` | 75 | 15 |
| RF microneedling | `rf` | 90 | 15 |
| Exosomen & collageen | `exosomen` | 45 | 15 |
| Huidverbetering | `huidverbetering` | 60 | 15 |
| Laserontharing | `laser` | 30 | 15 |
| Lip blush | `lipblush` | 120 | 30 |

---

## Putting it online

`server.py` binds to `127.0.0.1`, which is correct for local use. To host it, put it
behind a reverse proxy that terminates HTTPS (Caddy or nginx) and change the bind
address in `main()`. Before it faces the public internet:

- serve it over **HTTPS only** — the admin token travels in a header
- set `AYAA_ADMIN_TOKEN` to a long random value rather than the generated file
- configure SMTP so confirmations actually reach customers
- back up `ayaa.db` (a scheduled file copy is enough)

Python's `http.server` is fine for one studio's traffic. If it ever needs more,
the API surface is small enough to move behind gunicorn or into any framework.

### Static hosting

If the page is ever served without the backend, it detects that `/api` does not
answer and falls back on its own to a request form — treatment, preferred date,
time of day, contact — which hands the request to WhatsApp, e-mail or Instagram DM.
Fill these in for that path:

```js
whatsapp: '31612345678',   // country code, no + and no spaces
email:    'hallo@ayaabeautyskin.nl',
```

That form is deliberately honest: it says a request is not a confirmed appointment.
Only the live calendar confirms.

---

## Languages

Dutch and Arabic, switched by `NL / ع` in the nav, remembered per visitor; a
first-time visitor with an Arabic browser lands on Arabic.

Arabic sets `dir="rtl"`, swaps to Amiri + IBM Plex Sans Arabic, and drops the
letter-spacing and uppercasing that the Latin small-caps labels use — both mangle
Arabic. Dates, weekday names and the booking confirmation all follow the language.
The photo strip and marquee stay `dir="ltr"` on purpose: it keeps the scroll maths
identical in both languages.

All copy lives in the `I18N` object in `index.html`. Edit text there, never in the
markup — the markup ships empty and is filled at runtime, so there is no second copy
to drift.

---

## Notes

- The 3D scanner analyses **skin and scalp/hair**, which is why the laser card cites
  measured hair density and the analysis card sells both.
- The hydrofacial copy describes the **multifunction aqua-peel / hydra-dermabrasion
  device** in customer language rather than the supplier's listing title.
- **No prices and no testimonials.** Prices vary per treatment and per course, so the
  FAQ says they are quoted at the intake. Reviews were left out rather than invented —
  add real ones and they can go in.
- The follower count in the studio section is hard-coded (`data-count="1341"`,
  correct as of Sept 2026). It does not update itself.
- The hero photograph is a stock image from Unsplash (`img/hero.jpg`, 2400x3600),
  used under the Unsplash License, which permits commercial use without attribution.
  Every other photo on the page is Samar's own, from the Instagram account. The split
  is deliberate: the hero is atmosphere, while the treatment cards make claims about
  her work and so use her real photos.
- Instagram images came from the public profile at 640px. For print-sharp hero and
  gallery frames, drop higher-resolution originals into `img/` under the same names.
- Motion is GSAP + ScrollTrigger from a CDN, and degrades: without JS the content is
  still there, and `prefers-reduced-motion` disables all of it.
