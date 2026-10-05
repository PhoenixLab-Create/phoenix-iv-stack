import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';

const TERMINAL_STATUSES = new Set(['SIGNED', 'NOT_PROCEEDING', 'CANCELLED']);

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const visits = await this.prisma.visit.findMany({
      include: { patient: true },
      orderBy: { startedAt: 'desc' },
      take: 200, // simple cap — a real pagination scheme is a post-MVP refinement, not needed for the PRD's "keep it simple" dashboard
    });

    const incomplete = visits.filter((v) => !TERMINAL_STATUSES.has(v.status));
    const completed = visits.filter((v) => v.status === 'SIGNED');

    return {
      incompleteVisits: incomplete.map(this.toSummaryRow),
      completedVisits: completed.map(this.toSummaryRow),
    };
  }

  private toSummaryRow(v: any) {
    return {
      visitId: v.id,
      patientName: `${v.patient.firstName} ${v.patient.lastName}`,
      status: v.status,
      startedAt: v.startedAt,
      signedAt: v.signedAt,
    };
  }
}
