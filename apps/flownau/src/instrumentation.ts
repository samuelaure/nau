export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startInternalCron } = await import('@/modules/scheduling/internal-cron')
    startInternalCron()
  }
}
