/**
 * Generates ARCHITECTURE.excalidraw from PRD spec
 * 8 modules, all user types, full data flows
 */
'use strict';
const fs = require('fs');
let _s = 1;
const ns = () => _s++;

function R(id, x, y, w, h, stroke, bg, rough=0) {
  return {
    id, type:"rectangle", x, y, width:w, height:h,
    strokeColor:stroke, backgroundColor:bg,
    fillStyle:"solid", strokeWidth:2, strokeStyle:"solid",
    roughness:rough, opacity:100, angle:0, groupIds:[],
    roundness:{type:3,value:16},
    seed:ns(), version:1, versionNonce:ns(),
    isDeleted:false, boundElements:null, updated:1, link:null, locked:false
  };
}

function T(id, x, y, w, txt, size, align="center", color="#1e1e1e") {
  const lines = (txt.match(/\n/g)||[]).length + 1;
  return {
    id, type:"text", x, y, width:w, height:Math.ceil(lines*size*1.35),
    strokeColor:color, backgroundColor:"transparent",
    fillStyle:"hachure", strokeWidth:1, strokeStyle:"solid",
    roughness:0, opacity:100, angle:0, groupIds:[],
    roundness:null,
    seed:ns(), version:1, versionNonce:ns(),
    isDeleted:false, boundElements:null, updated:1, link:null, locked:false,
    text:txt, fontSize:size, fontFamily:1,
    textAlign:align, verticalAlign:"top", baseline:Math.round(size*0.8)
  };
}

function A(id, x1, y1, x2, y2, color="#495057", dashed=false) {
  return {
    id, type:"arrow", x:x1, y:y1,
    width:Math.abs(x2-x1), height:Math.abs(y2-y1),
    strokeColor:color, backgroundColor:"transparent",
    fillStyle:"hachure", strokeWidth:2,
    strokeStyle:dashed?"dashed":"solid",
    roughness:0, opacity:100, angle:0, groupIds:[],
    roundness:{type:2,value:16},
    seed:ns(), version:1, versionNonce:ns(),
    isDeleted:false, boundElements:null, updated:1, link:null, locked:false,
    points:[[0,0],[x2-x1,y2-y1]],
    lastCommittedPoint:null, startBinding:null, endBinding:null,
    startArrowhead:null, endArrowhead:"arrow"
  };
}

// COLORS
const C = {
  amber:  {bg:"#fff3bf", s:"#e67700"},
  green:  {bg:"#ebfbee", s:"#2f9e44"},
  teal:   {bg:"#e6fcf5", s:"#0ca678"},
  blue:   {bg:"#dbe4ff", s:"#4263eb"},
  lblue:  {bg:"#e7f5ff", s:"#1c7ed6"},
  violet: {bg:"#f3f0ff", s:"#7048e8"},
  purple: {bg:"#f8f0fc", s:"#9c36b5"},
  orange: {bg:"#fff4e6", s:"#e8590c"},
  red:    {bg:"#fff5f5", s:"#c92a2a"},
  gray:   {bg:"#f8f9fa", s:"#868e96"},
  dark:   {bg:"#f1f3f5", s:"#495057"},
  indigo: {bg:"#edf2ff", s:"#3b5bdb"},
};

const E = [];

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const ML  = 90;           // margin left
const CW  = 2020;         // content width
const R_  = ML + CW;      // 2110 right edge

// Layer Y positions
const Y_TITLE  = 12;
const Y_ACT = 65;   const H_ACT = 135;
const Y_FE  = 265;  const H_FE  = 310;
const Y_BC  = 640;  const H_BC  = 490;
const Y_EXT = 1155; const H_EXT = 115;

// Blockchain column geometry
const SOL_X = ML;         const SOL_W = 660;
const EXT_X = ML+680;     const EXT_W = 420;
const AI_X  = ML+680+440; const AI_W  = R_-(ML+680+440); // 900

