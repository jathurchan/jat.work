// Typed accessor over src/config/site.yaml. Components import from here so the
// raw YAML shape stays in one place.
import raw from '../config/site.yaml';

export type Topic = 'cloud' | 'systems' | 'ai';

export interface Product {
  label: string;
  href: string;
}

export interface Metric {
  value: string;
  label: string;
}

export type CareerVariant = 'station' | 'branch' | 'project' | 'destination';

export interface CareerEntry {
  /** Chapter marker shown in the node ("01", "—" for a branch, etc.). */
  chapter: string;
  org: string;
  /** Key into the symbol set drawn inside the node disc (see Experience.astro). */
  symbol?: string;
  period: string;
  role: string;
  /** City / context line under the role. */
  place?: string;
  /** Accent colour for the node + card (a CSS token or hex). */
  color: string;
  /** Card/brand accent; falls back to `color` when omitted. */
  brand?: string;
  now?: boolean;
  /** Visual treatment for the node. */
  variant?: CareerVariant;
  /** Short tag for a side branch (e.g. "Detour · iOS"). */
  tag?: string;
  /** End-of-line label for a branch terminus (e.g. "Paused — for now"). */
  terminus?: string;
  /** Narrative beat printed on the connector leading into this node. */
  transitionIn?: string;
  product?: Product;
  /** When true the product action opens the in-page RaftLock demo. */
  demo?: boolean;
  story?: string;
  heroMetric?: Metric;
  stack?: string[];
  /** Destination card only: render the animated "what's next" terminal in
   * place of a tech-chip stack. */
  terminal?: boolean;
}



export interface SiteConfig {
  profile: {
    fullName: string;
    email: string;
    resume?: string;
    links: { github: string; linkedin: string };
  };
  meta: { title: string; description: string };
  intro: {
    greeting: string;
    name: string;
    nameShort: string;
    company?: string;
    statementLead: string;
    pillars: { key: string; label: string; color: string }[];
    bio: string;
    invitation: string;
  };
  skills: {
    eyebrow: string;
    lead: string;
    // `key` + `color` mirror an intro pillar so the toolkit threads the same
    // three focus-area colours as the statement and achievement deck.
    categories: { key: string; name: string; color: string; items: string[] }[];
  };
  lab: { eyebrow: string; lead: string };
  /** Grouped multi-part post series, rendered as one card in the feed. */
  series?: { id: string; name: string; topic: string; blurb: string; parts: string[] }[];
  careerHead: { eyebrow: string; lead: string };
  careerStart: { kicker: string; line: string };
  nav: { sections: { id: string; label: string }[] };
  featured: {
    title: string;
    meta: string;
    source: string;
    eyebrow: string;
    lead: string;
    tagline: string;
    chips: string[];
  };
  filters: { id: string; label: string; name?: string; color?: string }[];
  career: CareerEntry[];
}

export const config = raw as SiteConfig;

export const { profile, meta, intro, skills, lab, series, careerHead, careerStart, nav, featured, filters, career } = config;

// Topics are every filter except the catch-all "all" tab.
const topics = filters.filter((f) => f.id !== 'all');

/** Color per topic — derived from site.yaml so cards, filters, and post
 * headers stay in lockstep. Add a topic in the YAML and it lands here. */
export const topicColor: Record<string, string> = Object.fromEntries(
  topics.map((t) => [t.id, t.color ?? 'var(--ink)']),
);

/** Title-case display label per topic, also derived from site.yaml. */
export const topicLabel: Record<string, string> = Object.fromEntries(
  topics.map((t) => [t.id, t.name ?? t.label]),
);

/** Card/post date formatter, e.g. "Jun 22, 2026". */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
