import { PARTY_ORDER, DAWUM_API_URL, DAWUM_PARLIAMENT_ID, DAWUM_MAX_AGE_DAYS } from "./constants.js";

function formatGermanDate(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

function isRecentEnough(isoDate) {
  const ageMs = Date.now() - new Date(isoDate).getTime();
  return ageMs <= DAWUM_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

// Same "Fehlertoleranz" formula dawum.de itself documents and that the app
// already applies to the hardcoded default (see constants.js).
function sigmaFor(value) {
  return 1 + Math.sqrt(value / 10);
}

// Fetches dawum.de's newest-surveys feed and turns it into one poll preset
// per (recent enough) Sachsen-Anhalt survey, in this app's own party-keyed
// shape. Any party dawum reports that this app doesn't track as its own
// (e.g. FDP) is folded into "Sonstige", matching how the hardcoded default
// already lumps small parties together.
export async function fetchDawumPresets() {
  const response = await fetch(DAWUM_API_URL);
  if (!response.ok) {
    throw new Error(`dawum.de API antwortete mit Status ${response.status}`);
  }
  const db = await response.json();

  const partyShortcutById = Object.fromEntries(
    Object.entries(db.Parties).map(([id, party]) => [id, party.Shortcut]),
  );
  const instituteNameById = Object.fromEntries(
    Object.entries(db.Institutes).map(([id, institute]) => [id, institute.Name]),
  );

  const presets = Object.values(db.Surveys)
    .filter((survey) => survey.Parliament_ID === DAWUM_PARLIAMENT_ID && isRecentEnough(survey.Date))
    .sort((a, b) => (a.Date < b.Date ? 1 : -1))
    .map((survey) => {
      const data = PARTY_ORDER.reduce((acc, party) => {
        acc[party] = { value: 0, sigma: 0 };
        return acc;
      }, {});

      Object.entries(survey.Results).forEach(([partyId, value]) => {
        const shortcut = partyShortcutById[partyId];
        const party = PARTY_ORDER.includes(shortcut) ? shortcut : "Sonstige";
        data[party].value += value;
      });

      PARTY_ORDER.forEach((party) => {
        data[party].sigma = sigmaFor(data[party].value);
      });

      const institute = instituteNameById[survey.Institute_ID] ?? "unbekanntes Institut";
      return {
        id: `dawum-${survey.Institute_ID}-${survey.Date}`,
        label: `${institute} – ${formatGermanDate(survey.Date)}`,
        sourceUrl: "https://dawum.de/Sachsen-Anhalt/",
        data,
      };
    });

  return presets;
}