// ═══════════════════════════════════════════════════════════════
// TITLE
// ═══════════════════════════════════════════════════════════════
E.push(T("ttl", ML+200, Y_TITLE, 1600,
  "STRAITA — Target Architecture  |  City DAO on Solana  |  Almaty, Kazakhstan",
  22, "center", "#1c7ed6"));

// ═══════════════════════════════════════════════════════════════
// LAYER 1 — PARTICIPANTS
// ═══════════════════════════════════════════════════════════════
E.push(R("bg_act", ML, Y_ACT, CW, H_ACT, C.dark.s, C.dark.bg));
E.push(T("lbl_act", ML, Y_ACT+3, CW, "PARTICIPANTS  &  ROLES", 11, "center", C.dark.s));

const ACTORS = [
  { id:"vis",  icon:"👁", name:"VISITOR",
    sub:"No wallet required\nRead-only: all public data\nMap, contracts, analytics",
    c: C.gray },
  { id:"cit",  icon:"🪪", name:"CITIZEN  (SBT Holder)",
    sub:"Phantom / Backpack wallet\nTier 0 (rep 0-49): vote + jury\nT1 Bronze → T2 Silver → T3 Gold\nIIN hashed client-side only",
    c: C.green },
  { id:"exp",  icon:"🔬", name:"EXPERT",
    sub:"Licensed construction engineer\n500,000 ₸ stake required\n2× jury vote weight\nPublic history on-chain",
    c: C.teal },
  { id:"con",  icon:"🏗️",  name:"CONTRACTOR",
    sub:"Registered ТОО\nDaily work log updates\nGPS photo validation\nReputation score: AAA→BLACKLIST",
    c: C.amber },
  { id:"aki",  icon:"🏛️",  name:"AKIMAT  (Admin)",
    sub:"Government wallet\nRegister contracts on-chain\nSet milestones + budgets\nTerminate if penalty hits 30%",
    c: C.indigo },
];

const AW = Math.floor((CW-80)/5);
ACTORS.forEach((a,i) => {
  const ax = ML+40 + i*(AW+10);
  E.push(R(`bg_a${a.id}`, ax, Y_ACT+18, AW, H_ACT-26, a.c.s, a.c.bg));
  E.push(T(`h_a${a.id}`, ax+6, Y_ACT+22, AW-12, `${a.icon}  ${a.name}`, 13, "center", a.c.s));
  E.push(T(`b_a${a.id}`, ax+8, Y_ACT+44, AW-16, a.sub, 10, "left", "#333"));
});

// ═══════════════════════════════════════════════════════════════
// LAYER 2 — NEXT.JS FRONTEND
// ═══════════════════════════════════════════════════════════════
E.push(R("bg_fe", ML, Y_FE, CW, H_FE, C.green.s, C.green.bg));
E.push(T("h_fe", ML, Y_FE+3, CW,
  "NEXT.JS 14  FRONTEND  (TypeScript · Tailwind CSS · Leaflet · @solana/wallet-adapter · Vercel AI SDK)",
  13, "center", C.green.s));

const MODULES = [
  { id:"m1",  badge:"M1+M7", color: C.lblue,
    title:"CONTRACT\nREGISTRY + WORK LOG",
    pages:"/ — Almaty map, colored pins\n/contracts — list, filters, search\n/contracts/[id] — full detail\n/contracts/[id]/log — activity feed\n/contracts/[id]/board — Kanban\n/contracts/[id]/analytics — charts" },
  { id:"m2",  badge:"M2", color: C.green,
    title:"CITIZEN\nREGISTRY",
    pages:"/register — wallet + IIN hash\n/profile — rep score, NFT badges\nSoulbound Token display\nTier progression (T0→T3)\nJury + voting history" },
  { id:"m3",  badge:"M3", color: C.teal,
    title:"JURY\nMECHANISM",
    pages:"/jury/[session_id]\nPhase 1: Commit UI (48h)\nvote = hash(vote+salt)\nPhase 2: Reveal UI (24h)\nVerdict + rep + reward" },
  { id:"m45", badge:"M4+M5", color: C.amber,
    title:"PENALTY ENGINE\n+ DISTRICT TREASURY",
    pages:"/treasury/[district]\nLive penalty counter\nAuto-trigger display\nSpending proposals feed\nDAO vote UI (1 person = 1 vote)" },
  { id:"m68", badge:"M6+M8", color: C.purple,
    title:"CITY FEATURES\n+ SUGGESTIONS",
    pages:"/city — project backlog\n/city/vote — quadratic voting\n/city/suggest — citizen feed\n/city/suggest/new — submit\nAI Research Report panel" },
  { id:"m7a", badge:"M7+ADM", color: C.orange,
    title:"CONTRACTOR\nPORTAL + ADMIN",
    pages:"/contractors — leaderboard (AAA→C)\n/contractors/[id] — full profile\n/admin — akimat panel\nGPS validator, blocker reports\n/city/results — funded projects" },
];

