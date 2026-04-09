// ============================================================
// ClearOffer — Client-side config
// ============================================================
// All user-visible product strings live here.
// A product rename = change PRODUCT.NAME + PRODUCT.TAGLINE.
// ============================================================

const CLEAROFFER_CONFIG = {
  PRODUCT: {
    NAME: 'ClearOffer',
    TAGLINE: 'Know what to offer before you ask.',
    DOMAIN: 'clearoffer.com.au',
    SUPPORT_EMAIL: 'hello@clearoffer.com.au',
  },
  PRICING: {
    BUYERS_BRIEF_AUD: 149,
    BUYERS_BRIEF_LABEL: "Buyer's Brief",
    AGENT_FEE_RANGE: '$8,000–$15,000',
  },
  COPY: {
    // CTAs
    CTA_PRIMARY: "Get Your Free Scout Report",
    CTA_PAID: "Get Your Buyer's Brief — $149",
    CTA_PAID_SUB: "One-time. No subscription.",
    // Price anchor shown above paid CTA
    PRICE_ANCHOR: "A buyer's agent charges $8,000–$15,000. Your Buyer's Brief is $149.",
    // Social proof — UPDATE WEEKLY
    // <!-- UPDATE WEEKLY -->
    SOCIAL_PROOF: "47 Brisbane buyers got a Buyer's Brief this week.",
    // Email gate
    EMAIL_GATE_HEADING: "Your free Scout Report is ready.",
    EMAIL_GATE_SUB: "Enter your email and we'll send it — and save it for you.",
    EMAIL_GATE_FINE: "One free Scout Report per email address. No spam.",
    // Report section locked labels
    LOCKED_OFFER: "Opening offer recommendation with reasoning",
    LOCKED_NEGO: "Full negotiation script with specific dollar figures",
    LOCKED_AVM_DETAIL: "Full AVM breakdown with confidence score",
    LOCKED_COMPARABLES: "5 comparable sales with full attributes",
    LOCKED_OUTLOOK: "5–10 year suburb outlook",
    LOCKED_AGENT: "What the agent won't tell you",
    // 404
    NOT_FOUND_HEADING: "Page not found",
    NOT_FOUND_SUB: "Let's get you back on track.",
  },
};

// Disclaimer is derived so the product name stays in sync with PRODUCT.NAME
// Do not hardcode the product name inside this string
CLEAROFFER_CONFIG.COPY.DISCLAIMER =
  `This report is market research and analysis, not a formal property valuation. ` +
  `It is not suitable for lending, legal, or insurance purposes. ` +
  `${CLEAROFFER_CONFIG.PRODUCT.NAME} is not a registered property valuer. ` +
  `Always obtain independent legal and financial advice before purchasing property.`;

// Make available globally (vanilla JS, no module system)
if (typeof window !== 'undefined') {
  window.CLEAROFFER = CLEAROFFER_CONFIG;
}
