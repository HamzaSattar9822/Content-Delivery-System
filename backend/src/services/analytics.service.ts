import { ContentStatus, FileType, LinkStatus } from '@prisma/client';
import { prisma } from '../db/prisma';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export class AnalyticsService {
  constructor(private readonly db = prisma) {}

  /** High-level dashboard metrics. */
  async dashboard() {
    const [
      totalContent,
      totalVideos,
      totalPdfs,
      contentByTypeRows,
      activeLinks,
      expiredLinks,
      revokedLinks,
      totalViews,
      viewsToday,
      mostViewed,
      recentActivity,
      viewsByTypeRows,
    ] = await Promise.all([
      this.db.content.count({ where: { status: { not: ContentStatus.ARCHIVED } } }),
      this.db.content.count({
        where: { fileType: FileType.VIDEO, status: { not: ContentStatus.ARCHIVED } },
      }),
      this.db.content.count({
        where: { fileType: FileType.PDF, status: { not: ContentStatus.ARCHIVED } },
      }),
      this.db.content.groupBy({
        by: ['fileType'],
        where: { status: { not: ContentStatus.ARCHIVED } },
        _count: true,
      }),
      this.db.accessLink.count({ where: { status: LinkStatus.ACTIVE } }),
      this.db.accessLink.count({ where: { status: LinkStatus.EXPIRED } }),
      this.db.accessLink.count({ where: { status: LinkStatus.REVOKED } }),
      this.db.viewLog.count(),
      this.db.viewLog.count({ where: { createdAt: { gte: startOfToday() } } }),
      this.db.content.findMany({
        take: 5,
        orderBy: { viewLogs: { _count: 'desc' } },
        select: {
          id: true,
          title: true,
          fileType: true,
          _count: { select: { viewLogs: true } },
        },
      }),
      this.db.viewLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          content: { select: { title: true, fileType: true } },
          link: { select: { label: true } },
        },
      }),
      this.db.viewLog.groupBy({
        by: ['contentId'],
        _count: true,
      }),
    ]);

    // Aggregate views by content file type.
    const contentIds = viewsByTypeRows.map((r) => r.contentId);
    const contentTypes = contentIds.length
      ? await this.db.content.findMany({
          where: { id: { in: contentIds } },
          select: { id: true, fileType: true },
        })
      : [];
    const typeById = new Map(contentTypes.map((c) => [c.id, c.fileType]));
    const viewsByFileTypeMap = new Map<string, number>();
    for (const row of viewsByTypeRows) {
      const type = typeById.get(row.contentId) ?? 'OTHER';
      viewsByFileTypeMap.set(type, (viewsByFileTypeMap.get(type) ?? 0) + row._count);
    }

    return {
      totalContent,
      totalVideos,
      totalPdfs,
      contentByType: contentByTypeRows.map((r) => ({ key: r.fileType, count: r._count })),
      viewsByFileType: Array.from(viewsByFileTypeMap.entries()).map(([key, count]) => ({ key, count })),
      activeLinks,
      expiredLinks,
      revokedLinks,
      totalViews,
      viewsToday,
      mostViewedContent: mostViewed.map((c) => ({
        id: c.id,
        title: c.title,
        fileType: c.fileType,
        views: c._count.viewLogs,
      })),
      recentActivity: recentActivity.map((v) => ({
        id: v.id,
        content: v.content.title,
        fileType: v.content.fileType,
        link: v.link.label,
        deviceType: v.deviceType,
        browser: v.browser,
        country: v.country,
        ipAddress: v.ipAddress,
        createdAt: v.createdAt,
      })),
    };
  }

  /** Detailed analytics, optionally scoped to a single link or content item. */
  async detailed(filter: { linkId?: string; contentId?: string; from?: Date; to?: Date }) {
    const where = {
      ...(filter.linkId ? { linkId: filter.linkId } : {}),
      ...(filter.contentId ? { contentId: filter.contentId } : {}),
      ...(filter.from || filter.to
        ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
        : {}),
    };

    const sessionWhere = {
      ...(filter.linkId ? { linkId: filter.linkId } : {}),
      ...(filter.from || filter.to
        ? { startedAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
        : {}),
    };

    const [totalViews, viewers, sessions, durationAgg, completed, deviceTypes, browsers, countries, viewsWithContent] =
      await Promise.all([
        this.db.viewLog.count({ where }),
        this.db.viewLog.findMany({ where, select: { ipAddress: true } }),
        this.db.session.count({ where: sessionWhere }),
        this.db.viewLog.aggregate({ where, _avg: { watchSeconds: true }, _sum: { watchSeconds: true } }),
        this.db.viewLog.count({ where: { ...where, completed: true } }),
        this.db.viewLog.groupBy({ by: ['deviceType'], where, _count: true }),
        this.db.viewLog.groupBy({ by: ['browser'], where, _count: true }),
        this.db.viewLog.groupBy({ by: ['country'], where, _count: true }),
        this.db.viewLog.findMany({
          where,
          select: { content: { select: { fileType: true } } },
        }),
      ]);

    const ipCounts = new Map<string, number>();
    for (const v of viewers) {
      const ip = v.ipAddress ?? 'unknown';
      ipCounts.set(ip, (ipCounts.get(ip) ?? 0) + 1);
    }
    const uniqueViewers = ipCounts.size;
    const repeatViewers = Array.from(ipCounts.values()).filter((c) => c > 1).length;

    const fileTypeCounts = new Map<string, number>();
    for (const v of viewsWithContent) {
      const key = v.content.fileType;
      fileTypeCounts.set(key, (fileTypeCounts.get(key) ?? 0) + 1);
    }

    return {
      totalViews,
      uniqueViewers,
      repeatViewers,
      sessions,
      averageWatchSeconds: Math.round(durationAgg._avg.watchSeconds ?? 0),
      totalWatchSeconds: durationAgg._sum.watchSeconds ?? 0,
      completionRate: totalViews ? Math.round((completed / totalViews) * 100) : 0,
      fileTypes: Array.from(fileTypeCounts.entries()).map(([key, count]) => ({ key, count })),
      deviceTypes: deviceTypes.map((d) => ({ key: d.deviceType, count: d._count })),
      browsers: browsers.map((b) => ({ key: b.browser ?? 'Unknown', count: b._count })),
      countries: countries.map((c) => ({ key: c.country ?? 'Unknown', count: c._count })),
    };
  }

  /** Daily view counts for the last N days (timeseries for charts). */
  async timeseries(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const rows = await this.db.viewLog.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });
    const buckets = new Map<string, number>();
    for (const r of rows) {
      const key = r.createdAt.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }
}
