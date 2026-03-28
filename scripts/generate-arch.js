// Generates ARCHITECTURE.excalidraw
let seed = 1;

function el_rect(id, x, y, w, h, stroke, bg, roughness = 1, rounded = true) {
  return {
    id, type: "rectangle", x, y, width: w, height: h,
    strokeColor: stroke, backgroundColor: bg,
    fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid",
    roughness, opacity: 100, angle: 0, groupIds: [],
    roundness: rounded ? { type: 3, value: 20 } : null,
    seed: seed++, version: 1, versionNonce: seed++,
    isDeleted: false, boundElements: null, updated: 1, link: null, locked: false
  };
}

function el_text(id, x, y, w, content, fontSize, align = "center", color = "#1e1e1e", bold = false) {
  const lineCount = content.split('\n').length;
  const h = Math.ceil(lineCount * fontSize * 1.35);
  return {
    id, type: "text", x, y, width: w, height: h,
    strokeColor: color, backgroundColor: "transparent",
    fillStyle: "hachure", strokeWidth: 1, strokeStyle: "solid",
    roughness: 0, opacity: 100, angle: 0, groupIds: [],
    roundness: null,
    seed: seed++, version: 1, versionNonce: seed++,
    isDeleted: false, boundElements: null, updated: 1, link: null, locked: false,
    text: content, fontSize, fontFamily: 1,
    textAlign: align, verticalAlign: "top",
    baseline: Math.round(fontSize * 0.8),
    ...(bold ? { fontStyle: "bold" } : {})
  };
}

function el_arrow(id, x1, y1, x2, y2, color = "#495057", dashed = false) {
  return {
    id, type: "arrow", x: x1, y: y1,
    width: Math.abs(x2 - x1), height: Math.abs(y2 - y1),
    strokeColor: color, backgroundColor: "transparent",
    fillStyle: "hachure", strokeWidth: 2,
    strokeStyle: dashed ? "dashed" : "solid",
    roughness: 1, opacity: 100, angle: 0, groupIds: [],
    roundness: { type: 2, value: 16 },
    seed: seed++, version: 1, versionNonce: seed++,
    isDeleted: false, boundElements: null, updated: 1, link: null, locked: false,
    points: [[0, 0], [x2 - x1, y2 - y1]],
    lastCommittedPoint: null,
    startBinding: null, endBinding: null,
    startArrowhead: null, endArrowhead: "arrow"
  };
}

// ─────────────────────────────────────────────────
// LAYOUT CONSTANTS
// ─────────────────────────────────────────────────
const CW = 2200; // canvas width

// Row Y positions
const Y_TITLE     = 10;
const Y_CITIZENS  = 60;
const Y_FRONTEND  = 190;
const Y_PAGES     = 290;
const Y_COL       = 530;   // 3-column row
const Y_SUPPORT   = Y_COL;
const Y_DEPLOY    = 1200;

// Column X positions
const X_LEFT  = 80;
const X_SOL   = 80;  W_SOL = 760;
const X_SUP   = 880; W_SUP = 540;
const X_AI    = 1460; W_AI  = 660;
const X_RIGHT = X_AI + W_AI;

// Heights
const H_CITIZENS  = 80;
const H_FRONTEND  = 200;
const H_PROG      = 82;
const H_STEP      = 102;
const H_SUP_ITEM  = 100;
const H_DEPLOY    = 120;

// Col height: 5 programs × 82 + 4 gaps × 4 + header 80 + padding 30
const H_SOL = 80 + 5 * H_PROG + 4 * 4 + 20;   // = 80+426+16 = 522
const H_AI  = 80 + 4 * H_STEP + 3 * 4 + 20;    // = 80+420+12 = 512
const H_SUP = 80 + 3 * H_SUP_ITEM + 2 * 10 + 10 * 2; // = 80+320 = 400

