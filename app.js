// ES 335 project website. Reads the small JSON files exported by the capture24-modelling notebook
// (copied into data/) and draws every chart as plain SVG/HTML. No libraries, no build step.

// Fill these in with your public links (leave "" to hide a link).
const LINKS = {
  modelling: "https://www.kaggle.com/code/nityanandkarmali/modelling",      // e.g. https://www.kaggle.com/code/<user>/capture24-modelling
  preprocessing: "https://www.kaggle.com/code/nityanandkarmali/preprocessing",  // e.g. https://www.kaggle.com/code/<user>/capture24-preprocessing
  repo: "https://github.com/Nitya047/capture24-site",           // e.g. https://github.com/<user>/<repo>
};
const TEAM = "Nityanand Karmali · Amartya Tuljapurkar";

const FILES = ["results", "budget", "leakage", "learning_curve", "persons", "compact"];
const CLASS_VAR = { "sleep": "--c-sleep", "sedentary": "--c-sedentary", "light": "--c-light", "moderate-vigorous": "--c-mv" };
const MODEL_VAR = { forest: "--m-forest", tree: "--m-tree" };
const NS = "http://www.w3.org/2000/svg";
const D = {};                       // loaded data
const state = { cmModel: "forest", budModel: "forest", k: 8, person: null };

