/**
 * Scope-of-work checklists per service type (BUILD_SPEC §G) — PURE data.
 *
 * Structured (area → tasks) so they render identically in the PDF and on the
 * approval page, and set a clear, signable expectation of what's included.
 * Add-on tasks (inside oven/fridge/windows, etc.) are priced separately by the
 * engine and are NOT repeated here.
 */
import type { ScopeChecklist } from "./types";

/** Recurring / one-time standard residential visit. */
export const RESIDENTIAL_STANDARD_SCOPE: ScopeChecklist = {
  key: "residential-standard",
  title: "Standard Cleaning — Scope of Work",
  intro: "Performed every visit, throughout the home:",
  sections: [
    {
      area: "Kitchen",
      tasks: [
        "Countertops & backsplash wiped",
        "Sink scrubbed & faucet polished",
        "Exterior of appliances wiped (fridge, oven, dishwasher)",
        "Stovetop & microwave interior cleaned",
        "Cabinet fronts spot-cleaned",
        "Floors vacuumed & mopped; trash emptied",
      ],
    },
    {
      area: "Bathrooms",
      tasks: [
        "Toilets cleaned & sanitized",
        "Showers, tubs & glass cleaned",
        "Sinks & vanities wiped; mirrors polished",
        "Chrome fixtures shined",
        "Floors mopped; trash emptied",
      ],
    },
    {
      area: "Bedrooms & Living Areas",
      tasks: [
        "Dusting of reachable surfaces & furniture",
        "Beds made (linens changed if left out)",
        "Mirrors & glass spot-cleaned",
        "Floors vacuumed and/or mopped",
      ],
    },
    {
      area: "Throughout",
      tasks: [
        "Cobweb removal",
        "Light switches, door handles & high-touch points wiped",
        "Baseboards & sills spot-dusted",
        "General tidy and floors finished",
      ],
    },
  ],
};

/** Initial / one-time deep clean — everything in standard, plus detail work. */
export const RESIDENTIAL_DEEP_SCOPE: ScopeChecklist = {
  key: "residential-deep",
  title: "Deep Cleaning — Scope of Work",
  intro: "Includes everything in a standard cleaning, plus detailed first-visit work:",
  sections: [
    {
      area: "Kitchen (detail)",
      tasks: [
        "Backsplash & cabinet fronts fully wiped",
        "Microwave interior & exterior detailed",
        "Appliance exteriors detailed; behind/around small appliances",
        "Baseboards hand-wiped",
      ],
    },
    {
      area: "Bathrooms (detail)",
      tasks: [
        "Tile & grout detailed; soap-scum and buildup removed",
        "Fixtures descaled & polished",
        "Baseboards and door frames hand-wiped",
      ],
    },
    {
      area: "Whole-home detail",
      tasks: [
        "Baseboards, door frames & doors hand-wiped",
        "Detailed dusting incl. blinds, vents & ceiling fans (reachable)",
        "Light fixtures & switch plates detailed",
        "Edge & corner vacuuming; under reachable furniture",
      ],
    },
  ],
};

/** Commercial / janitorial service. */
export const COMMERCIAL_SCOPE: ScopeChecklist = {
  key: "commercial-standard",
  title: "Commercial Cleaning — Scope of Work",
  intro: "Performed each scheduled service per the agreed frequency:",
  sections: [
    {
      area: "Entrances & Common Areas",
      tasks: [
        "Glass doors & entry glass cleaned",
        "Surfaces dusted; high-touch points sanitized",
        "Floors vacuumed and/or mopped",
        "Trash & recycling emptied; liners replaced",
      ],
    },
    {
      area: "Restrooms",
      tasks: [
        "Toilets, urinals & sinks cleaned and sanitized",
        "Mirrors & fixtures polished",
        "Consumables restocked (paper & soap, if supplied)",
        "Floors mopped & disinfected",
      ],
    },
    {
      area: "Offices & Workstations",
      tasks: [
        "Trash emptied; liners replaced",
        "Desks & surfaces dusted/spot-cleaned (uncluttered areas)",
        "Floors vacuumed and/or mopped",
      ],
    },
    {
      area: "Break Room / Kitchen",
      tasks: [
        "Counters, sinks & tables wiped and sanitized",
        "Appliance exteriors wiped",
        "Floors mopped; trash emptied",
      ],
    },
  ],
};

/**
 * Which residential checklists to include given the service shape:
 *  - recurring → standard (per visit) + deep (the separate initial deep clean)
 *  - one-time deep → deep only
 *  - one-time standard → standard only
 */
export function residentialScopes(opts: {
  isRecurring: boolean;
  primaryIsDeepClean: boolean;
  hasInitialDeepClean: boolean;
}): ScopeChecklist[] {
  if (opts.isRecurring) {
    return opts.hasInitialDeepClean
      ? [RESIDENTIAL_STANDARD_SCOPE, RESIDENTIAL_DEEP_SCOPE]
      : [RESIDENTIAL_STANDARD_SCOPE];
  }
  return opts.primaryIsDeepClean ? [RESIDENTIAL_DEEP_SCOPE] : [RESIDENTIAL_STANDARD_SCOPE];
}

export function commercialScopes(): ScopeChecklist[] {
  return [COMMERCIAL_SCOPE];
}