const MW = Math.floor((CW-60)/6);
const MH  = 255;
const MY  = Y_FE + 38;
MODULES.forEach((m,i) => {
  const mx = ML+30 + i*(MW+8);
  E.push(R(`bg_m${m.id}`, mx, MY, MW, MH, m.color.s, m.color.bg, 0));
  E.push(T(`badge_m${m.id}`, mx+4, MY+5, MW-8,  m.badge, 10, "center", m.color.s));
  E.push(T(`h_m${m.id}`, mx+6, MY+20, MW-12, m.title, 12, "center", m.color.s));
  E.push(T(`b_m${m.id}`, mx+7, MY+68, MW-14, m.pages, 10, "left", "#333"));
});

// ═══════════════════════════════════════════════════════════════
// ARROWS — Actors → Frontend
// ═══════════════════════════════════════════════════════════════
// Citizen → Contract module
const citCX = ML+40 + 1*(AW+10) + AW/2;
E.push(A("a_cit_fe", citCX, Y_ACT+H_ACT, ML+30+1*(MW+8)+MW/2, Y_FE, C.green.s));

// Contractor → Contractor module
const conCX = ML+40 + 3*(AW+10) + AW/2;
E.push(A("a_con_fe", conCX, Y_ACT+H_ACT, ML+30+5*(MW+8)+MW/2, Y_FE, C.amber.s));

// Akimat → Admin module
const akiCX = ML+40 + 4*(AW+10) + AW/2;
E.push(A("a_aki_fe", akiCX, Y_ACT+H_ACT, ML+30+5*(MW+8)+MW/2+50, Y_FE, C.indigo.s));

// Expert → Jury module
const expCX = ML+40 + 2*(AW+10) + AW/2;
E.push(A("a_exp_fe", expCX, Y_ACT+H_ACT, ML+30+2*(MW+8)+MW/2, Y_FE, C.teal.s));

// ═══════════════════════════════════════════════════════════════
// ARROWS — Frontend → Blockchain layer
// ═══════════════════════════════════════════════════════════════
const FE_BOT = Y_FE + H_FE;

// Solana arrow (from contract + jury modules)
E.push(A("a_fe_sol", ML+30+MW/2, FE_BOT, SOL_X+SOL_W/2-60, Y_BC, C.lblue.s));
E.push(T("lbl_fe_sol", ML+30+MW/2+6, FE_BOT+8, 200, "Solana Web3.js\n+ Anchor Client", 11, "left", C.lblue.s));

// AI arrow (from city features module)
const citFeatCX = ML+30+4*(MW+8)+MW/2;
E.push(A("a_fe_ai", citFeatCX, FE_BOT, AI_X+AI_W/2, Y_BC, C.purple.s));
E.push(T("lbl_fe_ai", citFeatCX+6, FE_BOT+8, 200, "POST /api/research\nOpenAI API (agentic)", 11, "left", C.purple.s));

// ═══════════════════════════════════════════════════════════════
// LAYER 3 — BLOCKCHAIN  (3 columns)
// ═══════════════════════════════════════════════════════════════

