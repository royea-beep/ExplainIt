import fs from 'node:fs';
import path from 'node:path';
import type { ScreenInfo } from './types';

// Re-export shared types for backwards compatibility
export type { ScreenInfo, ElementInfo } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PDFOptions {
  title?: string;
  language?: 'he' | 'en';
  outputDir?: string;
  includeAnnotations?: boolean;
}

export interface PDFResult {
  pdfPath: string;
  mdPath: string;
  pageCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 595.28; // A4 points
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_HEIGHT = PAGE_HEIGHT - MARGIN * 2;

const ANNOTATION_CIRCLE_RADIUS = 12;
const ANNOTATION_COLOR = '#E53935';
const ANNOTATION_TEXT_COLOR = '#FFFFFF';
const HEADING_COLOR = '#1A237E';
const BODY_COLOR = '#333333';
const SUBTLE_COLOR = '#757575';

// ---------------------------------------------------------------------------
// PDFGenerator
// ---------------------------------------------------------------------------

export class PDFGenerator {
  /**
   * Generate an annotated PDF guide (and a companion Markdown file) from a
   * list of captured screens.
   */
  async generateGuide(
    screens: ScreenInfo[],
    options?: PDFOptions,
  ): Promise<PDFResult> {
    const title = options?.title ?? 'ExplainIt Guide';
    const language = options?.language ?? 'he';
    const outputDir = options?.outputDir ?? path.join(process.cwd(), 'exports', 'docs');
    const includeAnnotations = options?.includeAnnotations ?? true;

    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const baseName = `${title.replace(/\s+/g, '_')}_${timestamp}`;
    const pdfPath = path.join(outputDir, `${baseName}.pdf`);
    const mdPath = path.join(outputDir, `${baseName}.md`);

    // Generate both outputs concurrently
    const [pageCount] = await Promise.all([
      this.generatePDF(screens, { title, language, includeAnnotations, pdfPath }),
      this.generateMarkdown(screens, { title, language, includeAnnotations, mdPath }),
    ]);

    return { pdfPath, mdPath, pageCount };
  }

  // -----------------------------------------------------------------------
  // PDF generation
  // -----------------------------------------------------------------------

  private async generatePDF(
    screens: ScreenInfo[],
    opts: {
      title: string;
      language: string;
      includeAnnotations: boolean;
      pdfPath: string;
    },
  ): Promise<number> {
    // Dynamic import – pdfkit ships as CommonJS
    const PDFDocument = (await import('pdfkit')).default;

    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      info: {
        Title: opts.title,
        Author: 'ExplainIt',
        Creator: 'ExplainIt PDF Generator',
      },
      autoFirstPage: false,
    });

    const writeStream = fs.createWriteStream(opts.pdfPath);
    doc.pipe(writeStream);

    let pageCount = 0;

    // Helper: add a new page and bump counter
    const addPage = () => {
      doc.addPage();
      pageCount++;
    };

    // ----- 1. Cover page -----
    addPage();
    this.drawCoverPage(doc, opts.title);

    // ----- 2. Table of contents -----
    addPage();
    this.drawTableOfContents(doc, screens, opts.language);

    // ----- 3. Summary page – "How to use the product" -----
    addPage();
    this.drawSummaryPage(doc, screens, opts.language);

    // ----- 4. Screen pages -----
    for (const screen of screens) {
      addPage();
      this.drawScreenPage(doc, screen, opts.includeAnnotations);
    }

    // Finalise
    doc.end();

