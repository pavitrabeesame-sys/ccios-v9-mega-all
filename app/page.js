"use client";
import { useEffect, useMemo, useState } from "react";

// Same-origin API routes now live inside this app under app/api/*.
const BE = "/api";

const TABS = [
  { id: "orders", label: "Orders" },
  { id: "oos", label: "OOS" },
  { id: "customers", label: "Customers" },
  { id: "products", label: "Products" },
  { id: "reviews", label: "Reviews" },
  { id: "analytics", label: "Analytics" },
  { id: "action", label: "Action Centre" },
  { id: "nova", label: "NOVA AI" },
];

const colors = {
  bg: "#08080a",
  panel: "#14181b",
  border: "#22282c",
  text: "#ffffff",
  muted: "#8a9198",
  accent: "#ff4d8d",
};

function Card({ title, children, right }) {
  return (
    <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", color: colors.muted, fontWeight: 700 }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function isArrayOfObjects(v) {
  return Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null;
}

function isPlainRecordOfArrays(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const arrField = Object.values(data).find((v) => Array.isArray(v));
    if (arrField) return arrField;
  }
  return data;
}

// Renders whatever shape of JSON the backend returns, without assuming fixed fields.
function SmartData({ data }) {
  const [showRaw, setShowRaw] = useState(false);

  if (data === undefined || data === null) {
    return <div style={{ color: colors.muted, fontSize: 13 }}>No data loaded yet.</div>;
  }

  const list = isPlainRecordOfArrays(data);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button onClick={() => setShowRaw((s) => !s)} style={ghostBtn}>
          {showRaw ? "Show table" : "Show raw JSON"}
        </button>
      </div>
      {showRaw ? (
        <pre style={{ background: "#0f1214", padding: 12, borderRadius: 10, color: "#4ade80", fontSize: 12, overflow: "auto", maxHeight: 500 }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : isArrayOfObjects(list) ? (
        <TableView rows={list} />
      ) : Array.isArray(list) ? (
        <ul style={{ margin: 0, paddingLeft: 18, color: colors.text, fontSize: 13 }}>
          {list.map((item, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{String(item)}</li>
          ))}
        </ul>
      ) : typeof data === "object" ? (
        <KeyValueView obj={data} />
      ) : (
        <div style={{ color: colors.text }}>{String(data)}</div>
      )}
    </div>
  );
}

function TableView({ rows }) {
  const cols = Array.from(
    rows.slice(0, 20).reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set())
  ).slice(0, 7);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} style={{ textAlign: "left", padding: "6px 8px", color: colors.muted, borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap" }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c} style={{ padding: "6px 8px", borderBottom: `1px solid ${colors.border}`, color: colors.text, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {typeof r[c] === "object" ? JSON.stringify(r[c]) : String(r[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 100 && (
        <div style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Showing first 100 of {rows.length} rows.</div>
      )}
    </div>
  );
}

function KeyValueView({ obj }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {Object.entries(obj).map(([k, v]) => (
        <div key={k} style={{ fontSize: 13 }}>
          <div style={{ color: colors.muted, fontSize: 11 }}>{k}</div>
          <div style={{ color: colors.text }}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</div>
        </div>
      ))}
    </div>
  );
}

