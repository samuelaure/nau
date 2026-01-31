import Link from 'next/link'
import { ArrowRight, Video, Instagram, Zap, Shield } from 'lucide-react'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#1e1b4b,#000)] text-white overflow-hidden">
      {/* Navigation */}
      <nav className="flex justify-between items-center px-6 md:px-20 py-6 fixed top-0 w-full z-50 glass">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent rounded-lg">
            <Video size={20} color="white" />
          </div>
          <span className="font-extrabold text-xl font-heading tracking-wide">flownaŭ</span>
        </div>
        <Link href="/login" className="btn-primary px-6 py-2">
          Dashboard <ArrowRight size={18} />
        </Link>
      </nav>

      {/* Hero Section */}
      <main className="pt-40 flex flex-col items-center text-center max-w-5xl mx-auto px-6">
        <div className="animate-fade-in bg-accent/10 px-4 py-2 rounded-full border border-accent/30 text-accent text-sm font-semibold mb-6">
          Next Generation Video Automation
        </div>

        <h1 className="animate-fade-in text-5xl md:text-[72px] leading-[1.1] mb-6 font-heading font-bold">
          Scale your Instagram <br />
          <span className="text-accent">With Data-Driven Video</span>
        </h1>

        <p className="animate-fade-in text-xl text-text-secondary max-w-2xl mb-10 leading-relaxed">
          Automate the creation and publishing of Reels. Connect Airtable, manage multiple accounts,
          and let Remotion handle the rendering.
        </p>

        <div className="animate-fade-in flex gap-4">
          <Link
            href="/login"
            className="btn-primary px-8 py-4 text-lg"
          >
            Get Started <ArrowRight size={20} />
          </Link>
          <Button
            variant="outline"
            size="lg"
            className="text-lg"
          >
            Watch Demo
          </Button>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 w-full">
          {[
            {
              icon: Zap,
              title: 'Hyper-Fast Rendering',
              desc: 'Optimized Remotion engine running directly on Hetzner infrastructure.',
            },
            {
              icon: Shield,
              title: 'Secure Tokens',
              desc: 'AES-256-CBC encryption for all your Instagram Business credentials.',
            },
            {
              icon: Instagram,
              title: 'Multi-Account',
              desc: 'Manage and publish to dozens of accounts from a single interface.',
            },
          ].map((feature, i) => (
            <Card
              key={i}
              className="animate-fade-in flex flex-col items-center text-center md:items-start md:text-left"
              style={{ animationDelay: `${0.1 * (i + 1)}s` }}
            >
              <div className="text-accent mb-4">
                <feature.icon size={32} />
              </div>
              <h3 className="text-xl font-heading font-semibold mb-3">{feature.title}</h3>
              <p className="text-text-secondary text-[15px]">{feature.desc}</p>
            </Card>
          ))}
        </div>
      </main>

      {/* Decorative Blur */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent/15 blur-[150px] -z-10 rounded-full pointer-events-none" />
    </div>
  )
}
