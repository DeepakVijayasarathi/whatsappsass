import { prisma } from "./prisma";
import { sendWhatsAppTemplate } from "./whatsapp";
import type { ProviderConfig } from "./whatsapp";
import { fireWebhooks } from "./webhookDispatcher";

async function getWorkspaceConfig(workspaceId: string) {
  return prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      metaWhatsappEnabled: true,
      whatsappProvider: true,
      metaPhoneNumberId: true,
      metaAccessToken: true,
      msg91AuthKey: true,
      msg91IntegratedNumber: true,
    },
  });
}

// ── One-shot campaign scheduler ───────────────────────────────────────────────
async function runScheduledCampaigns() {
  const now = new Date();

  const due = await prisma.campaign.findMany({
    where: { status: "draft", scheduledAt: { lte: now } },
    select: { id: true, workspaceId: true, template: true },
  });

  for (const campaign of due) {
    const claimed = await prisma.campaign.updateMany({
      where: { id: campaign.id, status: "draft" },
      data: { status: "running" },
    });
    if (claimed.count === 0) continue;

    try {
      const ws = await getWorkspaceConfig(campaign.workspaceId);
      if (!ws) {
        // Workspace deleted between queueing and execution — skip silently
        await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "paused" } });
        continue;
      }
      if (!ws.metaWhatsappEnabled) {
        await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "paused" } });
        continue;
      }

      const config: ProviderConfig = {
        provider: (ws.whatsappProvider as "meta" | "msg91") || "meta",
        metaPhoneNumberId: ws.metaPhoneNumberId ?? undefined,
        metaAccessToken: ws.metaAccessToken ?? undefined,
        msg91AuthKey: ws.msg91AuthKey ?? undefined,
        msg91IntegratedNumber: ws.msg91IntegratedNumber ?? undefined,
      };

      const contacts = await prisma.contact.findMany({
        where: { workspaceId: campaign.workspaceId, optIn: true },
        select: { id: true, phone: true },
      });

      let sent = 0, failed = 0;
      for (const contact of contacts) {
        try {
          const result = await sendWhatsAppTemplate(
            { to: contact.phone, templateName: campaign.template, languageCode: "en_US", components: [] },
            config
          );
          await prisma.messageLog.create({
            data: { workspaceId: campaign.workspaceId, contactId: contact.id, campaignId: campaign.id, wamid: result.wamid, status: "sent" },
          });
          sent++;
        } catch {
          await prisma.messageLog.create({
            data: { workspaceId: campaign.workspaceId, contactId: contact.id, campaignId: campaign.id, status: "failed" },
          });
          failed++;
        }
      }

      await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "completed" } });
      await fireWebhooks(campaign.workspaceId, "campaign.completed", {
        campaignId: campaign.id, sent, failed, total: contacts.length,
      });
      console.log(`[scheduler] Campaign ${campaign.id} done — sent:${sent} failed:${failed}`);
    } catch (err) {
      console.error(`[scheduler] Campaign ${campaign.id} errored:`, err);
      await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "paused" } });
    }
  }
}

// ── Drip sequence scheduler ───────────────────────────────────────────────────
async function runSequenceSteps() {
  const now = new Date();

  // Find active enrollments that haven't completed
  const enrollments = await prisma.sequenceEnrollment.findMany({
    where: { status: "active" },
    include: {
      sequence: {
        include: {
          steps: { orderBy: { stepNumber: "asc" } },
        },
      },
      contact: { select: { id: true, phone: true, workspaceId: true } },
    },
  });

  for (const enrollment of enrollments) {
    const { sequence, contact } = enrollment;
    if (sequence.status !== "active") continue;

    const steps = sequence.steps;
    const nextStep = steps[enrollment.currentStep];
    if (!nextStep) {
      // All steps done
      await prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "completed", completedAt: now },
      });
      continue;
    }

    // Check if it's time to send this step
    const sendAt = new Date(enrollment.startedAt);
    sendAt.setDate(sendAt.getDate() + nextStep.delayDays);
    if (now < sendAt) continue;

    // Claim this step
    const claimed = await prisma.sequenceEnrollment.updateMany({
      where: { id: enrollment.id, currentStep: enrollment.currentStep, status: "active" },
      data: { currentStep: enrollment.currentStep + 1 },
    });
    if (claimed.count === 0) continue;

    try {
      const ws = await getWorkspaceConfig(contact.workspaceId);
      if (!ws) continue; // workspace deleted — skip
      if (!ws.metaWhatsappEnabled) continue;

      const config: ProviderConfig = {
        provider: (ws.whatsappProvider as "meta" | "msg91") || "meta",
        metaPhoneNumberId: ws.metaPhoneNumberId ?? undefined,
        metaAccessToken: ws.metaAccessToken ?? undefined,
        msg91AuthKey: ws.msg91AuthKey ?? undefined,
        msg91IntegratedNumber: ws.msg91IntegratedNumber ?? undefined,
      };

      const result = await sendWhatsAppTemplate(
        { to: contact.phone, templateName: nextStep.templateName, languageCode: nextStep.languageCode, components: [] },
        config
      );

      await prisma.messageLog.create({
        data: { workspaceId: contact.workspaceId, contactId: contact.id, wamid: result.wamid, status: "sent" },
      });

      await fireWebhooks(contact.workspaceId, "sequence.step_sent", {
        sequenceId: sequence.id,
        contactId: contact.id,
        stepNumber: nextStep.stepNumber,
        template: nextStep.templateName,
      });

      // If this was the last step, mark enrollment complete
      if (enrollment.currentStep + 1 >= steps.length) {
        await prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: { status: "completed", completedAt: new Date() },
        });
      }

      console.log(`[scheduler] Sequence ${sequence.id} step ${nextStep.stepNumber} sent to contact ${contact.id}`);
    } catch (err) {
      console.error(`[scheduler] Sequence step failed for enrollment ${enrollment.id}:`, err);
      // Roll back step counter so it retries next tick
      await prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { currentStep: enrollment.currentStep },
      });
    }
  }
}

export function startScheduler(intervalMs = 60_000) {
  runScheduledCampaigns().catch(console.error);
  runSequenceSteps().catch(console.error);
  setInterval(() => {
    runScheduledCampaigns().catch(console.error);
    runSequenceSteps().catch(console.error);
  }, intervalMs);
  console.log("[scheduler] Campaign + sequence scheduler started");
}
