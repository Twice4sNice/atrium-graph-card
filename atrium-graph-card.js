/*
 * Atrium Verlauf (atrium-graph) v0.3.1
 * Teil der Atrium-Kartenfamilie: https://github.com/Twice4sNice/Atrium
 * MIT License
 */

const ATRIUM_CARDS_VERSION = "0.3.1";

const aEsc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Only accept simple CSS colours from configs (they end up inside style attributes). */
const safeColor = (v, fallback) =>
  typeof v === "string" && /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%]+\)|[a-z]{3,20})$/i.test(v.trim()) ? v.trim() : fallback;

const OFFLINE = new Set(["unavailable", "unknown"]);
const TOGGLE_DOMAINS = new Set(["switch", "light", "fan", "input_boolean", "automation", "siren", "humidifier"]);
const OPENING_CLASSES = new Set(["door", "window", "opening", "garage_door"]);
const DOMAIN_ICONS = {
  switch: "mdi:power-socket-eu",
  light: "mdi:lightbulb-outline",
  fan: "mdi:fan",
  input_boolean: "mdi:toggle-switch-outline",
  automation: "mdi:robot-outline",
  script: "mdi:script-text-outline",
  binary_sensor: "mdi:checkbox-blank-circle-outline",
  cover: "mdi:window-shutter",
  lock: "mdi:lock",
  sensor: "mdi:eye-outline",
  climate: "mdi:thermostat",
};