// ── COLUMN A: SOLANA PROGRAMS ──────────────────────────────────
E.push(R("bg_sol", SOL_X, Y_BC, SOL_W, H_BC, C.lblue.s, C.lblue.bg));
E.push(T("h_sol", SOL_X, Y_BC+4, SOL_W, "⬡  SOLANA DEVNET  (Anchor · Rust)", 16, "center", C.lblue.s));
E.push(T("s_sol", SOL_X, Y_BC+28, SOL_W, "5 on-chain programs · devnet → mainnet · $0.00025/tx · 400ms finality", 11, "center", "#1864ab"));

const PROGS = [
  { id:"p1", badge:"M1", icon:"📋", name:"CONTRACT REGISTRY",
    body:"register_contract(title, amount, deadline, milestones)\nescrow 20% auto-locked · submit_milestone_completion\ntrigger_penalty · release_tranche · terminate_contract\nStatuses: Active→Disputed→Penalized→Completed" },
  { id:"p2", badge:"M2", icon:"🪪", name:"CITIZEN REGISTRY  +  SBT",
    body:"register_citizen(district, iin_hash)  ← hash client-side only\nis_eligible · update_reputation · ban_citizen\nSoulbound Token: non-transferable, Metaplex standard\nTier 0-3 by rep · Gold: penalty royalty 10%" },
  { id:"p3", badge:"M3", icon:"⚖️",  name:"JURY MECHANISM  (Commit-Reveal)",
    body:"initialize_jury_session · select_jury_vrf (Switchboard)\nPhase 1 commit_vote: hash(vote+salt) on-chain, 48h\nPhase 2 reveal_vote: verify hash, 24h\nExpert=2pts · threshold 3/5 · 2-2 tie→5-person jury" },
  { id:"p4", badge:"M4", icon:"⚡",  name:"PENALTY ENGINE",
    body:"check_deadline() — permissionless, anyone can call\n1%/day overdue · 10%/rejected milestone · 5%/ghost site\ncap at 30% of contract · auto-transfer to treasury\nFull audit trail: immutable, public, tamper-proof" },
  { id:"p5", badge:"M5", icon:"🏛️",  name:"DISTRICT TREASURY",
    body:"deposit() from Penalty Engine · balance per district\ncreate_proposal(title, amount, deadline)\nvote_on_proposal(for/against) · SBT holders only\nexecute_proposal: auto on quorum (5%) + simple majority" },
];

const PY0 = Y_BC + 68;
const PH  = 78; const PG = 6;
PROGS.forEach((p,i) => {
  const py = PY0 + i*(PH+PG);
  E.push(R(`bg_${p.id}`, SOL_X+14, py, SOL_W-28, PH, "#339af0","#e7f5ff",0));
  E.push(T(`badge_${p.id}`, SOL_X+18, py+4, SOL_W-36, `${p.badge}`, 9, "left", "#868e96"));
  E.push(T(`h_${p.id}`, SOL_X+18, py+4, SOL_W-36, `     ${p.icon}  ${p.name}`, 13, "left", C.lblue.s));
  E.push(T(`b_${p.id}`, SOL_X+18, py+24, SOL_W-36, p.body, 9.5, "left", "#1864ab"));
});

// Internal arrow: P4 → P5 (penalty funds)
const p4bot = PY0 + 3*(PH+PG) + PH;
const p5top = PY0 + 4*(PH+PG);
E.push(A("a_p4p5", SOL_X+SOL_W-24, p4bot-PH/2, SOL_X+SOL_W-24, p5top+PH/2, "#c92a2a"));
E.push(T("lbl_p4p5", SOL_X+SOL_W-80, (p4bot+p5top)/2-8, 60, "penalty\nfunds", 8, "center", "#c92a2a"));

// ── COLUMN B: SOLANA EXTENSIONS ──────────────────────────────
E.push(R("bg_ext", EXT_X, Y_BC, EXT_W, H_BC, C.violet.s, C.violet.bg));
E.push(T("h_ext", EXT_X, Y_BC+4, EXT_W, "SOLANA ECOSYSTEM", 16, "center", C.violet.s));
E.push(T("s_ext", EXT_X, Y_BC+28, EXT_W, "Native services & protocols", 11, "center", "#5f3dc4"));