// ---------- small helpers ----------
const $ = (s) => document.querySelector(s);
const f3 = (v) => (v == null || Number.isNaN(v) ? "–" : Number(v).toFixed(3));
const pct = (v, d = 1) => (v == null ? "–" : (100 * v).toFixed(d) + "%");
const int = (v) => Number(v).toLocaleString("en-US");
const signed = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(3);
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const clsColor = (c) => `var(${CLASS_VAR[c] || "--muted"})`;
const shortCls = (c) => (c === "moderate-vigorous" ? "mod-vig" : c);
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
function el(tag, attrs = {}, parent, html) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
function S(tag, attrs = {}, parent, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
function svgIn(container, w, h, label) {
  container.innerHTML = "";
  const s = S("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: "img" }, container);
  if (label) s.setAttribute("aria-label", label);
  return s;
}
const scale = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
function niceTicks(lo, hi, n = 5) {
  const step0 = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}
function modelName(m) {
  const bp = (D.results && D.results.best_params) || {};
  return { majority: "Majority class", logistic: "Logistic regression",
           tree: `Decision tree${bp.tree && bp.tree.max_depth ? ` (depth ${bp.tree.max_depth})` : ""}`,
           forest: "Random forest" }[m] || m;
}
function rowsOf(records) {           // results.models is a list of records with a "model" key
  const o = {};
  for (const r of records) o[r.model ?? r.index] = r;
  return o;
}

// ---------- tooltip ----------
const tip = $("#tip");
function showTip(html, ev) {
  tip.innerHTML = html; tip.hidden = false;
  const pad = 14, r = tip.getBoundingClientRect();
  let x = ev.clientX + pad, y = ev.clientY + pad;
  if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - pad;
  tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px";
}
const hideTip = () => { tip.hidden = true; };
function hover(node, html) {
  node.addEventListener("pointermove", (e) => showTip(typeof html === "function" ? html() : html, e));
  node.addEventListener("pointerleave", hideTip);
}
addEventListener("scroll", hideTip, { passive: true });

// ---------- segmented control ----------
function seg(container, options, current, onPick) {
  container.innerHTML = "";
  for (const [value, label] of options) {
    const b = el("button", { type: "button", role: "radio", "aria-checked": String(value === current) }, container, esc(label));
    b.addEventListener("click", () => {
      for (const x of container.children) x.setAttribute("aria-checked", "false");
      b.setAttribute("aria-checked", "true");
      onPick(value);
    });
  }
}

// ---------- headline tiles ----------
function renderTiles() {
  const R = rowsOf(D.results.models), ci = rowsOf(D.results.ci);
  const diff = D.results.paired_differences.find((d) => d.comparison === "forest - tree");
  const fullF = D.compact.find((r) => r.model === "forest" && r.k === 16);
  const compF = D.compact.find((r) => r.model === "forest" && r.k === D.budget.k_compact);
  const leakF = D.leakage.find((r) => r.model === "forest");
  const tiles = [
    ["Random forest on new people", f3(R.forest.test_macro_f1), `macro-F1 · 95% interval ${f3(ci.forest.ci_low)}–${f3(ci.forest.ci_high)}`],
    [`Compact model: ${modelName("tree").toLowerCase()}`, f3(R.tree.test_macro_f1), diff ? `${f3(diff.diff)} below the forest (interval ${f3(diff.ci_low)}–${f3(diff.ci_high)})` : ""],
    ["Features the forest needs", `${D.budget.k_compact} of 16`, fullF && compF ? `gives up ${f3(fullF.test_macro_f1 - compF.test_macro_f1)} test macro-F1` : ""],
    ["Score inflation from a random split", leakF ? signed(leakF.inflation) : "–", "forest, versus splitting by person"],
  ];
  const box = $("#tiles"); box.innerHTML = "";
  for (const [l, v, c] of tiles) el("div", { class: "tile" }, box, `<div class="label">${esc(l)}</div><div class="value">${v}</div><div class="ctx">${esc(c)}</div>`);
}

function renderClassLegend() {
  const box = $("#class-legend"); box.innerHTML = "";
  const tr = D.results.confusion.forest.map((r) => r.reduce((a, b) => a + b, 0));
  const tot = tr.reduce((a, b) => a + b, 0);
  D.results.classes.forEach((c, i) => el("span", { class: "key" }, box,
    `<span class="sw" style="background:${clsColor(c)}"></span>${esc(c)} <span class="muted">${pct(tr[i] / tot)} of test windows</span>`));
}

// ---------- model comparison (dot + interval) ----------
function renderModels() {
  const box = $("#chart-models"), W = Math.max(300, box.clientWidth);
  const order = ["majority", "logistic", "tree", "forest"];
  const ci = rowsOf(D.results.ci), R = rowsOf(D.results.models);
  const narrow = W < 520, L = narrow ? 112 : 170, Rm = 52, rowH = 46, top = 8, H = top + rowH * order.length + 28;
  const xMax = Math.ceil((Math.max(...order.map((m) => ci[m].ci_high)) + 0.05) * 10) / 10;
  const x = scale(0, xMax, L, W - Rm);
  const s = svgIn(box, W, H, "Test macro-F1 by model with 95% intervals");
  for (const t of niceTicks(0, xMax, narrow ? 4 : 8)) {
    S("line", { x1: x(t), x2: x(t), y1: top, y2: H - 24, class: "gridline" }, s);
    S("text", { x: x(t), y: H - 6, "text-anchor": "middle", class: "tick-label" }, s, t.toFixed(1));
  }
  order.forEach((m, i) => {
    const cy = top + rowH * i + rowH / 2, c = ci[m];
    const g = S("g", {}, s);
    if (m === state.cmModel) S("rect", { x: 0, y: cy - rowH / 2 + 2, width: W, height: rowH - 4, rx: 8, class: "sel-band" }, g);
    S("text", { x: L - 12, y: cy + 4, "text-anchor": "end", style: `fill:var(--ink);font-size:${narrow ? 12 : 13}px` }, g, narrow ? modelName(m).replace("Logistic regression", "Logistic").replace(/Decision tree/, "Tree") : modelName(m));
    S("line", { x1: x(c.ci_low), x2: x(c.ci_high), y1: cy, y2: cy, style: "stroke:var(--ink-2);stroke-width:2;stroke-linecap:round" }, g);
    for (const v of [c.ci_low, c.ci_high]) S("line", { x1: x(v), x2: x(v), y1: cy - 6, y2: cy + 6, style: "stroke:var(--ink-2);stroke-width:2;stroke-linecap:round" }, g);
    S("circle", { cx: x(c.macro_f1), cy, r: 6, style: "fill:var(--ink);stroke:var(--surface);stroke-width:2" }, g);
    S("text", { x: x(c.ci_high) + 10, y: cy + 4, class: "val" }, g, f3(c.macro_f1));
    const hit = S("rect", { x: 0, y: cy - rowH / 2, width: W, height: rowH, class: "hit" }, g);
    hover(hit, `<b>${esc(modelName(m))}</b><br>macro-F1 ${f3(c.macro_f1)}<br>95% interval ${f3(c.ci_low)}–${f3(c.ci_high)}<br>balanced accuracy ${f3(R[m].balanced_acc)}<br>accuracy ${pct(R[m].accuracy)}`);
    hit.addEventListener("click", () => { if (m !== "majority" || true) { state.cmModel = m; renderCmSection(); renderModels(); } });
  });
  // table view
  const cls = D.results.classes;
  let t = `<div class="table-scroll"><table><thead><tr><th>Model</th><th>Macro-F1</th><th>95% interval</th><th>Balanced acc.</th><th>Accuracy</th>${cls.map((c) => `<th>Recall ${esc(shortCls(c))}</th>`).join("")}</tr></thead><tbody>`;
  for (const m of order) t += `<tr><td>${esc(modelName(m))}</td><td>${f3(R[m].test_macro_f1)}</td><td>${f3(ci[m].ci_low)}–${f3(ci[m].ci_high)}</td><td>${f3(R[m].balanced_acc)}</td><td>${pct(R[m].accuracy)}</td>${cls.map((c) => `<td>${f3(R[m]["recall_" + c])}</td>`).join("")}</tr>`;
  $("#table-models").innerHTML = t + "</tbody></table></div>";
}

function renderDiffText() {
  const d = Object.fromEntries(D.results.paired_differences.map((r) => [r.comparison, r]));
  const ft = d["forest - tree"], fl = d["forest - logistic"];
  if (!ft || !fl) return;
  const both = ft.ci_low > 0 && fl.ci_low > 0;
  $("#diff-text").innerHTML = `On the same resamples of people, the forest beats the ${esc(modelName("tree").toLowerCase())} by <b>${f3(ft.diff)}</b> (95% interval ${f3(ft.ci_low)} to ${f3(ft.ci_high)}) and logistic regression by <b>${f3(fl.diff)}</b> (${f3(fl.ci_low)} to ${f3(fl.ci_high)}). ${both ? "Both intervals exclude zero, so the forest is better on these people, but its lead over a single shallow tree is small." : "At least one interval includes zero, so that difference is not clear."}`;
}

// ---------- confusion matrix ----------
function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return A.map((v, i) => Math.round(v + (B[i] - v) * t));
}
function renderCM(box, M, classes) {
  const lo = cssVar("--seq-0"), hi = cssVar("--seq-hi");
  const narrow = box.clientWidth < 420;
  box.innerHTML = "";
  const wrap = el("div", {}, box);
  el("div", { class: "cm-axis", style: "text-align:center;margin-left:84px" }, wrap, "predicted →");
  const g = el("div", { class: "cm", style: `grid-template-columns:${narrow ? 72 : 84}px repeat(${classes.length},minmax(0,1fr))` }, wrap);
  el("div", { class: "h rh cm-axis" }, g, "true ↓");
  for (const c of classes) el("div", { class: "h" }, g, `<span class="sw" style="background:${clsColor(c)};margin-right:4px"></span>${esc(narrow ? shortCls(c) : c)}`);
  M.forEach((row, i) => {
    const tot = row.reduce((a, b) => a + b, 0) || 1;
    el("div", { class: "h rh" }, g, esc(narrow ? shortCls(classes[i]) : classes[i]));
    row.forEach((n, j) => {
      const v = n / tot, rgb = mix(lo, hi, Math.sqrt(v));
      const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
      const cell = el("div", { class: "cell" + (i === j ? " diag" : ""), style: `background:rgb(${rgb});color:${lum < 0.5 ? "#fff" : "#0b0b0b"}`, tabindex: "0",
        "aria-label": `true ${classes[i]}, predicted ${classes[j]}: ${pct(v)} (${int(n)} windows)` }, g, (100 * v).toFixed(v < 0.1 ? 1 : 0) + "%");
      hover(cell, `<b>true ${esc(classes[i])} → predicted ${esc(classes[j])}</b><br>${int(n)} windows<br>${pct(v)} of true ${esc(classes[i])}`);
    });
  });
}

// ---------- horizontal recall bars ----------
function renderBars(box, classes, vals, ref, refLabel) {
  const W = Math.max(260, box.clientWidth), narrow = W < 420, L = narrow ? 78 : 140, Rm = 50, rowH = 34, H = rowH * classes.length + 26;
  const x = scale(0, 1, L, W - Rm);
  const s = svgIn(box, W, H, "Recall by class");
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    S("line", { x1: x(t), x2: x(t), y1: 0, y2: H - 22, class: "gridline" }, s);
    S("text", { x: x(t), y: H - 6, "text-anchor": "middle", class: "tick-label" }, s, t === 0 || t === 1 ? t : t.toFixed(2));
  }
  classes.forEach((c, i) => {
    const y = rowH * i + 6, h = rowH - 14, v = vals[c];
    S("text", { x: L - 10, y: y + h / 2 + 4, "text-anchor": "end", style: "fill:var(--ink)" }, s, narrow ? shortCls(c) : c);
    if (v == null) {
      S("text", { x: x(0) + 6, y: y + h / 2 + 4, class: "tick-label" }, s, "fewer than 20 windows");
    } else {
      const w = Math.max(2, x(v) - x(0));
      S("path", { d: `M${x(0)},${y} h${w - 4} a4,4 0 0 1 4,4 v${h - 8} a4,4 0 0 1 -4,4 h${-(w - 4)} z`, style: `fill:${clsColor(c)}` }, s);
      const lx = Math.max(x(v), ref && ref[c] != null ? x(ref[c]) : 0);   // keep the number clear of the reference tick
      S("text", { x: lx + 7, y: y + h / 2 + 4, class: "val" }, s, v.toFixed(2));
    }
    if (ref && ref[c] != null) S("line", { x1: x(ref[c]), x2: x(ref[c]), y1: y - 3, y2: y + h + 3, style: "stroke:var(--ink);stroke-width:2;stroke-linecap:round" }, s);
    const hit = S("rect", { x: 0, y: y - 4, width: W, height: rowH - 4, class: "hit" }, s);
    hover(hit, `<b>${esc(c)}</b><br>recall ${v == null ? "not shown (fewer than 20 windows)" : f3(v)}${ref && ref[c] != null ? `<br>${esc(refLabel)} ${f3(ref[c])}` : ""}`);
  });
}

