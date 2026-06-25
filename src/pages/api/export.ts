import type { APIRoute } from 'astro';
import { getJourneys, getTree, readFile } from '../../lib/content.ts';
import path from 'path';

export const GET: APIRoute = ({ request }) => {
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope');
  const filePath = url.searchParams.get('path');
  const slug = url.searchParams.get('slug');

  try {
    let data: unknown;
    let filename: string;

    if (scope === 'page') {
      if (!filePath) return err('path required', 400);
      const file = readFile(filePath);
      if (!file) return err('File not found', 404);
      data = file;
      filename = path.basename(filePath);
    } else if (scope === 'journey') {
      if (!slug) return err('slug required', 400);
      const journeys = getJourneys();
      const journey = journeys.find(j => j.slug === slug);
      if (!journey) return err('Journey not found', 404);
      const tree = getTree();
      const journeyTree = tree.find(j => j.slug === slug);
      const pages = (journeyTree?.pages ?? []).map(page => ({
        slug: page.slug,
        path: page.path,
        data: readFile(page.path),
      }));
      data = { journey, pages };
      filename = `${slug}.json`;
    } else if (scope === 'all') {
      const journeys = getJourneys();
      const tree = getTree();
      const pages = tree.flatMap(j =>
        j.pages.map(page => ({
          path: page.path,
          data: readFile(page.path),
        }))
      );
      data = { journeys, pages };
      filename = 'pawlog-export.json';
    } else {
      return err('scope must be page, journey, or all', 400);
    }

    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return err(String(e), 500);
  }
};

function err(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
