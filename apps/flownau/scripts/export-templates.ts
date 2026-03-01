import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function exportTemplates() {
  try {
    const templates = await prisma.videoTemplate.findMany()
    const exportPath = path.join(process.cwd(), 'backups', `templates-backup-latest.json`)

    // Ensure backups directory exists
    const dir = path.dirname(exportPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(exportPath, JSON.stringify(templates, null, 2))
    console.log(`✅ Exported ${templates.length} templates to ${exportPath}`)
  } catch (error) {
    console.error('❌ Failed to export templates:', error)
  } finally {
    await prisma.$disconnect()
  }
}

exportTemplates()
