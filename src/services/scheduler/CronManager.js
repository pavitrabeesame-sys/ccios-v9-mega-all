import { prisma } from "../../lib/prisma.js";

export async function runCCIOSCron() {
  await prisma.cronJob.upsert({
    where: { name: "ccios_v10_main" },
    update: { status: "RUNNING", lastRunAt: new Date() },
    create: { name: "ccios_v10_main", status: "RUNNING", lastRunAt: new Date() }
  });

  try {
    console.log("CCIOS Cron Running...");
    // TODO: Add your token refresh + review sync here

    await prisma.cronJob.update({
      where: { name: "ccios_v10_main" },
      data: { status: "SUCCESS", nextRunAt: new Date(Date.now() + 10 * 60 * 1000) }
    });
    return { success: true, message: "Cron completed" };
  } catch (error) {
    await prisma.cronJob.update({ where: { name: "ccios_v10_main" }, data: { status: "FAILED" } });
    throw error;
  }
}