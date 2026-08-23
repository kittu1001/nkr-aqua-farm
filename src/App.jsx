import React, { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line
} from "recharts";
import {
  Droplets, Fish, Wheat, Wallet, TrendingUp, Plus, ChevronLeft,
  AlertTriangle, Waves, Sprout, History, LayoutGrid
} from "lucide-react";

/* ---------------------------------------------------------------
   Design tokens
   Palette drawn from a brackish grow-out pond at last light:
   deep teal water, sun-baked pond-bank clay, feed-pellet gold.
------------------------------------------------------------------*/
const INK = "#0E211F";        // deep pond teal-black (bg)
const INK_2 = "#152E2B";      // panel surface
const INK_3 = "#1D3B37";      // raised surface / hover
const LINE = "#2A4D48";       // hairline
const PAPER = "#F3EEE1";      // pond-bank sand (primary text)
const PAPER_DIM = "#B9C9C4";  // secondary text
const GOLD = "#D9A441";       // feed pellet gold (primary accent)
const CORAL = "#E2725B";      // alert / deficit
const TEAL_BRIGHT = "#5FBFAE";// good / growth

const SITES = [
  { name: "Site A", tanks: ["A1", "A2", "A3", "A4", "A5"] },
  { name: "Site B", tanks: ["B1", "B2", "B3", "B4"] },
  { name: "Outlying", tanks: ["KR8", "KL10", "KL16", "YB3", "YB4"] },
];
const ALL_TANKS = SITES.flatMap((s) => s.tanks);

const TABS = [
  { key: "stocking", label: "Seed Stocking", icon: Sprout },
  { key: "feed", label: "Feed & FCR", icon: Wheat },
  { key: "water", label: "Water Quality", icon: Droplets },
  { key: "growth", label: "Growth", icon: TrendingUp },
  { key: "harvest", label: "Harvest & Sales", icon: Fish },
  { key: "expenses", label: "Expenses", icon: Wallet },
];

const EMPTY_TANK = { stocking: [], feed: [], water: [], growth: [], harvest: [], expenses: [] };

const uid = () => Math.random().toString(36).slice(2, 9);
const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

/* ---------------------------------------------------------------
   Storage helpers
------------------------------------------------------------------*/
async function loadTank(tankId) {
  try {
    const res = await window.storage.get(`tank:${tankId}`);
    if (res && res.value) return { ...EMPTY_TANK, ...JSON.parse(res.value) };
  } catch (e) { /* not found yet */ }
  return { ...EMPTY_TANK };
}
async function saveTank(tankId, data) {
  try {
    await window.storage.set(`tank:${tankId}`, JSON.stringify(data));
  } catch (e) {
    console.error("save failed", e);
  }
}

