'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/modules/shared/components/ui/Card'
import { Button } from '@/modules/shared/components/ui/Button'
import { Label } from '@/modules/shared/components/ui/Label'
import { Textarea } from '@/modules/shared/components/ui/Textarea'
import { Select } from '@/modules/shared/components/ui/Select'
import { Loader2, Wand2, Film } from 'lucide-react'
import { Player } from '@remotion/player'
import { preloadAudio, preloadVideo } from '@remotion/preload'
import { DynamicTemplateMaster } from '@/modules/rendering/DynamicComposition'
import { DynamicCompositionSchema } from '@/modules/rendering/DynamicComposition/schema'
import type { DynamicCompositionSchemaType } from '@/modules/rendering/DynamicComposition/schema'
import { z } from 'zod'

export default function ComposePage() {
  const router = useRouter()
  const params = useParams()
  const accountId = params.id as string

  const [prompt, setPrompt] = useState('')
  const [format, setFormat] = useState('reel')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [schema, setSchema] = useState<DynamicCompositionSchemaType | null>(null)
  const [jsonString, setJsonString] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [compositionId, setCompositionId] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const [renderSuccess, setRenderSuccess] = useState<string | null>(null)

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/agent/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, accountId, format }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate composition')
      }

      setSchema(data.composition.schemaJson)
      setJsonString(JSON.stringify(data.composition.schemaJson, null, 2))
      setCompositionId(data.composition.id)
      setJsonError(null)
      setRenderSuccess(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setJsonString(text)
    try {
      const parsed = JSON.parse(text)
      const valid = DynamicCompositionSchema.parse(parsed)
      setSchema(valid)
      setJsonError(null)
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        setJsonError(`Schema Error: ${err.issues[0].message} at ${err.issues[0].path.join('.')}`)
      } else if (err instanceof SyntaxError) {
        setJsonError('Invalid JSON syntax')
      } else {
        setJsonError('Unknown validation error')
      }
    }
  }

  useEffect(() => {
    if (!schema) return
    const unmounts: Array<() => void> = []

    schema.tracks.media.forEach((node) => {
      if (node.assetUrl) {
        try {
          unmounts.push(preloadVideo(node.assetUrl))
        } catch (e) {
          console.error('Failed to preload video', node.assetUrl, e)
        }
      }
    })

    schema.tracks.audio.forEach((node) => {
      if (node.assetUrl) {
        try {
          unmounts.push(preloadAudio(node.assetUrl))
        } catch (e) {
          console.error('Failed to preload audio', node.assetUrl, e)
        }
      }
    })

    return () => {
      unmounts.forEach((unmount) => {
        try {
          unmount()
        } catch (e) {
          console.error(e)
        }
      })
    }
  }, [schema])

  const handleRender = async () => {
    if (!schema || !compositionId) return

    setRendering(true)
    setRenderSuccess(null)
    setError(null)

    try {
      const res = await fetch('/api/render/dynamic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema, compositionId, accountId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Render failed')
      }

      setRenderSuccess(data.videoUrl)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setRendering(false)
    }
  }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          ← Back
        </Button>
        <h1 className="text-3xl font-heading font-semibold">Agent Compose ✨</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Form Setup */}
        <Card className="bg-panel border-border flex flex-col">
          <div className="p-6">
            <h3 className="text-xl font-heading font-semibold">Creative Direction</h3>
            <p className="text-sm text-text-secondary mt-1">
              Tell the AI what kind of video you want to build.
            </p>
          </div>
          <div className="p-6 pt-0">
            <form onSubmit={handleGenerate} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="format">Video Format</Label>
                <Select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  options={[
                    { label: 'Instagram Reel (9:16)', value: 'reel' },
                    { label: 'Instagram Post (1:1)', value: 'post' },
                    { label: 'Instagram Story (9:16)', value: 'story' },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt">Prompt Editor</Label>
                <Textarea
                  id="prompt"
                  placeholder="e.g. Create a high energy 15 second promo. Start with a split screen hook with our logo, then transition to a full-screen lifestyle shot with bold white text saying 'Summer Sale'."
                  className="h-32 bg-background font-mono text-sm"
                  value={prompt}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setPrompt(e.target.value)
                  }
                />
              </div>

              {error && (
                <div className="p-4 bg-error/10 border border-error/50 rounded-md text-error text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90"
                disabled={loading || !prompt}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Thinking & Composing...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generate Timeline
                  </>
                )}
              </Button>
            </form>
          </div>
        </Card>

        {/* Output Preview */}
        <Card className="bg-panel border-border overflow-hidden flex flex-col">
          <div className="p-6">
            <h3 className="text-xl font-heading font-semibold">Timeline Preview</h3>
          </div>
          <div className="flex-1 p-6 flex flex-col items-center justify-center min-h-[500px] border-t border-border bg-black/50 overflow-hidden relative">
            {loading ? (
              <div className="flex flex-col items-center justify-center text-text-secondary animate-pulse gap-4">
                <div className="w-12 h-12 rounded-full border-t-2 border-accent animate-spin" />
                <p>Agent is calculating frames...</p>
              </div>
            ) : schema ? (
              <div className="w-full max-w-[340px] aspect-[9/16] shadow-2xl rounded-lg overflow-hidden relative">
                <Player
                  component={DynamicTemplateMaster}
                  inputProps={{ schema }}
                  durationInFrames={Math.max(1, schema.durationInFrames || 150)}
                  fps={Math.max(1, schema.fps || 30)}
                  compositionWidth={schema.width || 1080}
                  compositionHeight={schema.height || 1920}
                  style={{ width: '100%', height: '100%' }}
                  controls
                  autoPlay
                  loop
                />
              </div>
            ) : (
              <div className="text-text-secondary text-sm flex flex-col items-center">
                <Wand2 className="w-8 h-8 opacity-20 mb-2" />
                <p>Waiting for generation...</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Schema Override & Render Execution */}
      {schema && (
        <Card className="bg-panel border-border mt-8 flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Timeline JSON Override</h3>
              <p className="text-xs text-text-secondary">
                Changes reflect instantly on Player. Valid Zod schema required to compile.
              </p>
            </div>
            <Button
              onClick={handleRender}
              disabled={rendering || jsonError !== null}
              className="bg-accent hover:bg-accent/90"
            >
              {rendering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Compiling...
                </>
              ) : (
                <>
                  <Film className="mr-2 h-4 w-4" />
                  Compile & Output MP4
                </>
              )}
            </Button>
          </div>
          <div className="p-4">
            {renderSuccess && (
              <div className="mb-4 p-4 bg-green-500/10 border border-green-500/50 rounded-md text-green-500 text-sm flex items-center justify-between">
                <span>Render complete! Compilation successful.</span>
                <a
                  href={renderSuccess}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-green-500/20 rounded hover:bg-green-500/30 transition-colors"
                >
                  View MP4
                </a>
              </div>
            )}
            <Textarea
              value={jsonString}
              onChange={handleEditorChange}
              spellCheck={false}
              className={`min-h-[400px] font-mono text-sm leading-relaxed p-4 bg-background ${jsonError ? 'border-error ring-1 ring-error' : 'border-border'}`}
            />
            {jsonError && (
              <div className="mt-4 p-4 bg-error/10 border border-error/50 rounded-md text-error text-sm font-mono">
                {jsonError}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