    // Wait for the write stream to finish
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    return pageCount;
  }

  // -----------------------------------------------------------------------
  // Cover page
  // -----------------------------------------------------------------------

  private drawCoverPage(doc: InstanceType<typeof import('pdfkit')>, title: string): void {
    // Decorative top bar
    doc.rect(0, 0, PAGE_WIDTH, 8).fill(HEADING_COLOR);

    // Title
    doc
      .font('Helvetica-Bold')
      .fontSize(36)
      .fillColor(HEADING_COLOR)
      .text(title, MARGIN, PAGE_HEIGHT / 2 - 80, {
        width: CONTENT_WIDTH,
        align: 'center',
      });

    // Subtitle
    doc
      .font('Helvetica')
      .fontSize(14)
      .fillColor(SUBTLE_COLOR)
      .text('Product Documentation Guide', MARGIN, PAGE_HEIGHT / 2 - 20, {
        width: CONTENT_WIDTH,
        align: 'center',
      });

    // Date
    const dateStr = new Date().toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc
      .fontSize(12)
      .fillColor(SUBTLE_COLOR)
      .text(dateStr, MARGIN, PAGE_HEIGHT / 2 + 20, {
        width: CONTENT_WIDTH,
        align: 'center',
      });

    // Footer branding
    doc
      .fontSize(10)
      .fillColor(SUBTLE_COLOR)
      .text('Generated by ExplainIt', MARGIN, PAGE_HEIGHT - MARGIN - 20, {
        width: CONTENT_WIDTH,
        align: 'center',
      });

    // Decorative bottom bar
    doc.rect(0, PAGE_HEIGHT - 8, PAGE_WIDTH, 8).fill(HEADING_COLOR);
  }

  // -----------------------------------------------------------------------
  // Table of contents
  // -----------------------------------------------------------------------

  private drawTableOfContents(
    doc: InstanceType<typeof import('pdfkit')>,
    screens: ScreenInfo[],
    language: string,
  ): void {
    const tocTitle = language === 'he' ? '\u05EA\u05D5\u05DB\u05DF \u05E2\u05E0\u05D9\u05D9\u05E0\u05D9\u05DD' : 'Table of Contents';

    doc
      .font('Helvetica-Bold')
      .fontSize(24)
      .fillColor(HEADING_COLOR)
      .text(tocTitle, MARGIN, MARGIN, { width: CONTENT_WIDTH });

    doc.moveDown(1.5);

    // Fixed pages: Cover (1), TOC (2), Summary (3) => screens start at page 4
    const screenStartPage = 4;

    screens.forEach((screen, index) => {
      const pageNum = screenStartPage + index;
      const y = doc.y;

      doc
        .font('Helvetica')
        .fontSize(12)
        .fillColor(BODY_COLOR)
        .text(`${index + 1}. ${screen.name}`, MARGIN, y, {
          width: CONTENT_WIDTH - 40,
          continued: false,
        });

      // Page number on the right
      doc
        .font('Helvetica')
        .fontSize(12)
        .fillColor(SUBTLE_COLOR)
        .text(`${pageNum}`, PAGE_WIDTH - MARGIN - 30, y, {
          width: 30,
          align: 'right',
        });

      // Dotted leader line
      const textEnd = MARGIN + 20 + (index + 1).toString().length * 8 + screen.name.length * 6;
      const lineY = y + 8;
      doc
        .strokeColor('#CCCCCC')
        .lineWidth(0.5)
        .dash(2, { space: 3 })
        .moveTo(Math.min(textEnd, PAGE_WIDTH - MARGIN - 50), lineY)
        .lineTo(PAGE_WIDTH - MARGIN - 35, lineY)
        .stroke()
        .undash();

      doc.moveDown(0.8);
    });
  }

  // -----------------------------------------------------------------------
  // Summary page
  // -----------------------------------------------------------------------

  private drawSummaryPage(
    doc: InstanceType<typeof import('pdfkit')>,
    screens: ScreenInfo[],
    language: string,
  ): void {
    const summaryTitle =
      language === 'he' ? '\u05D0\u05D9\u05DA \u05DC\u05D4\u05E9\u05EA\u05DE\u05E9 \u05D1\u05DE\u05D5\u05E6\u05E8' : 'How to Use the Product';

    doc
      .font('Helvetica-Bold')
      .fontSize(24)
      .fillColor(HEADING_COLOR)
      .text(summaryTitle, MARGIN, MARGIN, { width: CONTENT_WIDTH });

    doc.moveDown(1);

    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor(BODY_COLOR)
      .text(
        'This guide walks you through every screen of the product. ' +
          'Each page contains an annotated screenshot with numbered markers ' +
          'highlighting the key interactive elements. A description of each ' +
          'element is listed below the image.',
        { width: CONTENT_WIDTH, lineGap: 4 },
      );

    doc.moveDown(1);

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(HEADING_COLOR)
      .text('Screens Overview', { width: CONTENT_WIDTH });

    doc.moveDown(0.5);

    screens.forEach((screen, i) => {
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor(BODY_COLOR)
        .text(`${i + 1}. ${screen.name} — ${screen.description}`, {
          width: CONTENT_WIDTH,
          lineGap: 3,
        });
      doc.moveDown(0.3);
    });
  }

  // -----------------------------------------------------------------------
  // Screen page
  // -----------------------------------------------------------------------

  private drawScreenPage(
    doc: InstanceType<typeof import('pdfkit')>,
    screen: ScreenInfo,
    includeAnnotations: boolean,
  ): void {
    // Page title
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor(HEADING_COLOR)
      .text(screen.name, MARGIN, MARGIN, { width: CONTENT_WIDTH });

    // Route / URL
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(SUBTLE_COLOR)
      .text(screen.route || screen.url, { width: CONTENT_WIDTH });

    doc.moveDown(0.5);

    const imageTop = doc.y;
    // Reserve space for the image – roughly half the content area
    const maxImageHeight = CONTENT_HEIGHT * 0.45;
    const maxImageWidth = CONTENT_WIDTH;

    // Embed screenshot if the file exists
    let imageHeight = maxImageHeight;
    let imageWidth = maxImageWidth;
    let imageScaleX = 1;
    let imageScaleY = 1;
    let originalWidth = maxImageWidth;
    let originalHeight = maxImageHeight;

    if (fs.existsSync(screen.screenshotPath)) {
      try {
        // Get image dimensions by embedding it
        const imgData = fs.readFileSync(screen.screenshotPath);
        // Use a simple approach: embed the image and let pdfkit handle sizing
        // We'll use default dimensions and scale proportionally
        // Try to read PNG dimensions from header (width at bytes 16-19, height at bytes 20-23)
        if (imgData.length > 24 && imgData[0] === 0x89 && imgData[1] === 0x50) {
          originalWidth = imgData.readUInt32BE(16);
          originalHeight = imgData.readUInt32BE(20);
        }

        // Scale to fit
        const scaleW = maxImageWidth / originalWidth;
        const scaleH = maxImageHeight / originalHeight;
        const scale = Math.min(scaleW, scaleH, 1);

        imageWidth = originalWidth * scale;
        imageHeight = originalHeight * scale;
        imageScaleX = imageWidth / originalWidth;
        imageScaleY = imageHeight / originalHeight;

        doc.image(screen.screenshotPath, MARGIN, imageTop, {
          width: imageWidth,
          height: imageHeight,
        });
      } catch {
        // If the image cannot be embedded, draw a placeholder
        doc
          .rect(MARGIN, imageTop, maxImageWidth, maxImageHeight)
          .strokeColor('#CCCCCC')
          .lineWidth(1)
          .stroke();
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor(SUBTLE_COLOR)
          .text('[ Screenshot unavailable ]', MARGIN, imageTop + maxImageHeight / 2 - 6, {
            width: maxImageWidth,
            align: 'center',
          });
        imageWidth = maxImageWidth;
        imageHeight = maxImageHeight;
      }
    } else {
      // Placeholder when file is missing
      doc
        .rect(MARGIN, imageTop, maxImageWidth, maxImageHeight)
        .strokeColor('#CCCCCC')
        .lineWidth(1)
        .stroke();
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(SUBTLE_COLOR)
        .text('[ Screenshot not found ]', MARGIN, imageTop + maxImageHeight / 2 - 6, {
          width: maxImageWidth,
          align: 'center',
        });
      imageWidth = maxImageWidth;
      imageHeight = maxImageHeight;
    }

    // ----- Annotations overlaid on the image -----
    if (includeAnnotations && screen.elements.length > 0) {
      screen.elements.forEach((el, idx) => {
        const num = idx + 1;

        // Map element bounds to the scaled image coordinates
        const cx = MARGIN + el.bounds.x * imageScaleX + (el.bounds.width * imageScaleX) / 2;
        const cy = imageTop + el.bounds.y * imageScaleY + (el.bounds.height * imageScaleY) / 2;

        // Clamp within image area
        const clampedCx = Math.max(MARGIN + ANNOTATION_CIRCLE_RADIUS, Math.min(cx, MARGIN + imageWidth - ANNOTATION_CIRCLE_RADIUS));
        const clampedCy = Math.max(imageTop + ANNOTATION_CIRCLE_RADIUS, Math.min(cy, imageTop + imageHeight - ANNOTATION_CIRCLE_RADIUS));

        // Draw filled circle
        doc
          .circle(clampedCx, clampedCy, ANNOTATION_CIRCLE_RADIUS)
          .fillAndStroke(ANNOTATION_COLOR, '#FFFFFF');

        // Number inside circle
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(ANNOTATION_TEXT_COLOR)
          .text(
            String(num),
            clampedCx - ANNOTATION_CIRCLE_RADIUS,
            clampedCy - 5,
            {
              width: ANNOTATION_CIRCLE_RADIUS * 2,
              align: 'center',
            },
          );

        // Arrow-like line from circle to right margin area
        const marginX = MARGIN + imageWidth + 5;
        const lineEndX = Math.min(marginX, PAGE_WIDTH - MARGIN);
        doc
          .strokeColor(ANNOTATION_COLOR)
          .lineWidth(0.8)
          .moveTo(clampedCx + ANNOTATION_CIRCLE_RADIUS, clampedCy)
          .lineTo(lineEndX, clampedCy)
          .stroke();
      });
    }

    // ----- Description text below image -----
    const descriptionTop = imageTop + imageHeight + 15;
    doc.y = descriptionTop;

    // Screen description
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(BODY_COLOR)
      .text(screen.description, MARGIN, descriptionTop, { width: CONTENT_WIDTH, lineGap: 3 });

    doc.moveDown(0.7);

    // Element list
    if (includeAnnotations && screen.elements.length > 0) {
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(HEADING_COLOR)
        .text('Elements:', { width: CONTENT_WIDTH });

      doc.moveDown(0.3);

      screen.elements.forEach((el, idx) => {
        const num = idx + 1;

        // Check if we need a new page for the remaining elements
        if (doc.y > PAGE_HEIGHT - MARGIN - 40) {
          doc.addPage();
        }

        // Colored number badge (inline)
        const badgeY = doc.y;
        doc
          .circle(MARGIN + 8, badgeY + 6, 8)
          .fill(ANNOTATION_COLOR);
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(ANNOTATION_TEXT_COLOR)
          .text(String(num), MARGIN, badgeY + 2, { width: 16, align: 'center' });

        // Label and type
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor(BODY_COLOR)
          .text(`${el.label}`, MARGIN + 22, badgeY, { width: CONTENT_WIDTH - 22, continued: true })
          .font('Helvetica')
          .fontSize(9)
          .fillColor(SUBTLE_COLOR)
          .text(`  (${el.type})`, { continued: false });

        doc.moveDown(0.3);
      });
    }
  }

  // -----------------------------------------------------------------------
  // Markdown generation
  // -----------------------------------------------------------------------

  private async generateMarkdown(
    screens: ScreenInfo[],
    opts: {
      title: string;
      language: string;
      includeAnnotations: boolean;
      mdPath: string;
    },
  ): Promise<void> {
    const lines: string[] = [];

    // Title
    lines.push(`# ${opts.title}`);
    lines.push('');
    lines.push(
      `> Generated by **ExplainIt** on ${new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    );
    lines.push('');

    // Table of contents
    lines.push('## Table of Contents');
    lines.push('');
    screens.forEach((screen, i) => {
      const anchor = screen.name
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, '-');
      lines.push(`${i + 1}. [${screen.name}](#${anchor})`);
    });
    lines.push('');

    // Summary
    lines.push('## How to Use the Product');
    lines.push('');
    lines.push(
      'This guide walks you through every screen of the product. ' +
        'Each section contains an annotated screenshot with numbered markers ' +
        'highlighting the key interactive elements.',
    );
    lines.push('');
    lines.push('### Screens Overview');
    lines.push('');
    screens.forEach((screen, i) => {
      lines.push(`${i + 1}. **${screen.name}** — ${screen.description}`);
    });
    lines.push('');
    lines.push('---');
    lines.push('');

    // Screen sections
    screens.forEach((screen) => {
      lines.push(`## ${screen.name}`);
      lines.push('');
      lines.push(`**Route:** \`${screen.route || screen.url}\``);
      lines.push('');
      lines.push(screen.description);
      lines.push('');

      // Screenshot reference
      const relScreenshot = path.relative(path.dirname(opts.mdPath), screen.screenshotPath);
      lines.push(`![${screen.name}](${relScreenshot.replace(/\\/g, '/')})`);
      lines.push('');

      // Elements
      if (opts.includeAnnotations && screen.elements.length > 0) {
        lines.push('### Elements');
        lines.push('');
        lines.push('| # | Label | Type | Selector |');
        lines.push('|---|-------|------|----------|');
        screen.elements.forEach((el, idx) => {
          lines.push(
            `| ${idx + 1} | ${el.label} | ${el.type} | \`${el.selector}\` |`,
          );
        });
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    });

    fs.writeFileSync(opts.mdPath, lines.join('\n'), 'utf-8');
  }
}
