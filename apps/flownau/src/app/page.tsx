import Link from 'next/link'
import { ArrowRight, Video, Instagram, Zap, Shield } from 'lucide-react'

export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at top right, #1e1b4b, #000)',
        color: 'white',
        overflow: 'hidden',
      }}
    >
      {/* Navigation */}
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px 80px',
          position: 'fixed',
          top: 0,
          width: '100%',
          zIndex: 100,
        }}
        className="glass"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '8px', background: 'var(--accent-color)', borderRadius: '8px' }}>
            <Video size={20} color="white" />
          </div>
          <span style={{ fontWeight: '800', fontSize: '20px', fontFamily: 'Outfit' }}>FLOWNAU</span>
        </div>
        <Link href="/login" className="btn-primary" style={{ padding: '8px 24px' }}>
          Dashboard <ArrowRight size={18} />
        </Link>
      </nav>

      {/* Hero Section */}
      <main
        style={{
          paddingTop: '160px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: '1000px',
          margin: '0 auto',
        }}
      >
        <div
          className="animate-fade-in"
          style={{
            background: 'rgba(124, 58, 237, 0.1)',
            padding: '8px 16px',
            borderRadius: '100px',
            border: '1px solid rgba(124, 58, 237, 0.3)',
            color: 'var(--accent-color)',
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '24px',
          }}
        >
          Next Generation Video Automation
        </div>

        <h1
          className="animate-fade-in"
          style={{
            fontSize: '72px',
            lineHeight: '1.1',
            marginBottom: '24px',
            fontFamily: 'Outfit',
          }}
        >
          Scale your Instagram <br />
          <span style={{ color: 'var(--accent-color)' }}>With Data-Driven Video</span>
        </h1>

        <p
          className="animate-fade-in"
          style={{
            fontSize: '20px',
            color: 'var(--text-secondary)',
            maxWidth: '600px',
            marginBottom: '40px',
            lineHeight: '1.6',
          }}
        >
          Automate the creation and publishing of Reels. Connect Airtable, manage multiple accounts,
          and let Remotion handle the rendering.
        </p>

        <div className="animate-fade-in" style={{ display: 'flex', gap: '16px' }}>
          <Link
            href="/login"
            className="btn-primary"
            style={{ padding: '16px 32px', fontSize: '18px' }}
          >
            Get Started <ArrowRight size={20} />
          </Link>
          <button
            style={{
              padding: '16px 32px',
              fontSize: '18px',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'white',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Watch Demo
          </button>
        </div>

        {/* Feature Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '32px',
            marginTop: '100px',
            width: '100%',
          }}
        >
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
            <div
              key={i}
              className="card animate-fade-in"
              style={{ animationDelay: `${0.1 * (i + 1)}s` }}
            >
              <div style={{ color: 'var(--accent-color)', marginBottom: '16px' }}>
                <feature.icon size={32} />
              </div>
              <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>{feature.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Decorative Blur */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '600px',
          background: 'rgba(124, 58, 237, 0.15)',
          filter: 'blur(150px)',
          zIndex: -1,
          borderRadius: '50%',
        }}
      />
    </div>
  )
}
