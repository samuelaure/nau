'use client'

import React, { useEffect, useState } from 'react'
import { Sparkles, Video, Zap, Shield, X } from 'lucide-react'
import { useOnboardingStore } from '../../store/useOnboardingStore'

export function WelcomeModal() {
  const { hasCompletedOnboarding, startOnboarding, skipOnboarding } = useOnboardingStore()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Show welcome modal only on first visit
    if (!hasCompletedOnboarding) {
      // Delay to allow page to load
      const timer = setTimeout(() => setIsVisible(true), 500)
      return () => clearTimeout(timer)
    }
  }, [hasCompletedOnboarding])

  const handleStartTutorial = () => {
    setIsVisible(false)
    startOnboarding()
  }

  const handleSkip = () => {
    setIsVisible(false)
    skipOnboarding()
  }

  if (!isVisible || hasCompletedOnboarding) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] animate-fade-in" />

      {/* Modal */}
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-panel border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="relative bg-gradient-to-br from-accent via-accent/80 to-accent/60 p-8 text-center">
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close welcome modal"
            >
              <X size={18} className="text-white/80 hover:text-white" />
            </button>

            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mb-4 border border-white/30">
              <Sparkles size={40} className="text-white" />
            </div>

            <h1 className="text-3xl font-bold text-white mb-2 font-heading">Welcome to Flownau</h1>
            <p className="text-white/80 text-sm max-w-md mx-auto">
              A powerful, intuitive video editor built for creators who demand precision and speed.
            </p>
          </div>

          {/* Features */}
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FeatureCard
                icon={Video}
                title="Professional Tools"
                description="Timeline editing, multi-layer composition, and real-time preview"
              />
              <FeatureCard
                icon={Zap}
                title="Lightning Fast"
                description="Optimized performance with 60fps playback and instant updates"
              />
              <FeatureCard
                icon={Shield}
                title="Auto-Save"
                description="Never lose your work with automatic saving and recovery"
              />
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                onClick={handleStartTutorial}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-accent hover:bg-accent/90 rounded-xl text-base font-bold text-white transition-all shadow-lg shadow-accent/20"
              >
                <Sparkles size={18} />
                Start Interactive Tutorial
              </button>
              <button
                onClick={handleSkip}
                className="px-6 py-4 border border-white/10 hover:bg-white/5 rounded-xl text-base font-medium text-text-secondary hover:text-white transition-all"
              >
                Skip for Now
              </button>
            </div>

            <p className="text-center text-xs text-white/30 pt-2">
              You can restart the tutorial anytime from the Help menu
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

interface FeatureCardProps {
  icon: React.ComponentType<{ size: number; className?: string }>
  title: string
  description: string
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="flex flex-col items-center text-center p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-accent/30 hover:bg-accent/5 transition-all">
      <div className="p-3 bg-accent/10 rounded-lg mb-3 border border-accent/20">
        <Icon size={20} className="text-accent" />
      </div>
      <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
      <p className="text-xs text-text-secondary leading-relaxed">{description}</p>
    </div>
  )
}
