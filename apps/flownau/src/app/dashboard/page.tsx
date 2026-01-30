import { prisma } from '@/lib/prisma'
import { Instagram, Video } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default async function DashboardPage() {
  const accountsCount = await prisma.socialAccount.count()
  const templatesCount = await prisma.template.count()
  const recentRenders = await prisma.render.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { template: true },
  })

  // Using arbitrary values to match brand colors exactly while using Tailwind structure
  const stats = [
    {
      name: 'Active Accounts',
      value: accountsCount,
      icon: Instagram,
      iconClass: 'text-[#E1306C]',
      bgClass: 'bg-[#E1306C]/15'
    },
    {
      name: 'Total Templates',
      value: templatesCount,
      icon: Video,
      iconClass: 'text-[var(--accent-color)]',
      bgClass: 'bg-[var(--accent-color)]/15'
    },
  ]

  return (
    <div className="animate-fade-in">
      <header className="mb-10">
        <h1 className="text-3xl font-heading font-semibold mb-2">Dashboard Overview</h1>
        <p className="text-text-secondary">Monitor your automated video workflows.</p>
      </header>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-12">
        {stats.map((stat) => (
          <Card
            key={stat.name}
            className="flex items-center gap-5"
          >
            <div className={`p-3 rounded-xl ${stat.bgClass} ${stat.iconClass}`}>
              <stat.icon size={28} />
            </div>
            <div>
              <p className="text-sm text-text-secondary font-medium">{stat.name}</p>
              <h3 className="text-2xl font-heading font-bold">{stat.value}</h3>
            </div>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-2xl font-heading font-semibold mb-6">Recent Activity</h2>
        <div className="glass overflow-hidden">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/5 text-text-secondary text-sm font-medium">
                <th className="p-4 pl-6 font-heading">Template</th>
                <th className="p-4 font-heading">Status</th>
                <th className="p-4 font-heading">Date</th>
                <th className="p-4 pr-6 font-heading">Action</th>
              </tr>
            </thead>
            <tbody>
              {recentRenders.map((render: any) => (
                <tr
                  key={render.id}
                  className="border-b border-white/5 text-sm hover:bg-white/5 transition-colors duration-200"
                >
                  <td className="p-4 pl-6 font-medium text-white">{render.template.name}</td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide ${render.status === 'COMPLETED'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-amber-500/10 text-amber-500'
                        }`}
                    >
                      {render.status}
                    </span>
                  </td>
                  <td className="p-4 text-text-secondary">
                    {new Date(render.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </td>
                  <td className="p-4 pr-6">
                    <Button variant="ghost" size="sm" className="text-accent hover:text-accent-hover font-semibold text-sm transition-colors">
                      View
                    </Button>
                  </td>
                </tr>
              ))}
              {recentRenders.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="p-8 text-center text-text-secondary italic"
                  >
                    No recent activity found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