function renderCmSection() {
  seg($("#cm-model"), ["logistic", "tree", "forest"].map((m) => [m, modelName(m).replace(/ \(.*\)/, "")]), state.cmModel, (m) => { state.cmModel = m; renderCmSection(); renderModels(); });
  const cls = D.results.classes, R = rowsOf(D.results.models)[state.cmModel];
  renderCM($("#cm-main"), D.results.confusion[state.cmModel], cls);
  renderBars($("#recall-main"), cls, Object.fromEntries(cls.map((c) => [c, R["recall_" + c]])));
}

// ---------- feature budget explorer ----------
function budgetPoint(k) { return D.budget.points.find((p) => p.k === k); }
function renderBudget() {
  const m = state.budModel, k = state.k, P = budgetPoint(k), full = budgetPoint(16), cls = D.budget.classes;
  $("#k-out").textContent = k;
  $("#k").value = k;
  document.querySelectorAll(".k-label").forEach((n) => (n.textContent = `k = ${k}`));
  const cur = P[m], ref = full[m], d = cur.test_macro_f1 - ref.test_macro_f1;
  const added = D.budget.order[k - 1];
  $("#bud-readout").innerHTML =
    `<div class="tile"><div class="label">Test macro-F1 with ${k} feature${k > 1 ? "s" : ""}</div><div class="value">${f3(cur.test_macro_f1)}</div><div class="ctx">${k === 16 ? "all features" : `<span class="${d >= 0 ? "delta-good" : "delta-bad"}">${signed(d)}</span> versus all 16`}</div></div>` +
    `<div class="tile"><div class="label">Cross-validation macro-F1</div><div class="value">${f3(cur.cv_macro_f1)}</div><div class="ctx">± ${f3(cur.cv_std)} across 5 folds of training people</div></div>` +
    `<div class="tile"><div class="label">Feature added at k = ${k}</div><div class="value" style="font-family:ui-monospace,Menlo,monospace;font-size:22px">${esc(added)}</div><div class="ctx">${esc(describeFeature(added))}</div></div>`;
  const chips = $("#chips"); chips.innerHTML = "";
  D.budget.order.forEach((f, i) => {
    const b = el("button", { type: "button", class: "chip" + (i < k ? " on" : ""), title: `Keep the top ${i + 1}` }, chips, `<span class="r">${i + 1}</span>${esc(f)}`);
    b.addEventListener("click", () => { state.k = i + 1; renderBudget(); });
  });
  renderBudgetChart();
  renderBars($("#recall-budget"), cls, cur.recall, ref.recall, "with all 16 features:");
  renderCM($("#cm-budget"), cur.confusion, cls);
}
function describeFeature(f) {
  const [a, st] = f.split("_");
  const axis = a === "m" ? "overall magnitude" : `${a}-axis`;
  return { std: `how much the ${axis} varies`, mean: `average ${axis} (mostly wrist orientation)`, min: `lowest ${axis} value`, max: `highest ${axis} value` }[st] + " in the 10 s window";
}
function renderBudgetChart() {
  const box = $("#chart-budget"), W = Math.max(300, box.clientWidth), narrow = W < 520;
  const m = state.budModel, pts = D.budget.points, kc = D.budget.k_compact;
  const L = 44, Rm = 16, top = 34, bot = 34, H = narrow ? 260 : 320;
  const all = pts.flatMap((p) => ["forest", "tree"].flatMap((n) => [p[n].cv_macro_f1 - p[n].cv_std, p[n].cv_macro_f1 + p[n].cv_std, p[n].test_macro_f1]));
  const y0 = Math.floor(Math.min(...all) * 20) / 20, y1 = Math.ceil(Math.max(...all) * 20) / 20;
  const x = scale(1, 16, L + 8, W - Rm - 8), y = scale(y0, y1, H - bot, top);
  const s = svgIn(box, W, H, `Macro-F1 against number of features for the ${m}`);
  const col = `var(${MODEL_VAR[m]})`;
  for (const t of niceTicks(y0, y1, 5)) {
    S("line", { x1: L, x2: W - Rm, y1: y(t), y2: y(t), class: "gridline" }, s);
    S("text", { x: L - 6, y: y(t) + 4, "text-anchor": "end", class: "tick-label" }, s, t.toFixed(2));
  }
  for (let k = 1; k <= 16; k++) if (!narrow || k % 3 === 1 || k === 16) S("text", { x: x(k), y: H - bot + 18, "text-anchor": "middle", class: "tick-label" }, s, k);
  S("text", { x: (L + W) / 2, y: H - 2, "text-anchor": "middle", class: "tick-label" }, s, "number of features kept (k)");
  S("line", { x1: L, x2: W - Rm, y1: H - bot, y2: H - bot, class: "axis" }, s);
  // selected k band and compact marker
  S("rect", { x: x(state.k) - 10, y: top - 6, width: 20, height: H - bot - top + 6, rx: 6, class: "sel-band" }, s);
  S("line", { x1: x(kc), x2: x(kc), y1: top - 6, y2: H - bot, style: "stroke:var(--muted);stroke-width:1.5;stroke-dasharray:2 4" }, s);
  S("text", { x: x(kc), y: top - 12, "text-anchor": "middle", class: "tick-label" }, s, `compact k = ${kc}`);
  // legend (HTML, above the chart)
  $("#bud-legend").innerHTML =
    `<span class="key"><span class="sw line" style="background:${col}"></span>cross-validation, training people (band ±1 sd)</span>` +
    `<span class="key"><span class="sw dash" style="border-color:${col}"></span>test, 50 new people</span>`;
  // band, lines, markers
  const band = pts.map((p) => `${x(p.k)},${y(p[m].cv_macro_f1 + p[m].cv_std)}`).concat(pts.slice().reverse().map((p) => `${x(p.k)},${y(p[m].cv_macro_f1 - p[m].cv_std)}`));
  S("polygon", { points: band.join(" "), style: `fill:${col};opacity:.14` }, s);
  const line = (key) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.k)},${y(p[m][key])}`).join("");
  S("path", { d: line("cv_macro_f1"), style: `fill:none;stroke:${col};stroke-width:2;stroke-linejoin:round` }, s);
  S("path", { d: line("test_macro_f1"), style: `fill:none;stroke:${col};stroke-width:2;stroke-dasharray:5 4;stroke-linejoin:round` }, s);
  for (const p of pts) {
    const sel = p.k === state.k;
    S("circle", { cx: x(p.k), cy: y(p[m].cv_macro_f1), r: sel ? 6 : 4, style: `fill:${col};stroke:var(--surface);stroke-width:2` }, s);
    if (sel) S("circle", { cx: x(p.k), cy: y(p[m].test_macro_f1), r: 6, style: `fill:var(--surface);stroke:${col};stroke-width:2` }, s);
  }
  // crosshair + click to select
  const cross = S("line", { y1: top - 6, y2: H - bot, style: "stroke:var(--ink-2);stroke-width:1;visibility:hidden" }, s);
  const hit = S("rect", { x: L, y: 0, width: W - L - Rm, height: H - bot, class: "hit" }, s);
  const kAt = (ev) => {
    const r = s.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * W;
    return Math.min(16, Math.max(1, Math.round(1 + ((px - x(1)) / (x(16) - x(1))) * 15)));
  };
  hit.addEventListener("pointermove", (ev) => {
    const k = kAt(ev), p = budgetPoint(k)[m];
    cross.setAttribute("x1", x(k)); cross.setAttribute("x2", x(k)); cross.style.visibility = "visible";
    showTip(`<b>${k} feature${k > 1 ? "s" : ""}</b> (adds ${esc(D.budget.order[k - 1])})<br>CV ${f3(p.cv_macro_f1)} ± ${f3(p.cv_std)}<br>test ${f3(p.test_macro_f1)}<br><span style="color:var(--muted)">click to select</span>`, ev);
  });
  hit.addEventListener("pointerleave", () => { cross.style.visibility = "hidden"; hideTip(); });
  hit.addEventListener("click", (ev) => { state.k = kAt(ev); renderBudget(); });
}
function renderCompactTable() {
  const rows = D.compact;
  let t = `<div class="table-scroll"><table><thead><tr><th>Model</th><th>Features</th><th>CV macro-F1</th><th>Test macro-F1</th><th>Recall mod-vig</th></tr></thead><tbody>`;
  for (const r of rows) t += `<tr><td>${esc(modelName(r.model).replace(/ \(.*\)/, ""))}${r.k < 16 ? " (compact)" : ""}</td><td>${r.k}</td><td>${f3(r.cv_macro_f1)}</td><td>${f3(r.test_macro_f1)}</td><td>${f3(r.recall_mv)}</td></tr>`;
  $("#table-compact").innerHTML = t + "</tbody></table></div><p class=\"note\" style=\"margin:8px 0 0\">Each compact budget is the smallest k whose cross-validation score is within 0.01 of that model's best, chosen without looking at the test set. All rows use the 10% training subsample.</p>";
  const F16 = rows.find((r) => r.model === "forest" && r.k === 16), Fc = rows.find((r) => r.model === "forest" && r.k < 16);
  const T16 = rows.find((r) => r.model === "tree" && r.k === 16), Tc = rows.find((r) => r.model === "tree" && r.k < 16);
  if (F16 && Fc && T16 && Tc) $("#budget-note").innerHTML = `With only its top ${Fc.k} features the forest scores ${f3(Fc.test_macro_f1)} on new people against ${f3(F16.test_macro_f1)} with all 16. A tree using just ${Tc.k} features (${f3(Tc.test_macro_f1)}) does as well as the same tree with all 16 (${f3(T16.test_macro_f1)}). Sleep is recognised from a single movement-variability feature; moderate-vigorous and sedentary need a second one; only light activity keeps improving past 8.`;
}

// ---------- people ----------
function renderPeople() {
  const P = D.persons, box = $("#chart-people"), W = Math.max(300, box.clientWidth);
  const vals = P.map((p) => p.balanced_acc);
  const lo = Math.floor(Math.min(...vals) * 20) / 20, hi = Math.ceil(Math.max(...vals) * 20) / 20;
  const L = 16, Rm = 16, r = W < 520 ? 6 : 7, x = scale(lo, hi, L + r, W - Rm - r);
  // simple beeswarm: stack dots that would overlap
  const placed = [];
  const order = P.map((p, i) => i).sort((a, b) => P[a].balanced_acc - P[b].balanced_acc);
  for (const i of order) {
    const cx = x(P[i].balanced_acc);
    const taken = (l) => placed.some((q) => q.lvl === l && Math.abs(q.cx - cx) < 2 * r + 2);
    let lvl = 0;
    for (let n = 1; taken(lvl); n++) lvl = n % 2 ? Math.ceil(n / 2) : -n / 2;   // 0, 1, -1, 2, -2, ...
    placed.push({ i, cx, lvl });
  }
  const levels = placed.map((q) => q.lvl), maxL = Math.max(1, ...levels.map(Math.abs));
  const top = 30, mid = top + (maxL + 1) * (2 * r + 2), H = mid + (maxL + 1) * (2 * r + 2) + 46;
  const s = svgIn(box, W, H, "Balanced accuracy of each of the 50 test people");
  for (const t of niceTicks(lo, hi, W < 520 ? 4 : 7)) {
    S("line", { x1: x(t), x2: x(t), y1: top - 10, y2: H - 38, class: "gridline" }, s);
    S("text", { x: x(t), y: H - 22, "text-anchor": "middle", class: "tick-label" }, s, t.toFixed(2));
  }
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  S("line", { x1: x(mean), x2: x(mean), y1: top - 10, y2: H - 38, style: "stroke:var(--ink-2);stroke-width:1.5;stroke-dasharray:4 3" }, s);
  S("text", { x: x(mean), y: top - 14, "text-anchor": "middle", class: "tick-label" }, s, `mean ${f3(mean)}`);
  S("text", { x: W / 2, y: H - 4, "text-anchor": "middle", class: "tick-label" }, s, "balanced accuracy (each dot = one test person)");
  for (const q of placed) {
    const p = P[q.i], cy = mid + q.lvl * (2 * r + 2), sel = q.i === state.person;
    const c = S("circle", { cx: q.cx, cy, r: sel ? r + 2 : r, tabindex: "0", style: `cursor:pointer;fill:${sel ? "var(--accent)" : "var(--ink-2)"};stroke:var(--surface);stroke-width:2;${sel ? "" : "opacity:.75"}` }, s);
    c.setAttribute("aria-label", `${p.person}, balanced accuracy ${f3(p.balanced_acc)}`);
    hover(c, `<b>${esc(p.person)}</b><br>balanced accuracy ${f3(p.balanced_acc)}<br>${int(p.windows)} windows<br>${pct(p["share_moderate-vigorous"])} moderate-vigorous`);
    const pick = () => selectPerson(q.i);
    c.addEventListener("click", pick);
    c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
  }
}
function selectPerson(i) {
  state.person = i;
  $("#person-select").value = String(i);
  renderPeople(); renderPersonDetail();
}
function renderPersonDetail() {
  const p = D.persons[state.person], cls = D.results.classes, box = $("#person-detail");
  const all = D.persons.map((q) => q.balanced_acc).sort((a, b) => a - b);
  const rank = all.filter((v) => v < p.balanced_acc).length + 1;
  box.innerHTML = `<div class="pd-head"><h4>${esc(p.person)}</h4><span>${int(p.windows)} labelled windows (${(p.windows / 360).toFixed(1)} h)</span><span>balanced accuracy <b>${f3(p.balanced_acc)}</b> · ${rank === 1 ? "lowest" : rank === all.length ? "highest" : `${ordinal(rank)} lowest`} of ${all.length}</span><span>accuracy ${pct(p.accuracy)}</span></div>
    <div class="pd-grid"><div><h4 class="card-title">How this person spent their labelled time</h4><div class="stackbar" id="pd-stack"></div><div class="legend-row" id="pd-leg" style="margin-top:6px"></div></div>
    <div><h4 class="card-title">How well each class was recognised <span class="muted">(tick = all test people)</span></h4><div class="chart" id="pd-bars"></div></div></div>
    <p class="note" id="pd-note"></p>`;
  const st = $("#pd-stack"), lg = $("#pd-leg");
  for (const c of cls) {
    const v = p["share_" + c];
    if (v > 0) { const d = el("div", { style: `flex:${v};background:${clsColor(c)}` }, st); hover(d, `<b>${esc(c)}</b><br>${pct(v)} of this person's windows`); }
    el("span", { class: "key" }, lg, `<span class="sw" style="background:${clsColor(c)}"></span>${esc(shortCls(c))} ${pct(v, 0)}`);
  }
  const R = rowsOf(D.results.models).forest;
  renderBars($("#pd-bars"), cls, Object.fromEntries(cls.map((c) => [c, p["recall_" + c]])), Object.fromEntries(cls.map((c) => [c, R["recall_" + c]])), "all test people:");
  const mv = p["share_moderate-vigorous"], mvr = p["recall_moderate-vigorous"];
  let note = "";
  if (mvr == null) note = "This person has fewer than 20 moderate-vigorous windows, so their recall on that class is not shown. Balanced accuracy averages over the classes they do have, so a handful of missed windows can pull it down a lot.";
  else if (mvr < 0.3) note = `Most of this person's moderate-vigorous windows were missed. If their vigorous activity moves the wrist little, 10-second summary features cannot see it.`;
  else {
    const weak = cls.filter((c) => p["recall_" + c] != null).sort((a, b) => (p["recall_" + a] - R["recall_" + a]) - (p["recall_" + b] - R["recall_" + b]))[0];
    const gap = p["recall_" + weak] - R["recall_" + weak];
    if (gap < -0.1) note = `This person's weakest class compared with everyone else is ${weak}: recall ${f3(p["recall_" + weak])} against ${f3(R["recall_" + weak])} for all test people.`;
    else if (mv < 0.01) note = `Under 1% of this person's windows are moderate-vigorous, so a few missed windows of that class move their balanced accuracy a lot.`;
  }
  $("#pd-note").textContent = note;
}
const ordinal = (n) => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
function initPeopleControls() {
  const sel = $("#person-select"); sel.innerHTML = "";
  const idx = D.persons.map((p, i) => i).sort((a, b) => parseInt(D.persons[a].person.replace(/\D/g, "")) - parseInt(D.persons[b].person.replace(/\D/g, "")));
  for (const i of idx) el("option", { value: String(i) }, sel, `${esc(D.persons[i].person)} · ${f3(D.persons[i].balanced_acc)}`);
  sel.addEventListener("change", () => selectPerson(+sel.value));
  const byAcc = D.persons.map((p, i) => i).sort((a, b) => D.persons[a].balanced_acc - D.persons[b].balanced_acc);
  const picks = { low: byAcc[0], mid: byAcc[Math.floor(byAcc.length / 2)], high: byAcc[byAcc.length - 1] };
  state.person = picks.low;
  seg($("#person-sort"), [["low", "Lowest"], ["mid", "Median"], ["high", "Highest"]], "low", (v) => selectPerson(picks[v]));
  sel.value = String(state.person);
}
function renderGroups() {
  const g = D.results.groups;
  let t = `<div class="table-scroll"><table><thead><tr><th>Group</th><th>People</th><th>Windows</th><th>Pooled macro-F1</th><th>Mean balanced acc. per person</th></tr></thead><tbody>`;
  for (const r of g) t += `<tr><td>${r.attribute === "sex" ? "Sex" : "Age"}: ${esc(r.group)}</td><td>${r.people}</td><td>${int(r.windows)}</td><td>${f3(r.macro_f1)}</td><td>${f3(r.mean_person_balanced_acc)}</td></tr>`;
  $("#table-groups").innerHTML = t + `</tbody></table></div><p class="note" style="margin:8px 0 0">Pooled macro-F1 mixes everyone's windows together, so it also reflects how much of each activity a group did. Per-person balanced accuracy is the fairer comparison, and for sex it is nearly identical.</p>`;
}