// ─────────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────────
const C = {
  amber:    { bg: "#fff3bf", stroke: "#e67700" },
  green:    { bg: "#ebfbee", stroke: "#2f9e44" },
  blue:     { bg: "#d0ebff", stroke: "#1971c2" },
  blueSub:  { bg: "#e7f5ff", stroke: "#339af0" },
  purple:   { bg: "#f3d9fa", stroke: "#9c36b5" },
  purpSub:  { bg: "#f8f0fc", stroke: "#cc5de8" },
  orange:   { bg: "#fff4e6", stroke: "#e8590c" },
  gray:     { bg: "#f1f3f5", stroke: "#495057" },
  grayDark: { bg: "#dee2e6", stroke: "#343a40" },
  red:      { bg: "#fff5f5", stroke: "#c92a2a" },
};

const elements = [];

// ─────────────────────────────────────────────────
// 0. TITLE
// ─────────────────────────────────────────────────
elements.push(el_text("t_title", 300, Y_TITLE, 1600,
  "AMANAT PROTOCOL — Solution Architecture",
  28, "center", "#1971c2"));

// ─────────────────────────────────────────────────
// 1. CITIZENS
// ─────────────────────────────────────────────────
elements.push(el_rect("r_cit", X_LEFT, Y_CITIZENS, CW - X_LEFT * 2, H_CITIZENS,
  C.amber.stroke, C.amber.bg));
elements.push(el_text("t_cit1", X_LEFT, Y_CITIZENS + 10, CW - X_LEFT * 2,
  "👥  CITIZENS / AKIMAT",
  20, "center", C.amber.stroke));
elements.push(el_text("t_cit2", X_LEFT, Y_CITIZENS + 40, CW - X_LEFT * 2,
  "Browser · Phantom Wallet · IIN Registration · Treasury Voting · Jury Duty",
  14, "center", "#664d03"));

// Arrow: citizens → frontend
elements.push(el_arrow("a_cf", 1100, Y_CITIZENS + H_CITIZENS, 1100, Y_FRONTEND, "#2f9e44"));
elements.push(el_text("t_acf", 1110, Y_CITIZENS + H_CITIZENS + 5, 120,
  "HTTPS", 12, "left", "#2f9e44"));

// ─────────────────────────────────────────────────
// 2. NEXT.JS FRONTEND
// ─────────────────────────────────────────────────
elements.push(el_rect("r_fe", X_LEFT, Y_FRONTEND, CW - X_LEFT * 2, H_FRONTEND,
  C.green.stroke, C.green.bg));
elements.push(el_text("t_fe", X_LEFT, Y_FRONTEND + 10, CW - X_LEFT * 2,
  "NEXT.JS 14 FRONTEND  (TypeScript · Tailwind CSS · Leaflet · react-leaflet)",
  18, "center", C.green.stroke));

// Page sub-boxes (8 boxes, equal width inside frontend)
const pages = [
  { id: "map",     label: "/  Map\nAlmaty Leaflet\ncolored pins",              color: C.green },
  { id: "clist",   label: "/contracts\nList + filters\nstatus tabs",           color: C.green },
  { id: "cdetail", label: "/contracts/[id]\nMilestone timeline\n+ jury status", color: C.green },
  { id: "jury",    label: "/jury/[id]\nCommit-reveal\nvoting UI",              color: C.green },
  { id: "treas",   label: "/treasury/[d]\nAI proposals\nDistrict fund",        color: C.green },
  { id: "reg",     label: "/register\nIIN SHA-256\nclient-side only",          color: C.green },
  { id: "prof",    label: "/profile\n/admin\nReputation + Registry",           color: C.green },
  { id: "api",     label: "POST /api/research\nAI Research Agent\nOpenAI endpoint", color: C.purple },
];

const PW = Math.floor((CW - X_LEFT * 2 - 16) / 8); // page box width
const PH = 110;
const PY = Y_PAGES;

pages.forEach((p, i) => {
  const px = X_LEFT + 8 + i * PW;
  elements.push(el_rect(`r_pg_${p.id}`, px, PY, PW - 4, PH,
    p.color.stroke, p.color.bg, 0));
  elements.push(el_text(`t_pg_${p.id}`, px + 6, PY + 8, PW - 16,
    p.label, 12, "left", p.color.stroke === C.purple.stroke ? C.purple.stroke : "#2b8a3e"));
});

// Arrows: frontend → solana & frontend → ai
elements.push(el_arrow("a_fSol", 450, Y_FRONTEND + H_FRONTEND,
  450, Y_COL, C.blue.stroke));
