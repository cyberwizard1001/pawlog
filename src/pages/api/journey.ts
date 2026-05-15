/**
 * @module journey
 * @description POST /api/journey — creates a new journey (folder + journeys.json entry). Body: { slug, name, description? }.
 *              PATCH /api/journey — renames/edits a journey. Body: { slug, name, description? }.
 *              DELETE /api/journey — deletes a journey and all its pages. Body: { slug }.
 */
import type { APIRoute } from 'astro';
import { getJourneys, saveJourneys } from '../../lib/content.ts';
import { gitCommit, gitDeleteJourney, COPY_DIR } from '../../lib/git.ts';
import path from 'path';
import fs from 'fs';

export const POST: APIRoute = async ({ request }) => {
  const { slug, name, description } = await request.json();

  if (!slug || !name) {
    return new Response(JSON.stringify({ error: 'slug and name are required' }), { status: 400 });
  }
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    return new Response(JSON.stringify({ error: 'Slug must be lowercase letters and hyphens only' }), { status: 400 });
  }

  const journeys = getJourneys();
  if (journeys.some(j => j.slug === slug)) {
    return new Response(JSON.stringify({ error: 'A journey with that slug already exists' }), { status: 409 });
  }

  journeys.push({ slug, name: name.trim(), ...(description?.trim() ? { description: description.trim() } : {}) });
  saveJourneys(journeys);

  const dir = path.join(COPY_DIR, slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  gitCommit('journeys.json', `Create journey: ${name.trim()}`);

  return new Response(JSON.stringify({ slug }), { status: 201 });
};

export const PATCH: APIRoute = async ({ request }) => {
  const { slug, name, description } = await request.json();

  if (!slug || !name) {
    return new Response(JSON.stringify({ error: 'slug and name are required' }), { status: 400 });
  }

  const journeys = getJourneys();
  const idx = journeys.findIndex(j => j.slug === slug);
  if (idx === -1) {
    return new Response(JSON.stringify({ error: 'Journey not found' }), { status: 404 });
  }

  journeys[idx] = {
    slug,
    name: name.trim(),
    ...(description?.trim() ? { description: description.trim() } : {}),
  };
  saveJourneys(journeys);
  gitCommit('journeys.json', `Update journey: ${name.trim()}`);

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

export const DELETE: APIRoute = async ({ request }) => {
  const { slug } = await request.json();

  if (!slug) {
    return new Response(JSON.stringify({ error: 'slug is required' }), { status: 400 });
  }

  const journeys = getJourneys();
  const idx = journeys.findIndex(j => j.slug === slug);
  if (idx === -1) {
    return new Response(JSON.stringify({ error: 'Journey not found' }), { status: 404 });
  }

  journeys.splice(idx, 1);
  saveJourneys(journeys);
  gitDeleteJourney(slug, `Delete journey: ${slug}`);

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