// ---------- leakage ----------
function renderLeak() {
  const box = $("#chart-leak"), W = Math.max(300, box.clientWidth), narrow = W < 520;
  const rows = D.leakage, L = narrow ? 80 : 150, Rm = narrow ? 64 : 90, rowH = 54, top = 34, H = top + rowH * rows.length + 26;
  const vals = rows.flatMap((r) => [r.random_split, r.participant_split]);
  const lo = Math.floor(Math.min(...vals) * 20) / 20 - 0.02, hi = Math.ceil(Math.max(...vals) * 20) / 20;
  const x = scale(lo, hi, L, W - Rm);
  const s = svgIn(box, W, H, "Cross-validation macro-F1 with a random split versus a split by person");
  for (const t of niceTicks(lo, hi, narrow ? 4 : 6)) {
    S("line", { x1: x(t), x2: x(t), y1: top - 8, y2: H - 22, class: "gridline" }, s);
    S("text", { x: x(t), y: H - 6, "text-anchor": "middle", class: "tick-label" }, s, t.toFixed(2));
  }
  const lg = S("g", { transform: `translate(${L},14)` }, s);
  S("circle", { cx: 6, cy: 0, r: 6, style: "fill:var(--ink)" }, lg);
  S("text", { x: 18, y: 4 }, lg, "split by person (honest)");
  S("circle", { cx: narrow ? 170 : 200, cy: 0, r: 5, style: "fill:var(--surface);stroke:var(--ink);stroke-width:2" }, lg);
  S("text", { x: (narrow ? 170 : 200) + 12, y: 4 }, lg, "random split");
  rows.forEach((r, i) => {
    const cy = top + rowH * i + rowH / 2;
    S("text", { x: L - 12, y: cy + 4, "text-anchor": "end", style: "fill:var(--ink)" }, s, narrow ? (r.model === "logistic" ? "Logistic" : "Forest") : modelName(r.model));
    S("line", { x1: x(r.participant_split), x2: x(r.random_split), y1: cy, y2: cy, style: "stroke:var(--axis);stroke-width:4;stroke-linecap:round" }, s);
    S("circle", { cx: x(r.participant_split), cy, r: 7, style: "fill:var(--ink);stroke:var(--surface);stroke-width:2" }, s);
    S("circle", { cx: x(r.random_split), cy, r: 6, style: "fill:var(--surface);stroke:var(--ink);stroke-width:2" }, s);
    S("text", { x: Math.max(x(r.random_split), x(r.participant_split)) + 12, y: cy + 4, class: "val" }, s, signed(r.inflation));
    const hit = S("rect", { x: 0, y: cy - rowH / 2, width: W, height: rowH, class: "hit" }, s);
    hover(hit, `<b>${esc(modelName(r.model))}</b><br>split by person ${f3(r.participant_split)} ± ${f3(r.participant_std)}<br>random split ${f3(r.random_split)} ± ${f3(r.random_std)}<br>inflation ${signed(r.inflation)}`);
  });
  const F = rows.find((r) => r.model === "forest"), Lg = rows.find((r) => r.model === "logistic");
  if (F && Lg) $("#leak-note").textContent = `A random split makes the forest look ${f3(F.inflation)} better than it really is on new people, but changes logistic regression by only ${f3(Lg.inflation)}. A forest is flexible enough to learn person-specific patterns; a linear model with 16 coefficients is not. This is why every number on this page comes from splitting by person.`;
}