elements.push(el_text("t_a_fSol", 460, Y_FRONTEND + H_FRONTEND + 10, 180,
  "Solana Web3.js\nAnchor client", 12, "left", C.blue.stroke));

elements.push(el_arrow("a_fAi", 1700, Y_FRONTEND + H_FRONTEND,
  1700, Y_COL, C.purple.stroke));
elements.push(el_text("t_a_fAi", 1710, Y_FRONTEND + H_FRONTEND + 10, 160,
  "OpenAI API\ngpt-4o-mini", 12, "left", C.purple.stroke));

// ─────────────────────────────────────────────────
// 3. SOLANA DEVNET (left column)
// ─────────────────────────────────────────────────
elements.push(el_rect("r_sol", X_SOL, Y_COL, W_SOL, H_SOL,
  C.blue.stroke, C.blue.bg));
elements.push(el_text("t_sol_h", X_SOL, Y_COL + 10, W_SOL,
  "⬡  SOLANA DEVNET  (Anchor · Rust)", 18, "center", C.blue.stroke));
elements.push(el_text("t_sol_s", X_SOL, Y_COL + 40, W_SOL,
  "5 on-chain programs · devnet deployment · Switchboard VRF · IPFS evidence", 12, "center", "#1864ab"));

const PROG_Y0 = Y_COL + 80;
const programs = [
  { id: "creg",  icon: "📋", name: "CONTRACT REGISTRY",
    body: "register_contract · submit_milestone_completion\ntrigger_penalty · release_tranche · terminate_contract" },
  { id: "citreg", icon: "🪪", name: "CITIZEN REGISTRY  (Soulbound Token)",
    body: "register_citizen(iin_hash) · update_reputation\nslash_reputation · ban_citizen · is_eligible check" },
  { id: "jury",  icon: "⚖️", name: "JURY MECHANISM  (Commit-Reveal)",
    body: "select_jury_vrf · commit_vote · reveal_vote\nfinalize_session · replace_inactive · escalate_dispute" },
  { id: "pen",   icon: "⚡", name: "PENALTY ENGINE",
    body: "check_deadline (anyone can call) · 1%/day overdue\n10%/rejection · 5%/ghost-site · cap 30% of contract" },
  { id: "treas", icon: "🏛️", name: "DISTRICT TREASURY",
    body: "deposit · create_proposal · vote_on_proposal\nexecute_proposal (auto on quorum + majority)" },
];

programs.forEach((p, i) => {
  const py = PROG_Y0 + i * (H_PROG + 4);
  elements.push(el_rect(`r_p_${p.id}`, X_SOL + 12, py, W_SOL - 24, H_PROG,
    C.blueSub.stroke, C.blueSub.bg, 0, false));
  elements.push(el_text(`t_p_${p.id}_h`, X_SOL + 18, py + 6, W_SOL - 36,
    `${p.icon}  ${p.name}`, 13, "left", C.blue.stroke));
  elements.push(el_text(`t_p_${p.id}_b`, X_SOL + 18, py + 26, W_SOL - 36,
    p.body, 11, "left", "#1864ab"));
});

// Internal arrow: penalty → district treasury
const penBottom  = PROG_Y0 + 3 * (H_PROG + 4) + H_PROG;
const treasTop   = PROG_Y0 + 4 * (H_PROG + 4);
elements.push(el_arrow("a_pen_tr", X_SOL + W_SOL / 2, penBottom,
  X_SOL + W_SOL / 2, treasTop, "#c92a2a"));
elements.push(el_text("t_a_pen_tr", X_SOL + W_SOL / 2 + 6, penBottom + 1, 130,
  "penalty funds", 10, "left", "#c92a2a"));

// ─────────────────────────────────────────────────
// 4. SUPPORTING SERVICES (center column)
// ─────────────────────────────────────────────────
elements.push(el_rect("r_sup", X_SUP, Y_SUPPORT, W_SUP, H_SOL,
  C.gray.stroke, C.gray.bg));
elements.push(el_text("t_sup_h", X_SUP, Y_SUPPORT + 10, W_SUP,
  "SUPPORTING SERVICES", 17, "center", C.grayDark.stroke));

