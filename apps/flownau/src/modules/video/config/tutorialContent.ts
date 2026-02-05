import { TutorialStep } from '../store/useOnboardingStore'
import {
  Sparkles,
  Video,
  Clock,
  Settings,
  Play,
  Keyboard,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react'

export interface TutorialStepContent {
  id: TutorialStep
  title: string
  description: string
  icon: LucideIcon
  highlightElement?: string
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right'
  actionText?: string
  skipText?: string
}

export const tutorialContent: Record<TutorialStep, TutorialStepContent> = {
  welcome: {
    id: 'welcome',
    title: 'Welcome to Flownau Video Editor',
    description:
      'Create stunning videos with ease. This quick tutorial will show you the essential features to get started.',
    icon: Sparkles,
    position: 'center',
    actionText: 'Start Tutorial',
    skipText: 'Skip Tutorial',
  },

  'add-asset': {
    id: 'add-asset',
    title: 'Add Your First Asset',
    description:
      'Browse your project assets or cloud storage in the Library panel. Click any asset to add it to your timeline.',
    icon: Video,
    highlightElement: 'asset-browser',
    position: 'right',
    actionText: 'Next',
    skipText: 'Skip',
  },

  'timeline-basics': {
    id: 'timeline-basics',
    title: 'Timeline Basics',
    description:
      'Drag elements to reorder them, resize to adjust duration, and click to select. The playhead shows your current position.',
    icon: Clock,
    highlightElement: 'timeline',
    position: 'top',
    actionText: 'Next',
    skipText: 'Skip',
  },

  'properties-panel': {
    id: 'properties-panel',
    title: 'Properties Panel',
    description:
      'Select any element to edit its properties: position, size, opacity, and more. Changes update in real-time on the canvas.',
    icon: Settings,
    highlightElement: 'properties-panel',
    position: 'left',
    actionText: 'Next',
    skipText: 'Skip',
  },

  'playback-controls': {
    id: 'playback-controls',
    title: 'Playback Controls',
    description:
      'Preview your video with play/pause controls. Use the scrubber to jump to any point in your timeline.',
    icon: Play,
    highlightElement: 'playback-controls',
    position: 'bottom',
    actionText: 'Next',
    skipText: 'Skip',
  },

  shortcuts: {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    description:
      'Speed up your workflow with shortcuts:\n• Space: Play/Pause\n• Cmd/Ctrl+Z: Undo\n• Cmd/Ctrl+Shift+Z: Redo\n• Delete: Remove selected element\n• Cmd/Ctrl+/: Show all shortcuts',
    icon: Keyboard,
    position: 'center',
    actionText: 'Finish Tutorial',
    skipText: 'Skip',
  },

  complete: {
    id: 'complete',
    title: "You're All Set!",
    description:
      "You've completed the tutorial. Start creating amazing videos! You can restart this tutorial anytime from the help menu.",
    icon: CheckCircle2,
    position: 'center',
    actionText: 'Start Creating',
  },
}
