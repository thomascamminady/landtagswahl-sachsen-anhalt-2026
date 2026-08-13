export const PARTY_ORDER = ["AfD", "CDU", "Linke", "SPD", "Grüne", "BSW", "Sonstige"];
export const NAMED_PARTIES = PARTY_ORDER.filter((p) => p !== "Sonstige");

export const PARTY_COLORS = {
  AfD: "#469CDA",
  CDU: "#000000",
  Linke: "#EA33F7",
  SPD: "#EA3323",
  Grüne: "#377E22",
  BSW: "#712A4F",
  Sonstige: "#C0C0C0",
};

// CDU's party color is black, so darkening it for the uncertainty line would
// just give black-on-black with no visible contrast - use gray instead.
export const UNCERTAINTY_COLOR_OVERRIDES = {
  CDU: "#9e9e9e",
};

export const HUERDE = 5.0;
export const AFD_MAJORITY_THRESHOLD = 50.0;
export const AFD_MAJORITY_HIGHLIGHT_COLOR = "#fcff00";

export const DEFAULT_SAMPLE_COUNT = 400;

// dawum.de documents its own "Fehlertoleranz" (error tolerance) formula for
// these bars: 1 + sqrt(Umfragewert / 10). It's their own simplified,
// generalized heuristic for the statistical uncertainty of a poll result -
// conceptually closer to a standard error/margin of error on the estimate
// than a standard deviation of individual responses, and explicitly not a
// rigorous confidence interval. We use it as-is for the initial values.
export const DEFAULT_POLL_DATA = {
  AfD: { value: 41.0, sigma: 3.0 },
  CDU: { value: 24.0, sigma: 2.5 },
  Linke: { value: 13.0, sigma: 2.1 },
  SPD: { value: 7.0, sigma: 1.8 },
  Grüne: { value: 5.0, sigma: 1.7 },
  BSW: { value: 4.0, sigma: 1.6 },
  Sonstige: { value: 6.0, sigma: 1.8 },
};

// Displayed in the chart title/footer and used as the always-available
// fallback entry in the poll-preset dropdown, so the app still works with a
// sensible default even if the live dawum.de fetch fails or is slow.
export const DEFAULT_POLL_META = {
  id: "default",
  label: "Infratest dimap – 30.07.2026",
  sourceUrl: "https://dawum.de/Sachsen-Anhalt/Infratest_dimap/2026-07-30/",
};

// dawum.de's compact endpoint: one entry per institute/parliament, already
// reduced to each institute's most recent survey. CORS is open
// (access-control-allow-origin: *), so this is fetchable straight from the
// browser - no backend or scheduled job needed to keep it current.
export const DAWUM_API_URL = "https://api.dawum.de/newest_surveys.json";
export const DAWUM_PARLIAMENT_ID = "14"; // Sachsen-Anhalt

// Institutes stop reappearing in the "newest surveys" feed once they stop
// polling a state, so old entries (e.g. from 2018) linger there forever.
// Only offer presets recent enough to be a plausible current snapshot.
export const DAWUM_MAX_AGE_DAYS = 90;
