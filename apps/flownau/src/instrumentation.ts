export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startInternalCron } = await import('@/modules/scheduling/internal-cron')
    startInternalCron()

    // Any asset stuck in 'processing' means the previous container died mid-job.
    // Reset them to 'pending' so they show as retriable in the UI.
    const { prisma } = await import('@/modules/shared/prisma')
    await prisma.asset
      .updateMany({
        where: { optimizationStatus: 'processing' },
        data: { optimizationStatus: 'failed' },
      })
      .catch(() => {})
  }
}
