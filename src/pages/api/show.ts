/**
 * @module show
 * @description GET /api/show?path=&hash= — returns raw file content at a specific git commit hash.
 */
import type { APIRoute } from 'astro';
import { gitShow } from '../../lib/git.ts';

export const GET: APIRoute = ({ url }) => {
  const p = url.searchParams.get('path');
  const hash = url.searchParams.get('hash');
  if (!p || !hash) return new Response('Missing params', { status: 400 });
  return new Response(gitShow(hash, p), { headers: { 'Content-Type': 'text/plain' } });
};
