import fs from 'fs';
import path from 'path';
import { COPY_DIR } from './git.ts';

export interface CopyItem {
  label: string;
  description?: string;
  content: string;
  group?: string;
}

export interface CopyFile {
  meta: { page: string; description?: string; groups?: string[] };
  items: Record<string, CopyItem>;
}

export interface PageRef {
  name: string;
  slug: string;
  path: string; // relative to COPY_DIR, e.g. "website/homepage.json"
}

export interface Journey {
  name: string;
  slug: string;
  description?: string;
  pages: PageRef[];
}

export interface JourneyMeta {
  slug: string;
  name: string;
  description?: string;
}

const JOURNEYS_FILE = path.join(COPY_DIR, 'journeys.json');

const JOURNEYS_FALLBACK: JourneyMeta[] = [
  { slug: 'website', name: 'Website' },
  { slug: 'app', name: 'App' },
  { slug: 'quote-direct', name: 'Quote — Direct' },
  { slug: 'quote-aggregator', name: 'Quote — Aggregator' },
];

export function getJourneys(): JourneyMeta[] {
  if (fs.existsSync(JOURNEYS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(JOURNEYS_FILE, 'utf8'));
    } catch {}
  }
  return JOURNEYS_FALLBACK;
}

export function saveJourneys(journeys: JourneyMeta[]): void {
  fs.writeFileSync(JOURNEYS_FILE, JSON.stringify(journeys, null, 2) + '\n', 'utf8');
}

export function getTree(): Journey[] {
  return getJourneys().flatMap(({ slug, name, description }) => {
    const dir = path.join(COPY_DIR, slug);
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
    const pages: PageRef[] = files.map(file => {
      const relPath = `${slug}/${file}`;
      const data = readFile(relPath);
      return {
        name: data?.meta?.page ?? file.replace('.json', ''),
        slug: file.replace('.json', ''),
        path: relPath,
      };
    });
    return [{ name, slug, description, pages }];
  });
}

export function readFile(relPath: string): CopyFile | null {
  const full = path.join(COPY_DIR, relPath);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch {
    return null;
  }
}

export function writeFile(relPath: string, data: CopyFile): void {
  const full = path.join(COPY_DIR, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
