/**
 * @module tree
 * @description GET /api/tree — returns the full journey/page tree built from the copy/ directory.
 */
import type { APIRoute } from 'astro';
import { getTree } from '../../lib/content.ts';

export const GET: APIRoute = () => {
  return Response.json(getTree());
};
