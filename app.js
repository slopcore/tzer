(() => {
  const HALF = 12 * 3600e3;
  const STEP = 15 * 60e3;
  const STORE = "skyclock.zones";
  const RISE_SET_ELEV = -0.833;
  const myZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const COORDS = window.ZONE_COORDS || {};

  // Legacy IANA names that browsers still report, mapped to zone.tab names.
  const ALIASES = {
    "Asia/Calcutta": "Asia/Kolkata", "Asia/Katmandu": "Asia/Kathmandu", "Asia/Saigon": "Asia/Ho_Chi_Minh",
    "Asia/Rangoon": "Asia/Yangon", "Europe/Kiev": "Europe/Kyiv", "Atlantic/Faeroe": "Atlantic/Faroe",
    "America/Godthab": "America/Nuuk", "Pacific/Truk": "Pacific/Chuuk", "Pacific/Ponape": "Pacific/Pohnpei",
    "Pacific/Enderbury": "Pacific/Kanton", "Asia/Ulan_Bator": "Asia/Ulaanbaatar", "Asia/Dacca": "Asia/Dhaka",
    "Asia/Thimbu": "Asia/Thimphu", "Asia/Ujung_Pandang": "Asia/Makassar", "Asia/Chongqing": "Asia/Shanghai",
    "Asia/Harbin": "Asia/Shanghai", "Asia/Macao": "Asia/Macau", "Asia/Ashkhabad": "Asia/Ashgabat",
    "America/Coral_Harbour": "America/Atikokan", "America/Fort_Wayne": "America/Indiana/Indianapolis",
    "US/Eastern": "America/New_York", "US/Central": "America/Chicago", "US/Mountain": "America/Denver",
    "US/Pacific": "America/Los_Angeles", "Europe/Uzhgorod": "Europe/Kyiv", "Europe/Zaporozhye": "Europe/Kyiv",
    "Australia/ACT": "Australia/Sydney", "Australia/NSW": "Australia/Sydney", "GB": "Europe/London"
  };

  const coordCache = {};
  function coordsFor(zone) {
    if (zone in coordCache) return coordCache[zone];
    let c = COORDS[zone] || COORDS[ALIASES[zone]];
    if (!c) {
      const tail = "/" + zone.split("/").pop();
      const hit = Object.keys(COORDS).find(k => k.endsWith(tail));
      c = hit ? COORDS[hit] : null;
    }
    return (coordCache[zone] = c);
  }

  // Sun elevation in degrees (USNO low-precision formulas, ~1 arcminute).
  const RAD = Math.PI / 180;
  function sunElevation(lat, lon, t) {
    const d = t / 86400000 - 10957.5;
    const g = (357.529 + 0.98560028 * d) * RAD;
    const q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
    const e = (23.439 - 0.00000036 * d) * RAD;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    const dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = (18.697374558 + 24.06570982441908 * d) * 15 * RAD;
    const H = gmst + lon * RAD - ra;
    const la = lat * RAD;
    return Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H)) / RAD;
  }

  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  function ramp(stops, x) {
    if (x <= stops[0][0]) return `rgb(${stops[0][1].join(",")})`;
    for (let i = 1; i < stops.length; i++) {
      if (x <= stops[i][0]) {
        const [x0, c0] = stops[i - 1], [x1, c1] = stops[i];
        const t = (x - x0) / (x1 - x0);
        return `rgb(${c0.map((v, k) => Math.round(v + (c1[k] - v) * t)).join(",")})`;
      }
    }
    return `rgb(${stops[stops.length - 1][1].join(",")})`;
  }
  const ELEV_STOPS = [
    [-18, "#070b1f"], [-12, "#0f1838"], [-6, "#26387a"], [-2, "#4b73b3"],
    [0.5, "#76bbe5"], [8, "#8dcff2"], [30, "#a8def8"], [90, "#b6e5fa"]
  ].map(([x, c]) => [x, hex(c)]);
  const CLOCK_STOPS = [
    [0, "#070b1f"], [4.5, "#070b1f"], [6, "#26387a"], [7.25, "#76bbe5"],
    [12.5, "#a8def8"], [17.5, "#76bbe5"], [19, "#26387a"], [20.5, "#070b1f"], [24, "#070b1f"]
  ].map(([x, c]) => [x, hex(c)]);

  function sky(zone, t, localHour) {
    const c = coordsFor(zone);
    if (!c) return { color: ramp(CLOCK_STOPS, localHour), bright: localHour >= 6.6 && localHour < 18.4 };
    const el = sunElevation(c[0], c[1], t);
    return { color: ramp(ELEV_STOPS, el), bright: el > -4, el };
  }

  const fmtCache = {};
  function fmt(zone) {
    return fmtCache[zone] ??= new Intl.DateTimeFormat("en-GB", {
      timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  }
  function offsetMin(zone, t) {
    const p = {};
    for (const x of fmt(zone).formatToParts(t)) p[x.type] = x.value;
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((asUTC - Math.floor(t / 1000) * 1000) / 60000);
  }
  const local = (zone, t) => new Date(t + offsetMin(zone, t) * 60000);
  const hourOf = d => d.getUTCHours() + d.getUTCMinutes() / 60;
  function abbr(zone, t) {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" })
      .formatToParts(t).find(x => x.type === "timeZoneName");
    return part ? part.value : "";
  }
  function isDST(zone, t) {
    const y = new Date(t).getUTCFullYear();
    const jan = offsetMin(zone, Date.UTC(y, 0, 1)), jul = offsetMin(zone, Date.UTC(y, 6, 1));
    return jan !== jul && offsetMin(zone, t) > Math.min(jan, jul);
  }
  const pad = n => String(n).padStart(2, "0");
  const hhmm = d => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayLabel = d => `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  function relLabel(mins) {
    if (mins === 0) return "same as you";
    const s = mins > 0 ? "+" : "−", a = Math.abs(mins), h = Math.floor(a / 60), m = a % 60;
    return `${s}${h}h${m ? " " + m + "m" : ""} vs you`;
  }
  const cityName = z => z.split("/").pop().replace(/_/g, " ");
  const fmtCoord = ([la, lo]) =>
    `${Math.abs(la).toFixed(1)}°${la >= 0 ? "N" : "S"} ${Math.abs(lo).toFixed(1)}°${lo >= 0 ? "E" : "W"}`;

  function validZone(z) {
    try { new Intl.DateTimeFormat("en", { timeZone: z }); return true; } catch { return false; }
  }

  // Sunrise/sunset inside [start, end], found by bisection on the 15-minute samples.
  function sunEvents(zone, samples) {
    const c = coordsFor(zone);
    if (!c) return null;
    const f = t => sunElevation(c[0], c[1], t) - RISE_SET_ELEV;
    const out = [];
    for (let i = 1; i < samples.length; i++) {
      let a = samples[i - 1], b = samples[i], fa = f(a), fb = f(b);
      if ((fa < 0) === (fb < 0)) continue;
      const rising = fa < 0;
      for (let k = 0; k < 20; k++) {
        const m = (a + b) / 2, fm = f(m);
        if ((fm < 0) === (fa < 0)) { a = m; fa = fm; } else { b = m; }
      }
      out.push({ t: (a + b) / 2, rising });
    }
    const allUp = out.length === 0 && f(samples[0]) > 0;
    return { events: out, allUp, allDown: out.length === 0 && !allUp };
  }

  let zones;
  try { zones = JSON.parse(localStorage.getItem(STORE) || "null"); } catch { zones = null; }
  if (!Array.isArray(zones) || !zones.every(z => typeof z === "string" && validZone(z))) {
    zones = ["Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney", "Atlantic/Reykjavik"];
  }
  zones = [myZone, ...zones.filter(z => z !== myZone)];
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(zones.slice(1))); } catch {} };


  const stack = document.getElementById("stack");
  let hoverFrac = null;

  function rowHTML(zone, isMe, now, start, end, myOff) {
    const span = end - start;
    const pct = t => ((t - start) / span * 100).toFixed(3) + "%";
    const samples = [start];
    for (let t = Math.ceil(start / STEP) * STEP; t < end; t += STEP) if (t > start) samples.push(t);
    samples.push(end);

    const grad = [];
    let ticks = "";
    for (const t of samples) {
      const d = local(zone, t), h = hourOf(d), s = sky(zone, t, h);
      grad.push(`${s.color} ${pct(t)}`);
      if (d.getUTCMinutes() === 0 && t > start + 60e3 && t < end - 60e3) {
        const hr = d.getUTCHours(), cls = (s.bright ? " day" : "") + (hr % 3 ? " minor" : "");
        if (hr === 0) {
          ticks += `<div class="tick midnight" style="left:${pct(t)}"></div>` +
                   `<span class="lbl date${s.bright ? " day" : ""}${t > end - 3 * 3600e3 ? " flip" : ""}" style="left:${pct(t)}">${dayLabel(d)}</span>`;
        } else {
          ticks += `<div class="tick${cls}" style="left:${pct(t)}"></div>`;
        }
        ticks += `<span class="lbl${cls}" style="left:${pct(t)}">${pad(hr)}</span>`;
      }
    }

    const coords = coordsFor(zone);
    const sun = sunEvents(zone, samples);
    let sunText = "clock-based colours (no location)";
    if (sun) {
      if (sun.allUp) sunText = "Sun up all day";
      else if (sun.allDown) sunText = "Sun down all day";
      else sunText = sun.events.map(e => `${e.rising ? "↑" : "↓"} ${hhmm(local(zone, e.t))}`).join("  ");
    }

    const off = offsetMin(zone, now);
    const nowLocal = local(zone, now);
    return `<div class="row${isMe ? " me" : ""}" data-zone="${zone}">
      <div class="meta">
        <div class="top">
          <span class="city" title="${zone}${coords ? " · " + fmtCoord(coords) : ""}">${cityName(zone)}</span>
          ${isMe ? '<span class="you">You</span>' : `<button class="rm" type="button" data-rm="${zone}" aria-label="Remove ${cityName(zone)}">×</button>`}
        </div>
        <span class="time" data-time>${hhmm(nowLocal)}</span>
        <span class="info">
          <span data-day>${dayLabel(nowLocal)}</span>
          <span>${abbr(zone, now)}</span>
          ${isMe ? "" : `<span>${relLabel(off - myOff)}</span>`}
          ${isDST(zone, now) ? '<span class="dst" title="Daylight saving time is in effect">DST</span>' : ""}
        </span>
        <span class="sun" title="Sunrise (↑) and sunset (↓) in this 24-hour window, local time">${sunText}</span>
      </div>
      <div class="bar" style="background:linear-gradient(90deg,${grad.join(",")})">
        ${ticks}<div class="nowline"></div><div class="hoverline" hidden></div>
      </div>
    </div>`;
  }

  function render() {
    const now = Date.now();
    const myOff = offsetMin(myZone, now);
    stack.innerHTML = zones.map((z, i) => rowHTML(z, i === 0, now, now - HALF, now + HALF, myOff)).join("");
    applyHover();
  }

  function applyHover() {
    const now = Date.now();
    const t = hoverFrac == null ? now : now - HALF + hoverFrac * 2 * HALF;
    for (const row of stack.querySelectorAll(".row")) {
      const d = local(row.dataset.zone, t);
      row.querySelector("[data-time]").textContent = hhmm(d);
      row.querySelector("[data-day]").textContent = dayLabel(d);
      const hl = row.querySelector(".hoverline");
      hl.hidden = hoverFrac == null;
      if (hoverFrac != null) hl.style.left = (hoverFrac * 100) + "%";
    }
  }

  function onPoint(e) {
    const bar = e.target.closest(".bar");
    if (!bar) return;
    const r = bar.getBoundingClientRect();
    hoverFrac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    applyHover();
  }
  const clearHover = () => { hoverFrac = null; applyHover(); };
  stack.addEventListener("pointermove", onPoint);
  stack.addEventListener("pointerdown", onPoint);
  stack.addEventListener("pointerleave", clearHover);
  stack.addEventListener("pointerup", e => { if (e.pointerType !== "mouse") clearHover(); });

  stack.addEventListener("click", e => {
    const z = e.target.closest("[data-rm]")?.dataset.rm;
    if (!z) return;
    zones = zones.filter(x => x !== z);
    save(); render();
  });

  // ---- Search ----
  const COUNTRY = window.COUNTRY_NAMES || {};
  const EXTRA_TERMS = {
    GB: "uk united kingdom great britain england scotland wales northern ireland",
    US: "usa america united states of america", AE: "uae emirates dubai", NZ: "aotearoa",
    KR: "korea south korea", KP: "north korea", RU: "russia", CZ: "czechia czech republic",
    NL: "holland", CH: "switzerland swiss", VN: "vietnam", TW: "taiwan", IR: "iran", SY: "syria",
    LA: "laos", BO: "bolivia", TZ: "tanzania", VE: "venezuela", MD: "moldova", BN: "brunei",
    CI: "ivory coast", CD: "congo drc", CG: "congo", FM: "micronesia", TR: "turkey turkiye",
    "America/New_York": "nyc eastern", "America/Chicago": "central", "America/Denver": "mountain",
    "America/Los_Angeles": "pacific la san francisco seattle", "America/Phoenix": "arizona",
    "Asia/Kolkata": "india mumbai delhi bangalore bengaluru", "Asia/Shanghai": "china beijing",
    "Asia/Dubai": "abu dhabi", "Europe/London": "gmt bst", "Australia/Sydney": "melbourne canberra"
  };
  const fold = x => x.normalize("NFD").replace(/\p{M}/gu, "").replace(/[’']/g, "").toLowerCase();
  const input = document.getElementById("zoneInput");
  const list = document.getElementById("results");
  const err = document.getElementById("err");
  let index = null, matches = [], active = -1;

  function buildIndex() {
    const y = new Date().getUTCFullYear(), jan = Date.UTC(y, 0, 15), jul = Date.UTC(y, 6, 15);
    const ids = new Set([...Object.keys(COORDS), "UTC"]);
    return [...ids].filter(validZone).map(zone => {
      const cc = COORDS[zone]?.[2];
      const country = cc ? COUNTRY[cc] || cc : "";
      const city = cityName(zone);
      const text = [city, zone.replace(/[/_]/g, " "), country, cc || "", EXTRA_TERMS[cc] || "",
                    EXTRA_TERMS[zone] || "", abbr(zone, jan), abbr(zone, jul)].join(" ");
      const tokens = [...new Set(fold(text).split(/[^\p{L}\p{N}+-]+/u).filter(Boolean))];
      return { zone, city: fold(city), countryKey: fold(country), country, cityLabel: city, tokens };
    });
  }

  function search(q) {
    index ??= buildIndex();
    const words = fold(q).split(/[^\p{L}\p{N}+-]+/u).filter(Boolean);
    if (!words.length) return [];
    const full = words.join(" ");
    return index
      .filter(e => words.every(w => e.tokens.some(t => t.startsWith(w))))
      .map(e => {
        const exact = words.every(w => e.tokens.includes(w));
        const score = e.city === full ? 0
          : e.countryKey === full ? 1
          : e.city.startsWith(full) ? 2
          : exact ? 3
          : e.countryKey.startsWith(full) ? 4 : 5;
        return { e, score };
      })
      .sort((a, b) => a.score - b.score || a.e.cityLabel.localeCompare(b.e.cityLabel))
      .slice(0, 12)
      .map(x => x.e);
  }

  const esc = x => x.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function showResults() {
    matches = search(input.value);
    active = matches.length ? 0 : -1;
    err.textContent = "";
    if (!input.value.trim()) { closeResults(); return; }
    const now = Date.now(), myOff = offsetMin(myZone, now);
    list.innerHTML = matches.length ? matches.map((m, i) => {
      const added = zones.includes(m.zone);
      return `<li role="option" id="opt-${i}" data-i="${i}" class="${i === active ? "active" : ""}${added ? " added" : ""}" aria-selected="${i === active}">
        <span class="r-main"><span class="r-city">${esc(m.cityLabel)}</span><span class="r-country">${esc(m.country || m.zone)}</span></span>
        <span class="r-side"><span class="r-time">${hhmm(local(m.zone, now))}</span><span class="r-off">${added ? "added" : esc(relLabel(offsetMin(m.zone, now) - myOff))}</span></span>
      </li>`;
    }).join("") : `<li class="empty">No places match "${esc(input.value.trim())}". Try a city, country or zone like PST.</li>`;
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-activedescendant", active >= 0 ? "opt-" + active : "");
  }
  function closeResults() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }
  function setActive(i) {
    if (!matches.length) return;
    active = (i + matches.length) % matches.length;
    list.querySelectorAll("li[data-i]").forEach(li => {
      const on = +li.dataset.i === active;
      li.classList.toggle("active", on);
      li.setAttribute("aria-selected", on);
      if (on) li.scrollIntoView({ block: "nearest" });
    });
    input.setAttribute("aria-activedescendant", "opt-" + active);
  }
  function addZone(z) {
    if (!zones.includes(z)) { zones.push(z); save(); render(); }
    input.value = "";
    closeResults();
    input.focus();
  }

  input.addEventListener("input", showResults);
  input.addEventListener("focus", () => { if (input.value.trim()) showResults(); });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); list.hidden ? showResults() : setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Escape") { closeResults(); }
  });
  list.addEventListener("pointerdown", e => e.preventDefault());
  list.addEventListener("click", e => {
    const li = e.target.closest("li[data-i]");
    if (li) addZone(matches[+li.dataset.i].zone);
  });
  input.addEventListener("blur", closeResults);

  document.getElementById("addForm").addEventListener("submit", e => {
    e.preventDefault();
    const raw = input.value.trim();
    if (!raw) return;
    if (active >= 0 && matches[active]) return addZone(matches[active].zone);
    if (validZone(raw)) return addZone(raw);
    err.textContent = `No places match "${raw}". Try a city, country or zone like PST.`;
  });

  render();
  setInterval(render, 30e3);
})();
