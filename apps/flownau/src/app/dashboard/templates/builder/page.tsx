'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/modules/shared/components/ui/Button'
import { Textarea } from '@/modules/shared/components/ui/Textarea'
import { Input } from '@/modules/shared/components/ui/Input'
import { Card } from '@/modules/shared/components/ui/Card'
import { toast } from 'sonner'

// Dynamically load Remotion Player to avoid Next.js SSR document not defined errors
const RemotionPlayer = dynamic(() => import('@remotion/player').then((mod) => mod.Player), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-800 w-full h-full rounded-md" />,
}) as any

const DynamicCompositionMock = dynamic(
  () =>
    import('@/modules/rendering/DynamicCompositionMock/DynamicCompositionMock').then(
      (mod) => mod.DynamicCompositionMock,
    ),
  { ssr: false },
)

const DEFAULT_SCHEMA = {
  format: 'reel',
  fps: 30,
  durationInFrames: 300,
  width: 1080,
  height: 1920,
  tracks: {
    media: [
      {
        id: 'bg_1',
        type: 'media',
        assetUrl: 'placeholder',
        startFrame: 0,
        durationInFrames: 300,
        mediaStartAt: 0,
        scale: 'cover',
      },
    ],
    text: [
      {
        id: 'headline_1',
        type: 'text',
        content: 'Default Headline Text',
        startFrame: 30,
        durationInFrames: 120,
        safeZone: 'center-safe',
        color: '#FFFFFF',
        fontSize: 80,
        animation: 'fade',
      },
    ],
    audio: [],
  },
}