const supItems = [
  { id: "vrf",    icon: "🎲", name: "Switchboard VRF",
    body: "Provably random jury selection\nCryptographic proof on-chain\nPrevents contractor collusion",
    c: C.orange },
  { id: "ipfs",   icon: "📸", name: "IPFS / Arweave",
    body: "Contractor photo evidence\nOff-chain storage, hash on-chain\nPermanent, censorship-resistant",
    c: C.orange },
  { id: "wallet", icon: "👛", name: "Phantom / Backpack",
    body: "@solana/wallet-adapter\nTransaction signing\nDevnet SOL airdrop button",
    c: C.amber },
];

const SUP_Y0 = Y_SUPPORT + 75;
supItems.forEach((s, i) => {
  const sy = SUP_Y0 + i * (H_SUP_ITEM + 10);
  elements.push(el_rect(`r_s_${s.id}`, X_SUP + 12, sy, W_SUP - 24, H_SUP_ITEM,
    s.c.stroke, s.c.bg, 0, false));
  elements.push(el_text(`t_s_${s.id}_h`, X_SUP + 20, sy + 8, W_SUP - 40,
    `${s.icon}  ${s.name}`, 14, "left", s.c.stroke));
  elements.push(el_text(`t_s_${s.id}_b`, X_SUP + 20, sy + 30, W_SUP - 40,
    s.body, 11, "left", "#495057"));
});

// IIN Privacy note box
const IIN_Y = SUP_Y0 + 3 * (H_SUP_ITEM + 10) + 10;
elements.push(el_rect("r_iin", X_SUP + 12, IIN_Y, W_SUP - 24, 90,
  "#c92a2a", "#fff5f5", 0, false));
elements.push(el_text("t_iin_h", X_SUP + 20, IIN_Y + 8, W_SUP - 40,
  "🔒  IIN PRIVACY MODEL", 13, "left", "#c92a2a"));
elements.push(el_text("t_iin_b", X_SUP + 20, IIN_Y + 28, W_SUP - 40,
  "hash(IIN + salt) computed client-side only\ncrypto.subtle SHA-256 · raw IIN never transmitted\nOnly Uint8Array[32] hash sent to blockchain",
  10, "left", "#862e2e"));

// Arrows: jury → VRF, contract → IPFS
const juryMidX = X_SOL + W_SOL;
const juryMidY = PROG_Y0 + 2 * (H_PROG + 4) + H_PROG / 2; // jury box center Y
const vrfMidY  = SUP_Y0 + H_SUP_ITEM / 2;
elements.push(el_arrow("a_j_vrf", juryMidX, juryMidY, X_SUP, vrfMidY, C.orange.stroke));
elements.push(el_text("t_j_vrf", juryMidX + 4, juryMidY - 16, 110,
  "VRF request", 10, "left", C.orange.stroke));

const contractMidY = PROG_Y0 + H_PROG / 2;
const ipfsMidY     = SUP_Y0 + H_SUP_ITEM + 10 + H_SUP_ITEM / 2;
elements.push(el_arrow("a_c_ipfs", juryMidX, contractMidY, X_SUP, ipfsMidY, C.orange.stroke));
elements.push(el_text("t_c_ipfs", juryMidX + 4, contractMidY - 16, 110,
  "photo hash", 10, "left", C.orange.stroke));

// ─────────────────────────────────────────────────
// 5. AI RESEARCH AGENT (right column)
// ─────────────────────────────────────────────────
elements.push(el_rect("r_ai", X_AI, Y_COL, W_AI, H_SOL,
  C.purple.stroke, C.purple.bg));
elements.push(el_text("t_ai_h", X_AI, Y_COL + 10, W_AI,
  "🤖  AI RESEARCH AGENT", 18, "center", C.purple.stroke));
elements.push(el_text("t_ai_s", X_AI, Y_COL + 40, W_AI,
  "OpenAI gpt-4o-mini + web_search_preview · autonomous internet research", 12, "center", "#6741d9"));