const ghostBtn = {
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${colors.border}`,
  background: "transparent",
  color: colors.muted,
  fontSize: 12,
  cursor: "pointer",
};

const primaryBtn = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "none",
  background: colors.accent,
  color: "#160b10",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

// Scans whatever real data has already been loaded and surfaces actionable items.
// Falls back to an empty state instead of inventing numbers when nothing matches.
function deriveTasks(d) {
  const tasks = [];

  const oos = isPlainRecordOfArrays(d.oos);
  if (isArrayOfObjects(oos)) {
    tasks.push({ title: `Restock ${oos.length} out-of-stock SKU${oos.length === 1 ? "" : "s"}`, detail: "From OOS feed" });
  }

  const reviews = isPlainRecordOfArrays(d.reviews);
  if (isArrayOfObjects(reviews)) {
    const unreplied = reviews.filter((r) => {
      const val = r.reply ?? r.replied ?? r.response ?? r.status;
      return !val || /pending|no/i.test(String(val));
    });
    if (unreplied.length > 0) {
      tasks.push({ title: `Reply to ${unreplied.length} review${unreplied.length === 1 ? "" : "s"}`, detail: "No reply on file yet" });
    }
  }

  const orders = isPlainRecordOfArrays(d.orders);
  if (isArrayOfObjects(orders)) {
    const failed = orders.filter((o) => /fail|error|cancel/i.test(String(o.status ?? "")));
    if (failed.length > 0) {
      tasks.push({ title: `Investigate ${failed.length} failed/cancelled order${failed.length === 1 ? "" : "s"}`, detail: "Flagged by status field" });
    }
  }

  return tasks;
}

export default function Home() {
  const [data, setData] = useState({});
  const [tab, setTab] = useState("orders");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [novaInput, setNovaInput] = useState("");
  const [novaMessages, setNovaMessages] = useState([]);
  const [novaBusy, setNovaBusy] = useState(false);

  useEffect(() => {
    load("orders");
  }, []);

  const load = async (t) => {
    setTab(t);
    if (t === "action" || t === "nova") return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(BE + "/" + t);
      if (!r.ok) throw new Error(`Backend returned ${r.status} for /${t}`);
      const j = await r.json();
      setData((s) => ({ ...s, [t]: j }));
    } catch (e) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const tasks = useMemo(() => deriveTasks(data), [data]);

  const sendNova = async () => {
    if (!novaInput.trim()) return;
    const userMsg = novaInput.trim();
    setNovaMessages((m) => [...m, { role: "user", text: userMsg }]);
    setNovaInput("");
    setNovaBusy(true);
    try {
      const r = await fetch(BE + "/nova", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const j = await r.json();
      setNovaMessages((m) => [...m, { role: "nova", text: j.reply || JSON.stringify(j) }]);
    } catch (e) {
      setNovaMessages((m) => [
        ...m,
        {
          role: "nova",
          text: `NOVA isn't connected yet (${e.message}). Add a POST /nova endpoint on your backend that accepts {message} and returns {reply} to wire this up.`,
        },
      ]);
    } finally {
      setNovaBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text, padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontWeight: 900, marginBottom: 4 }}>
        CCIOS V9 <span style={{ color: colors.accent }}>Dashboard</span>
      </h1>
      <div style={{ color: colors.muted, fontSize: 13, marginBottom: 16 }}>{BE}</div>

      <div style={{ display: "flex", gap: 8, margin: "12px 0 20px", flexWrap: "wrap" }}>
        {TABS.map((x) => (
          <button
            key={x.id}
            onClick={() => load(x.id)}
            style={{
              padding: "8px 14px",
              borderRadius: 20,
              border: `1px solid ${colors.border}`,
              background: tab === x.id ? "#fff" : "#1a1a1e",
              color: tab === x.id ? "#000" : "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab !== "action" && tab !== "nova" && (
        <Card
          title={tab.toUpperCase()}
          right={
            <button onClick={() => load(tab)} style={ghostBtn} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          }
        >
          {error && <div style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          {data[tab]?._note && (
            <div style={{ background: "#2a2416", border: "1px solid #4a3f1e", color: "#e0c477", fontSize: 12, padding: "8px 10px", borderRadius: 8, marginBottom: 10 }}>
              ⚠ {data[tab]._note}
            </div>
          )}
          <SmartData data={data[tab]} />
        </Card>
      )}

      {tab === "action" && (
        <Card title="ACTION CENTRE">
          {tasks.length === 0 ? (
            <div style={{ color: colors.muted, fontSize: 13 }}>
              Nothing flagged yet — visit the Orders, OOS, and Reviews tabs first so there's data to check, or this stays empty until your backend
              returns fields like <code>status</code>, <code>reply</code>, or an OOS list.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tasks.map((t, i) => (
                <div key={i} style={{ padding: 12, border: `1px solid ${colors.border}`, borderRadius: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.title}</div>
                  <div style={{ color: colors.muted, fontSize: 12 }}>{t.detail}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "nova" && (
        <Card title="NOVA AI ASSISTANT">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12, maxHeight: 400, overflowY: "auto" }}>
            {novaMessages.length === 0 && (
              <div style={{ color: colors.muted, fontSize: 13 }}>Ask NOVA about your store data, e.g. "summarise today's orders".</div>
            )}
            {novaMessages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  background: m.role === "user" ? colors.accent : "#1a1a1e",
                  color: m.role === "user" ? "#160b10" : colors.text,
                  padding: "8px 12px",
                  borderRadius: 12,
                  maxWidth: "80%",
                  fontSize: 13,
                }}
              >
                {m.text}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={novaInput}
              onChange={(e) => setNovaInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendNova()}
              placeholder="Ask NOVA anything..."
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                background: "#0f1214",
                color: colors.text,
                fontSize: 13,
              }}
            />
            <button onClick={sendNova} style={primaryBtn} disabled={novaBusy}>
              {novaBusy ? "…" : "Send"}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
