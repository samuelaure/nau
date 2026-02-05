'use client'

import React, { useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useOnboardingStore } from '../../store/useOnboardingStore'
import { tutorialContent } from '../../config/tutorialContent'
import { useElementSpotlight } from './HighlightableElement'

export function TutorialOverlay() {
  const {
    isActive,
    currentStep,
    highlightedElement,
    nextStep,
    previousStep,
    skipOnboarding,
    setHighlightedElement,
  } = useOnboardingStore()

  const spotlightPos = useElementSpotlight(highlightedElement)
  const stepContent = tutorialContent[currentStep]
  const stepIndex = Object.keys(tutorialContent).indexOf(currentStep)
  const totalSteps = Object.keys(tutorialContent).length - 1 // Exclude 'complete'

  useEffect(() => {
    if (stepContent.highlightElement) {
      setHighlightedElement(stepContent.highlightElement)
    } else {
      setHighlightedElement(null)
    }

    return () => setHighlightedElement(null)
  }, [currentStep, stepContent.highlightElement, setHighlightedElement])

  if (!isActive) return null

  const Icon = stepContent.icon

  const isFirstStep = stepIndex === 0
  const isLastStep = currentStep === 'shortcuts'

  return (
    <>
      {/* Consolidated Pierced Backdrop & Spotlight */}
      <div
        className="fixed inset-0 z-[100] animate-fade-in pointer-events-none"
        style={{
          background: highlightedElement
            ? `radial-gradient(circle at ${spotlightPos.x}% ${spotlightPos.y}%, transparent 120px, rgba(0,0,0,0.7) 250px)`
            : 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          pointerEvents: 'auto',
        }}
        onClick={skipOnboarding} // Clicking backdrop skips/closes tutorial
      />

      {/* Tutorial Card */}
      <div
        className={`
          fixed z-[102] max-w-md w-full mx-4
          ${stepContent.position === 'center' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : ''}
          ${stepContent.position === 'top' ? 'top-24 left-1/2 -translate-x-1/2' : ''}
          ${stepContent.position === 'bottom' ? 'bottom-24 left-1/2 -translate-x-1/2' : ''}
          ${stepContent.position === 'left' ? 'left-8 top-1/2 -translate-y-1/2' : ''}
          ${stepContent.position === 'right' ? 'right-8 top-1/2 -translate-y-1/2' : ''}
          animate-slide-up
        `}
      >
        <div className="bg-panel border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="relative bg-gradient-to-br from-accent/20 to-accent/5 p-6 border-b border-white/10">
            <button
              onClick={skipOnboarding}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close tutorial"
            >
              <X size={16} className="text-white/60 hover:text-white" />
            </button>

            <div className="flex items-start gap-4">
              <div className="p-3 bg-accent/20 rounded-xl border border-accent/30">
                <Icon size={24} className="text-accent" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-white mb-1">{stepContent.title}</h2>
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <span className="font-bold">
                    Step {stepIndex + 1} of {totalSteps}
                  </span>
                  <div className="flex gap-1">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 rounded-full transition-all ${
                          i <= stepIndex ? 'w-4 bg-accent' : 'w-2 bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {stepContent.description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between p-4 bg-white/[0.02] border-t border-white/5">
            <button
              onClick={previousStep}
              disabled={isFirstStep}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${
                  isFirstStep
                    ? 'opacity-30 cursor-not-allowed'
                    : 'hover:bg-white/10 text-text-secondary hover:text-white'
                }
              `}
            >
              <ChevronLeft size={16} />
              Back
            </button>

            <div className="flex gap-2">
              {stepContent.skipText && (
                <button
                  onClick={skipOnboarding}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-white hover:bg-white/10 transition-all"
                >
                  {stepContent.skipText}
                </button>
              )}
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-2 bg-accent hover:bg-accent/90 rounded-lg text-sm font-bold text-white transition-all shadow-lg shadow-accent/20"
              >
                {stepContent.actionText || 'Next'}
                {!isLastStep && <ChevronRight size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