const EXTS = [
  { id:"vrf",  icon:"🎲", name:"Switchboard VRF",
    body:"Verifiable random function\nOn-chain cryptographic proof\nJury selection: unpredictable\nSelected 24h before inspection\nPrevents contractor bribery" },
  { id:"meta", icon:"🖼️", name:"Metaplex  (NFTs + SBTs)",
    body:"Soulbound Token: non-transferable\nCitizen tier badges (Bronze/Silver/Gold)\nCity Builder NFT on funded proposal\nCompressed NFTs: 1M mints ≈ $50\nFair Judge + Whistleblower NFTs" },
  { id:"spl",  icon:"💰", name:"SPL Token + Escrow",
    body:"USDC-equivalent contract payments\n20% escrowed at registration\nTranche release: jury acceptance\nPenalty auto-deducted from escrow\nDistrict Treasury accumulates fines" },
];

const EY0 = Y_BC+68;
const EH  = 130;
EXTS.forEach((e,i) => {
  const ey = EY0 + i*(EH+10);
  E.push(R(`bg_e${e.id}`, EXT_X+12, ey, EXT_W-24, EH, C.violet.s, "#f3f0ff", 0));
  E.push(T(`h_e${e.id}`, EXT_X+18, ey+8, EXT_W-36, `${e.icon}  ${e.name}`, 13, "left", C.violet.s));
  E.push(T(`b_e${e.id}`, EXT_X+18, ey+28, EXT_W-36, e.body, 10, "left", "#5f3dc4"));
});

// Arrow: Jury → VRF
const juryMidY = PY0 + 2*(PH+PG) + PH/2;
E.push(A("a_jury_vrf", SOL_X+SOL_W, juryMidY, EXT_X, EY0+EH/2, "#7048e8"));
E.push(T("lbl_jvrf", SOL_X+SOL_W+4, juryMidY-12, 80, "VRF\nrequest", 9, "left", "#7048e8"));

// Arrow: Contract → IPFS (photo evidence)
const p1MidY = PY0 + PH/2;
E.push(A("a_c_ipfs", SOL_X+SOL_W, p1MidY, EXT_X, EY0+EH+10+EH/2, "#e8590c", true));
E.push(T("lbl_cipfs", SOL_X+SOL_W+4, p1MidY-12, 80, "photo\nhash", 9, "left", "#e8590c"));

// ── COLUMN C: AI RESEARCH AGENT ──────────────────────────────
E.push(R("bg_ai", AI_X, Y_BC, AI_W, H_BC, C.purple.s, C.purple.bg));
E.push(T("h_ai", AI_X, Y_BC+4, AI_W, "🤖  AI RESEARCH AGENT  —  Module 6", 16, "center", C.purple.s));
E.push(T("s_ai", AI_X, Y_BC+28, AI_W,
  "Claude Sonnet 4.5 (agentic mode)  ·  Vercel AI SDK  ·  Autonomous internet research before every vote",
  11, "center", "#6741d9"));

const STEPS = [
  { id:"s1", num:"①", name:"CONTRACTOR INTELLIGENCE",
    body:"goszakup.gov.kz — past contracts, on-time delivery rate\nkgd.gov.kz — tax debt check · stat.gov.kz — registry\nsud.kz — court cases and disputes\nOutput: violations count, blacklist status, related companies, red flags" },
  { id:"s2", num:"②", name:"BUDGET REASONABLENESS CHECK",
    body:"Market rate for similar work in Almaty (₸/sq.m, ₸/km, ₸/unit)\nGlobal benchmarks: World Bank data, ADB projects database\nDeviation %: +18% = Inflated ⚠ · -5% = Fair ✅ · -30% = Underfunded ⚠\nOutput: verdict + cost_per_unit + market_average comparison" },
  { id:"s3", num:"③", name:"GLOBAL EXAMPLES + LOCAL CONTEXT",
    body:"Similar projects: 3-5 worldwide (city, year, budget, outcome)\nSuccess / partial / failed — lessons learned, source URLs\nDistrict demographics: population, beneficiaries estimate\nResidents complaints from social media / egov.kz" },
  { id:"s4", num:"④", name:"SWOT  +  RISK SCORE  0–100",
    body:"Strengths · Weaknesses · Opportunities · Threats (4-quadrant)\nRisk Score < 30 → LOW_RISK: proceed to vote ✅\nRisk Score 31-60 → MEDIUM_RISK: flagged concerns shown ⚠\nRisk Score > 60 → HIGH_RISK: additional scrutiny required 🚨" },
];

