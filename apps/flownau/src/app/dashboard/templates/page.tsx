import { prisma } from '@/modules/shared/prisma'
import { Video, Globe } from 'lucide-react'
import AddTemplateButton from '@/modules/video/components/AddTemplateButton'
import TemplateCard from '@/modules/video/components/TemplateCard'
import { Card } from '@/modules/shared/components/ui/Card'

export default async function TemplatesPage() {
  const [templates, accounts] = await Promise.all([
    prisma.template.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { renders: true } },
        account: { select: { username: true, platform: true } },
      },
    }),
    prisma.user
      .findFirst()
      .then((user) =>
        user
          ? prisma.socialAccount.findMany({
              where: { userId: user.id },
              select: { id: true, username: true, platform: true },
            })
          : [],
      )
      .then((accounts) =>
        accounts.map((acc) => ({
          ...acc,
          username: acc.username || '',
        })),
      ),
  ])

  // Group templates by account
  const groupedTemplates: Record<string, typeof templates> = {}
  const unassignedTemplates: typeof templates = []

  templates.forEach((t) => {
    if (t.accountId && t.account) {
      const key = t.account.username || 'Unknown Account'
      if (!groupedTemplates[key]) {
        groupedTemplates[key] = []
      }
      groupedTemplates[key].push(t)
    } else {
      unassignedTemplates.push(t)
    }
  })

  return (
    <div className="animate-fade-in">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-heading font-semibold mb-2">Video Templates</h1>
          <p className="text-text-secondary">Automated video schemas linked to Airtable tables.</p>
        </div>
        <AddTemplateButton label="New Template" accounts={accounts} />
      </header>

      <div className="flex flex-col gap-10">
        {Object.entries(groupedTemplates).map(([accountName, accountTemplates]) => (
          <div key={accountName}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-[linear-gradient(45deg,#f09433_0%,#e6683c_25%,#dc2743_50%,#cc2366_75%,#bc1888_100%)] flex items-center justify-center text-white">
                <Video size={16} />
              </div>
              <h2 className="text-xl font-heading font-semibold">{accountName}</h2>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6">
              {accountTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} context="templates" />
              ))}
            </div>
          </div>
        ))}

        {unassignedTemplates.length > 0 && (
          <div>
            {Object.keys(groupedTemplates).length > 0 && (
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center text-text-secondary">
                  <Globe size={16} />
                </div>
                <h2 className="text-xl font-heading font-semibold">Global Templates</h2>
              </div>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6">
              {unassignedTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} context="templates" />
              ))}
            </div>
          </div>
        )}

        {templates.length === 0 && (
          <Card className="col-span-full py-20 px-10 text-center border-dashed bg-transparent flex flex-col items-center">
            <Video size={48} className="text-text-secondary mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No templates created</h3>
            <p className="text-text-secondary mb-6">
              Create your first video template and link it to an Airtable table.
            </p>
            <AddTemplateButton label="Create Template" accounts={accounts} />
          </Card>
        )}
      </div>
    </div>
  )
}
