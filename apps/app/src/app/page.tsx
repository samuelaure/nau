import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSessionFromCookieStore } from '@nau/auth'
import { ArrowRight, BookOpen, Zap, Calendar } from 'lucide-react'

export const dynamic = 'force-dynamic'

const ACCOUNTS_URL = process.env['NEXT_PUBLIC_ACCOUNTS_URL'] ?? 'https://accounts.9nau.com'
const APP_URL = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://app.9nau.com'

export default async function LandingPage() {
  const cookieStore = await cookies()
  const session = await getSessionFromCookieStore(cookieStore)
  if (session) redirect('/home')

  const loginUrl = `${ACCOUNTS_URL}/login?redirect_uri=${encodeURIComponent(`${APP_URL}/home`)}`

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#0f172a,#000)] text-white overflow-hidden">
      {/* Nav */}
      <nav className="flex justify-between items-center px-6 md:px-20 py-6 fixed top-0 w-full z-50 backdrop-blur-md bg-black/20 border-b border-white/5">
        <span className="font-extrabold text-xl tracking-tight">9naŭ</span>
        <a
          href={loginUrl}
          className="bg-white text-gray-900 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-gray-100 transition-colors"
        >
          Log in
        </a>
      </nav>

      {/* Hero */}
      <main className="pt-40 flex flex-col items-center text-center max-w-4xl mx-auto px-6">
        <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10 text-white/60 text-sm font-medium mb-8">
          Your personal growth operating system
        </div>

        <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] mb-6 tracking-tight">
          Capture everything.
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
            Grow intentionally.
          </span>
        </h1>

        <p className="text-lg text-white/50 max-w-xl mb-10 leading-relaxed">
          Notes, actions, and experiences — unified in one place. AI-powered synthesis helps you
          reflect, plan, and act on what matters.
        </p>

        <a
          href={loginUrl}
          className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors"
        >
          Get started <ArrowRight size={20} />
        </a>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 w-full text-left">
          {[
            {
              icon: BookOpen,
              title: 'Journal',
              desc: 'Daily captures organised automatically. Never lose a thought or a moment.',
            },
            {
              icon: Zap,
              title: 'Actions',
              desc: 'GTD-style action tracking with AI triage. Inbox to done without friction.',
            },
            {
              icon: Calendar,
              title: 'Schedule',
              desc: 'See your week at a glance. Plan with context, not just a to-do list.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 flex flex-col gap-3"
            >
              <div className="text-indigo-400">
                <Icon size={28} />
              </div>
              <h3 className="font-semibold text-lg">{title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Glow */}
      <div className="absolute top-[25%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] -z-10 rounded-full pointer-events-none" />
    </div>
  )
}
