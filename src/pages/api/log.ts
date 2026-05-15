/**
 * @module log
 * @description GET /api/log?path= — returns git commit history (LogEntry[]) for a given copy file.
 */
import type { APIRoute } from 'astro';
import { gitLog } from '../../lib/git.ts';

export const GET: APIRoute = ({ url }) => {
  const p = url.searchParams.get('path');
  if (!p) return new Response('Missing path', { status: 400 });
  return Response.json(gitLog(p));
};
