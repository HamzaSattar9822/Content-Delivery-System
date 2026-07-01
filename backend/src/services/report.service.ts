import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { AuditAction, LinkStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { BadRequestError } from '../utils/errors';

export type ReportType =
  | 'content-usage'
  | 'link-usage'
  | 'viewer-activity'
  | 'security-events'
  | 'expired-links';

export type ReportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ReportData {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export class ReportService {
  constructor(private readonly db = prisma) {}

  async build(type: ReportType): Promise<ReportData> {
    switch (type) {
      case 'content-usage':
        return this.contentUsage();
      case 'link-usage':
        return this.linkUsage();
      case 'viewer-activity':
        return this.viewerActivity();
      case 'security-events':
        return this.securityEvents();
      case 'expired-links':
        return this.expiredLinks();
      default:
        throw new BadRequestError('Unknown report type');
    }
  }

  private async contentUsage(): Promise<ReportData> {
    const content = await this.db.content.findMany({
      include: { category: true, _count: { select: { links: true, viewLogs: true } } },
      orderBy: { viewLogs: { _count: 'desc' } },
    });
    return {
      title: 'Content Usage Report',
      columns: ['Title', 'Type', 'Category', 'Status', 'Links', 'Total Views'],
      rows: content.map((c) => [
        c.title,
        c.fileType,
        c.category?.name ?? '-',
        c.status,
        c._count.links,
        c._count.viewLogs,
      ]),
    };
  }

  private async linkUsage(): Promise<ReportData> {
    const links = await this.db.accessLink.findMany({
      include: { content: { select: { title: true } } },
      orderBy: { viewCount: 'desc' },
    });
    return {
      title: 'Link Usage Report',
      columns: ['Label', 'Content', 'Status', 'Views', 'Max Views', 'Created', 'Expires'],
      rows: links.map((l) => [
        l.label ?? l.id,
        l.content.title,
        l.status,
        l.viewCount,
        l.maxViews ?? 'Unlimited',
        l.createdAt.toISOString(),
        l.neverExpire ? 'Never' : l.expiresAt?.toISOString() ?? '-',
      ]),
    };
  }

  private async viewerActivity(): Promise<ReportData> {
    const logs = await this.db.viewLog.findMany({
      take: 5000,
      orderBy: { createdAt: 'desc' },
      include: { content: { select: { title: true } } },
    });
    return {
      title: 'Viewer Activity Report',
      columns: ['Date', 'Content', 'Device', 'Browser', 'OS', 'Country', 'IP', 'Watch (s)', 'Completed'],
      rows: logs.map((v) => [
        v.createdAt.toISOString(),
        v.content.title,
        v.deviceType,
        v.browser ?? '-',
        v.os ?? '-',
        v.country ?? '-',
        v.ipAddress ?? '-',
        v.watchSeconds,
        v.completed ? 'Yes' : 'No',
      ]),
    };
  }

  private async securityEvents(): Promise<ReportData> {
    const logs = await this.db.auditLog.findMany({
      where: { action: { in: [AuditAction.ACCESS_DENIED, AuditAction.SECURITY_EVENT, AuditAction.LINK_REVOKE] } },
      take: 5000,
      orderBy: { createdAt: 'desc' },
    });
    return {
      title: 'Security Events Report',
      columns: ['Date', 'Action', 'Actor', 'Entity', 'IP', 'Details'],
      rows: logs.map((l) => [
        l.createdAt.toISOString(),
        l.action,
        l.actorEmail ?? '-',
        `${l.entityType ?? ''}:${l.entityId ?? ''}`,
        l.ipAddress ?? '-',
        JSON.stringify(l.metadata ?? {}),
      ]),
    };
  }

  private async expiredLinks(): Promise<ReportData> {
    const links = await this.db.accessLink.findMany({
      where: { status: LinkStatus.EXPIRED },
      include: { content: { select: { title: true } } },
      orderBy: { expiresAt: 'desc' },
    });
    return {
      title: 'Expired Links Report',
      columns: ['Label', 'Content', 'Views', 'Expired At'],
      rows: links.map((l) => [
        l.label ?? l.id,
        l.content.title,
        l.viewCount,
        l.expiresAt?.toISOString() ?? '-',
      ]),
    };
  }

  toCsv(data: ReportData): string {
    const escape = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [data.columns.map(escape).join(',')];
    for (const row of data.rows) lines.push(row.map(escape).join(','));
    return lines.join('\n');
  }

  async toXlsx(data: ReportData): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Content Delivery System';
    const ws = wb.addWorksheet(data.title.slice(0, 31));
    ws.addRow(data.columns);
    ws.getRow(1).font = { bold: true };
    for (const row of data.rows) ws.addRow(row);
    ws.columns.forEach((col) => {
      col.width = 22;
    });
    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  toPdf(data: ReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).text(data.title, { underline: false });
      doc.moveDown(0.5);
      doc.fontSize(8).fillColor('#666').text(`Generated ${new Date().toISOString()}`);
      doc.moveDown(0.5);
      doc.fillColor('#000').fontSize(9);

      doc.font('Helvetica-Bold').text(data.columns.join('  |  '));
      doc.moveTo(doc.x, doc.y).lineTo(800, doc.y).stroke();
      doc.font('Helvetica');
      for (const row of data.rows.slice(0, 1000)) {
        doc.text(row.map((c) => String(c)).join('  |  '));
      }
      doc.end();
    });
  }

  contentType(format: ReportFormat): string {
    switch (format) {
      case 'csv':
        return 'text/csv';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'pdf':
        return 'application/pdf';
    }
  }
}