// ---------- learning curve ----------
function renderLC() {
  const box = $("#chart-lc"), W = Math.max(280, box.clientWidth), H = 260, L = 44, Rm = 16, top = 16, bot = 40;
  const lc = D.learning_curve, ns = [...new Set(lc.map((r) => r.people))].sort((a, b) => a - b);
  const agg = ns.map((n) => { const v = lc.filter((r) => r.people === n).map((r) => r.val_macro_f1); return { n, mean: v.reduce((a, b) => a + b, 0) / v.length, v }; });
  const all = lc.map((r) => r.val_macro_f1);
  const y0 = Math.floor(Math.min(...all) * 20) / 20, y1 = Math.ceil(Math.max(...all) * 20) / 20;
  const x = scale(0, Math.max(...ns) * 1.05, L + 4, W - Rm), y = scale(y0, y1, H - bot, top);
  const s = svgIn(box, W, H, "Validation macro-F1 against number of training people");
  for (const t of niceTicks(y0, y1, 4)) {
    S("line", { x1: L, x2: W - Rm, y1: y(t), y2: y(t), class: "gridline" }, s);
    S("text", { x: L - 6, y: y(t) + 4, "text-anchor": "end", class: "tick-label" }, s, t.toFixed(2));
  }
  for (const n of ns) S("text", { x: x(n), y: H - bot + 18, "text-anchor": "middle", class: "tick-label" }, s, n);
  S("text", { x: (L + W) / 2, y: H - 4, "text-anchor": "middle", class: "tick-label" }, s, "training participants");
  S("line", { x1: L, x2: W - Rm, y1: H - bot, y2: H - bot, class: "axis" }, s);
  for (const a of agg) for (const v of a.v) S("circle", { cx: x(a.n), cy: y(v), r: 3, style: "fill:var(--muted);opacity:.6" }, s);
  S("path", { d: agg.map((a, i) => `${i ? "L" : "M"}${x(a.n)},${y(a.mean)}`).join(""), style: "fill:none;stroke:var(--m-forest);stroke-width:2;stroke-linejoin:round" }, s);
  for (const a of agg) {
    S("circle", { cx: x(a.n), cy: y(a.mean), r: 5, style: "fill:var(--m-forest);stroke:var(--surface);stroke-width:2" }, s);
    const hit = S("rect", { x: x(a.n) - 18, y: top, width: 36, height: H - bot - top, class: "hit" }, s);
    hover(hit, `<b>${a.n} training people</b><br>mean validation macro-F1 ${f3(a.mean)}<br>${a.v.length} draw${a.v.length > 1 ? "s" : ""}: ${a.v.map(f3).join(", ")}`);
  }
  const last = agg[agg.length - 1], prev = agg[agg.length - 2];
  S("text", { x: x(last.n), y: y(last.mean) - 12, "text-anchor": "end", class: "val" }, s, f3(last.mean));
  box.insertAdjacentHTML("beforeend", `<p class="note" style="margin:8px 0 0">The forest's line rises steeply up to about 20 people and is flat from ${prev.n} (${f3(prev.mean)}) to ${last.n} (${f3(last.mean)}). More people of the same kind would add little; the 16 summary features and label noise are the bigger limit. Grey dots are individual random draws.</p>`);
}
function renderSens() {
  const s = D.results.sensitivity; if (!s) return;
  const n = (s.gap_participants || []).length;
  $("#sens").innerHTML = `<p style="margin:0 0 8px">${n} participants have more than 1% fewer samples than their recording time implies. Does leaving them out change anything?</p>
    <table><tbody><tr><td>Forest trained on everyone</td><td><b>${f3(s.forest_all_participants)}</b></td></tr><tr><td>Forest trained without them</td><td><b>${f3(s.forest_without_gap_participants)}</b></td></tr></tbody></table>
    <p class="note" style="margin:8px 0 0">Both scored on the same test people (without the gap participants). The difference is ${Math.abs(s.forest_without_gap_participants - s.forest_all_participants).toFixed(4)}, so the recording gaps do not affect the conclusions.</p>`;
}
function renderMethodBits() {
  const bp = D.results.best_params || {};
  const parts = [];
  if (bp.logistic) parts.push(`logistic C = ${bp.logistic.logisticregression__C}`);
  if (bp.tree) parts.push(`tree depth ${bp.tree.max_depth}, minimum leaf ${pct(bp.tree.min_samples_leaf, 1)} of rows`);
  if (bp.forest) parts.push(`forest max_features = ${bp.forest.max_features}, minimum leaf ${pct(bp.forest.min_samples_leaf, 2)} of rows`);
  $("#best-params").innerHTML = parts.length ? `<b>Chosen settings:</b> ${esc(parts.join("; "))}.` : "";
  const L = [];
  if (LINKS.modelling) L.push(`<a href="${esc(LINKS.modelling)}">Modelling notebook (Kaggle)</a>`);
  if (LINKS.preprocessing) L.push(`<a href="${esc(LINKS.preprocessing)}">Preprocessing notebook (Kaggle)</a>`);
  if (LINKS.repo) L.push(`<a href="${esc(LINKS.repo)}">Website source (GitHub)</a>`);
  $("#links").innerHTML = L.length ? `<b>Code:</b> ${L.join(" · ")}. Run the preprocessing notebook, then the modelling notebook (seed 42).` : "";
}
function renderGallery() {
  const figs = [["data_overview.png", "Class counts and moderate-vigorous share per person"], ["features_by_class.png", "Movement variability by class, and feature correlations (training people)"],
    ["confusion_matrices.png", "Confusion matrices on the test people"], ["feature_budget.png", "Feature budget curves"], ["per_person.png", "Spread over the 50 test people"], ["learning_curve.png", "Learning curve"]];
  const g = $("#gallery"); g.innerHTML = "";
  for (const [f, cap] of figs) {
    const fig = el("figure", {}, g, `<a href="data/figures/${f}" target="_blank" rel="noopener"><img src="data/figures/${f}" alt="${esc(cap)}"></a><figcaption>${esc(cap)} <span class="muted">(click to enlarge)</span></figcaption>`);
    const img = fig.querySelector("img");
    img.addEventListener("load", () => { $("#figures-sec").hidden = false; });
    img.addEventListener("error", () => fig.remove());
  }
}