const STEP_Y0 = Y_COL + 80;
const steps = [
  { id: "s1", label: "① CONTRACTOR DUE DILIGENCE",
    body: "goszakup.gov.kz · kgd.gov.kz · stat.gov.kz · sud.kz\nPast contracts · violations · tax debt · court cases · blacklist" },
  { id: "s2", label: "② GLOBAL BENCHMARKS",
    body: "worldbank.org · adb.org · scholar.google.com\nSimilar projects worldwide · costs · outcomes · lessons learned" },
  { id: "s3", label: "③ BUDGET REASONABLENESS CHECK",
    body: "Proposed vs market average · deviation % · cost/unit\nVerdict: Fair Price ✓  /  Inflated ⚠  /  Underfunded ⚠" },
  { id: "s4", label: "④ SWOT + RISK SCORE  0 – 100",
    body: "Strengths · Weaknesses · Opportunities · Threats\nLOW_RISK (<30) · MEDIUM_RISK (30-60) · HIGH_RISK (>60)" },
];

steps.forEach((s, i) => {
  const sy = STEP_Y0 + i * (H_STEP + 4);
  elements.push(el_rect(`r_${s.id}`, X_AI + 12, sy, W_AI - 24, H_STEP,
    C.purpSub.stroke, C.purpSub.bg, 0, false));
  elements.push(el_text(`t_${s.id}_h`, X_AI + 18, sy + 8, W_AI - 36,
    s.label, 13, "left", C.purple.stroke));
  elements.push(el_text(`t_${s.id}_b`, X_AI + 18, sy + 30, W_AI - 36,
    s.body, 11, "left", "#6741d9"));
});

// ─────────────────────────────────────────────────
// 6. DATA FLOW ANNOTATIONS
// ─────────────────────────────────────────────────
// Arrow: AI → treasury page (dashed, returns research report)
elements.push(el_arrow("a_ai_treas",
  X_AI + W_AI / 2, Y_COL,
  X_LEFT + 4 * PW + PW / 2, Y_FRONTEND + H_FRONTEND,
  C.purple.stroke, true));
elements.push(el_text("t_ai_return", X_AI + W_AI / 2 + 10, Y_COL - 30, 180,
  "SWOT report →\ncitizens vote with data", 10, "left", C.purple.stroke));

// ─────────────────────────────────────────────────
// 7. DEPLOYMENT BAR
// ─────────────────────────────────────────────────
const Y_DEP = Y_COL + H_SOL + 40;
elements.push(el_rect("r_dep", X_LEFT, Y_DEP, CW - X_LEFT * 2, H_DEPLOY,
  C.grayDark.stroke, C.grayDark.bg));
elements.push(el_text("t_dep_h", X_LEFT, Y_DEP + 10, CW - X_LEFT * 2,
  "🖥️  DEPLOYMENT ARCHITECTURE", 16, "center", C.grayDark.stroke));
elements.push(el_text("t_dep_1", X_LEFT, Y_DEP + 38, CW - X_LEFT * 2,
  "74.208.191.110 (Ubuntu 24.04 LTS · 7.7 GB RAM · 232 GB SSD)   nginx reverse proxy  →  PM2 process manager  →  Next.js 14  (port 3000)  ·  Node.js 20",
  13, "center", "#343a40"));
elements.push(el_text("t_dep_2", X_LEFT, Y_DEP + 66, CW - X_LEFT * 2,
  "GitHub: github.com/bogachev-alex/city-dao                Demo: http://74.208.191.110",
  13, "center", "#495057"));
elements.push(el_text("t_dep_3", X_LEFT, Y_DEP + 90, CW - X_LEFT * 2,
  "Deploy flow:  npm run build  →  rsync  →  npm install + build on server  →  pm2 restart amanat",
  11, "center", "#868e96"));

// ─────────────────────────────────────────────────
// OUTPUT
// ─────────────────────────────────────────────────
const doc = {
  type: "excalidraw",
  version: 2,
  source: "https://excalidraw.com",
  elements,
  appState: {
    gridSize: null,
    viewBackgroundColor: "#ffffff"
  },
  files: {}
};

const fs = require('fs');
const out = JSON.stringify(doc, null, 2);
fs.writeFileSync('ARCHITECTURE.excalidraw', out);
console.log(`Written ARCHITECTURE.excalidraw — ${elements.length} elements`);