const STY0 = Y_BC+68;
const STH  = 100; const STG = 6;
STEPS.forEach((s,i) => {
  const sy = STY0 + i*(STH+STG);
  E.push(R(`bg_st${s.id}`, AI_X+12, sy, AI_W-24, STH, "#cc5de8", "#f8f0fc", 0));
  E.push(T(`h_st${s.id}`, AI_X+18, sy+6, AI_W-36, `${s.num}  ${s.name}`, 13, "left", C.purple.s));
  E.push(T(`b_st${s.id}`, AI_X+18, sy+26, AI_W-36, s.body, 10, "left", "#6741d9"));
});

// Arrow: AI result → City Features (dashed — SWOT returned)
const citFX = ML+30+4*(MW+8)+MW/2;
E.push(A("a_ai_ret", AI_X+AI_W/2, Y_BC, citFX, FE_BOT, "#9c36b5", true));
E.push(T("lbl_ai_ret", AI_X+AI_W/2+6, Y_BC-28, 210, "← SWOT report → citizens vote with data", 10, "left", "#9c36b5"));

// ═══════════════════════════════════════════════════════════════
// LAYER 4 — EXTERNAL SERVICES
// ═══════════════════════════════════════════════════════════════
E.push(R("bg_svc", ML, Y_EXT, CW, H_EXT, C.orange.s, C.orange.bg));
E.push(T("h_svc", ML, Y_EXT+3, CW, "EXTERNAL SERVICES  &  DATA SOURCES", 11, "center", C.orange.s));

const SVCS = [
  { id:"ipfs",    icon:"📸", name:"IPFS / Arweave",
    body:"Contractor photo evidence\nGPS-verified, <24h freshness\nHash stored on-chain\nPermanent, censorship-resistant" },
  { id:"goszak",  icon:"🏢", name:"goszakup.gov.kz",
    body:"Public procurement open API\nContractor performance history\nAI research primary source\n147 Almaty projects tracked" },
  { id:"phantom", icon:"👛", name:"Phantom / Backpack Wallet",
    body:"@solana/wallet-adapter\nTransaction signing + approval\nDevnet SOL airdrop button\nMobile + browser extension" },
  { id:"helius",  icon:"🔍", name:"Helius RPC + Block Explorer",
    body:"High-performance Solana RPC\nReal-time transaction updates\nPublic audit trail (immutable)\nAll penalties visible on-chain" },
];

const SVW = Math.floor((CW-60)/4);
SVCS.forEach((sv,i) => {
  const sx = ML+30 + i*(SVW+10);
  E.push(R(`bg_sv${sv.id}`, sx, Y_EXT+18, SVW, H_EXT-26, C.orange.s, "#fff9db", 0));
  E.push(T(`h_sv${sv.id}`, sx+8, Y_EXT+24, SVW-16, `${sv.icon}  ${sv.name}`, 13, "left", C.orange.s));
  E.push(T(`b_sv${sv.id}`, sx+8, Y_EXT+44, SVW-16, sv.body, 10, "left", "#7c4a03"));
});

// Arrows: Blockchain → External
const bcBot = Y_BC + H_BC;
E.push(A("a_bc_ipfs",  SOL_X+SOL_W/2-80, bcBot, ML+30+SVW/2,          Y_EXT, "#e8590c", true));
E.push(A("a_bc_gosz",  AI_X+AI_W/2,      bcBot, ML+30+SVW+10+SVW/2,   Y_EXT, "#e8590c", true));
E.push(A("a_bc_rpc",   SOL_X+SOL_W/2+80, bcBot, ML+30+3*(SVW+10)+SVW/2, Y_EXT, "#868e96", true));

