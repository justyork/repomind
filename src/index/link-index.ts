import type { DocRecord } from './types.js';

export type LinkKind = 'related' | 'wikilink' | 'parent_of';

export interface LinkEdge {
  from: string;
  to: string;
  kind: LinkKind;
  /** Unresolved wikilink target when `to` is not a known slug. */
  rawTarget?: string;
}

export interface BacklinkEntry {
  from: string;
  kind: LinkKind;
}

export interface LinkIndexSnapshot {
  edges: LinkEdge[];
  backlinks: Map<string, BacklinkEntry[]>;
  brokenTargets: Set<string>;
}

const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function parseWikilinkTargets(body: string): string[] {
  const targets: string[] = [];
  for (const match of body.matchAll(WIKILINK_PATTERN)) {
    const display = match[1]?.trim() ?? '';
    const slugPart = match[2]?.trim() ?? display;
    if (slugPart) {
      targets.push(slugPart);
    }
  }
  return targets;
}

interface SlugLookups {
  slugSet: Set<string>;
  titleToSlug: Map<string, string>;
}

function buildSlugLookups(docs: DocRecord[]): SlugLookups {
  const slugSet = new Set(docs.map((doc) => doc.slug));
  const titleToSlug = new Map<string, string>();
  for (const doc of docs) {
    titleToSlug.set(doc.slug.toLowerCase(), doc.slug);
    titleToSlug.set(doc.title.toLowerCase(), doc.slug);
  }
  return { slugSet, titleToSlug };
}

export function resolveWikilinkTarget(
  raw: string,
  lookups: SlugLookups,
): { slug: string | null; broken: boolean } {
  if (lookups.slugSet.has(raw)) {
    return { slug: raw, broken: false };
  }
  const byKey = lookups.titleToSlug.get(raw.toLowerCase());
  if (byKey) {
    return { slug: byKey, broken: false };
  }
  return { slug: null, broken: true };
}

function addBacklink(
  backlinks: Map<string, BacklinkEntry[]>,
  to: string,
  entry: BacklinkEntry,
): void {
  const list = backlinks.get(to) ?? [];
  const duplicate = list.some((item) => item.from === entry.from && item.kind === entry.kind);
  if (!duplicate) {
    list.push(entry);
    backlinks.set(to, list);
  }
}

export function buildLinkIndex(
  docs: DocRecord[],
  extraEdges: LinkEdge[] = [],
): LinkIndexSnapshot {
  const lookups = buildSlugLookups(docs);
  const edges: LinkEdge[] = [...extraEdges];
  const backlinks = new Map<string, BacklinkEntry[]>();
  const brokenTargets = new Set<string>();

  function registerEdge(edge: LinkEdge): void {
    edges.push(edge);
    if (lookups.slugSet.has(edge.to)) {
      addBacklink(backlinks, edge.to, { from: edge.from, kind: edge.kind });
    }
  }

  for (const doc of docs) {
    if (doc.contentKind !== 'markdown') {
      continue;
    }

    for (const related of doc.related) {
      if (related === doc.slug) {
        continue;
      }
      const broken = !lookups.slugSet.has(related);
      if (broken) {
        brokenTargets.add(related);
      }
      registerEdge({
        from: doc.slug,
        to: related,
        kind: 'related',
        ...(broken ? { rawTarget: related } : {}),
      });
    }

    for (const raw of parseWikilinkTargets(doc.body)) {
      const resolved = resolveWikilinkTarget(raw, lookups);
      if (resolved.broken || !resolved.slug) {
        brokenTargets.add(raw);
        registerEdge({
          from: doc.slug,
          to: raw,
          kind: 'wikilink',
          rawTarget: raw,
        });
        continue;
      }
      if (resolved.slug === doc.slug) {
        continue;
      }
      registerEdge({
        from: doc.slug,
        to: resolved.slug,
        kind: 'wikilink',
      });
    }
  }

  for (const edge of extraEdges) {
    if (lookups.slugSet.has(edge.to)) {
      addBacklink(backlinks, edge.to, { from: edge.from, kind: edge.kind });
    }
  }

  return { edges, backlinks, brokenTargets };
}

export function getOutboundSlugs(snapshot: LinkIndexSnapshot, fromSlug: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const edge of snapshot.edges) {
    if (edge.from !== fromSlug || seen.has(edge.to)) {
      continue;
    }
    seen.add(edge.to);
    result.push(edge.to);
  }
  return result;
}

export interface LinkHealthSummary {
  orphanSlugs: string[];
  brokenTargets: string[];
  oneWayCount: number;
}

export function computeLinkHealth(
  snapshot: LinkIndexSnapshot,
  docs: DocRecord[],
): LinkHealthSummary {
  const inbound = new Set<string>();
  const outboundPairs = new Set<string>();
  const reversePairs = new Set<string>();

  for (const edge of snapshot.edges) {
    if (edge.kind === 'parent_of') {
      continue;
    }
    inbound.add(edge.to);
    outboundPairs.add(`${edge.from}\0${edge.to}`);
    reversePairs.add(`${edge.to}\0${edge.from}`);
  }

  let oneWayCount = 0;
  for (const pair of outboundPairs) {
    if (!reversePairs.has(pair)) {
      oneWayCount += 1;
    }
  }

  const orphanSlugs =
    docs.length <= 1
      ? []
      : docs
          .filter((doc) => !inbound.has(doc.slug))
          .map((doc) => doc.slug);

  return {
    orphanSlugs,
    brokenTargets: [...snapshot.brokenTargets].sort(),
    oneWayCount,
  };
}

export function getBacklinksForSlug(
  snapshot: LinkIndexSnapshot,
  slug: string,
  docsBySlug: Map<string, DocRecord>,
): Array<{ slug: string; title: string; kind: BacklinkEntry['kind'] }> {
  const entries = snapshot.backlinks.get(slug) ?? [];
  return entries.map((entry) => {
    const doc = docsBySlug.get(entry.from);
    return {
      slug: entry.from,
      title: doc?.title ?? entry.from,
      kind: entry.kind,
    };
  });
}