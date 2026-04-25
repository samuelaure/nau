import { useEffect, useState } from 'react';
import { checkSession, redirectToLogin, SessionUser } from '../lib/auth';

export function LandingPage() {
  const [session, setSession] = useState<SessionUser | null | 'loading'>('loading');

  useEffect(() => {
    checkSession().then(setSession);
  }, []);

  const handleCta = () => {
    if (session && session !== 'loading') {
      window.location.href = '/';
    } else {
      redirectToLogin();
    }
  };

  const ctaLabel =
    session === 'loading' ? 'Loading…' : session ? 'Go to Dashboard →' : 'Get started →';

  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <header style={styles.header}>
          <span style={styles.wordmark}>naŭthenticity</span>
        </header>

        <main style={styles.main}>
          <h1 style={styles.headline}>
            Grow your brand with
            <br />
            <span style={styles.accent}>authentic engagement</span>
          </h1>
          <p style={styles.sub}>
            AI-powered comment intelligence that learns your voice, monitors your targets, and
            delivers on-brand engagement — automatically.
          </p>

          <div style={styles.features}>
            <Feature icon="🎯" title="Target Monitoring" desc="Track competitor and inspiration accounts. Get notified when they post." />
            <Feature icon="🧬" title="Brand DNA" desc="Define your voice once. Every comment sounds unmistakably like you." />
            <Feature icon="⚡" title="Smart Fanout" desc="Auto-generate and queue comments during your delivery window." />
          </div>

          <button
            style={styles.cta}
            onClick={handleCta}
            disabled={session === 'loading'}
          >
            {ctaLabel}
          </button>
        </main>

        <footer style={styles.footer}>
          <span>Part of the <a href="https://9nau.com" style={styles.link}>9naŭ</a> platform</span>
        </footer>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={styles.feature}>
      <span style={styles.featureIcon}>{icon}</span>
      <strong style={styles.featureTitle}>{title}</strong>
      <p style={styles.featureDesc}>{desc}</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: 'var(--bg-app)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  container: {
    maxWidth: '720px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '3rem',
  },
  header: {
    textAlign: 'center',
  },
  wordmark: {
    fontSize: '1.25rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--text-primary)',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
    textAlign: 'center',
  },
  headline: {
    fontSize: 'clamp(2rem, 5vw, 3rem)',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
    margin: 0,
    color: 'var(--text-primary)',
  },
  accent: {
    background: 'linear-gradient(90deg, var(--accent), #a78bfa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  sub: {
    fontSize: '1.1rem',
    color: 'var(--text-secondary)',
    maxWidth: '520px',
    margin: 0,
    lineHeight: 1.6,
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
    width: '100%',
    margin: '0.5rem 0',
  },
  feature: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    textAlign: 'left',
  },
  featureIcon: {
    fontSize: '1.4rem',
  },
  featureTitle: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  featureDesc: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: 1.5,
  },
  cta: {
    background: 'var(--accent)',
    color: '#0d1117',
    border: 'none',
    borderRadius: '8px',
    padding: '0.8rem 2rem',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    marginTop: '0.5rem',
  },
  footer: {
    textAlign: 'center',
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
  },
  link: {
    color: 'var(--accent)',
    textDecoration: 'none',
  },
};