// ═══════════════════════════════════════════════════════════════
// LIFECYCLE SIDEBAR (right of diagram)
// ═══════════════════════════════════════════════════════════════
const LC_X = R_+24;
const LC_W = 230;
E.push(R("bg_lc", LC_X, Y_FE, LC_W, Y_EXT+H_EXT-Y_FE, "#495057", "#f1f3f5"));
E.push(T("h_lc", LC_X, Y_FE+6, LC_W, "CONTRACT\nLIFECYCLE", 13, "center", "#495057"));

const LC = [
  ["#1c7ed6", "① Akimat registers contract"],
  ["#1c7ed6", "② 20% auto-escrowed on-chain"],
  ["#2f9e44", "③ Contractor posts daily log"],
  ["#2f9e44", "④ GPS + photo validation"],
  ["#0ca678", "⑤ Milestone claim submitted"],
  ["#7048e8", "⑥ VRF selects jury (24h before)"],
  ["#7048e8", "⑦ Commit phase — 48h"],
  ["#7048e8", "⑧ Reveal phase — 24h"],
  ["#2f9e44", "⑨ Accept → tranche released ✅"],
  ["#c92a2a", "⑩ Reject → penalty deducted ⚡"],
  ["#c92a2a", "⑪ Funds → District Treasury"],
  ["#9c36b5", "⑫ Citizens vote on spending"],
  ["#e8590c", "⑬ Proposal researched by AI"],
  ["#3b5bdb", "⑭ Quadratic vote → funded"],
];
LC.forEach(([color, step], i) => {
  E.push(T(`lc_${i}`, LC_X+8, Y_FE+52+i*46, LC_W-16, step, 10, "left", color));
  // small divider line area
});

// ═══════════════════════════════════════════════════════════════
// PENALTY FORMULA CALLOUT
// ═══════════════════════════════════════════════════════════════
E.push(R("bg_formula", LC_X, Y_EXT-180, LC_W, 168, "#c92a2a", "#fff5f5"));
E.push(T("h_formula", LC_X, Y_EXT-176, LC_W, "⚡ PENALTY FORMULA", 12, "center", "#c92a2a"));
E.push(T("b_formula", LC_X+8, Y_EXT-154, LC_W-16,
  "Time:\n1% × days overdue\n\nQuality:\n10% × rejected milestones\n\nGhost site:\n5% × zero-worker days\n\nCAP: 30% of contract\n\n→ Auto to Treasury",
  10, "left", "#862e2e"));

// ═══════════════════════════════════════════════════════════════
// NFT COLLECTION CALLOUT
// ═══════════════════════════════════════════════════════════════
E.push(R("bg_nft", LC_X, Y_ACT, LC_W, Y_FE-Y_ACT-10, "#0ca678", "#e6fcf5"));
E.push(T("h_nft", LC_X, Y_ACT+4, LC_W, "🏅 NFT COLLECTION", 12, "center", "#0ca678"));
E.push(T("b_nft", LC_X+8, Y_ACT+24, LC_W-16,
  "🥉 Active Citizen  (rep ≥50)\n🥈 Trusted Citizen  (rep ≥150)\n🥇 Guardian  (rep ≥300)\n🏗️ City Builder  (funded)\n⚖️ Fair Judge  (10 juries)\n🚨 Whistleblower  (caught cheat)\n🏆 District Champion (monthly)",
  10, "left", "#087f5b"));

// ═══════════════════════════════════════════════════════════════
// OUTPUT
// ═══════════════════════════════════════════════════════════════
const doc = {
  type:"excalidraw", version:2, source:"https://excalidraw.com",
  elements:E,
  appState:{ gridSize:null, viewBackgroundColor:"#ffffff" },
  files:{}
};

fs.writeFileSync('ARCHITECTURE.excalidraw', JSON.stringify(doc, null, 2));
console.log(`✓ ARCHITECTURE.excalidraw — ${E.length} elements`);
