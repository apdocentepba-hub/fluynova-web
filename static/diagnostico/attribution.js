/* FLUYNOVA — attribution for /diagnostico/
 * Preserves only explicit, validated UTM fields across the CTA to the home form.
 * No cookies, analytics pixels, storage, external requests or personal data.
 * The form transmits campaign fields only if a visitor submits with consent.
 */
(function (root) {
  "use strict";

  const VALID = /^[A-Za-z0-9_.-]{1,90}$/;
  const TRACKING_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];
  const DEFAULTS = {
    utm_source: "diagnostico",
    utm_medium: "landing",
    utm_campaign: "primera_evaluacion"
  };

  function buildLeadUrl(search) {
    const incoming = new URLSearchParams(typeof search === "string" ? search : "");
    const outgoing = new URLSearchParams();

    for (const key of TRACKING_KEYS) {
      const raw = incoming.get(key);
      if (raw && VALID.test(raw)) {
        outgoing.set(key, raw);
      } else if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
        outgoing.set(key, DEFAULTS[key]);
      }
    }
    return "/?" + outgoing.toString() + "#contacto";
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { buildLeadUrl };
  }

  if (root && root.document && root.location) {
    const url = buildLeadUrl(root.location.search);
    for (const anchor of root.document.querySelectorAll("a[data-diagnostic-cta]")) {
      anchor.setAttribute("href", url);
    }
  }
})(typeof window !== "undefined" ? window : undefined);
