import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

// Convertit la fiche One-Pager (Markdown produit par Gemini) en document Word (.docx).
// Gère : titres #/##/###, puces, listes numérotées, tableaux, citations, séparateurs, **gras** et *italique*.

const FONT = "Calibri";
const ACCENT = "3F3D99"; // indigo foncé
const MUTED = "6B7280";
const PAGE_WIDTH_TWIPS = 11906; // A4
const MARGIN_TWIPS = 1000; // ≈ 1,76 cm
const CONTENT_WIDTH = PAGE_WIDTH_TWIPS - 2 * MARGIN_TWIPS;

// Retire les emojis éventuels (rendu inégal dans Word)
const stripEmoji = (s: string) => s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\s{2,}/g, " ").trim();

function inlineRuns(text: string, base: { bold?: boolean; italics?: boolean; color?: string; size?: number } = {}): TextRun[] {
  const parts = stripEmoji(text).split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).filter((p) => p !== "");
  return parts.map((part) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return new TextRun({ text: part.slice(2, -2), bold: true, italics: base.italics, color: base.color, size: base.size, font: FONT });
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return new TextRun({ text: part.slice(1, -1), italics: true, bold: base.bold, color: base.color, size: base.size, font: FONT });
    }
    return new TextRun({ text: part, bold: base.bold, italics: base.italics, color: base.color, size: base.size, font: FONT });
  });
}

function buildTable(rows: string[][]): Table {
  const cols = Math.max(...rows.map((r) => r.length));
  const colWidth = Math.floor(CONTENT_WIDTH / cols);
  const border = { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" };
  const borders = { top: border, bottom: border, left: border, right: border };

  return new Table({
    width: { size: colWidth * cols, type: WidthType.DXA },
    columnWidths: Array(cols).fill(colWidth),
    rows: rows.map(
      (cells, rowIdx) =>
        new TableRow({
          tableHeader: rowIdx === 0,
          children: Array.from({ length: cols }, (_, c) =>
            new TableCell({
              borders,
              width: { size: colWidth, type: WidthType.DXA },
              shading: rowIdx === 0 ? { fill: "E8E7F7", type: ShadingType.CLEAR, color: "auto" } : undefined,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: inlineRuns(cells[c] || "", { bold: rowIdx === 0, size: 19 }),
                }),
              ],
            })
          ),
        })
    ),
  });
}

export interface OnepagerMeta {
  fundName: string;
  managerName?: string;
}

export async function buildOnepagerDocx(markdown: string, meta: OnepagerMeta): Promise<Blob> {
  const children: (Paragraph | Table)[] = [];
  const lines = markdown.replace(/\r/g, "").split("\n");
  let i = 0;
  let hasTitle = false;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Bloc de code éventuel : on ignore les délimiteurs
    if (trimmed.startsWith("```")) {
      i++;
      continue;
    }

    // Tableau : lignes consécutives commençant et finissant par |
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        const cells = lines[i].trim().split("|").slice(1, -1).map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      if (rows.length) {
        children.push(buildTable(rows));
        children.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
      }
      continue;
    }

    i++;
    if (!trimmed) continue;

    if (trimmed.startsWith("# ")) {
      hasTitle = true;
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: inlineRuns(trimmed.slice(2), { bold: true, size: 34, color: ACCENT }),
        })
      );
      if (meta.managerName) {
        children.push(
          new Paragraph({
            spacing: { after: 160 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 4 } },
            children: [new TextRun({ text: `Société de gestion : ${meta.managerName}`, color: MUTED, size: 19, font: FONT })],
          })
        );
      }
    } else if (trimmed.startsWith("## ")) {
      children.push(
        new Paragraph({
          spacing: { before: 180, after: 60 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB", space: 2 } },
          children: inlineRuns(trimmed.slice(3), { bold: true, size: 24, color: ACCENT }),
        })
      );
    } else if (trimmed.startsWith("### ")) {
      children.push(new Paragraph({ spacing: { before: 100, after: 40 }, children: inlineRuns(trimmed.slice(4), { bold: true, size: 21 }) }));
    } else if (/^[-*•] /.test(trimmed)) {
      children.push(new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 30 }, children: inlineRuns(trimmed.slice(2), { size: 20 }) }));
    } else if (/^\d+[.)] /.test(trimmed)) {
      children.push(new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 30 }, children: inlineRuns(trimmed.replace(/^\d+[.)] /, ""), { size: 20 }) }));
    } else if (trimmed.startsWith(">")) {
      children.push(
        new Paragraph({
          indent: { left: 280 },
          spacing: { after: 60 },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: ACCENT, space: 8 } },
          children: inlineRuns(trimmed.replace(/^>\s?/, ""), { italics: true, size: 20, color: "374151" }),
        })
      );
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      children.push(new Paragraph({ spacing: { after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB", space: 1 } }, children: [] }));
    } else {
      children.push(new Paragraph({ spacing: { after: 80 }, children: inlineRuns(trimmed, { size: 20 }) }));
    }
  }

  if (!hasTitle) {
    children.unshift(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: meta.fundName, bold: true, size: 34, color: ACCENT, font: FONT })] }));
  }

  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  const doc = new Document({
    creator: "TPF App",
    title: `One-Pager – ${meta.fundName}`,
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    numbering: {
      config: [
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] },
        { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 280 } } } }] },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH_TWIPS, height: 16838 },
            margin: { top: 900, bottom: 900, left: MARGIN_TWIPS, right: MARGIN_TWIPS },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: "One-Pager fonds · Usage interne", color: MUTED, size: 16, font: FONT })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `Généré le ${today} à partir des rapports reçus · Page `, color: MUTED, size: 16, font: FONT }),
                  new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16, font: FONT }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export function onepagerFileName(fundName: string) {
  const safe = fundName.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  const date = new Date().toISOString().slice(0, 10);
  return `One-Pager - ${safe} - ${date}.docx`;
}
