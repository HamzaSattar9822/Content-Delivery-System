import { Request, Response } from 'express';
import { container } from '../container';
import { BadRequestError } from '../utils/errors';
import { ReportFormat, ReportType } from '../services/report.service';

const { reportService } = container.services;

const VALID_TYPES: ReportType[] = [
  'content-usage',
  'link-usage',
  'viewer-activity',
  'security-events',
  'expired-links',
];
const VALID_FORMATS: ReportFormat[] = ['csv', 'xlsx', 'pdf'];

export const reportController = {
  async export(req: Request, res: Response): Promise<void> {
    const type = req.params.type as ReportType;
    const format = (String(req.query.format ?? 'csv') as ReportFormat);
    if (!VALID_TYPES.includes(type)) throw new BadRequestError('Unknown report type');
    if (!VALID_FORMATS.includes(format)) throw new BadRequestError('Unknown report format');

    const data = await reportService.build(type);
    const filename = `${type}-${new Date().toISOString().slice(0, 10)}.${format}`;
    res.setHeader('Content-Type', reportService.contentType(format));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (format === 'csv') {
      res.send(reportService.toCsv(data));
    } else if (format === 'xlsx') {
      res.send(await reportService.toXlsx(data));
    } else {
      res.send(await reportService.toPdf(data));
    }
  },
};
