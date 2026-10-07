import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import type { InvoiceData, InvoiceLine } from './invoice.js';

/** Noto Sans (SIL OFL 1.1, assets/fonts/OFL.txt): has ₹, which the PDF standard fonts lack. */
const FONT_REGULAR = fileURLToPath(new URL('../../assets/fonts/NotoSans-Regular.ttf', import.meta.url));
const FONT_BOLD = fileURLToPath(new URL('../../assets/fonts/NotoSans-Bold.ttf', import.meta.url));

const INK = '#111827';
const MUTED = '#6b7280';
const RULE = '#d1d5db';
const SHADE = '#f3f4f6';
const DEMO_FILL = '#fef3c7';
const DEMO_INK = '#92400e';
const ALERT_FILL = '#fee2e2';
const ALERT_INK = '#991b1b';

const MARGIN = 40;
/** Room above the content for the running header on every page. */
const TOP = 58;
const BOTTOM = 52;

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rupees = (paise: number) => money.format(paise / 100);
const date = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const day = (iso: string) => date.format(new Date(iso));

type Doc = PDFKit.PDFDocument;
type Align = 'left' | 'right' | 'center';
interface Column {
  label: string;
  width: number;
  align: Align;
  value: (line: InvoiceLine, index: number) => string;
}

/** Renders the invoice as an A4 PDF. Long orders continue on further pages with the table header repeated. */
export function renderInvoicePdf(invoice: InvoiceData): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: TOP, bottom: BOTTOM, left: MARGIN, right: MARGIN },
    bufferPages: true,
    displayTitle: true,
    info: { Title: `${invoice.title} ${invoice.number}`, Author: invoice.seller.name, Subject: invoice.demoNote },
  });
  doc.registerFont('regular', FONT_REGULAR);
  doc.registerFont('bold', FONT_BOLD);
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const width = doc.page.width - MARGIN * 2;
  const limit = () => doc.page.height - BOTTOM;
  /** Starts a new page when `height` more points won't fit. */
  const ensure = (height: number) => {
    if (doc.y + height > limit()) doc.addPage();
  };
  const text = (value: string, x: number, y: number, options: PDFKit.Mixins.TextOptions & { font?: string; size?: number; color?: string } = {}) => {
    const { font = 'regular', size = 9, color = INK, ...rest } = options;
    doc.font(font).fontSize(size).fillColor(color).text(value, x, y, { lineBreak: false, ...rest });
  };
  /** One table cell; numbers that don't fit shrink rather than wrap. */
  const cell = (value: string, x: number, y: number, w: number, align: Align, font = 'regular', size = 8) => {
    let s = size;
    doc.font(font);
    while (s > 6 && doc.fontSize(s).widthOfString(value) > w - 6) s -= 0.5;
    text(value, x + 3, y, { width: w - 6, align, font, size: s });
  };

  // ── Title and invoice details ──
  text(invoice.title, MARGIN, TOP, { font: 'bold', size: 20 });
  text(invoice.seller.name, MARGIN, TOP + 28, { font: 'bold', size: 10 });
  const details: [string, string][] = [
    ['Invoice no.', invoice.number],
    ['Invoice date', day(invoice.invoiceDate)],
    ['Order ID', invoice.orderId],
    ['Order date', day(invoice.orderDate)],
  ];
  details.forEach(([label, value], i) => {
    const y = TOP + 2 + i * 14;
    text(label, MARGIN + width - 210, y, { width: 90, color: MUTED });
    text(value, MARGIN + width - 120, y, { width: 120, align: 'right', font: 'bold' });
  });
  doc.y = TOP + 64;

  const box = (message: string, fill: string, ink: string, size = 10) => {
    const y = doc.y;
    doc.rect(MARGIN, y, width, 22).fill(fill);
    text(message, MARGIN + 10, y + 5, { font: 'bold', size, color: ink, width: width - 20 });
    doc.y = y + 30;
  };
  box(invoice.demoNote, DEMO_FILL, DEMO_INK);
  if (invoice.banner) box(invoice.banner, ALERT_FILL, ALERT_INK, 11);

  // ── Seller and buyer ──
  const half = (width - 20) / 2;
  const party = (x: number, heading: string, lines: [string, string?][]) => {
    let y = doc.y;
    text(heading.toUpperCase(), x, y, { font: 'bold', size: 7.5, color: MUTED, characterSpacing: 0.5 });
    y += 13;
    for (const [value, font] of lines) {
      doc.font(font ?? 'regular').fontSize(9);
      const h = doc.heightOfString(value, { width: half });
      doc.fillColor(INK).text(value, x, y, { width: half });
      y += h + 1;
    }
    return y;
  };
  const top = doc.y;
  const sellerEnd = party(MARGIN, 'Sold by', [
    [invoice.seller.name, 'bold'],
    ...invoice.seller.addressLines.map((l): [string] => [l]),
    [`GSTIN: ${invoice.seller.gstin}`],
  ]);
  doc.y = top;
  const buyerEnd = party(MARGIN + half + 20, 'Bill to / Ship to', [
    [invoice.billTo.name, 'bold'],
    ...invoice.billTo.lines.map((l): [string] => [l]),
    [`Place of supply: ${invoice.billTo.state}`],
  ]);
  doc.y = Math.max(sellerEnd, buyerEnd) + 10;
  text(invoice.supply === 'intra' ? 'Tax: CGST + SGST (intra-state supply)' : 'Tax: IGST (inter-state supply)', MARGIN, doc.y, { size: 8.5, color: MUTED });
  doc.y += 18;

  // ── Lines ──
  const intra = invoice.supply === 'intra';
  const fixed: Column[] = [
    { label: 'Qty', width: 28, align: 'right', value: (l) => String(l.quantity) },
    { label: 'Unit price', width: 66, align: 'right', value: (l) => rupees(l.unitPricePaise) },
    { label: 'GST', width: 30, align: 'right', value: (l) => `${l.ratePercent}%` },
    { label: 'Taxable value', width: 68, align: 'right', value: (l) => rupees(l.taxablePaise) },
    ...(intra
      ? [
          { label: 'CGST', width: 56, align: 'right', value: (l) => rupees(l.cgstPaise) } satisfies Column,
          { label: 'SGST', width: 56, align: 'right', value: (l) => rupees(l.sgstPaise) } satisfies Column,
        ]
      : [{ label: 'IGST', width: 62, align: 'right', value: (l) => rupees(l.igstPaise) } satisfies Column]),
    { label: 'Amount', width: 72, align: 'right', value: (l) => rupees(l.amountPaise) },
  ];
  const numberWidth = 20;
  const descriptionWidth = width - numberWidth - fixed.reduce((sum, c) => sum + c.width, 0);
  const columns: Column[] = [
    { label: '#', width: numberWidth, align: 'left', value: (_l, i) => String(i + 1) },
    { label: 'Description', width: descriptionWidth, align: 'left', value: (l) => l.description },
    ...fixed,
  ];
  const tableHeader = () => {
    const y = doc.y;
    doc.rect(MARGIN, y, width, 18).fill(SHADE);
    let x = MARGIN;
    for (const c of columns) {
      cell(c.label, x, y + 5, c.width, c.align, 'bold', 7.5);
      x += c.width;
    }
    doc.y = y + 18;
  };
  ensure(60);
  tableHeader();
  invoice.lines.forEach((line, i) => {
    doc.font('regular').fontSize(8);
    const descriptionHeight = doc.heightOfString(line.description, { width: descriptionWidth - 6 });
    const height = Math.max(descriptionHeight, 10) + 10;
    if (doc.y + height > limit()) {
      doc.addPage();
      text('Items (continued)', MARGIN, doc.y, { font: 'bold', size: 9 });
      doc.y += 16;
      tableHeader();
    }
    const y = doc.y;
    let x = MARGIN;
    for (const c of columns) {
      if (c.label === 'Description') {
        doc.font('regular').fontSize(8).fillColor(INK).text(line.description, x + 3, y + 5, { width: c.width - 6 });
      } else {
        cell(c.value(line, i), x, y + 5, c.width, c.align);
      }
      x += c.width;
    }
    doc.moveTo(MARGIN, y + height).lineTo(MARGIN + width, y + height).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.y = y + height;
  });

  // ── Totals ──
  const t = invoice.totals;
  const totalRows: [string, string, boolean?][] = [
    ['Items total', rupees(t.itemsPaise)],
    ['Delivery', t.deliveryPaise ? rupees(t.deliveryPaise) : 'Free'],
    ['Invoice total (GST inclusive)', rupees(t.totalPaise), true],
    ['Taxable value', rupees(t.taxablePaise)],
    ...(intra
      ? ([
          ['CGST', rupees(t.cgstPaise)],
          ['SGST', rupees(t.sgstPaise)],
        ] as [string, string][])
      : ([['IGST', rupees(t.igstPaise)]] as [string, string][])),
    ['Total tax', rupees(t.taxPaise), true],
  ];
  ensure(totalRows.length * 15 + 30);
  doc.y += 10;
  const totalsTop = doc.y;
  const totalsX = MARGIN + width - 250;
  totalRows.forEach(([label, value, strong], i) => {
    const y = totalsTop + i * 15;
    const font = strong ? 'bold' : 'regular';
    text(label, totalsX, y, { width: 160, font, color: strong ? INK : MUTED });
    text(value, totalsX + 160, y, { width: 90, align: 'right', font });
  });
  text('Amount in words', MARGIN, totalsTop, { font: 'bold', size: 7.5, color: MUTED });
  doc.font('regular').fontSize(9).fillColor(INK).text(invoice.amountInWords, MARGIN, totalsTop + 12, { width: width - 270 });
  doc.y = Math.max(totalsTop + totalRows.length * 15, doc.y) + 16;

  // ── Payment ──
  const sectionHeading = (title: string) => {
    doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + width, doc.y).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.y += 8;
    text(title, MARGIN, doc.y, { font: 'bold', size: 11 });
    doc.y += 18;
  };
  const p = invoice.payment;
  const paymentRows: [string, string, boolean?][] = [
    ['Paid with', p.label],
    ...(p.emi ? ([['EMI plan', p.emi]] as [string, string][]) : []),
    ['Invoice total', rupees(t.totalPaise)],
    ...p.discounts.map((d): [string, string] => [d.label, `−${rupees(d.amountPaise)}`]),
    ['Amount paid', rupees(p.paidPaise), true],
  ];
  ensure(paymentRows.length * 15 + 60);
  sectionHeading('Payment');
  for (const [label, value, strong] of paymentRows) {
    const font = strong ? 'bold' : 'regular';
    const y = doc.y;
    text(label, MARGIN, y, { width: 230, font, color: strong ? INK : MUTED });
    text(value, MARGIN + 230, y, { width: width - 230, align: 'right', font });
    doc.y = y + 15;
  }
  doc.font('regular').fontSize(8).fillColor(MUTED).text(p.note, MARGIN, doc.y + 2, { width });
  doc.y += 14;

  // ── Refunds ──
  if (invoice.refunds.length > 0) {
    ensure(70);
    doc.y += 6;
    sectionHeading('Refunds');
    const refundColumns = [
      { label: 'Date', width: 70, align: 'left' as Align },
      { label: 'Details', width: width - 70 - 130 - 80 - 70, align: 'left' as Align },
      { label: 'Refunded to', width: 130, align: 'left' as Align },
      { label: 'Amount', width: 80, align: 'right' as Align },
      { label: 'Status', width: 70, align: 'center' as Align },
    ];
    const refundHeader = () => {
      const y = doc.y;
      doc.rect(MARGIN, y, width, 18).fill(SHADE);
      let x = MARGIN;
      for (const c of refundColumns) {
        cell(c.label, x, y + 5, c.width, c.align, 'bold', 7.5);
        x += c.width;
      }
      doc.y = y + 18;
    };
    refundHeader();
    for (const refund of invoice.refunds) {
      const values = [day(refund.date), refund.what, refund.to, rupees(refund.amountPaise), refund.status];
      doc.font('regular').fontSize(8);
      const height = Math.max(...refundColumns.map((c, i) => (c.align !== 'right' ? doc.heightOfString(values[i]!, { width: c.width - 6 }) : 10))) + 10;
      if (doc.y + height > limit()) {
        doc.addPage();
        refundHeader();
      }
      const y = doc.y;
      let x = MARGIN;
      refundColumns.forEach((c, i) => {
        if (c.align === 'right') cell(values[i]!, x, y + 5, c.width, c.align);
        else doc.font('regular').fontSize(8).fillColor(INK).text(values[i]!, x + 3, y + 5, { width: c.width - 6, align: c.align });
        x += c.width;
      });
      doc.moveTo(MARGIN, y + height).lineTo(MARGIN + width, y + height).lineWidth(0.5).strokeColor(RULE).stroke();
      doc.y = y + height;
    }
    doc.font('regular').fontSize(8).fillColor(MUTED).text('Refunds are listed for reference; the sale above is unchanged. Demo refunds — no money moves.', MARGIN, doc.y + 6, {
      width,
    });
  }

  // ── Running header and footer on every page ──
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    // Drawing in the margins must not start new pages.
    const margins = { ...doc.page.margins };
    doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
    text(`${invoice.title} · ${invoice.number}`, MARGIN, 24, { size: 8, color: MUTED });
    text(invoice.demoNote, MARGIN, 24, { width, align: 'right', size: 8, font: 'bold', color: DEMO_INK });
    doc.moveTo(MARGIN, 38).lineTo(MARGIN + width, 38).lineWidth(0.5).strokeColor(RULE).stroke();
    const footerY = doc.page.height - 34;
    text(`${invoice.demoNote} ${invoice.seller.name} is a fictional seller.`, MARGIN, footerY, { size: 7.5, color: MUTED });
    text(`Page ${i - range.start + 1} of ${range.count}`, MARGIN, footerY, { width, align: 'right', size: 7.5, color: MUTED });
    doc.page.margins = margins;
  }

  doc.end();
  return done;
}
