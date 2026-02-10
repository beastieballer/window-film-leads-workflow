const STORAGE_KEY = "wf_db_v1";

const DEFAULT_SETTINGS = {
  currency: "USD",
  minimum_job: { residential: 499, commercial: 1250 },
  labor_per_sqft: { solar: 4.5, decorative: 5.5, safety: 7.5, anti_graffiti: 6.5 },
  material_per_sqft_default: 1.1,
  material_per_sqft_by_type: {
    solar_interior: 1.0,
    solar_exterior: 1.2,
    decorative_basic: 0.85,
    decorative_premium: 5.35,
    safety_security_8mil: 1.45
  },
  waste_factor: { simple: 0.1, mixed: 0.15, complex: 0.2 },
  removal: { per_sqft: 2.5, heavy_adhesive_adder_per_sqft: 1.5, minimum: 150 },
  adders: { coi_admin: 75, permit_handling: 150 },
  gross_margin_targets: { good: 0.45, better: 0.5, best: 0.55 },
  quote_valid_days: 14,
  payment_terms: {
    residential: { deposit_pct: 0.5, balance: "due_on_completion" },
    commercial: { deposit_pct: 0.3, balance: "net_15_or_due_on_completion_under_2500" }
  }
};

const SEED_DB = {
  version: 1,
  settings: DEFAULT_SETTINGS,
  leads: [
    {
      id: "lead_seed_1",
      createdAt: "2026-02-10T12:00:00.000Z",
      updatedAt: "2026-02-10T12:00:00.000Z",
      status: "NEW",
      source: "web",
      contact: { name: "Avery Johnson", phone: "+14105550123", email: "avery@example.com" },
      location: { address: "123 Harbor Ave", city: "Baltimore", state: "MD" },
      jobType: "residential",
      sqftEstimate: 180,
      filmCategory: "solar_interior",
      goals: ["heat", "glare"],
      glass: { dualPane: null, lowE: null, notes: "Not sure if low-e. Wants daytime privacy too." },
      removalNeeded: false,
      access: "ground + step ladder",
      notes: "Wants a quick ballpark today; prefers text.",
      tags: ["hot_lead"],
      history: [{ at: "2026-02-10T12:00:00.000Z", type: "LEAD_CREATED", by: "system", detail: { source: "web" } }]
    },
    {
      id: "lead_seed_2",
      createdAt: "2026-02-10T12:05:00.000Z",
      updatedAt: "2026-02-10T12:05:00.000Z",
      status: "QUALIFYING",
      source: "phone",
      contact: { name: "Morgan Facilities", phone: "+14435550199", email: "fm@morganfacilities.com" },
      location: { address: "500 Market St", city: "Columbia", state: "MD" },
      jobType: "commercial",
      sqftEstimate: null,
      filmCategory: "unsure",
      goals: ["heat", "uv"],
      glass: { dualPane: null, lowE: null, notes: "Office building, 2nd floor. Needs COI." },
      removalNeeded: null,
      access: "interior access, ladder likely",
      notes: "Needs options and estimated payback; schedule site walk.",
      tags: ["commercial"],
      history: [{ at: "2026-02-10T12:05:00.000Z", type: "LEAD_CREATED", by: "system", detail: { source: "phone" } }]
    }
  ],
  tasks: [],
  quotes: [],
  messages: []
};

const els = {
  timestamp: document.getElementById("timestamp"),
  leadCount: document.getElementById("leadCount"),
  leadsList: document.getElementById("leadsList"),
  leadTitle: document.getElementById("leadTitle"),
  leadMeta: document.getElementById("leadMeta"),
  leadDetailBody: document.getElementById("leadDetailBody"),
  tasksList: document.getElementById("tasksList"),
  quotesList: document.getElementById("quotesList"),
  messagesList: document.getElementById("messagesList"),
  newLeadBtn: document.getElementById("newLeadBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  createFollowupsBtn: document.getElementById("createFollowupsBtn"),
  ballparkBtn: document.getElementById("ballparkBtn"),
  proposalBtn: document.getElementById("proposalBtn"),
  draftReplyBtn: document.getElementById("draftReplyBtn"),
  modalOverlay: document.getElementById("modalOverlay"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  closeBtn: document.getElementById("closeBtn"),
  copyBtn: document.getElementById("copyBtn")
};

let state = { db: null, selectedLeadId: null };

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  const rand = Math.random().toString(16).slice(2, 10);
  return `${prefix}_${Date.now().toString(16)}_${rand}`;
}

function loadDb() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(SEED_DB);
  try {
    const parsed = JSON.parse(raw);
    parsed.version ??= 1;
    parsed.settings ??= structuredClone(DEFAULT_SETTINGS);
    parsed.leads ??= [];
    parsed.tasks ??= [];
    parsed.quotes ??= [];
    parsed.messages ??= [];
    return parsed;
  } catch {
    return structuredClone(SEED_DB);
  }
}

