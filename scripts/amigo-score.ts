#!/usr/bin/env node
/**
 * amigo-score.ts — Zero-LLM-call scorecard for Three Amigos sessions.
 *
 * Reads .storyline/workbench/amigo-notes/*.md after Round 3, extracts deterministic
 * metrics (tier counts, new-catch detection, dissent markers, agreement overlap),
 * and writes .storyline/workbench/amigo-notes/scorecard.yaml. Purpose: tell the
 * user whether the session earned its tokens or was theater, and hard-gate the
 * handoff to Mister Gherkin when a sensitive aggregate was discussed without any
 * dissent.
 *
 * The metrics are intentionally cheap and noisy. v1 is an audit trail, not a gate,
 * except for the single RED trigger which fires on `dissent == 0 && new_catches == 0`
 * on a sensitive aggregate — false positives there make the gate LESS likely to
 * fire, which is the correct failure direction.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const NOTES_DIR = ".storyline/workbench/amigo-notes";
const OUTPUT_REL = join(NOTES_DIR, "scorecard.yaml");
const BLUEPRINT_PATH = ".storyline/blueprint.yaml";
const SESSION_ID_PATH = ".storyline/.session-id";

const AMIGO_FILES = ["product.md", "developer.md", "testing.md", "frontend.md", "security.md"];

const DISSENT_KEYWORDS = [
  "disagree", "disagreed", "pushback", "pushed back", "however", "not convinced",
  "challenge", "actually,", "not sure", "overstate", "overstates", "overstated",
  "oversell", "oversells", "wrong", "misses", "missed", "contra", "undersell",
  "undersells", "narrower", "broader", "conceded", "concede", "object", "objects",
  "counter", "counterproposal", "counter-proposal", "refute", "but\\b",
];

const SENSITIVITY_KEYWORDS = [
  "auth", "authentication", "authorization", "password", "token", "secret",
  "credential", "credentials", "payment", "payments", "billing", "money",
  "pii", "personal data", "gdpr", "hipaa", "medical", "ssn", "session",
  "permission", "permissions", "role", "roles", "admin", "privileged",
];

const TIER_SHIFT_KEYWORDS = [
  "promoted", "demoted", "re-tier", "retier", "move to", "moved to",
  "shifted", "downgrade", "downgraded", "upgrade", "upgraded",
];

// Stopwords for stem-based overlap. Deliberately aggressive — we want signal,
// not vocabulary.
const STOPWORDS = new Set([
  "the", "this", "that", "these", "those", "with", "from", "into", "about",
  "than", "then", "when", "what", "where", "which", "while", "would", "should",
  "could", "will", "have", "been", "being", "does", "their", "there", "them",
  "they", "your", "yours", "ours", "just", "also", "like", "more", "most",
  "some", "such", "only", "other", "every", "round", "amigo", "amigos",
  "must", "address", "consider", "noted", "finding", "findings", "top",
  "question", "questions", "react", "others", "response", "responses", "why",
]);

interface AmigoScore {
  r1_must_address_count: number;
  r1_should_count: number;
  r1_noted_count: number;
  r1_must_caps_ok: boolean; // 3–6 is the target
  r2_react_word_count: number;
  r2_new_catches: number;
  r2_tier_shifts: number;
  peer_mentions: number;
  user_mentions: number;
  dissent_markers: number;
  r3_responses: number;
  r3_empty: boolean;
}

interface BlueprintSignals {
  contexts_touched: number;
  aggregates_touched: number;
  sensitive_aggregate_hit: boolean;
  sensitive_aggregates_named: string[];
  detection_source: "blueprint" | "keyword-fallback" | "both" | "none";
}

function splitRounds(content: string): { r1: string; r2: string; r3: string } {
  const r2Match = content.match(/^## React to Others/m);
  const r3Match = content.match(/^## Round 3/m);
  const r2Idx = r2Match?.index ?? -1;
  const r3Idx = r3Match?.index ?? -1;

  const r1 = r2Idx === -1 ? content : content.slice(0, r2Idx);
  const r2 = r2Idx === -1 ? "" : r3Idx === -1 ? content.slice(r2Idx) : content.slice(r2Idx, r3Idx);
  const r3 = r3Idx === -1 ? "" : content.slice(r3Idx);
  return { r1, r2, r3 };
}

function bulletsUnder(section: string | undefined): string[] {
  if (!section) return [];
  return section
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.startsWith("-") || l.startsWith("*"))
    .map(l => l.replace(/^[-*]\s*/, ""));
}

