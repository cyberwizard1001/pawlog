/**
 * @module file
 * @description GET /api/file?path= — reads a copy file as JSON.
 *              POST /api/file?path= — writes a copy file and commits to git. Body: { data, note }.
 */
import type { APIRoute } from 'astro';
import { readFile, writeFile } from '../../lib/content.ts';
import { gitCommit } from '../../lib/git.ts';

export const GET: APIRoute = ({ url }) => {
  const p = url.searchParams.get('path');
  if (!p) return new Response('Missing path', { status: 400 });
  const data = readFile(p);
  if (!data) return new Response('Not found', { status: 404 });
  return Response.json(data);
};

export const POST: APIRoute = async ({ url, request }) => {
  const p = url.searchParams.get('path');
  if (!p) return new Response('Missing path', { status: 400 });
  const { data, note } = await request.json();
  writeFile(p, data);
  gitCommit(p, note ?? '');
  return Response.json({ ok: true });
};