function saveDb(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

function normalizeEmail(email) {
  if (!email) return null;
  const value = String(email).trim().toLowerCase();
  if (!value.includes("@")) return null;
  return value;
}

function hasAny(v) {
  return v !== null && v !== undefined && String(v).trim() !== "";
}

function scoreLead(lead) {
  const reasons = [];
  let score = 0;

  if (hasAny(lead.contact?.phone) || hasAny(lead.contact?.email)) {
    score += 15;
    reasons.push("Contactable (phone/email).");
  } else {
    reasons.push("Missing contact details.");
  }

  if (hasAny(lead.location?.city) || hasAny(lead.location?.address)) {
    score += 10;
    reasons.push("Has location.");
  } else {
    reasons.push("Missing location (harder to schedule).");
  }

  const sqft = Number(lead.sqftEstimate);
  if (Number.isFinite(sqft) && sqft > 0) {
    score += Math.min(25, 5 + Math.log10(Math.max(10, sqft)) * 10);
    reasons.push("Has sqft estimate (can quote faster).");
  } else {
    reasons.push("No sqft estimate yet.");
  }

  const goalsCount = Array.isArray(lead.goals) ? lead.goals.length : 0;
  if (goalsCount >= 2) {
    score += 10;
    reasons.push("Clear goals.");
  } else if (goalsCount === 1) {
    score += 5;
    reasons.push("Some goals provided.");
  } else {
    reasons.push("Goals unknown.");
  }

  const glassKnown = lead.glass?.dualPane !== null || lead.glass?.lowE !== null;
  if (glassKnown) {
    score += 5;
    reasons.push("Some glass info provided.");
  } else {
    reasons.push("Glass type unknown (risk).");
  }

  if (lead.removalNeeded === true) {
    score += 5;
    reasons.push("Removal needed (higher ticket).");
  }

  if (lead.jobType === "commercial") {
    score += 5;
    reasons.push("Commercial lead (typically larger value).");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const missingSqft = !(Number.isFinite(sqft) && sqft > 0);
  const nextBestAction = missingSqft
    ? "Schedule a quick measure (virtual or onsite) to lock scope."
    : "Send a ballpark quote + 2–3 film options, then book measure/installation.";

  return { score, reasons, nextBestAction };
}

function reScoreLead(lead) {
  const scored = scoreLead(lead);
  lead.score = scored.score;
  lead.scoreReasons = scored.reasons;
  lead.nextBestAction = scored.nextBestAction;
  return lead;
}

function listLeads() {
  return [...state.db.leads].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).map((l) => reScoreLead(l));
}

function getLeadById(id) {
  return state.db.leads.find((l) => l.id === id) ?? null;
}

function upsertLead(lead) {
  const idx = state.db.leads.findIndex((l) => l.id === lead.id);
  if (idx === -1) state.db.leads.push(lead);
  else state.db.leads[idx] = lead;
  saveDb(state.db);
}

function roundUp(value, increment) {
  return Math.ceil(value / increment) * increment;
}

function money(n) {
  return Math.round(n * 100) / 100;
}

function formatUsd(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function categoryToLaborBucket(filmCategory) {
  if (!filmCategory) return "solar";
  if (filmCategory.startsWith("decorative")) return "decorative";
  if (filmCategory.startsWith("safety")) return "safety";
  if (filmCategory.includes("graffiti")) return "anti_graffiti";
  return "solar";
}

function computeQuote({ lead, measuredSqft, complexity = "simple", grossMarginTier = "better", includeRemoval = null }) {
  const settings = state.db.settings ?? DEFAULT_SETTINGS;
  const measured = Number(measuredSqft ?? lead?.sqftEstimate ?? NaN);
  if (!Number.isFinite(measured) || measured <= 0) return { error: "missing_sqft" };

  const waste = settings.waste_factor?.[complexity] ?? settings.waste_factor?.simple ?? 0.1;
  const billable = roundUp(measured * (1 + waste), 5);

  const filmType = lead?.filmCategory ?? "unsure";
  const materialPerSqft = settings.material_per_sqft_by_type?.[filmType] ?? settings.material_per_sqft_default ?? 1.1;

  const laborBucket = categoryToLaborBucket(filmType);
  const laborPerSqft = settings.labor_per_sqft?.[laborBucket] ?? 5.0;

  const materialCost = billable * materialPerSqft;
  const laborCost = measured * laborPerSqft;

  const adders = [];
  if (lead?.jobType === "commercial" && settings.adders?.coi_admin) {
    adders.push({ key: "coi_admin", label: "COI/Admin", amount: settings.adders.coi_admin });
  }

  const removalRequested = includeRemoval === null ? Boolean(lead?.removalNeeded) : Boolean(includeRemoval);
  if (removalRequested) {
    const removal = settings.removal ?? {};
    const removalCalc = measured * (removal.per_sqft ?? 2.5);
    const removalAmount = Math.max(removal.minimum ?? 150, removalCalc);
    adders.push({ key: "removal", label: "Old film removal (est.)", amount: removalAmount });
  }

  const addersTotal = adders.reduce((sum, a) => sum + a.amount, 0);
  const subtotal = materialCost + laborCost + addersTotal;

  const targetGM = settings.gross_margin_targets?.[grossMarginTier] ?? 0.5;
  const sellFromGM = subtotal / (1 - targetGM);

  const minJob =
    (lead?.jobType === "commercial" ? settings.minimum_job?.commercial : settings.minimum_job?.residential) ?? 0;
  const total = Math.max(minJob, sellFromGM);

  return {
    measuredSqft: money(measured),
    billableSqft: money(billable),
    wasteFactor: waste,
    filmType,
    laborBucket,
    rates: { materialPerSqft: money(materialPerSqft), laborPerSqft: money(laborPerSqft), targetGM },
    costs: {
      materialCost: money(materialCost),
      laborCost: money(laborCost),
      adders,
      subtotal: money(subtotal)
    },
    minimumJobApplied: total > sellFromGM ? money(minJob) : null,
    total: money(total)
  };
}

function computeBallparkRange({ lead, measuredSqft, complexity = "simple" }) {
  const low = computeQuote({ lead, measuredSqft, complexity, grossMarginTier: "good", includeRemoval: false });
  if (low.error) return low;

  const high = computeQuote({
    lead,
    measuredSqft,
    complexity: complexity === "simple" ? "mixed" : "complex",
    grossMarginTier: "best",
    includeRemoval: lead?.removalNeeded ?? false
  });
  if (high.error) return high;

  const lowTotal = Math.min(low.total, high.total);
  const highTotal = Math.max(low.total, high.total);

  return {
    measuredSqft: low.measuredSqft,
    filmType: low.filmType,
    low: money(lowTotal),
    high: money(highTotal),
    assumptions: { complexity, removalIncludedInHigh: Boolean(lead?.removalNeeded), glassVerificationRequired: true }
  };
}

function buildBallparkText({ lead, range }) {
  const city = lead.location?.city ? ` in ${lead.location.city}` : "";
  const sqft = range.measuredSqft ? `${range.measuredSqft} sqft` : "your windows";
  const goal = Array.isArray(lead.goals) && lead.goals.length ? ` (${lead.goals.join(", ")})` : "";
  return (
    `Ballpark for ${sqft}${city} is ${formatUsd(range.low)}–${formatUsd(range.high)} installed.` +
    ` Assumes standard access, interior install where appropriate, and glass-type verification.` +
    ` Next step: send a quick video walkthrough + confirm if the glass is dual-pane/low‑e.${goal}`
  );
}

function buildProposalHtml({ lead, quote }) {
  const contactLine = [lead.contact?.name, lead.contact?.email, lead.contact?.phone].filter(Boolean).join(" · ");
  const locationLine = [lead.location?.address, lead.location?.city, lead.location?.state].filter(Boolean).join(", ");
  const adders = quote.costs?.adders ?? [];
  const addersHtml = adders.length
    ? `<ul>${adders.map((a) => `<li>${escapeHtml(a.label)}: <strong>${escapeHtml(formatUsd(a.amount))}</strong></li>`).join("")}</ul>`
    : "<p>None</p>";

  const goalHtml =
    Array.isArray(lead.goals) && lead.goals.length ? `<p><strong>Goals:</strong> ${escapeHtml(lead.goals.join(", "))}</p>` : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Window Film Proposal</title>
  <style>
    body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; margin:40px; color:#0b1220;}
    h1{margin:0 0 4px 0;}
    .muted{color:#556; font-size:14px;}
    .card{border:1px solid #dde; border-radius:12px; padding:16px; margin:14px 0;}
    table{width:100%; border-collapse:collapse;}
    td,th{padding:8px 10px; border-bottom:1px solid #eef;}
    .total{font-size:18px;}
  </style>
</head>
<body>
  <h1>Window Film Proposal</h1>
  <div class="muted">${escapeHtml(nowIso().slice(0, 10))} · Lead ${escapeHtml(lead.id)}</div>

  <div class="card">
    <div class="muted">Customer</div>
    <div>${escapeHtml(contactLine || "—")}</div>
    <div class="muted" style="margin-top:8px;">Site</div>
    <div>${escapeHtml(locationLine || "—")}</div>
    ${goalHtml}
  </div>

  <div class="card">
    <div class="muted">Scope</div>
    <p>Supply and install ${escapeHtml(quote.filmType)} window film. Final film selection subject to glass-type verification (dual-pane/low‑e/tempered/laminated) and manufacturer compatibility.</p>
  </div>

  <div class="card">
    <div class="muted">Measurements</div>
    <table>
      <tr><th align="left">Measured</th><th align="left">Billable</th><th align="left">Waste</th></tr>
      <tr>
        <td>${escapeHtml(quote.measuredSqft)} sqft</td>
        <td>${escapeHtml(quote.billableSqft)} sqft</td>
        <td>${escapeHtml(Math.round((quote.wasteFactor ?? 0) * 100))}%</td>
      </tr>
    </table>
  </div>

  <div class="card">
    <div class="muted">Pricing</div>
    <table>
      <tr><td>Material</td><td align="right"><strong>${escapeHtml(formatUsd(quote.costs.materialCost))}</strong></td></tr>
      <tr><td>Labor</td><td align="right"><strong>${escapeHtml(formatUsd(quote.costs.laborCost))}</strong></td></tr>
      <tr><td>Adders</td><td align="right"><strong>${escapeHtml(formatUsd((quote.costs.adders ?? []).reduce((s,a)=>s+a.amount,0)))}</strong></td></tr>
      <tr><td class="total"><strong>Total</strong></td><td class="total" align="right"><strong>${escapeHtml(formatUsd(quote.total))}</strong></td></tr>
    </table>
    ${quote.minimumJobApplied ? `<p class="muted">Minimum job charge applied: ${escapeHtml(formatUsd(quote.minimumJobApplied))}</p>` : ""}
  </div>

  <div class="card">
    <div class="muted">Adders detail</div>
    ${addersHtml}
  </div>

  <div class="card">
    <div class="muted">Assumptions & Exclusions</div>
    <ul>
      <li>Quote assumes standard access and prep. Surface condition may affect final price.</li>
      <li>Thermal-stress risk on unknown/low‑e/aged IGUs must be reviewed before install.</li>
      <li>Permit/engineering not included unless explicitly listed.</li>
    </ul>
  </div>
</body>
</html>`;
}

function listTasksForLead(leadId) {
  return state.db.tasks.filter((t) => t.leadId === leadId).sort((a, b) => (a.dueAt > b.dueAt ? 1 : -1));
}

function listQuotesForLead(leadId) {
  return state.db.quotes.filter((q) => q.leadId === leadId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function listMessagesForLead(leadId) {
  return state.db.messages.filter((m) => m.leadId === leadId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function createDefaultFollowUpsForLead(leadId) {
  const lead = getLeadById(leadId);
  if (!lead) return null;

  const existingTypes = new Set(state.db.tasks.filter((t) => t.leadId === leadId).map((t) => t.type));
  const now = nowIso();
  const tasks = [
    { type: "FOLLOWUP_1H", dueHours: 1, title: "Send ballpark + film options", body: "Send ballpark + ask for glass type and a video walkthrough." },
    { type: "FOLLOWUP_24H", dueHours: 24, title: "Follow up (24h)", body: "If no response, send 2 time slots for a measure." },
    { type: "FOLLOWUP_72H", dueHours: 72, title: "Last touch (72h)", body: "Final check-in. Offer a quick call." }
  ]
    .filter((t) => !existingTypes.has(t.type))
    .map((t) => ({
      id: newId("task"),
      leadId,
      createdAt: now,
      updatedAt: now,
      status: "OPEN",
      type: t.type,
      dueAt: new Date(Date.now() + t.dueHours * 60 * 60 * 1000).toISOString(),
      title: t.title,
      body: t.body
    }));

  state.db.tasks.push(...tasks);
  saveDb(state.db);
  return { created: tasks.length, tasks };
}

function generateBallparkQuoteForLead(leadId) {
  const lead = getLeadById(leadId);
  if (!lead) return null;
  const measuredSqft = lead.sqftEstimate ?? null;
  const range = computeBallparkRange({ lead, measuredSqft, complexity: "simple" });
  if (range.error) return { error: range.error };

  const quote = {
    id: newId("quote"),
    leadId,
    createdAt: nowIso(),
    kind: "ballpark",
    inputs: { measuredSqft, complexity: "simple" },
    outputs: { range, text: buildBallparkText({ lead, range }) }
  };
  state.db.quotes.push(quote);

  const nextLead = { ...lead, status: lead.status === "NEW" ? "QUOTED" : lead.status, updatedAt: nowIso() };
  nextLead.history = [
    ...(lead.history ?? []),
    { at: nowIso(), type: "QUOTE_CREATED", by: "system", detail: { kind: "ballpark", quoteId: quote.id } }
  ];
  upsertLead(nextLead);

  saveDb(state.db);
  return quote;
}

function generateProposalForLead(leadId) {
  const lead = getLeadById(leadId);
  if (!lead) return null;
  const computed = computeQuote({ lead, measuredSqft: lead.sqftEstimate ?? null, complexity: "simple", grossMarginTier: "better" });
  if (computed.error) return { error: computed.error };

  const proposalHtml = buildProposalHtml({ lead, quote: computed });
  const quote = {
    id: newId("quote"),
    leadId,
    createdAt: nowIso(),
    kind: "proposal",
    inputs: { measuredSqft: lead.sqftEstimate ?? null, complexity: "simple", grossMarginTier: "better" },
    outputs: { computed, proposalHtml }
  };
  state.db.quotes.push(quote);

  const nextLead = { ...lead, status: lead.status === "NEW" ? "QUOTED" : lead.status, updatedAt: nowIso() };
  nextLead.history = [
    ...(lead.history ?? []),
    { at: nowIso(), type: "PROPOSAL_CREATED", by: "system", detail: { quoteId: quote.id } }
  ];
  upsertLead(nextLead);

  saveDb(state.db);
  return quote;
}

function pickChannel(lead) {
  if (lead.contact?.phone) return "sms";
  if (lead.contact?.email) return "email";
  return "note";
}

function draftSmsForLead({ lead, quoteText }) {
  const name = lead.contact?.name ? ` ${lead.contact.name.split(" ")[0]}` : "";
  const nextStep = lead.sqftEstimate
    ? "If that range works, I can recommend 2–3 film options and book a quick measure to confirm glass type."
    : "If you can send a quick video walkthrough (or window sizes), I can firm up pricing and recommend the right film.";
  return `Hi${name}—thanks for reaching out. ${quoteText}\n\n${nextStep}`;
}

function draftEmailForLead({ lead, quoteText }) {
  const subject = `Window Film Estimate — ${lead.location?.city ?? "Your Site"}`;
  const body =
    `Hi${lead.contact?.name ? ` ${lead.contact.name}` : ""},\n\n` +
    `${quoteText}\n\n` +
    `To firm this up, please reply with:\n` +
    `1) Confirmation if the glass is dual-pane / low‑e (if known)\n` +
    `2) A quick video walkthrough (or window sizes)\n` +
    `3) Any old film removal needed\n\n` +
    `Thanks,\n`;
  return { subject, body };
}

function draftReplyForLead(leadId) {
  const lead = getLeadById(leadId);
  if (!lead) return null;

  let quoteText = null;
  if (lead.sqftEstimate) {
    const quote = generateBallparkQuoteForLead(leadId);
    quoteText = quote?.outputs?.text ?? null;
  }
  quoteText ??= "I can get you a fast ballpark today—what’s the rough total sqft and is it residential or commercial?";

  const channel = pickChannel(lead);
  const record = {
    id: newId("msg"),
    leadId,
    createdAt: nowIso(),
    status: "DRAFT",
    channel,
    to: channel === "sms" ? lead.contact?.phone : lead.contact?.email,
    subject: null,
    body: ""
  };

  if (channel === "email") {
    const email = draftEmailForLead({ lead, quoteText });
    record.subject = email.subject;
    record.body = email.body;
  } else if (channel === "sms") {
    record.body = draftSmsForLead({ lead, quoteText });
  } else {
    record.body = quoteText;
  }

  state.db.messages.push(record);
  saveDb(state.db);
  return record;
}

function setButtonsEnabled(enabled) {
  els.createFollowupsBtn.disabled = !enabled;
  els.ballparkBtn.disabled = !enabled;
  els.proposalBtn.disabled = !enabled;
  els.draftReplyBtn.disabled = !enabled;
}

function renderLeadList() {
  const leads = listLeads();
  els.leadCount.textContent = `${leads.length} total`;

  if (!leads.length) {
    els.leadsList.innerHTML = `<div class="muted">No leads yet. Click “New Lead”.</div>`;
    return;
  }

  els.leadsList.innerHTML = leads
    .map((l) => {
      const selected = l.id === state.selectedLeadId ? "wf-lead-item selected" : "wf-lead-item";
      const top = l.contact?.name || l.location?.address || l.id;
      const sub = [l.status, l.jobType, l.sqftEstimate ? `${l.sqftEstimate} sqft` : null].filter(Boolean).join(" · ");
      const score = typeof l.score === "number" ? l.score : 0;
      return `<button class="${selected}" data-lead-id="${escapeHtml(l.id)}" type="button">
        <div class="wf-lead-top">
          <span class="wf-lead-name">${escapeHtml(top)}</span>
          <span class="wf-score">${escapeHtml(score)}</span>
        </div>
        <div class="wf-lead-sub">${escapeHtml(sub || "—")}</div>
      </button>`;
    })
    .join("");

  els.leadsList.querySelectorAll("[data-lead-id]").forEach((btn) => {
    btn.addEventListener("click", () => selectLead(btn.getAttribute("data-lead-id")));
  });
}

function renderLeadDetail(lead) {
  if (!lead) {
    els.leadTitle.textContent = "Select a lead";
    els.leadMeta.textContent = "—";
    els.leadDetailBody.innerHTML = `<p class="muted">Click a lead on the left to view details and generate quotes/messages.</p>`;
    setButtonsEnabled(false);
    return;
  }

  setButtonsEnabled(true);
  const name = lead.contact?.name || "Unnamed lead";
  const loc = [lead.location?.city, lead.location?.state].filter(Boolean).join(", ");
  els.leadTitle.textContent = name;
  els.leadMeta.textContent = `${lead.status} · ${lead.source} · Updated ${fmtDate(lead.updatedAt)}${loc ? ` · ${loc}` : ""}`;

  const contactBits = [
    lead.contact?.phone ? `📱 ${escapeHtml(lead.contact.phone)}` : null,
    lead.contact?.email ? `✉️ ${escapeHtml(lead.contact.email)}` : null
  ]
    .filter(Boolean)
    .join("<br/>");

  const goals = Array.isArray(lead.goals) && lead.goals.length ? lead.goals.join(", ") : "—";
  const scoreReasons = Array.isArray(lead.scoreReasons) ? lead.scoreReasons.join(" ") : "—";

  const missing = [];
  if (!(Number.isFinite(Number(lead.sqftEstimate)) && Number(lead.sqftEstimate) > 0)) missing.push("Rough total sqft (or a window list W×H×qty).");
  if (!hasAny(lead.location?.address) && !hasAny(lead.location?.city)) missing.push("Site address / city (for scheduling).");
  if (lead.removalNeeded === null || lead.removalNeeded === undefined) missing.push("Existing film removal needed? (Y/N).");
  if (!hasAny(lead.access)) missing.push("Access constraints (ground/ladder/lift, after-hours).");
  if (!Array.isArray(lead.goals) || !lead.goals.length) missing.push("Top 1–2 goals (heat/glare/privacy/safety/looks).");
  const glassKnown = lead.glass?.dualPane !== null || lead.glass?.lowE !== null || hasAny(lead.glass?.notes);
  if (!glassKnown) missing.push("Glass type (dual-pane? low‑e? tempered/laminated if known).");
  if (lead.jobType === "commercial") missing.push("COI required? Site contact + allowed work hours.");

  const plays = [];
  const goalText = (Array.isArray(lead.goals) ? lead.goals.join(" ") : "") + " " + String(lead.notes ?? "");
  if (/privacy/i.test(goalText)) plays.push("Offer a day-privacy option (dual-reflective) + a frosted/decorative option for bathrooms/entry glass.");
  if (/heat|glare|sun/i.test(goalText)) plays.push("Present 3-tier solar options (good/better/best) to lift AOV without adding sales time.");
  if (/uv/i.test(goalText)) plays.push("Add UV/warranty language + upsell to a higher-spec film if the client mentions fading.");
  if (lead.jobType === "commercial") plays.push("Suggest street-level anti-graffiti film and/or safety/security film as an add-on line item.");
  if ((lead.filmCategory ?? "unsure") === "unsure") plays.push("Run a virtual measure (video walkthrough) before quoting firm pricing to reduce scope creep.");

  els.leadDetailBody.innerHTML = `
    <div class="wf-detail-grid">
      <div class="wf-kv">
        <div class="wf-k">Contact</div>
        <div class="wf-v">${contactBits || "—"}</div>
      </div>
      <div class="wf-kv">
        <div class="wf-k">Scope</div>
        <div class="wf-v">
          ${escapeHtml(lead.jobType || "—")} · ${escapeHtml(lead.filmCategory || "unsure")}<br/>
          Sqft: <strong>${escapeHtml(lead.sqftEstimate ?? "—")}</strong> · Removal: <strong>${escapeHtml(lead.removalNeeded ?? "—")}</strong>
        </div>
      </div>
      <div class="wf-kv">
        <div class="wf-k">Goals</div>
        <div class="wf-v">${escapeHtml(goals)}</div>
      </div>
      <div class="wf-kv">
        <div class="wf-k">Score</div>
        <div class="wf-v"><strong>${escapeHtml(lead.score ?? 0)}</strong><div class="muted">${escapeHtml(scoreReasons)}</div></div>
      </div>
      <div class="wf-kv wf-kv-wide">
        <div class="wf-k">Next best action</div>
        <div class="wf-v">${escapeHtml(lead.nextBestAction ?? "—")}</div>
      </div>
      <div class="wf-kv wf-kv-wide">
        <div class="wf-k">Missing info (to close faster)</div>
        <div class="wf-v">
          ${missing.length ? `<ul>${missing.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>` : "Nothing major missing."}
        </div>
      </div>
      <div class="wf-kv wf-kv-wide">
        <div class="wf-k">Revenue plays (upsells / positioning)</div>
        <div class="wf-v">
          ${plays.length ? `<ul>${plays.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>` : "—"}
        </div>
      </div>
      <div class="wf-kv wf-kv-wide">
        <div class="wf-k">Notes</div>
        <div class="wf-v">${escapeHtml(lead.notes ?? "—")}</div>
      </div>
    </div>
  `;
}

function renderTasks(tasks) {
  if (!tasks.length) {
    els.tasksList.innerHTML = `<div class="muted">No tasks yet. Click “Create follow-ups”.</div>`;
    return;
  }
  els.tasksList.innerHTML = tasks
    .map((t) => {
      return `<div class="wf-row">
        <div class="wf-row-title">${escapeHtml(t.title)}</div>
        <div class="muted">${escapeHtml(t.status)} · due ${escapeHtml(fmtDate(t.dueAt))}</div>
      </div>`;
    })
    .join("");
}

function renderQuotes(quotes) {
  if (!quotes.length) {
    els.quotesList.innerHTML = `<div class="muted">No quotes yet.</div>`;
    return;
  }
  els.quotesList.innerHTML = quotes
    .map((q) => {
      const title = q.kind === "ballpark" ? "Ballpark" : "Proposal";
      let meta = fmtDate(q.createdAt);
      if (q.outputs?.range) meta += ` · ${formatUsd(q.outputs.range.low)}–${formatUsd(q.outputs.range.high)}`;
      if (q.outputs?.computed?.total) meta += ` · total ${formatUsd(q.outputs.computed.total)}`;
      const actions =
        q.kind === "proposal"
          ? `<button class="action-btn secondary wf-open-proposal" data-quote-id="${escapeHtml(
              q.id
            )}" type="button">Open proposal</button>`
          : "";
      return `<div class="wf-row">
        <div class="wf-row-title">${escapeHtml(title)}</div>
        <div class="muted">${escapeHtml(meta)}</div>
        ${actions ? `<div style="margin-top:8px">${actions}</div>` : ""}
      </div>`;
    })
    .join("");

  els.quotesList.querySelectorAll(".wf-open-proposal").forEach((btn) => {
    btn.addEventListener("click", () => {
      const quoteId = btn.getAttribute("data-quote-id");
      const q = state.db.quotes.find((x) => x.id === quoteId);
      const html = q?.outputs?.proposalHtml ?? "<p>No proposal HTML.</p>";
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
    });
  });
}

