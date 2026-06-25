import type { APIRoute } from 'astro';
import {
  Document, Packer, Paragraph, HeadingLevel, TextRun,
  Table, TableRow, TableCell, WidthType, BorderStyle,
} from 'docx';
import { getTree, readFile } from '../../lib/content.ts';
import { gitLog } from '../../lib/git.ts';

const BORDER_NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const CELL_MARGINS = { top: 100, bottom: 100, left: 150, right: 150 };
// Letter page 8.5" − 2×1" margins = 6.5" = 9360 DXA
const TABLE_WIDTH_DXA = 9360;
const COL_LABEL_DXA = 2808;  // ~30%
const COL_CONTENT_DXA = 6552; // ~70%

function headerRow() {
  return new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        margins: CELL_MARGINS,
        width: { size: COL_LABEL_DXA, type: WidthType.DXA },
        shading: { fill: 'F3F4F6' },
        children: [new Paragraph({ children: [new TextRun({ text: 'Label', bold: true, size: 20 })] })],
      }),
      new TableCell({
        margins: CELL_MARGINS,
        width: { size: COL_CONTENT_DXA, type: WidthType.DXA },
        shading: { fill: 'F3F4F6' },
        children: [new Paragraph({ children: [new TextRun({ text: 'Content', bold: true, size: 20 })] })],
      }),
    ],
  });
}

function dataRow(label: string, content: string) {
  return new TableRow({
    children: [
      new TableCell({
        margins: CELL_MARGINS,
        width: { size: COL_LABEL_DXA, type: WidthType.DXA },
        children: [new Paragraph({ children: [new TextRun({ text: label, size: 20 })] })],
      }),
      new TableCell({
        margins: CELL_MARGINS,
        width: { size: COL_CONTENT_DXA, type: WidthType.DXA },
        children: [new Paragraph({ children: [new TextRun({ text: content, size: 20 })] })],
      }),
    ],
  });
}

export const GET: APIRoute = async ({ url }) => {
  const params = url.searchParams;
  const journeySlug = params.get('journey');
  const filePath = params.get('path');
  const sectionFilter = params.get('section') || null;
  const withHistory = params.get('history') === 'true';

  const pagePaths: string[] = [];
  let docTitle = 'Export';

  if (journeySlug) {
    const tree = getTree();
    const journey = tree.find(j => j.slug === journeySlug);
    if (!journey) return new Response('Journey not found', { status: 404 });
    docTitle = journey.name;
    for (const page of journey.pages) pagePaths.push(page.path);
  } else if (filePath) {
    const tree = getTree();
    outer: for (const j of tree) {
      for (const p of j.pages) {
        if (p.path === filePath) { docTitle = p.name; break outer; }
      }
    }
    pagePaths.push(filePath);
  } else {
    return new Response('Missing journey or path param', { status: 400 });
  }

  const docChildren: any[] = [];

  docChildren.push(
    new Paragraph({ text: docTitle, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({
      children: [new TextRun({
        text: `Exported ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        italics: true, color: '888888', size: 18,
      })],
    }),
    new Paragraph({ text: '' }),
  );

  for (const path of pagePaths) {
    const file = readFile(path);
    if (!file) continue;

    const isMultiPage = pagePaths.length > 1;

    if (isMultiPage) {
      docChildren.push(new Paragraph({ text: file.meta.page, heading: HeadingLevel.HEADING_2 }));
      if (file.meta.description) {
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: file.meta.description, italics: true, color: '555555', size: 19 })],
        }));
      }
    } else if (file.meta.description) {
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: file.meta.description, italics: true, color: '555555', size: 19 })],
      }));
    }

    const groups = file.meta.groups ?? [];
    const items = file.items ?? {};

    const renderSection = (sectionName: string | null, entries: Array<[string, any]>) => {
      if (entries.length === 0) return;
      if (sectionName) {
        docChildren.push(new Paragraph({ text: sectionName, heading: isMultiPage ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2 }));
      }
      docChildren.push(new Table({
        width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
        columnWidths: [COL_LABEL_DXA, COL_CONTENT_DXA],
        borders: {
          top: BORDER_NONE, bottom: BORDER_NONE,
          left: BORDER_NONE, right: BORDER_NONE,
          insideH: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
          insideV: BORDER_NONE,
        },
        rows: [
          headerRow(),
          ...entries.map(([key, item]) => dataRow(item.label ?? key, item.content ?? '')),
        ],
      }));
      docChildren.push(new Paragraph({ text: '' }));
    };

    if (groups.length === 0) {
      const entries = Object.entries(items).filter(([, item]) =>
        !sectionFilter || (item.group ?? '') === sectionFilter
      );
      renderSection(null, entries);
    } else {
      for (const group of groups) {
        if (sectionFilter && group !== sectionFilter) continue;
        const entries = Object.entries(items).filter(([, item]) => (item.group ?? '') === group);
        renderSection(group, entries);
      }
      if (!sectionFilter) {
        const ungrouped = Object.entries(items).filter(([, item]) => !item.group || !groups.includes(item.group));
        if (ungrouped.length > 0) renderSection('Other', ungrouped);
      }
    }

    if (withHistory) {
      const log = gitLog(path);
      if (log.length > 0) {
        docChildren.push(new Paragraph({ text: 'Revision History', heading: HeadingLevel.HEADING_3 }));
        for (const entry of log) {
          const d = new Date(entry.date).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
          });
          docChildren.push(new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: `${d}  `, bold: true, size: 19 }),
              new TextRun({ text: entry.message, size: 19 }),
              new TextRun({ text: `  [${entry.hash.substring(0, 7)}]`, color: '888888', size: 18 }),
            ],
          }));
        }
        docChildren.push(new Paragraph({ text: '' }));
      }
    }
  }

  const doc = new Document({ sections: [{ children: docChildren }] });
  const buffer = await Packer.toBuffer(doc);
  const filename = `${docTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-export.docx`;

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
};