export default function TemplateBuilderPage() {
  const router = useRouter()
  const [schemaJson, setSchemaJson] = useState<any>(DEFAULT_SCHEMA)
  const [history, setHistory] = useState<any[]>([])

  // Settings Mode
  const [templateName, setTemplateName] = useState('New Template')
  const [contentPrompt, setContentPrompt] = useState('Write an engaging hook.')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [autoApprove, setAutoApprove] = useState(false)

  // Prompting state
  const [chatPrompt, setChatPrompt] = useState('')
  const [isIterating, setIsIterating] = useState(false)
  const [isDescribing, setIsDescribing] = useState(false)

  // AI Iterator Function
  const handleIterate = async () => {
    if (!chatPrompt.trim()) return
    setIsIterating(true)

    // Save snapshot to history
    setHistory((prev) => [...prev, JSON.parse(JSON.stringify(schemaJson))])

    try {
      const res = await fetch('/api/templates/ai-iterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemaJson, prompt: chatPrompt }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to iterate')

      setSchemaJson(data.schemaJson)
      setChatPrompt('')
      toast.success('Template geometry updated')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsIterating(false)
    }
  }

  // Undo Function
  const handleUndo = () => {
    if (history.length === 0) return
    const previous = history[history.length - 1]
    setSchemaJson(previous)
    setHistory((prev) => prev.slice(0, -1))
    toast.info('Restored previous iteration')
  }

  // Description Generation
  const handleGenerateDescription = async () => {
    setIsDescribing(true)
    try {
      const res = await fetch('/api/templates/ai-describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemaJson }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setDescription(data.description)
      toast.success('Description auto-generated')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsDescribing(false)
    }
  }

  // Save Function
  const handleSave = async () => {
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          description,
          contentPrompt,
          schemaJson,
          isActive,
          autoApproveCompositions: autoApprove,
        }),
      })
      if (!res.ok) throw new Error('Could not save template')
      toast.success('Template saved successfully!')
      router.push('/dashboard/templates')
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  // Visual text length dummy injector
  const injectPlaceholderText = (length: 'short' | 'long') => {
    const textStr =
      length === 'short'
        ? 'Short Title'
        : 'This is a much longer placeholder text that spans multiple characters to test the boundary edges and wrapping capabilities of our dynamic components.'

    const newSchema = { ...schemaJson }
    newSchema.tracks.text = newSchema.tracks.text.map((t: any) => ({ ...t, content: textStr }))
    setSchemaJson(newSchema)
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden p-4 gap-4">
      {/* LEFT PANE: Remotion Player Mock */}
      <div className="flex-1 flex flex-col bg-gray-900 rounded-lg p-4 border border-gray-800">
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Preview (Mock Layout)</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => injectPlaceholderText('short')}>
              Test Short Text
            </Button>
            <Button variant="outline" size="sm" onClick={() => injectPlaceholderText('long')}>
              Test Long Text
            </Button>
          </div>
        </div>

        <div className="flex-1 bg-black rounded-lg overflow-hidden flex items-center justify-center relative">
          <Suspense fallback={<div>Loading Player...</div>}>
            <RemotionPlayer
              component={DynamicCompositionMock}
              inputProps={{ schema: schemaJson as any }}
              durationInFrames={schemaJson.durationInFrames || 300}
              compositionWidth={schemaJson.width || 1080}
              compositionHeight={schemaJson.height || 1920}
              fps={schemaJson.fps || 30}
              autoPlay
              controls
              loop
              spaceKeyToPlayOrPause
              style={{
                width: '100%',
                maxWidth: '400px',
                aspectRatio: '9/16',
              }}
            />
          </Suspense>
        </div>
      </div>

      {/* RIGHT PANE: Chat, Code & Config */}
      <div className="w-[450px] flex flex-col gap-4 overflow-y-auto pr-2 pb-10">
        {/* ITERATOR WIDGET */}
        <Card className="bg-gray-900 border border-gray-800 text-white flex flex-col p-4 gap-4">
          <div>
            <h3 className="text-lg font-bold">AI Layout Iterator</h3>
            <p className="text-sm text-gray-400">Describe changes to the JSON structure.</p>
          </div>
          <div className="flex flex-col gap-3">
            <Textarea
              placeholder="Make the font size 120 and move the safeZone to bottom-third..."
              value={chatPrompt}
              onChange={(e) => setChatPrompt(e.target.value)}
              className="bg-gray-950 border-gray-800"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleIterate}
                disabled={isIterating || !chatPrompt}
                className="flex-1"
              >
                {isIterating ? 'Iterating...' : 'Update Template'}
              </Button>
              <Button
                onClick={handleUndo}
                disabled={history.length === 0}
                variant="outline"
                className="border-gray-700 bg-gray-800 hover:bg-gray-700"
              >
                Undo Option
              </Button>
            </div>
          </div>
        </Card>

        {/* JSON VIEWER */}
        <Card className="bg-gray-900 border border-gray-800 text-white flex flex-col p-4 gap-4">
          <div>
            <h3 className="text-lg font-bold">Schema Payload</h3>
          </div>
          <div>
            <pre className="bg-gray-950 p-3 rounded-md text-xs font-mono overflow-auto max-h-[300px] border border-gray-800">
              {JSON.stringify(schemaJson, null, 2)}
            </pre>
          </div>
        </Card>

        {/* SETTINGS WIDGET */}
        <Card className="bg-gray-900 border border-gray-800 text-white flex flex-col p-4 gap-4">
          <div>
            <h3 className="text-lg font-bold">Save Template Configuration</h3>
          </div>
          <div className="flex flex-col gap-4">
            <div className="space-y-1">
              <label className="text-sm text-gray-400">Template Name</label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="bg-gray-950 border-gray-800 text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-400">
                Content Provision Prompt (for AI generation format)
              </label>
              <Textarea
                value={contentPrompt}
                onChange={(e) => setContentPrompt(e.target.value)}
                className="bg-gray-950 border-gray-800 text-white"
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm text-gray-400">Smart Target Description</label>
                <Button
                  onClick={handleGenerateDescription}
                  disabled={isDescribing}
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs bg-gray-800 border-gray-700 hover:bg-gray-700"
                >
                  {isDescribing ? 'Generating...' : 'Auto-Generate'}
                </Button>
              </div>
              <Textarea
                placeholder="Best for storytelling..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-gray-950 border-gray-800 text-white"
                rows={3}
              />
            </div>

            <div className="flex gap-4 p-3 bg-gray-950 border border-gray-800 rounded-md">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded bg-gray-800 border-gray-700"
                />
                Active in Automation
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={autoApprove}
                  onChange={(e) => setAutoApprove(e.target.checked)}
                  className="rounded bg-gray-800 border-gray-700"
                />
                Auto-Approve Trust
              </label>
            </div>

            <Button
              onClick={handleSave}
              className="w-full font-bold bg-blue-600 hover:bg-blue-700 mt-2"
            >
              Save Template Network
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
