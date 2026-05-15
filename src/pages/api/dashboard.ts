/**
 * @module dashboard
 * @description GET /api/dashboard — returns aggregate stats (journey/page/item counts) and recent git commits across the copy repo.
 */
import type { APIRoute } from 'astro';
import { getTree, readFile } from '../../lib/content.ts';
import { gitRecentLog } from '../../lib/git.ts';

export const GET: APIRoute = () => {
  const tree = getTree();

  const journeys = tree.length;
  const pages = tree.reduce((n, j) => n + j.pages.length, 0);
  const items = tree.reduce((n, j) =>
    n + j.pages.reduce((m, p) => {
      const f = readFile(p.path);
      return m + (f ? Object.keys(f.items).length : 0);
    }, 0), 0);

  const recent = gitRecentLog(25);

  return new Response(JSON.stringify({ stats: { journeys, pages, items }, recent }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
