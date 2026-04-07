import { PrismaClient } from '@prisma/client';
import { sendgridService } from './sendgrid.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export const emailService = {
  // ==================== CADENCES ====================

  async listCadences(accountId: string) {
    return prisma.emailCadence.findMany({
      where: { accountId },
      include: { steps: { orderBy: { ordem: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getCadence(id: string, accountId: string) {
    return prisma.emailCadence.findFirst({
      where: { id, accountId },
      include: {
        steps: { orderBy: { ordem: 'asc' } },
        enrollments: { include: { contact: true } },
      },
    });
  },

  async createCadence(data: {
    accountId: string;
    name: string;
    description?: string;
    targetStageIds?: string[];
    createdBy?: string;
  }) {
    return prisma.emailCadence.create({
      data: {
        accountId: data.accountId,
        name: data.name,
        description: data.description,
        targetStageIds: data.targetStageIds || [],
        createdBy: data.createdBy,
      },
      include: { steps: true },
    });
  },

  async updateCadence(id: string, accountId: string, data: {
    name?: string;
    description?: string;
    targetStageIds?: string[];
    active?: boolean;
  }) {
    return prisma.emailCadence.update({
      where: { id },
      data,
      include: { steps: { orderBy: { ordem: 'asc' } } },
    });
  },

  async deleteCadence(id: string, accountId: string) {
    return prisma.emailCadence.delete({ where: { id } });
  },

  // ==================== STEPS ====================

  async createStep(cadenceId: string, data: {
    dayNumber: number;
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    ordem?: number;
  }) {
    return prisma.emailCadenceStep.create({
      data: {
        cadenceId,
        dayNumber: data.dayNumber,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        bodyText: data.bodyText,
        ordem: data.ordem || 0,
      },
    });
  },

  async updateStep(id: string, data: {
    dayNumber?: number;
    subject?: string;
    bodyHtml?: string;
    bodyText?: string;
    active?: boolean;
    ordem?: number;
  }) {
    return prisma.emailCadenceStep.update({ where: { id }, data });
  },

  async deleteStep(id: string) {
    return prisma.emailCadenceStep.delete({ where: { id } });
  },

  // ==================== TEMPLATES ====================

  async listTemplates(accountId: string) {
    return prisma.emailTemplate.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createTemplate(data: {
    accountId: string;
    name: string;
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    category?: string;
    createdBy?: string;
  }) {
    return prisma.emailTemplate.create({ data });
  },

  async updateTemplate(id: string, data: {
    name?: string;
    subject?: string;
    bodyHtml?: string;
    bodyText?: string;
    category?: string;
  }) {
    return prisma.emailTemplate.update({ where: { id }, data });
  },

  async deleteTemplate(id: string) {
    return prisma.emailTemplate.delete({ where: { id } });
  },

  // ==================== ENROLLMENTS ====================

  async enrollContacts(data: {
    accountId: string;
    cadenceId: string;
    contactIds: string[];
  }) {
    const cadence = await prisma.emailCadence.findUnique({
      where: { id: data.cadenceId },
      include: { steps: { orderBy: { ordem: 'asc' }, take: 1 } },
    });

    if (!cadence) throw new Error('Cadência não encontrada');

    const firstStep = cadence.steps[0];
    const now = new Date();
    const nextSendAt = firstStep
      ? new Date(now.getTime() + firstStep.dayNumber * 24 * 60 * 60 * 1000)
      : null;

    const enrollments = await Promise.all(
      data.contactIds.map(async (contactId) => {
        // Check if already enrolled
        const existing = await prisma.emailEnrollment.findFirst({
          where: {
            cadenceId: data.cadenceId,
            contactId,
            status: 'active',
          },
        });
        if (existing) return existing;

        return prisma.emailEnrollment.create({
          data: {
            accountId: data.accountId,
            cadenceId: data.cadenceId,
            contactId,
            nextSendAt,
          },
        });
      })
    );

    return enrollments;
  },

  async unenrollContacts(cadenceId: string, contactIds: string[]) {
    return prisma.emailEnrollment.updateMany({
      where: {
        cadenceId,
        contactId: { in: contactIds },
        status: 'active',
      },
      data: { status: 'paused' },
    });
  },

  async listEnrollments(accountId: string, cadenceId?: string) {
    return prisma.emailEnrollment.findMany({
      where: {
        accountId,
        ...(cadenceId ? { cadenceId } : {}),
      },
      include: { contact: true, cadence: true },
      orderBy: { enrolledAt: 'desc' },
    });
  },

  // ==================== SENDS ====================

  async listSends(accountId: string, filters?: {
    cadenceId?: string;
    contactId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = { accountId };
    if (filters?.contactId) where.contactId = filters.contactId;
    if (filters?.status) where.status = filters.status;
    if (filters?.cadenceId) {
      where.enrollment = { cadenceId: filters.cadenceId };
    }

    return prisma.emailSend.findMany({
      where,
      include: { contact: true, step: true },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    });
  },

  async getSendStats(accountId: string) {
    const [total, sent, delivered, opened, clicked, bounced, failed] = await Promise.all([
      prisma.emailSend.count({ where: { accountId } }),
      prisma.emailSend.count({ where: { accountId, status: 'sent' } }),
      prisma.emailSend.count({ where: { accountId, status: 'delivered' } }),
      prisma.emailSend.count({ where: { accountId, status: 'opened' } }),
      prisma.emailSend.count({ where: { accountId, status: 'clicked' } }),
      prisma.emailSend.count({ where: { accountId, status: 'bounced' } }),
      prisma.emailSend.count({ where: { accountId, status: 'failed' } }),
    ]);

    return { total, sent, delivered, opened, clicked, bounced, failed };
  },

  // ==================== CADENCE PROCESSOR ====================

  async processCadenceQueue() {
    const now = new Date();

    // Find active enrollments ready to send
    const readyEnrollments = await prisma.emailEnrollment.findMany({
      where: {
        status: 'active',
        nextSendAt: { lte: now },
      },
      include: {
        cadence: { include: { steps: { orderBy: { ordem: 'asc' } } } },
        contact: true,
      },
      take: 50,
    });

    logger.info(`[EmailProcessor] Found ${readyEnrollments.length} enrollments to process`);

    for (const enrollment of readyEnrollments) {
      try {
        const steps = enrollment.cadence.steps.filter(s => s.active);
        const currentStep = steps[enrollment.currentStep];

        if (!currentStep || !enrollment.contact.email) {
          // No more steps or no email → mark as completed
          await prisma.emailEnrollment.update({
            where: { id: enrollment.id },
            data: { status: 'completed', completedAt: now },
          });
          continue;
        }

        // Get SendGrid credentials
        const creds = await sendgridService.getAccountCredentials(enrollment.accountId);
        if (!creds) {
          logger.warn(`[EmailProcessor] No SendGrid credentials for account ${enrollment.accountId}`);
          continue;
        }

        // Replace variables in subject/body
        const replacements: Record<string, string> = {
          '{nome}': enrollment.contact.nome || '',
          '{email}': enrollment.contact.email || '',
        };

        let subject = currentStep.subject;
        let bodyHtml = currentStep.bodyHtml;
        for (const [key, val] of Object.entries(replacements)) {
          subject = subject.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), val);
          bodyHtml = bodyHtml.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), val);
        }

        // Create send record
        const emailSend = await prisma.emailSend.create({
          data: {
            accountId: enrollment.accountId,
            enrollmentId: enrollment.id,
            stepId: currentStep.id,
            contactId: enrollment.contactId,
            toEmail: enrollment.contact.email,
            subject,
            status: 'queued',
          },
        });

        // Send via SendGrid
        const result = await sendgridService.sendEmail({
          to: enrollment.contact.email,
          subject,
          html: bodyHtml,
          text: currentStep.bodyText || undefined,
          fromEmail: creds.fromEmail,
          fromName: creds.fromName,
          apiKey: creds.apiKey,
        });

        if (result.success) {
          await prisma.emailSend.update({
            where: { id: emailSend.id },
            data: {
              status: 'sent',
              sentAt: now,
              sendgridMessageId: result.messageId,
            },
          });

          // Advance to next step
          const nextStepIndex = enrollment.currentStep + 1;
          const nextStep = steps[nextStepIndex];

          if (nextStep) {
            const nextSendAt = new Date(now.getTime() + nextStep.dayNumber * 24 * 60 * 60 * 1000);
            await prisma.emailEnrollment.update({
              where: { id: enrollment.id },
              data: { currentStep: nextStepIndex, nextSendAt },
            });
          } else {
            await prisma.emailEnrollment.update({
              where: { id: enrollment.id },
              data: { status: 'completed', completedAt: now },
            });
          }
        } else {
          await prisma.emailSend.update({
            where: { id: emailSend.id },
            data: { status: 'failed', errorMessage: result.error },
          });
        }
      } catch (error: any) {
        logger.error(`[EmailProcessor] Error processing enrollment ${enrollment.id}: ${error.message}`);
      }
    }

    return readyEnrollments.length;
  },
};
