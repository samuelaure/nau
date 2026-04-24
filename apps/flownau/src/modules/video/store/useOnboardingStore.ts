import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TutorialStep =
  | 'welcome'
  | 'add-asset'
  | 'timeline-basics'
  | 'properties-panel'
  | 'playback-controls'
  | 'shortcuts'
  | 'complete'

interface OnboardingState {
  // State
  hasCompletedOnboarding: boolean
  currentStep: TutorialStep
  isActive: boolean
  highlightedElement: string | null

  // Actions
  startOnboarding: () => void
  completeOnboarding: () => void
  nextStep: () => void
  previousStep: () => void
  skipOnboarding: () => void
  setHighlightedElement: (elementId: string | null) => void
  resetOnboarding: () => void
}

const tutorialSteps: TutorialStep[] = [
  'welcome',
  'add-asset',
  'timeline-basics',
  'properties-panel',
  'playback-controls',
  'shortcuts',
  'complete',
]

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      // Initial State
      hasCompletedOnboarding: false,
      currentStep: 'welcome',
      isActive: false,
      highlightedElement: null,

      // Actions
      startOnboarding: () => {
        set({
          isActive: true,
          currentStep: 'welcome',
          highlightedElement: null,
        })
      },

      completeOnboarding: () => {
        set({
          hasCompletedOnboarding: true,
          isActive: false,
          currentStep: 'complete',
          highlightedElement: null,
        })
      },

      nextStep: () => {
        const { currentStep } = get()
        const currentIndex = tutorialSteps.indexOf(currentStep)

        if (currentIndex < tutorialSteps.length - 1) {
          const nextStep = tutorialSteps[currentIndex + 1]
          set({ currentStep: nextStep })

          // Auto-complete when reaching the last step
          if (nextStep === 'complete') {
            get().completeOnboarding()
          }
        }
      },

      previousStep: () => {
        const { currentStep } = get()
        const currentIndex = tutorialSteps.indexOf(currentStep)

        if (currentIndex > 0) {
          set({ currentStep: tutorialSteps[currentIndex - 1] })
        }
      },

      skipOnboarding: () => {
        set({
          hasCompletedOnboarding: true,
          isActive: false,
          currentStep: 'complete',
          highlightedElement: null,
        })
      },

      setHighlightedElement: (elementId: string | null) => {
        set({ highlightedElement: elementId })
      },

      resetOnboarding: () => {
        set({
          hasCompletedOnboarding: false,
          currentStep: 'welcome',
          isActive: false,
          highlightedElement: null,
        })
      },
    }),
    {
      name: 'flownau-onboarding',
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    },
  ),
)