// ---------- boot ----------
function renderAll() {
  renderTiles(); renderClassLegend(); renderModels(); renderDiffText(); renderCmSection();
  renderBudget(); renderCompactTable(); renderPeople(); renderPersonDetail(); renderGroups();
  renderLeak(); renderLC(); renderSens();
}
async function main() {
  $("#team").textContent = TEAM; $("#team-foot").textContent = TEAM;
  try {
    const got = window.SITE_DATA ? FILES.map((f) => window.SITE_DATA[f]) : await Promise.all(FILES.map((f) => fetch(`data/${f}.json`).then((r) => { if (!r.ok) throw new Error(`data/${f}.json (${r.status})`); return r.json(); })));
    FILES.forEach((f, i) => (D[f] = got[i]));
  } catch (e) {
    const n = $("#load-error"); n.hidden = false;
    n.innerHTML = `<b>Could not load the results.</b> Missing: <code>${esc(e.message)}</code>. Copy the JSON files from the notebook's <code>results.zip</code> into the <code>data/</code> folder. If you opened this file directly from disk, serve it instead (for example <code>python3 -m http.server</code>), because browsers block loading data from <code>file://</code> pages.`;
    return;
  }
  state.k = D.budget.k_compact;
  seg($("#bud-model"), [["forest", "Random forest"], ["tree", "Decision tree"]], state.budModel, (m) => { state.budModel = m; renderBudget(); });
  $("#k").addEventListener("input", (e) => { state.k = +e.target.value; renderBudget(); });
  $("#k-compact").addEventListener("click", () => { state.k = D.budget.k_compact; renderBudget(); });
  initPeopleControls(); renderMethodBits(); renderGallery();
  renderAll();
  let lastW = innerWidth, t;
  addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => { if (innerWidth !== lastW) { lastW = innerWidth; renderAll(); } }, 120); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderAll);
}
main();
