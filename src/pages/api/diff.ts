/**
 * @module diff
 * @description GET /api/diff?path=&from=&to= — returns raw git diff between two commit hashes for a given copy file.
 */
import type { APIRoute } from 'astro';
import { gitDiff } from '../../lib/git.ts';

export const GET: APIRoute = ({ url }) => {
  const p = url.searchParams.get('path');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!p || !from || !to) return new Response('Missing params', { status: 400 });
  return new Response(gitDiff(from, to, p), { headers: { 'Content-Type': 'text/plain' } });
};