function renderMessages(messages) {
  if (!messages.length) {
    els.messagesList.innerHTML = `<div class="muted">No drafts yet.</div>`;
    return;
  }
  els.messagesList.innerHTML = messages
    .map((m) => {
      const head = `${m.channel?.toUpperCase?.() ?? "NOTE"} · ${fmtDate(m.createdAt)}`;
      const body = m.body ? escapeHtml(m.body).replaceAll("\n", "<br/>") : "—";
      const subject = m.subject ? `<div class="muted"><strong>Subject:</strong> ${escapeHtml(m.subject)}</div>` : "";
      return `<div class="wf-row">
        <div class="wf-row-title">${escapeHtml(head)}</div>
        ${subject}
        <div class="wf-message">${body}</div>
        <div style="margin-top:8px">
          <button class="action-btn secondary wf-copy" data-copy="${escapeHtml(m.body ?? "")}" type="button">Copy</button>
        </div>
      </div>`;
    })
    .join("");

  els.messagesList.querySelectorAll(".wf-copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(btn.getAttribute("data-copy") ?? "");
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = "Copy"), 1000);
    });
  });
}

function renderSelectedLead() {
  const lead = state.selectedLeadId ? getLeadById(state.selectedLeadId) : null;
  renderLeadDetail(lead ? reScoreLead(lead) : null);
  if (!lead) {
    renderTasks([]);
    renderQuotes([]);
    renderMessages([]);
    return;
  }
  renderTasks(listTasksForLead(lead.id));
  renderQuotes(listQuotesForLead(lead.id));
  renderMessages(listMessagesForLead(lead.id));
}

