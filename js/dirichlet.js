import { PARTY_ORDER, NAMED_PARTIES, HUERDE } from "./constants.js";
import { pollData } from "./pollState.js";

// --- Dirichlet sampling (method-of-moments alpha + Marsaglia-Tsang gamma) --

function randomNormal() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function randomGamma(shape) {
  if (shape < 1) {
    const u = Math.random();
    return randomGamma(1 + shape) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x;
    let v;
    do {
      x = randomNormal();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function sampleDirichlet(alpha) {
  const gammas = alpha.map((a) => randomGamma(a));
  const sum = gammas.reduce((s, g) => s + g, 0);
  return gammas.map((g) => g / sum);
}

// The method-of-moments estimate below only holds when the stated variance
// is smaller than p*(1-p) - a party dragged near 0% or 100% while its sigma
// stays non-trivial (both freely draggable in "Prognose ändern", with no
// cross-validation between them) breaks that assumption and can push the
// averaged alpha0 to zero or negative. An alpha of 0 for every party makes
// every sampled outcome collapse to 0/0 = NaN, which the 5%-hurdle filter
// then silently turns into "every party gets 0%" instead of visibly failing.
// Flooring alpha0 keeps the distribution well-defined (very spread out)
// instead of degenerate.
const MIN_ALPHA0 = 1;

function computeAlpha() {
  const p = PARTY_ORDER.map((party) => pollData[party].value / 100);
  const variance = PARTY_ORDER.map((party) => (pollData[party].sigma / 100) ** 2);
  const alpha0Estimates = p.map((pi, i) => (pi * (1 - pi)) / variance[i] - 1);
  const rawAlpha0 = alpha0Estimates.reduce((s, v) => s + v, 0) / alpha0Estimates.length;
  const alpha0 = Math.max(rawAlpha0, MIN_ALPHA0);
  return p.map((pi) => pi * alpha0);
}

export function sampleOutcomes(nSamples) {
  const alpha = computeAlpha();
  const outcomes = [];

  for (let i = 0; i < nSamples; i++) {
    const draw = sampleDirichlet(alpha).map((x) => x * 100);
    const named = NAMED_PARTIES.map((party) => draw[PARTY_ORDER.indexOf(party)]);
    const surviving = named.map((v) => (v >= HUERDE ? v : 0));
    const total = surviving.reduce((s, v) => s + v, 0);
    const renormalized = surviving.map((v) => (total > 0 ? (v / total) * 100 : 0));

    const outcome = {};
    NAMED_PARTIES.forEach((party, idx) => {
      outcome[party] = renormalized[idx];
    });
    outcomes.push(outcome);
  }
  return outcomes;
}