function extractTiers(r1: string): { must: string[]; should: string[]; noted: string[] } {
  const mustMatch = r1.match(/###\s*Must Address\s*\n([\s\S]*?)(?=\n###|\n##|$)/i);
  const shouldMatch = r1.match(/###\s*Should Consider\s*\n([\s\S]*?)(?=\n###|\n##|$)/i);
  const notedMatch = r1.match(/###\s*Noted\s*\n([\s\S]*?)(?=\n###|\n##|$)/i);
  return {
    must: bulletsUnder(mustMatch?.[1]),
    should: bulletsUnder(shouldMatch?.[1]),
    noted: bulletsUnder(notedMatch?.[1]),
  };
}

function stems(text: string): Set<string> {
  const out = new Set<string>();
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w));
  for (const w of words) {
    out.add(w.replace(/(ing|ed|es|s)$/, ""));
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersect = 0;
  for (const x of a) if (b.has(x)) intersect++;
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

function countKeywordMatches(text: string, keywords: string[]): number {
  const lc = text.toLowerCase();
  let count = 0;
  for (const kw of keywords) {
    // kw may already contain regex anchors like \b; otherwise treat as literal
    const safe = kw.includes("\\b") ? kw : kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${safe}\\b`, "g");
    const m = lc.match(re);
    if (m) count += m.length;
  }
  return count;
}

function readFileOrNull(path: string): string | null {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

function scoreAmigo(content: string): { score: AmigoScore; mustStems: Set<string> } {
  const { r1, r2, r3 } = splitRounds(content);
  const tiers = extractTiers(r1);

  // R1 aggregate stems (for new-catch detection against R2)
  const r1Stems = new Set<string>();
  for (const item of [...tiers.must, ...tiers.should, ...tiers.noted]) {
    for (const s of stems(item)) r1Stems.add(s);
  }

  const mustStems = new Set<string>();
  for (const item of tiers.must) {
    for (const s of stems(item)) mustStems.add(s);
  }

  // R2 new catches: bullets in R2 with <50% stem overlap against R1 aggregate
  const r2Bullets = bulletsUnder(r2.replace(/^## React to Others.*?\n/i, ""));
  let newCatches = 0;
  for (const b of r2Bullets) {
    const bStems = stems(b);
    if (bStems.size === 0) continue;
    let overlap = 0;
    for (const s of bStems) if (r1Stems.has(s)) overlap++;
    if (overlap / bStems.size < 0.5) newCatches++;
  }

  const r2Words = r2.split(/\s+/).filter(Boolean).length;
  const tierShifts = countKeywordMatches(r2, TIER_SHIFT_KEYWORDS);

  const allText = `${r1}\n${r2}\n${r3}`;
  const peerMentions = allText.match(/@(product|developer|testing|frontend|security)-amigo/gi)?.length ?? 0;
  const userMentions = allText.match(/@user\b/gi)?.length ?? 0;
  const dissent = countKeywordMatches(r2, DISSENT_KEYWORDS);

  const r3Empty = /no @mentions for me/i.test(r3);
  const r3Responses = r3Empty ? 0 : (r3.match(/\*\*@[a-z]+-amigo/gi)?.length ?? 0);

  const mustCount = tiers.must.length;

  return {
    score: {
      r1_must_address_count: mustCount,
      r1_should_count: tiers.should.length,
      r1_noted_count: tiers.noted.length,
      r1_must_caps_ok: mustCount >= 3 && mustCount <= 6,
      r2_react_word_count: r2Words,
      r2_new_catches: newCatches,
      r2_tier_shifts: tierShifts,
      peer_mentions: peerMentions,
      user_mentions: userMentions,
      dissent_markers: dissent,
      r3_responses: r3Responses,
      r3_empty: r3Empty,
    },
    mustStems,
  };
}

function scanBlueprint(cwd: string, allText: string): BlueprintSignals {
  const bpPath = join(cwd, BLUEPRINT_PATH);
  const lc = allText.toLowerCase();

  if (!existsSync(bpPath)) {
    const keywordHit = countKeywordMatches(allText, SENSITIVITY_KEYWORDS) >= 3;
    return {
      contexts_touched: 0,
      aggregates_touched: 0,
      sensitive_aggregate_hit: keywordHit,
      sensitive_aggregates_named: [],
      detection_source: keywordHit ? "keyword-fallback" : "none",
    };
  }

  let bp: any;
  try {
    bp = parseYaml(readFileSync(bpPath, "utf-8"));
  } catch {
    return {
      contexts_touched: 0,
      aggregates_touched: 0,
      sensitive_aggregate_hit: false,
      sensitive_aggregates_named: [],
      detection_source: "none",
    };
  }

  const contexts: any[] = bp?.bounded_contexts ?? [];
  const sensitiveNames: string[] = [];
  const allAggNames: string[] = [];

  for (const ctx of contexts) {
    for (const agg of (ctx?.aggregates ?? [])) {
      if (!agg?.name) continue;
      allAggNames.push(agg.name);
      if (agg.sensitive === true) sensitiveNames.push(agg.name);
    }
  }

  // Which sensitive aggregates show up in the notes, by name?
  const namedHit = sensitiveNames.filter(n => lc.includes(n.toLowerCase()));
  const keywordHit = countKeywordMatches(allText, SENSITIVITY_KEYWORDS) >= 3;

  let detection: BlueprintSignals["detection_source"];
  if (namedHit.length > 0 && keywordHit) detection = "both";
  else if (namedHit.length > 0) detection = "blueprint";
  else if (keywordHit) detection = "keyword-fallback";
  else detection = "none";

  // Aggregates "touched" by this session = any aggregate name mentioned in notes
  const touchedAggs = allAggNames.filter(n => lc.includes(n.toLowerCase()));
  const touchedCtxs = contexts.filter((c: any) =>
    (c?.aggregates ?? []).some((a: any) => touchedAggs.includes(a?.name))
  );

  return {
    contexts_touched: touchedCtxs.length,
    aggregates_touched: touchedAggs.length,
    sensitive_aggregate_hit: detection !== "none",
    sensitive_aggregates_named: namedHit,
    detection_source: detection,
  };
}

function readSessionId(cwd: string): string {
  const p = join(cwd, SESSION_ID_PATH);
  if (!existsSync(p)) return "unknown";
  return readFileSync(p, "utf-8").trim() || "unknown";
}

function main(): void {
  const cwd = process.cwd();
  const notesDir = join(cwd, NOTES_DIR);

  if (!existsSync(notesDir)) {
    console.error(`amigo-score: notes directory not found at ${NOTES_DIR}`);
    console.error("Run a three amigos session first.");
    process.exit(1);
  }

  const amigos: Record<string, AmigoScore> = {};
  const mustStemsByAmigo: Record<string, Set<string>> = {};
  let allText = "";

  for (const fileName of AMIGO_FILES) {
    const filePath = join(notesDir, fileName);
    const content = readFileOrNull(filePath);
    if (content === null) continue;
    const amigoName = fileName.replace(".md", "");
    const { score, mustStems } = scoreAmigo(content);
    amigos[amigoName] = score;
    mustStemsByAmigo[amigoName] = mustStems;
    allText += "\n" + content;
  }

  if (Object.keys(amigos).length === 0) {
    console.error(`amigo-score: no amigo notes found in ${NOTES_DIR}`);
    process.exit(1);
  }

  // Agreement overlap: pairwise Jaccard on Must Address stems
  const names = Object.keys(mustStemsByAmigo);
  let overlapSum = 0;
  let pairs = 0;
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      overlapSum += jaccard(mustStemsByAmigo[names[i]], mustStemsByAmigo[names[j]]);
      pairs++;
    }
  }
  const agreementOverlap = pairs === 0 ? 0 : Number((overlapSum / pairs).toFixed(2));

  const scores = Object.values(amigos);
  const totalNewCatches = scores.reduce((s, a) => s + a.r2_new_catches, 0);
  const totalDissent = scores.reduce((s, a) => s + a.dissent_markers, 0);
  const totalPeer = scores.reduce((s, a) => s + a.peer_mentions, 0);
  const totalUser = scores.reduce((s, a) => s + a.user_mentions, 0);
  const totalTierShifts = scores.reduce((s, a) => s + a.r2_tier_shifts, 0);
  const peerUserRatio =
    totalUser === 0
      ? (totalPeer === 0 ? 0 : 99)
      : Number((totalPeer / totalUser).toFixed(2));

  const bp = scanBlueprint(cwd, allText);

  // Verdict
  let rating: "GREEN" | "YELLOW" | "RED";
  const reasons: string[] = [];
  let hardGate = false;
  let hardGateReason: string | null = null;

  if (bp.sensitive_aggregate_hit && totalDissent === 0 && totalNewCatches === 0) {
    rating = "RED";
    hardGate = true;
    hardGateReason =
      "Sensitive aggregate touched with zero dissent and zero new catches in Round 2 — the exact shape of a groupthink failure. Refusing Mister Gherkin handoff.";
    reasons.push(hardGateReason);
  } else if (totalNewCatches >= 3 && totalDissent >= 3 && agreementOverlap < 0.7) {
    rating = "GREEN";
    reasons.push(`${totalNewCatches} new catches in Round 2 across amigos`);
    reasons.push(`${totalDissent} dissent markers; agreement overlap ${agreementOverlap}`);
    reasons.push(`peer:user mention ratio ${peerUserRatio}`);
  } else {
    rating = "YELLOW";
    if (totalNewCatches < 3) reasons.push(`only ${totalNewCatches} new catches in Round 2 (target ≥ 3)`);
    if (totalDissent < 3) reasons.push(`only ${totalDissent} dissent markers (target ≥ 3)`);
    if (agreementOverlap >= 0.7) {
      reasons.push(`high agreement overlap ${agreementOverlap} — possible groupthink`);
    }
    if (bp.sensitive_aggregate_hit) {
      reasons.push("sensitive aggregate touched — review scorecard before handoff");
    }
  }

  const scorecard = {
    session_id: readSessionId(cwd),
    generated_at: new Date().toISOString(),
    blueprint_signals: bp,
    amigos,
    session_totals: {
      total_new_catches: totalNewCatches,
      total_dissent: totalDissent,
      total_tier_shifts: totalTierShifts,
      peer_to_user_ratio: peerUserRatio,
      agreement_overlap: agreementOverlap,
    },
    verdict: {
      rating,
      reasons,
      hard_gate: { triggered: hardGate, reason: hardGateReason },
    },
    cost_estimate: {
      prompt_caching_verified: "unknown",
      note: "Until verified in the plugin's sub-agent dispatch code, all amigo token-cost estimates are off by an unknown factor.",
    },
  };

  const outPath = join(cwd, OUTPUT_REL);
  writeFileSync(outPath, stringifyYaml(scorecard));

  // One-line stdout summary
  console.log(
    `[amigo-score] ${rating}  new_catches=${totalNewCatches}  dissent=${totalDissent}  overlap=${agreementOverlap}  peer:user=${peerUserRatio}`,
  );
  if (hardGate) {
    console.log(`[amigo-score] HARD GATE: ${hardGateReason}`);
  }
  console.log(`[amigo-score] Written to ${OUTPUT_REL}`);

  // Exit code: 0 for GREEN/YELLOW, 2 for RED hard gate
  process.exit(hardGate ? 2 : 0);
}

main();