function selectLead(leadId) {
  state.selectedLeadId = leadId;
  renderLeadList();
  renderSelectedLead();
}

function openModal({ title, bodyHtml, copyText }) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = bodyHtml;
  els.modalOverlay.style.display = "flex";
  els.modalOverlay.setAttribute("aria-hidden", "false");
  els.copyBtn.onclick = async () => {
    await navigator.clipboard.writeText(copyText ?? "");
    els.copyBtn.textContent = "Copied";
    setTimeout(() => (els.copyBtn.textContent = "Copy"), 1000);
  };
}

function closeModal() {
  els.modalOverlay.style.display = "none";
  els.modalOverlay.setAttribute("aria-hidden", "true");
}

function refresh() {
  els.timestamp.textContent = `Last refreshed: ${new Date().toLocaleString()}`;
  renderLeadList();
  renderSelectedLead();
}

function newLeadFormHtml() {
  return `
    <form id="newLeadForm" class="wf-form">
      <div class="wf-form-row"><label>Name</label><input name="name" placeholder="Customer name" /></div>
      <div class="wf-form-row"><label>Phone</label><input name="phone" placeholder="(555) 555-5555" /></div>
      <div class="wf-form-row"><label>Email</label><input name="email" placeholder="name@email.com" /></div>
      <div class="wf-form-row">
        <label>Job type</label>
        <select name="jobType">
          <option value="both">both</option>
          <option value="residential">residential</option>
          <option value="commercial">commercial</option>
        </select>
      </div>
      <div class="wf-form-row"><label>Sqft (rough)</label><input name="sqftEstimate" type="number" step="1" min="0" placeholder="e.g. 180" /></div>
      <div class="wf-form-row">
        <label>Film category</label>
        <select name="filmCategory">
          <option value="unsure">unsure</option>
          <option value="solar_interior">solar_interior</option>
          <option value="solar_exterior">solar_exterior</option>
          <option value="decorative_basic">decorative_basic</option>
          <option value="decorative_premium">decorative_premium</option>
          <option value="safety_security_8mil">safety_security_8mil</option>
        </select>
      </div>
      <div class="wf-form-row"><label>Goals (comma separated)</label><input name="goals" placeholder="heat, glare, privacy" /></div>
      <div class="wf-form-row"><label>Notes</label><textarea name="notes" placeholder="Lead context, constraints, etc."></textarea></div>
      <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:10px;">
        <button class="action-btn secondary" type="button" id="cancelNewLead">Cancel</button>
        <button class="action-btn" type="submit">Create lead</button>
      </div>
    </form>
  `;
}