const isTemplate = (v) => typeof v === "string" && /\[\[\[|\{\{|\{%/.test(v);
const plain = (v) => (typeof v === "string" && v.trim() && !isTemplate(v) ? v : undefined);

/* "RolladenSchlafzimmerLinks" / "Tasmota_Deko_Haustür" -> readable words. */
const pretty = (v) =>
  String(v || "")
    .replace(/_/g, " ")
    .replace(/([a-zäöüß0-9])([A-ZÄÖÜ])/g, "$1 $2")
    .replace(/\s{2,}/g, " ")
    .trim();

const lang = (hass) => hass?.locale?.language || hass?.language || "de";
const fmtNum = (hass, v, digits) =>
  Number(v).toLocaleString(lang(hass), { minimumFractionDigits: digits, maximumFractionDigits: digits });
const autoDigits = (v) => (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2);

const fire = (node, type, detail) =>
  node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));

const firstEntity = (hass, domains, test = () => true) =>
  Object.keys(hass?.states || {}).find((id) => domains.includes(id.split(".")[0]) && test(hass.states[id]));

function runAction(el, hass, action, entityId) {
  const a = action || {};
  const kind = a.action || "more-info";
  if (kind === "none") return undefined;
  if (kind === "toggle") return hass.callService("homeassistant", "toggle", {}, { entity_id: entityId });
  if (kind === "more-info") return fire(el, "hass-more-info", { entityId: a.entity || entityId });
  if (kind === "navigate") {
    if (a.navigation_path) {
      history.pushState(null, "", a.navigation_path);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    }
    return undefined;
  }
  if (kind === "url") {
    if (a.url_path) window.open(a.url_path, "_blank", "noopener");
    return undefined;
  }
  if (kind === "call-service" || kind === "perform-action") {
    const svc = a.perform_action || a.service;
    if (!svc || !svc.includes(".")) return undefined;
    const [domain, service] = svc.split(".");
    return hass.callService(domain, service, a.data || a.service_data || {}, a.target);
  }
  return undefined;
}

const BASE_CSS = `
:host{display:block;container-type:inline-size}
*{box-sizing:border-box}
button{font:inherit;color:inherit}
.c{background:var(--ha-card-background,var(--card-background-color,#1c1c1f));border:1px solid var(--ha-card-border-color,rgba(127,127,127,0.2));border-radius:var(--ha-card-border-radius,24px);box-shadow:var(--ha-card-box-shadow,none);padding:16px;color:var(--primary-text-color,#F5F5F7);height:100%;width:100%;display:flex;flex-direction:column;gap:12px;min-width:0}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
.hd{display:flex;align-items:center;gap:12px;min-width:0}
.t{margin:0;font-size:15px;font-weight:700;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.s{margin:2px 0 0;font-size:12.5px;color:var(--secondary-text-color,#9A9AA3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ib{width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;flex:none;background:rgba(127,127,127,0.16);border:1px solid rgba(127,127,127,0.18);--mdc-icon-size:20px}
.off{color:#F5A623}
@container (max-width:200px){.c{padding:12px;gap:10px;border-radius:20px}.ib{width:34px;height:34px;--mdc-icon-size:18px}.t{font-size:14px}}
`;

class AtriumBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    if (!config) throw new Error("Konfiguration fehlt");
    this._config = this._normalize(config);
    if (this._hass) this._render();
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    if (!this._config || this._busy) return;
    if (!old || this._watch().some((id) => old.states[id] !== hass.states[id])) this._render();
  }

  get hass() {
    return this._hass;
  }

  _normalize(config) {
    return config;
  }

  _watch() {
    return [];
  }

  _st(id) {
    return id ? this._hass?.states[id] : undefined;
  }

  _name(id, override) {
    return override || pretty(this._st(id)?.attributes?.friendly_name) || id || "";
  }

  getCardSize() {
    return 3;
  }
}

/* ---------- atrium-graph: replaces mini-graph-card ---------- */

const GRAPH_COLORS = ["#5B8CFF", "#F0A35C", "#30C26B", "#C77DFF"];

class AtriumGraph extends AtriumBase {
  static getStubConfig(hass) {
    return { entities: [firstEntity(hass, ["sensor"], (s) => s.attributes.unit_of_measurement) || ""] };
  }

  _normalize(config) {
    const list = (Array.isArray(config.entities) ? config.entities : [config.entity])
      .map((e) => (typeof e === "string" ? { entity: e } : e))
      .filter((e) => e && e.entity);
    if (!list.length) throw new Error("atrium-graph braucht mindestens eine Entität");
    this._hist = {};
    this._loadedAt = 0;
    return { hours_to_show: 24, ...config, entities: list };
  }

  _watch() {
    return this._config.entities.map((e) => e.entity);
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return { columns: 6, rows: 4, min_columns: 4 };
  }

  connectedCallback() {
    clearInterval(this._timer);
    this._timer = setInterval(() => this._load(), 5 * 60 * 1000);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    this._timer = null;
  }

  set hass(hass) {
    super.hass = hass;
    if (this._config && Date.now() - this._loadedAt > 60 * 1000) this._load();
  }

  get hass() {
    return this._hass;
  }

  async _load() {
    if (!this._hass || !this._config || this._loading) return;
    this._loading = true;
    this._loadedAt = Date.now();
    const ids = this._watch();
    const start = new Date(Date.now() - this._config.hours_to_show * 3600 * 1000).toISOString();
    try {
      const res = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: start,
        entity_ids: ids,
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
      for (const id of ids) {
        this._hist[id] = (res?.[id] || [])
          .map((p) => ({ t: (p.lu ?? p.lc) * 1000, v: parseFloat(p.s) }))
          .filter((p) => Number.isFinite(p.v) && Number.isFinite(p.t));
      }
    } catch (_) {
      /* keep the last known history */
    }
    this._loading = false;
    this._render();
  }

  _color(value) {
    const th = Array.isArray(this._config.color_thresholds) ? [...this._config.color_thresholds] : [];
    th.sort((a, b) => a.value - b.value);
    let color = GRAPH_COLORS[0];
    for (const t of th) if (Number.isFinite(value) && value >= t.value) color = safeColor(t.color, color);
    return color;
  }

  _digits(v) {
    const d = Number(this._config.decimals);
    return Number.isInteger(d) && d >= 0 && d <= 4 ? d : autoDigits(v);
  }

  _render() {
    const c = this._config;
    const first = c.entities[0];
    const s = this._st(first.entity);
    const unit = plain(c.unit) || s?.attributes?.unit_of_measurement || "";
    const cur = parseFloat(s?.state);
    const offline = !s || OFFLINE.has(s.state) || !Number.isFinite(cur);
    const name = plain(c.name) || this._name(first.entity, plain(first.name));
    const icon = plain(c.icon) || s?.attributes?.icon || "mdi:chart-line";
    const span = c.hours_to_show * 3600 * 1000;
    const t0 = Date.now() - span;

    const series = c.entities.map((e, i) => ({
      ...e,
      pts: this._hist[e.entity] || [],
      color: i === 0 ? this._color(cur) : GRAPH_COLORS[i % GRAPH_COLORS.length],
    }));
    const all = series.flatMap((x) => x.pts.map((p) => p.v));
    let paths = "";
    let stats = "";
    if (all.length > 1) {
      // auto-scale like mini-graph-card: data range plus a little headroom, not forced to zero
      const min = Math.min(...all);
      const max = Math.max(...all);
      const pad = (max - min) * 0.1 || Math.abs(max) * 0.1 || 1;
      const lo = min >= 0 && min - pad < 0 ? 0 : min - pad;
      const hi = max + pad;
      const range = hi - lo || 1;
      series.forEach((x, i) => {
        if (x.pts.length < 2) return;
        const d = x.pts
          .map((p, j) => `${j ? "L" : "M"}${((Math.max(0, p.t - t0) / span) * 300).toFixed(1)},${(78 - ((p.v - lo) / range) * 74).toFixed(1)}`)
          .join(" ");
        const end = ((Math.max(0, x.pts[x.pts.length - 1].t - t0) / span) * 300).toFixed(1);
        const start = ((Math.max(0, x.pts[0].t - t0) / span) * 300).toFixed(1);
        if (i === 0) paths += `<path d="${d} L${end},80 L${start},80 Z" fill="url(#ag)"/>`;
        paths += `<path d="${d}" fill="none" stroke="${x.color}" stroke-width="2" stroke-linejoin="round" ${i ? 'stroke-dasharray="4 3"' : ""} vector-effect="non-scaling-stroke"/>`;
      });
      const fv = series[0].pts.map((p) => p.v);
      if (fv.length) {
        const mn = Math.min(...fv);
        const mx = Math.max(...fv);
        stats = `<span>Min ${fmtNum(this._hass, mn, this._digits(mn))}</span><span>Max ${fmtNum(this._hass, mx, this._digits(mx))}</span>`;
      }
    }
    const others = series
      .slice(1)
      .map((x) => {
        const os = this._st(x.entity);
        const v = parseFloat(os?.state);
        const val = Number.isFinite(v) ? fmtNum(this._hass, v, this._digits(v)) : "–";
        return `<span class="o"><i style="border-color:${x.color}"></i>${aEsc(this._name(x.entity, plain(x.name)))}: <b>${val}</b> ${aEsc(os?.attributes?.unit_of_measurement || "")}</span>`;
      })
      .join("");
    const value = offline ? "–" : fmtNum(this._hass, cur, this._digits(cur));
    this.shadowRoot.innerHTML = `<style>${BASE_CSS}
      .big{font-size:38px;font-weight:800;letter-spacing:-.04em;line-height:1;white-space:nowrap}
      .big small{font-size:15px;color:var(--secondary-text-color,#9A9AA3);font-weight:600;margin-left:4px}
      svg{width:100%;height:96px;display:block;margin-top:auto}
      .ft{font-size:11.5px;color:var(--secondary-text-color,#9A9AA3);display:flex;gap:14px;flex-wrap:wrap}
      .o{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--secondary-text-color,#9A9AA3)}
      .o i{width:14px;height:0;border-top:2px dashed;display:inline-block}
      .o b{color:var(--primary-text-color,#F5F5F7)}
      .c{cursor:pointer}
      .c:focus-visible{outline:2px solid #5B8CFF;outline-offset:2px}
      @container (max-width:220px){.big{font-size:28px}svg{height:64px}}
    </style>
    <div class="c" role="button" tabindex="0" aria-label="${aEsc(name)}: ${aEsc(value)} ${aEsc(unit)}">
      <div class="row"><div class="hd"><span class="ib"><ha-icon icon="${aEsc(icon)}"></ha-icon></span><div style="min-width:0"><p class="t">${aEsc(name)}</p><p class="s ${offline ? "off" : ""}">${offline ? "Nicht erreichbar" : `Letzte ${c.hours_to_show} Stunden`}</p></div></div></div>
      <div class="big">${value}<small>${aEsc(unit)}</small></div>
      ${others ? `<div style="display:flex;gap:14px;flex-wrap:wrap">${others}</div>` : ""}
      ${paths ? `<svg viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${series[0].color}" stop-opacity=".4"/><stop offset="1" stop-color="${series[0].color}" stop-opacity="0"/></linearGradient></defs>${paths}</svg>` : ""}
      ${stats ? `<div class="ft">${stats}</div>` : ""}
    </div>`;
    const card = this.shadowRoot.querySelector(".c");
    const open = () => fire(this, "hass-more-info", { entityId: first.entity });
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  }
}


if (!customElements.get("atrium-graph")) customElements.define("atrium-graph", AtriumGraph);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "atrium-graph")) window.customCards.push({ type: "atrium-graph", name: "Atrium Verlauf", description: "Wert mit Verlaufsgraph", preview: true });
console.info("%c ATRIUM-GRAPH %c v0.3.1 ", "color:#fff;background:#2F6BFF;border-radius:4px 0 0 4px;padding:2px 4px", "color:#2F6BFF;background:#1c1c1f;border-radius:0 4px 4px 0;padding:2px 4px");
