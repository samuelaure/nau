'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/modules/shared/components/ui/Card'
import { Input } from '@/modules/shared/components/ui/Input'
import { Button } from '@/modules/shared/components/ui/Button'
import { Label } from '@/modules/shared/components/ui/Label'
import { Textarea } from '@/modules/shared/components/ui/Textarea'
import { Select } from '@/modules/shared/components/ui/Select'
import { Loader2, Wand2 } from 'lucide-react'
import { Player } from '@remotion/player'
import { DynamicComposition } from '@/modules/rendering/DynamicComposition'
import type { DynamicCompositionSchemaType } from '@/modules/rendering/DynamicComposition/schema'

export default function ComposePage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const accountId = params.id

    const [prompt, setPrompt] = useState('')
    const [format, setFormat] = useState('reel')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [schema, setSchema] = useState<DynamicCompositionSchemaType | null>(null)

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
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" onClick={() => router.back()}>← Back</Button>
                <h1 className="text-3xl font-heading font-semibold">Agent Compose ✨</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Form Setup */}
                <Card className="bg-panel border-border flex flex-col">
                    <div className="p-6">
                        <h3 className="text-xl font-heading font-semibold">Creative Direction</h3>
                        <p className="text-sm text-text-secondary mt-1">Tell the AI what kind of video you want to build.</p>
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
                                        { label: 'Instagram Story (9:16)', value: 'story' }
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
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                                />
                            </div>

                            {error && (
                                <div className="p-4 bg-error/10 border border-error/50 rounded-md text-error text-sm">
                                    {error}
                                </div>
                            )}

                            <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={loading || !prompt}>
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
                                    component={DynamicComposition}
                                    inputProps={{ schema }}
                                    durationInFrames={schema.durationInFrames || 150}
                                    fps={schema.fps || 30}
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

            {/* Raw Payload Block */}
            {schema && (
                <Card className="bg-panel border-border mt-8 flex flex-col">
                    <div className="p-4 border-b border-border">
                        <h3 className="text-sm font-semibold">Raw Zod Schema Payload</h3>
                    </div>
                    <div className="p-4">
                        <div className="bg-background rounded-md p-4 overflow-auto max-h-96 w-full text-xs font-mono">
                            <pre className="text-text-secondary">{JSON.stringify(schema, null, 2)}</pre>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    )
}