function wireNewLeadModal() {
  const form = document.getElementById("newLeadForm");
  const cancelBtn = document.getElementById("cancelNewLead");
  cancelBtn.addEventListener("click", closeModal);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());
    const createdAt = nowIso();
    const lead = reScoreLead({
      id: newId("lead"),
      createdAt,
      updatedAt: createdAt,
      status: "NEW",
      source: "manual",
      contact: { name: payload.name || null, phone: normalizePhone(payload.phone), email: normalizeEmail(payload.email) },
      location: { address: null, city: null, state: null },
      jobType: payload.jobType || "both",
      sqftEstimate: payload.sqftEstimate ? Number(payload.sqftEstimate) : null,
      filmCategory: payload.filmCategory || "unsure",
      goals: payload.goals ? String(payload.goals).split(",").map((s) => s.trim()).filter(Boolean) : [],
      glass: { dualPane: null, lowE: null, notes: null },
      removalNeeded: null,
      access: null,
      notes: payload.notes || null,
      tags: [],
      history: [{ at: createdAt, type: "LEAD_CREATED", by: "user", detail: { source: "manual" } }]
    });

    state.db.leads.push(lead);
    saveDb(state.db);
    closeModal();
    refresh();
    selectLead(lead.id);
  });
}

function exportDb() {
  const blob = new Blob([JSON.stringify(state.db, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `window-film-workflow-db-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function importDbPrompt() {
  const html = `
    <div class="muted" style="margin-bottom:10px;">Paste a previously exported JSON database.</div>
    <textarea id="importText" style="width:100%; min-height:240px;"></textarea>
    <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:10px;">
      <button class="action-btn secondary" type="button" id="cancelImport">Cancel</button>
      <button class="action-btn" type="button" id="doImport">Import</button>
    </div>
  `;
  openModal({ title: "Import database", bodyHtml: html, copyText: "" });
  document.getElementById("cancelImport").addEventListener("click", closeModal);
  document.getElementById("doImport").addEventListener("click", () => {
    const raw = document.getElementById("importText").value;
    try {
      const parsed = JSON.parse(raw);
      state.db = parsed;
      saveDb(state.db);
      closeModal();
      refresh();
    } catch (e) {
      alert("Invalid JSON.");
    }
  });
}

els.newLeadBtn.addEventListener("click", () => {
  openModal({ title: "New lead", bodyHtml: newLeadFormHtml(), copyText: "" });
  wireNewLeadModal();
});
els.refreshBtn.addEventListener("click", refresh);
els.exportBtn.addEventListener("click", exportDb);
els.importBtn.addEventListener("click", importDbPrompt);

els.closeModalBtn.addEventListener("click", closeModal);
els.closeBtn.addEventListener("click", closeModal);
els.modalOverlay.addEventListener("click", (e) => {
  if (e.target === els.modalOverlay) closeModal();
});

els.createFollowupsBtn.addEventListener("click", () => {
  if (!state.selectedLeadId) return;
  createDefaultFollowUpsForLead(state.selectedLeadId);
  refresh();
});

els.ballparkBtn.addEventListener("click", () => {
  if (!state.selectedLeadId) return;
  const quote = generateBallparkQuoteForLead(state.selectedLeadId);
  const text = quote?.outputs?.text ?? "No text generated.";
  openModal({ title: "Ballpark quote", bodyHtml: `<pre class="wf-pre">${escapeHtml(text)}</pre>`, copyText: text });
  refresh();
});

els.proposalBtn.addEventListener("click", () => {
  if (!state.selectedLeadId) return;
  const quote = generateProposalForLead(state.selectedLeadId);
  if (quote?.error) {
    openModal({ title: "Missing sqft", bodyHtml: `<p class="muted">Add rough sqft to generate a proposal.</p>`, copyText: "" });
    return;
  }
  openModal({ title: "Proposal created", bodyHtml: `<p>Proposal generated. Open it from the Quotes panel.</p>`, copyText: "" });
  refresh();
});

els.draftReplyBtn.addEventListener("click", () => {
  if (!state.selectedLeadId) return;
  const msg = draftReplyForLead(state.selectedLeadId);
  const body = msg?.body ?? "";
  openModal({ title: "Draft reply", bodyHtml: `<pre class="wf-pre">${escapeHtml(body)}</pre>`, copyText: body });
  refresh();
});

state.db = loadDb();
refresh();
