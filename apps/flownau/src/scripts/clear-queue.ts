import { renderQueue } from '@/modules/renderer/render-queue'

async function main() {
  await renderQueue.obliterate({ force: true })
  console.log('✅ Render queue cleared.')
}

main().catch(console.error).finally(() => renderQueue.close())
