import { PARTY_ORDER, DEFAULT_POLL_DATA, DEFAULT_SAMPLE_COUNT } from "./constants.js";

// pollData is mutated in place as sliders move, so it needs its own deep
// copy rather than referencing DEFAULT_POLL_DATA directly - otherwise the
// "reset to default" snapshot would drift along with live edits.
export const pollData = PARTY_ORDER.reduce((acc, party) => {
  acc[party] = { ...DEFAULT_POLL_DATA[party] };
  return acc;
}, {});

let currentSampleCount = DEFAULT_SAMPLE_COUNT;

// Loads a preset's values/sigmas into pollData in place, same as
// resetPollDataToDefaults, but from an arbitrary { party: {value, sigma} }
// source (the hardcoded default or a live dawum.de preset).
export function applyPollPreset(data) {
  PARTY_ORDER.forEach((party) => {
    pollData[party].value = data[party].value;
    pollData[party].sigma = data[party].sigma;
  });
}

export function getSampleCount() {
  return currentSampleCount;
}

export function setSampleCount(n) {
  currentSampleCount = n;
}

// --- sum-to-100 percentage constraint -------------------------------------
//
// Sliders move independently and are allowed to sum to anything while being
// dragged - redistributing the other parties live made it hard to dial in
// an exact target value, since every other slider kept jumping around.
// Normalization (dividing everything by the current sum) only happens once,
// explicitly, when "Speichern" is clicked.

export function normalizeValues() {
  const sum = PARTY_ORDER.reduce((s, p) => s + pollData[p].value, 0);
  if (sum <= 0) return;
  PARTY_ORDER.forEach((p) => {
    pollData[p].value = (pollData[p].value / sum) * 100;
  });
}

export function resetPollDataToDefaults() {
  applyPollPreset(DEFAULT_POLL_DATA);
  currentSampleCount = DEFAULT_SAMPLE_COUNT;
}