/* ---------------------------------------------------------------
   Small UI atoms
------------------------------------------------------------------*/
function Panel({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border ${className}`}
      style={{ background: INK_2, borderColor: LINE }}
    >
      {children}
    </div>
  );
}

function StatTile({ label, value, sub, tone = PAPER }) {
  return (
    <div className="rounded-xl p-3 flex-1 min-w-[120px]" style={{ background: INK_3, border: `1px solid ${LINE}` }}>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: PAPER_DIM }}>{label}</div>
      <div className="text-xl font-semibold mt-1" style={{ color: tone, fontFamily: "'Space Grotesk', sans-serif" }}>{value}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: PAPER_DIM }}>{sub}</div>}
    </div>
  );
}

function IconBtn({ onClick, children, active }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 rounded-lg text-xs font-medium transition-colors"
      style={{
        background: active ? GOLD : "transparent",
        color: active ? INK : PAPER_DIM,
        border: `1px solid ${active ? GOLD : LINE}`,
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: PAPER_DIM }}>
      {label}
      {children}
    </label>
  );
}
const inputStyle = {
  background: INK,
  border: `1px solid ${LINE}`,
  color: PAPER,
};

/* ---------------------------------------------------------------
   Entry form (generic, fields config per tab)
------------------------------------------------------------------*/
function EntryForm({ fields, onSubmit, submitLabel }) {
  const initial = Object.fromEntries(fields.map((f) => [f.key, f.key === "date" ? new Date().toISOString().slice(0, 10) : ""]));
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <div className="grid grid-cols-2 gap-2 p-3 rounded-xl" style={{ background: INK, border: `1px solid ${LINE}` }}>
      {fields.map((f) => (
        <Field label={f.label} key={f.key}>
          <input
            type={f.type || "text"}
            step={f.step}
            value={form[f.key]}
            onChange={(e) => set(f.key, e.target.value)}
            className="rounded-md px-2 py-1.5 text-sm outline-none"
            style={inputStyle}
            placeholder={f.placeholder}
          />
        </Field>
      ))}
      <button
        onClick={() => {
          const missing = fields.some((f) => f.required !== false && !form[f.key]);
          if (missing) return;
          onSubmit(form);
          setForm(initial);
        }}
        className="col-span-2 mt-1 rounded-md py-2 text-sm font-semibold flex items-center justify-center gap-1"
        style={{ background: GOLD, color: INK }}
      >
        <Plus size={15} /> {submitLabel}
      </button>
    </div>
  );
}

function EntryList({ rows, render, empty }) {
  if (!rows.length) return <div className="text-xs py-4 text-center" style={{ color: PAPER_DIM }}>{empty}</div>;
  return (
    <div className="flex flex-col gap-1.5 mt-2 max-h-64 overflow-y-auto pr-1">
      {[...rows].reverse().map((r) => (
        <div key={r.id} className="flex items-center justify-between text-xs rounded-lg px-3 py-2" style={{ background: INK, border: `1px solid ${LINE}` }}>
          {render(r)}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   Water quality range check
------------------------------------------------------------------*/
const WQ_RANGES = {
  pH: [7.5, 8.5],
  DO: [4, 12],
  ammonia: [0, 0.1],
  nitrite: [0, 0.25],
};
function wqFlag(key, val) {
  const r = WQ_RANGES[key];
  if (!r || val === "" || val === undefined) return null;
  const v = Number(val);
  return v >= r[0] && v <= r[1];
}

/* ---------------------------------------------------------------
   Crop cycles — derived from stocking entries.
   Each stocking event opens a new crop; everything dated between
   that stocking and the next one (per tank) belongs to that crop.
------------------------------------------------------------------*/
function buildCycles(tankId, tank) {
  const stocking = [...tank.stocking].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (stocking.length === 0) return [];

  const cycles = stocking.map((s, i) => ({
    tankId,
    cropNo: i + 1,
    start: s.date,
    end: stocking[i + 1] ? stocking[i + 1].date : null,
    plCount: s.plCount,
    stage: s.stage,
    source: s.source,
    stockingCost: s.cost || 0,
    areaCents: s.areaCents || "",
    feed: [], water: [], growth: [], harvest: [], expenses: [],
  }));

  const inCycle = (date, c) => {
    const d = new Date(date);
    return d >= new Date(c.start) && (c.end === null || d < new Date(c.end));
  };
  const bucket = (key) => {
    tank[key].forEach((row) => {
      const c = cycles.find((c) => inCycle(row.date, c)) || cycles[cycles.length - 1];
      c[key].push(row);
    });
  };
  ["feed", "water", "growth", "harvest", "expenses"].forEach(bucket);

  return cycles.map((c) => {
    const totalFeed = c.feed.reduce((s, r) => s + r.feedKg, 0);
    const harvestKg = c.harvest.reduce((s, r) => s + Number(r.kg || 0), 0);
    const revenue = c.harvest.reduce((s, r) => s + r.kg * r.pricePerKg, 0);
    const otherExpenses = c.expenses.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = otherExpenses + c.stockingCost;
    const fcr = harvestKg > 0 ? totalFeed / harvestKg : null;
    const latestABW = c.growth[c.growth.length - 1]?.abw || null;
    const estCount = latestABW && harvestKg ? (harvestKg * 1000) / latestABW : null;
    const survivalPct = estCount && c.plCount ? Math.min(100, (estCount / c.plCount) * 100) : null;
    const doc = Math.round((new Date(c.end || Date.now()) - new Date(c.start)) / 86400000);
    return { ...c, totalFeed, harvestKg, revenue, totalExpenses, netPL: revenue - totalExpenses, fcr, latestABW, survivalPct, doc, ongoing: c.end === null };
  });
}

/* ---------------------------------------------------------------
   Tab bodies
------------------------------------------------------------------*/
function StockingTab({ tank, update }) {
  const add = (form) => {
    const row = {
      id: uid(), date: form.date,
      plCount: Number(form.plCount),
      stage: form.stage || "",
      source: form.source || "",
      areaCents: form.areaCents ? Number(form.areaCents) : "",
      cost: form.cost ? Number(form.cost) : 0,
    };
    update({ ...tank, stocking: [...tank.stocking, row] });
  };

  const totalPL = tank.stocking.reduce((s, r) => s + r.plCount, 0);
  const totalCost = tank.stocking.reduce((s, r) => s + (r.cost || 0), 0);
  const totalArea = tank.stocking.reduce((s, r) => s + (Number(r.areaCents) || 0), 0);
  const density = totalArea > 0 ? (totalPL / totalArea).toFixed(0) : null;

  // rough survival estimate: (harvested kg *1000 / latest ABW g) vs total PL stocked
  const latestABW = tank.growth[tank.growth.length - 1]?.abw;
  const totalHarvestKg = tank.harvest.reduce((s, r) => s + Number(r.kg || 0), 0);
  const estCount = latestABW && totalHarvestKg ? (totalHarvestKg * 1000) / latestABW : null;
  const survivalPct = estCount && totalPL ? Math.min(100, (estCount / totalPL) * 100).toFixed(0) : null;

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        <StatTile label="Total PL stocked" value={totalPL ? totalPL.toLocaleString("en-IN") : "—"} tone={TEAL_BRIGHT} />
        <StatTile label="Stocking cost" value={inr(totalCost)} />
        {density && <StatTile label="Density" value={`${density} /cent`} />}
        {survivalPct && <StatTile label="Est. survival" value={`${survivalPct}%`} tone={survivalPct >= 60 ? TEAL_BRIGHT : CORAL} sub="vs harvest & ABW" />}
      </div>
      <EntryForm
        submitLabel="Log stocking"
        fields={[
          { key: "date", label: "Date", type: "date" },
          { key: "plCount", label: "PL count", type: "number", step: "1" },
          { key: "stage", label: "PL stage", placeholder: "PL12 etc.", required: false },
          { key: "source", label: "Hatchery / source", required: false },
          { key: "areaCents", label: "Tank area (cents)", type: "number", step: "0.1", required: false },
          { key: "cost", label: "Cost (₹)", type: "number", step: "1", required: false },
        ]}
        onSubmit={add}
      />
      <EntryList
        rows={tank.stocking}
        empty="No stocking records yet."
        render={(r) => (
          <>
            <span style={{ color: PAPER_DIM }}>{fmtDate(r.date)}</span>
            <span style={{ color: PAPER }}>{r.plCount.toLocaleString("en-IN")} PL{r.stage ? ` · ${r.stage}` : ""}</span>
            <span style={{ color: PAPER_DIM }} className="truncate max-w-[90px]">{r.source}</span>
          </>
        )}
      />
    </div>
  );
}

function FeedTab({ tank, update }) {
  const add = (form) => {
    const row = { id: uid(), date: form.date, feedKg: Number(form.feedKg), note: form.note || "" };
    update({ ...tank, feed: [...tank.feed, row] });
  };
  const totalFeed = tank.feed.reduce((s, r) => s + r.feedKg, 0);
  const totalHarvestKg = tank.harvest.reduce((s, r) => s + Number(r.kg || 0), 0);
  const fcr = totalHarvestKg > 0 ? (totalFeed / totalHarvestKg).toFixed(2) : "—";

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <StatTile label="Total feed" value={`${totalFeed.toFixed(0)} kg`} />
        <StatTile label="FCR" value={fcr} sub="feed ÷ harvest kg" tone={GOLD} />
        <StatTile label="Entries" value={tank.feed.length} />
      </div>
      <EntryForm
        submitLabel="Log feed"
        fields={[
          { key: "date", label: "Date", type: "date" },
          { key: "feedKg", label: "Feed (kg)", type: "number", step: "0.1" },
          { key: "note", label: "Note", required: false, placeholder: "feed type etc." },
        ]}
        onSubmit={add}
      />
      <EntryList
        rows={tank.feed}
        empty="No feed entries yet."
        render={(r) => (
          <>
            <span style={{ color: PAPER_DIM }}>{fmtDate(r.date)}</span>
            <span style={{ color: PAPER }}>{r.feedKg} kg</span>
            <span style={{ color: PAPER_DIM }} className="truncate max-w-[90px]">{r.note}</span>
          </>
        )}
      />
    </div>
  );
}

function WaterTab({ tank, update }) {
  const add = (form) => {
    const row = {
      id: uid(), date: form.date,
      pH: form.pH, DO: form.DO, ammonia: form.ammonia, nitrite: form.nitrite, temp: form.temp,
    };
    update({ ...tank, water: [...tank.water, row] });
  };
  const latest = tank.water[tank.water.length - 1];

  return (
    <div>
      {latest && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {["pH", "DO", "ammonia", "nitrite"].map((k) => {
            const flag = wqFlag(k, latest[k]);
            return (
              <StatTile
                key={k}
                label={k === "DO" ? "DO (mg/L)" : k}
                value={latest[k] || "—"}
                tone={flag === false ? CORAL : flag === true ? TEAL_BRIGHT : PAPER}
                sub={flag === false ? "out of range" : flag === true ? "ok" : ""}
              />
            );
          })}
        </div>
      )}
      <EntryForm
        submitLabel="Log reading"
        fields={[
          { key: "date", label: "Date", type: "date" },
          { key: "pH", label: "pH", type: "number", step: "0.1" },
          { key: "DO", label: "DO mg/L", type: "number", step: "0.1" },
          { key: "ammonia", label: "Ammonia", type: "number", step: "0.01" },
          { key: "nitrite", label: "Nitrite", type: "number", step: "0.01" },
          { key: "temp", label: "Temp °C", type: "number", step: "0.1", required: false },
        ]}
        onSubmit={add}
      />
      <EntryList
        rows={tank.water}
        empty="No water quality readings yet."
        render={(r) => (
          <>
            <span style={{ color: PAPER_DIM }}>{fmtDate(r.date)}</span>
            <span style={{ color: PAPER }}>pH {r.pH} · DO {r.DO} · NH₃ {r.ammonia} · NO₂ {r.nitrite}</span>
          </>
        )}
      />
    </div>
  );
}

function GrowthTab({ tank, update }) {
  const add = (form) => {
    const row = { id: uid(), date: form.date, abw: Number(form.abw) };
    update({ ...tank, growth: [...tank.growth, row] });
  };
  const chartData = tank.growth
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((r) => ({ date: fmtDate(r.date), ABW: r.abw }));
  const latest = tank.growth[tank.growth.length - 1];

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <StatTile label="Latest ABW" value={latest ? `${latest.abw} g` : "—"} tone={TEAL_BRIGHT} />
        <StatTile label="Samples" value={tank.growth.length} />
      </div>
      {chartData.length > 1 && (
        <div className="h-40 mb-3 rounded-xl p-2" style={{ background: INK, border: `1px solid ${LINE}` }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={LINE} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: PAPER_DIM, fontSize: 10 }} />
              <YAxis tick={{ fill: PAPER_DIM, fontSize: 10 }} />
              <Tooltip contentStyle={{ background: INK_2, border: `1px solid ${LINE}`, fontSize: 12 }} />
              <Line type="monotone" dataKey="ABW" stroke={TEAL_BRIGHT} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <EntryForm
        submitLabel="Log ABW sample"
        fields={[
          { key: "date", label: "Date", type: "date" },
          { key: "abw", label: "ABW (grams)", type: "number", step: "0.1" },
        ]}
        onSubmit={add}
      />
      <EntryList
        rows={tank.growth}
        empty="No growth samples yet."
        render={(r) => (
          <>
            <span style={{ color: PAPER_DIM }}>{fmtDate(r.date)}</span>
            <span style={{ color: PAPER }}>{r.abw} g</span>
          </>
        )}
      />
    </div>
  );
}

function HarvestTab({ tank, update }) {
  const add = (form) => {
    const row = { id: uid(), date: form.date, kg: Number(form.kg), pricePerKg: Number(form.pricePerKg), buyer: form.buyer || "" };
    update({ ...tank, harvest: [...tank.harvest, row] });
  };
  const totalKg = tank.harvest.reduce((s, r) => s + r.kg, 0);
  const totalRevenue = tank.harvest.reduce((s, r) => s + r.kg * r.pricePerKg, 0);

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <StatTile label="Total harvested" value={`${totalKg.toFixed(0)} kg`} />
        <StatTile label="Revenue" value={inr(totalRevenue)} tone={GOLD} />
      </div>
      <EntryForm
        submitLabel="Log harvest"
        fields={[
          { key: "date", label: "Date", type: "date" },
          { key: "kg", label: "Weight (kg)", type: "number", step: "0.1" },
          { key: "pricePerKg", label: "Price / kg (₹)", type: "number", step: "1" },
          { key: "buyer", label: "Buyer", required: false },
        ]}
        onSubmit={add}
      />
      <EntryList
        rows={tank.harvest}
        empty="No harvest records yet."
        render={(r) => (
          <>
            <span style={{ color: PAPER_DIM }}>{fmtDate(r.date)}</span>
            <span style={{ color: PAPER }}>{r.kg} kg @ ₹{r.pricePerKg}</span>
            <span style={{ color: GOLD }}>{inr(r.kg * r.pricePerKg)}</span>
          </>
        )}
      />
    </div>
  );
}

function ExpensesTab({ tank, update }) {
  const add = (form) => {
    const row = { id: uid(), date: form.date, category: form.category, amount: Number(form.amount), note: form.note || "" };
    update({ ...tank, expenses: [...tank.expenses, row] });
  };
  const total = tank.expenses.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <StatTile label="Total expenses" value={inr(total)} tone={CORAL} />
        <StatTile label="Entries" value={tank.expenses.length} />
      </div>
      <EntryForm
        submitLabel="Log expense"
        fields={[
          { key: "date", label: "Date", type: "date" },
          { key: "category", label: "Category", placeholder: "feed / labor / power" },
          { key: "amount", label: "Amount (₹)", type: "number", step: "1" },
          { key: "note", label: "Note", required: false },
        ]}
        onSubmit={add}
      />
      <EntryList
        rows={tank.expenses}
        empty="No expenses logged yet."
        render={(r) => (
          <>
            <span style={{ color: PAPER_DIM }}>{fmtDate(r.date)}</span>
            <span style={{ color: PAPER }}>{r.category}</span>
            <span style={{ color: CORAL }}>{inr(r.amount)}</span>
          </>
        )}
      />
    </div>
  );
}

/* ---------------------------------------------------------------
   Tank detail screen
------------------------------------------------------------------*/
function TankDetail({ tankId, tank, update, onBack }) {
  const [tab, setTab] = useState("stocking");
  const Body = { stocking: StockingTab, feed: FeedTab, water: WaterTab, growth: GrowthTab, harvest: HarvestTab, expenses: ExpensesTab }[tab];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="p-1.5 rounded-full" style={{ background: INK_2, border: `1px solid ${LINE}` }}>
          <ChevronLeft size={16} color={PAPER} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: GOLD, color: INK }}>
            {tankId}
          </div>
          <span className="text-sm font-medium" style={{ color: PAPER }}>Tank {tankId}</span>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 -mx-1 px-1">
        {TABS.map((t) => (
          <IconBtn key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            <span className="flex items-center gap-1"><t.icon size={13} />{t.label}</span>
          </IconBtn>
        ))}
      </div>

      <Body tank={tank} update={update} />
    </div>
  );
}

/* ---------------------------------------------------------------
   Dashboard (all tanks)
------------------------------------------------------------------*/
function Dashboard({ tanks, onSelect, loading }) {
  const rows = ALL_TANKS.map((id) => {
    const t = tanks[id] || EMPTY_TANK;
    const feed = t.feed.reduce((s, r) => s + r.feedKg, 0);
    const harvestKg = t.harvest.reduce((s, r) => s + r.kg, 0);
    const revenue = t.harvest.reduce((s, r) => s + r.kg * r.pricePerKg, 0);
    const expenses = t.expenses.reduce((s, r) => s + r.amount, 0);
    const fcr = harvestKg > 0 ? feed / harvestKg : 0;
    const lastWater = t.water[t.water.length - 1];
    const alert = lastWater && ["pH", "DO", "ammonia", "nitrite"].some((k) => wqFlag(k, lastWater[k]) === false);
    const plStocked = t.stocking.reduce((s, r) => s + r.plCount, 0);
    return { id, feed, harvestKg, revenue, expenses, fcr, alert, plStocked };
  });

  const totals = rows.reduce(
    (a, r) => ({ feed: a.feed + r.feed, harvestKg: a.harvestKg + r.harvestKg, revenue: a.revenue + r.revenue, expenses: a.expenses + r.expenses, plStocked: a.plStocked + r.plStocked }),
    { feed: 0, harvestKg: 0, revenue: 0, expenses: 0, plStocked: 0 }
  );
  const netPL = totals.revenue - totals.expenses;

  const chartData = rows.filter((r) => r.fcr > 0).map((r) => ({ tank: r.id, FCR: Number(r.fcr.toFixed(2)) }));

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        <StatTile label="PL stocked" value={totals.plStocked ? totals.plStocked.toLocaleString("en-IN") : "—"} tone={TEAL_BRIGHT} />
        <StatTile label="Total feed" value={`${totals.feed.toFixed(0)} kg`} />
        <StatTile label="Harvested" value={`${totals.harvestKg.toFixed(0)} kg`} />
        <StatTile label="Revenue" value={inr(totals.revenue)} tone={GOLD} />
        <StatTile label="Net P&L" value={inr(netPL)} tone={netPL >= 0 ? TEAL_BRIGHT : CORAL} />
      </div>

      {chartData.length > 0 && (
        <Panel className="p-3 mb-4">
          <div className="text-xs mb-2 font-medium" style={{ color: PAPER_DIM }}>FCR by tank</div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={LINE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="tank" tick={{ fill: PAPER_DIM, fontSize: 10 }} />
                <YAxis tick={{ fill: PAPER_DIM, fontSize: 10 }} />
                <Tooltip contentStyle={{ background: INK_2, border: `1px solid ${LINE}`, fontSize: 12 }} />
                <Bar dataKey="FCR" fill={GOLD} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {SITES.map((site) => (
        <div key={site.name} className="mb-4">
          <div className="text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: PAPER_DIM }}>
            <Waves size={12} /> {site.name}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {site.tanks.map((id) => {
              const r = rows.find((x) => x.id === id);
              return (
                <button
                  key={id}
                  onClick={() => onSelect(id)}
                  className="rounded-xl p-2.5 text-left relative"
                  style={{ background: INK_2, border: `1px solid ${LINE}` }}
                >
                  {r.alert && (
                    <AlertTriangle size={13} color={CORAL} className="absolute top-2 right-2" />
                  )}
                  <div className="text-sm font-semibold" style={{ color: PAPER, fontFamily: "'Space Grotesk', sans-serif" }}>{id}</div>
                  <div className="text-[10px] mt-1" style={{ color: PAPER_DIM }}>
                    {r.fcr > 0
                      ? `FCR ${r.fcr.toFixed(2)}`
                      : r.plStocked
                      ? `${r.plStocked.toLocaleString("en-IN")} PL`
                      : loading
                      ? "…"
                      : "no data"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   Crop History — all ponds, grouped by crop cycle
------------------------------------------------------------------*/
function CropHistoryCard({ c, onOpen }) {
  return (
    <button
      onClick={() => onOpen(c.tankId)}
      className="w-full text-left rounded-xl p-3 relative"
      style={{ background: INK_2, border: `1px solid ${LINE}` }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs" style={{ background: GOLD, color: INK }}>
            {c.tankId}
          </div>
          <span className="text-sm font-medium" style={{ color: PAPER }}>Crop #{c.cropNo}</span>
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{
            background: c.ongoing ? "rgba(95,191,174,0.15)" : "rgba(185,201,196,0.12)",
            color: c.ongoing ? TEAL_BRIGHT : PAPER_DIM,
          }}
        >
          {c.ongoing ? `Ongoing · DOC ${c.doc}` : `Closed · ${c.doc}d`}
        </span>
      </div>
      <div className="text-[11px] mb-2" style={{ color: PAPER_DIM }}>
        {fmtDate(c.start)} {c.end ? `→ ${fmtDate(c.end)}` : "→ present"}
        {c.source ? ` · ${c.source}` : ""}{c.stage ? ` · ${c.stage}` : ""}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <MiniStat label="PL" value={c.plCount.toLocaleString("en-IN")} />
        <MiniStat label="FCR" value={c.fcr ? c.fcr.toFixed(2) : "—"} tone={GOLD} />
        <MiniStat label="Harvest" value={c.harvestKg ? `${c.harvestKg.toFixed(0)}kg` : "—"} />
        <MiniStat label="P&L" value={c.harvestKg || c.totalExpenses ? inr(c.netPL) : "—"} tone={c.netPL >= 0 ? TEAL_BRIGHT : CORAL} />
      </div>
      {c.survivalPct !== null && (
        <div className="text-[10px] mt-1.5" style={{ color: PAPER_DIM }}>
          Est. survival <span style={{ color: c.survivalPct >= 60 ? TEAL_BRIGHT : CORAL }}>{c.survivalPct.toFixed(0)}%</span>
        </div>
      )}
    </button>
  );
}

function MiniStat({ label, value, tone = PAPER }) {
  return (
    <div className="rounded-md py-1.5 px-1 text-center" style={{ background: INK }}>
      <div className="text-[9px] uppercase" style={{ color: PAPER_DIM }}>{label}</div>
      <div className="text-[11px] font-semibold" style={{ color: tone, fontFamily: "'Space Grotesk', sans-serif" }}>{value}</div>
    </div>
  );
}

function CropHistory({ tanks, onOpenTank }) {
  const allCycles = ALL_TANKS.flatMap((id) => buildCycles(id, tanks[id] || EMPTY_TANK));
  const sorted = allCycles.sort((a, b) => new Date(b.start) - new Date(a.start));

  if (sorted.length === 0) {
    return (
      <div className="text-xs py-10 text-center" style={{ color: PAPER_DIM }}>
        No crop cycles yet — log a Seed Stocking entry on any tank to start one.
      </div>
    );
  }

  const ongoing = sorted.filter((c) => c.ongoing);
  const closed = sorted.filter((c) => !c.ongoing);

  return (
    <div>
      {ongoing.length > 0 && (
        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: TEAL_BRIGHT }}>Ongoing crops</div>
          <div className="flex flex-col gap-2">
            {ongoing.map((c) => <CropHistoryCard key={`${c.tankId}-${c.cropNo}`} c={c} onOpen={onOpenTank} />)}
          </div>
        </div>
      )}
      {closed.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: PAPER_DIM }}>Past crops</div>
          <div className="flex flex-col gap-2">
            {closed.map((c) => <CropHistoryCard key={`${c.tankId}-${c.cropNo}`} c={c} onOpen={onOpenTank} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Root app
------------------------------------------------------------------*/
export default function NKRAquaFarm() {
  const [tanks, setTanks] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("dashboard"); // dashboard | history

  useEffect(() => {
    (async () => {
      const entries = await Promise.all(ALL_TANKS.map(async (id) => [id, await loadTank(id)]));
      setTanks(Object.fromEntries(entries));
      setLoading(false);
    })();
  }, []);

  const updateTank = useCallback((id, data) => {
    setTanks((s) => ({ ...s, [id]: data }));
    saveTank(id, data);
  }, []);

  return (
    <div
      className="w-full min-h-[600px] rounded-3xl p-4"
      style={{ background: INK, fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap');
        ::-webkit-scrollbar { height: 4px; width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${LINE}; border-radius: 4px; }
      `}</style>

      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-lg font-bold flex items-center gap-1.5" style={{ color: PAPER, fontFamily: "'Space Grotesk', sans-serif" }}>
            <Fish size={18} color={GOLD} /> NKR Aqua Farm
          </div>
          <div className="text-[11px]" style={{ color: PAPER_DIM }}>14 tanks · Bhimavaram</div>
        </div>
        {!selected && (
          <div className="flex gap-1.5">
            <IconBtn active={view === "dashboard"} onClick={() => setView("dashboard")}>
              <span className="flex items-center gap-1"><LayoutGrid size={13} />Ponds</span>
            </IconBtn>
            <IconBtn active={view === "history"} onClick={() => setView("history")}>
              <span className="flex items-center gap-1"><History size={13} />Crop history</span>
            </IconBtn>
          </div>
        )}
      </div>

      {selected ? (
        <TankDetail
          tankId={selected}
          tank={tanks[selected] || EMPTY_TANK}
          update={(data) => updateTank(selected, data)}
          onBack={() => setSelected(null)}
        />
      ) : view === "history" ? (
        <CropHistory tanks={tanks} onOpenTank={setSelected} />
      ) : (
        <Dashboard tanks={tanks} onSelect={setSelected} loading={loading} />
      )}
    </div>
  );
}
