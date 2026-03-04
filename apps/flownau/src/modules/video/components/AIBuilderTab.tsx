'use client'

import { useState, Suspense, useEffect, useRef, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Button } from '@/modules/shared/components/ui/Button'
import { Textarea } from '@/modules/shared/components/ui/Textarea'
import { Card } from '@/modules/shared/components/ui/Card'
import { toast } from 'sonner'
import { AlertTriangle, Send, Undo2, Save, Maximize2, X, Smartphone } from 'lucide-react'
import { cn } from '@/modules/shared/utils'

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
                content: 'Hook/Headline Placeholder',
                startFrame: 30,
                durationInFrames: 120,
                safeZone: 'center-safe',
                color: '#FFFFFF',
                fontSize: 80,
                animation: 'fade',
            },
        ],
        audio: [
            {
                id: 'bg_music',
                type: 'audio',
                assetUrl: 'placeholder_music_url',
                startFrame: 0,
                durationInFrames: 300,
                volume: 0.5
            }
        ],
    },
}

// Sub-components defined OUTSIDE to prevent re-mounting focus issues
const PlayerWrapper = ({
    previewSchema,
    isFullscreen,
    setIsFullscreen,
    playerRef,
    isFocus = false
}: any) => {
    // Determine dimensions
    const width = previewSchema?.width || 1080
    const height = previewSchema?.height || 1920

    return (
        <div
            className={cn(
                "relative flex items-center justify-center bg-black/60 rounded-xl overflow-hidden border border-white/5 shadow-2xl transition-all duration-500 mx-auto",
                isFocus ? "w-auto h-full max-h-[95vh] max-w-full shadow-[0_0_100px_rgba(0,0,0,1)]" : "w-full h-full"
            )}
            style={{
                aspectRatio: `${width}/${height}`,
                // In side view, we might need a max-height to not overflow
                maxHeight: isFocus ? '95vh' : '500px'
            }}
        >
            {previewSchema ? (
                <Suspense fallback={<div className="animate-pulse text-accent">Loading Player...</div>}>
                    <RemotionPlayer
                        ref={playerRef}
                        component={DynamicCompositionMock}
                        inputProps={{ schema: previewSchema }}
                        durationInFrames={previewSchema.durationInFrames || 300}
                        compositionWidth={width}
                        compositionHeight={height}
                        fps={previewSchema.fps || 30}
                        autoPlay
                        controls // ENSURE CONTROLS ARE ON
                        loop
                        allowFullscreen={false} // We handle fullscreen ourselves
                        spaceKeyToPlayOrPause
                        className="w-full h-full"
                        style={{
                            width: '100%',
                            height: '100%',
                        }}
                    />
                </Suspense>
            ) : (
                <div className="text-gray-500">Initializing...</div>
            )}
            {!isFocus && (
                <button
                    onClick={() => setIsFullscreen(true)}
                    className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white/70 hover:text-white transition-all z-20"
                >
                    <Maximize2 size={18} />
                </button>
            )}
        </div>
    )
}

export default function AIBuilderTab({
    template,
    initialAssets,
}: {
    template: any
    initialAssets: any[]
}) {
    // 1. Core State
    const [schemaJson, setSchemaJson] = useState<any>(template.schemaJson || DEFAULT_SCHEMA)
    const [jsonText, setJsonText] = useState(JSON.stringify(template.schemaJson || DEFAULT_SCHEMA, null, 2))
    const [history, setHistory] = useState<any[]>([])

    // 2. Interaction State
    const [chatPrompt, setChatPrompt] = useState('')
    const [isIterating, setIsIterating] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)

    // 3. Asset Logic
    const [hasSufficientAssets, setHasSufficientAssets] = useState(true)
    const [previewSchema, setPreviewSchema] = useState<any>(null)

    const playerRef = useRef<any>(null)
    const debounceTimer = useRef<NodeJS.Timeout | null>(null)

    // Memoized validation to prevent unnecessary re-renders
    const validateManualJson = useCallback((text: string) => {
        try {
            const parsed = JSON.parse(text)
            if (JSON.stringify(parsed) !== JSON.stringify(schemaJson)) {
                setHistory((prev) => [...prev, JSON.parse(JSON.stringify(schemaJson))])
                setSchemaJson(parsed)
                toast.success('Preview updated')
            }
        } catch (e) {
            // Silently wait for valid JSON during typing
        }
    }, [schemaJson])

    // 4. Effects
    useEffect(() => {
        const requiredMediaSlots = schemaJson?.tracks?.media?.length || 0
        const videoAssets = initialAssets.filter(
            (a) => a.type.startsWith('video') || a.mimeType?.startsWith('video'),
        )

        setHasSufficientAssets(!(requiredMediaSlots > videoAssets.length && requiredMediaSlots > 0))

        const newSchema = JSON.parse(JSON.stringify(schemaJson))
        if (newSchema?.tracks?.media) {
            newSchema.tracks.media = newSchema.tracks.media.map((track: any) => {
                if (videoAssets.length > 0) {
                    const r = videoAssets[Math.floor(Math.random() * videoAssets.length)]
                    return { ...track, assetUrl: r.url }
                }
                return track
            })
        }
        setPreviewSchema(newSchema)
    }, [schemaJson, initialAssets])

    // 5. Handlers
    const handleIterate = async () => {
        if (!chatPrompt.trim()) return
        setIsIterating(true)
        setHistory((prev) => [...prev, JSON.parse(JSON.stringify(schemaJson))])

        try {
            const res = await fetch('/api/templates/ai-iterate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    schemaJson,
                    prompt: chatPrompt,
                    accountId: template.accountId,
                    templateId: template.id,
                    creationPrompt: template.creationPrompt || '',
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to iterate')

            setSchemaJson(data.schemaJson)
            setJsonText(JSON.stringify(data.schemaJson, null, 2))
            setChatPrompt('')
            toast.success('AI updated composition')
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setIsIterating(false)
        }
    }

    const handleUndo = () => {
        if (history.length === 0) return
        const previous = history[history.length - 1]
        setSchemaJson(previous)
        setJsonText(JSON.stringify(previous, null, 2))
        setHistory((prev) => prev.slice(0, -1))
        toast.info('Undone latest change')
    }

    const onJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value
        setJsonText(val)
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(() => validateManualJson(val), 2000)
    }

    const onJsonBlur = () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        try {
            const parsed = JSON.parse(jsonText)
            if (JSON.stringify(parsed) !== JSON.stringify(schemaJson)) {
                setHistory((prev) => [...prev, JSON.parse(JSON.stringify(schemaJson))])
                setSchemaJson(parsed)
                toast.success('Applied manual changes')
            }
        } catch (e) {
            toast.error('Invalid JSON structure - reverting view')
            setJsonText(JSON.stringify(schemaJson, null, 2))
        }
    }

    const handleSave = async () => {
        setIsSaving(true)
        const tId = toast.loading('Compiling composition logic...')
        try {
            const res = await fetch(`/api/templates/${template.id}/builder-save`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schemaJson }),
            })
            if (!res.ok) throw new Error('Save failed')
            toast.success('Template deployed and rules compiled!', { id: tId })
        } catch (error: any) {
            toast.error(error.message, { id: tId })
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[800px] mb-20">
            {/* LEFT: Instruction & Editor */}
            <div className="lg:col-span-7 flex flex-col gap-6">

                {/* 1. Instruction Engine */}
                <Card className="p-6 bg-white/5 border-white/10 shadow-2xl backdrop-blur-xl">
                    <div className="mb-4">
                        <h3 className="text-xl font-bold flex items-center gap-2 tracking-tight">
                            <Send size={20} className="text-accent" /> Instruction Engine
                        </h3>
                        <p className="text-sm text-text-secondary mt-1 opacity-70">Natural language adjustments to the composition.</p>
                    </div>

                    <div className="space-y-4">
                        <Textarea
                            placeholder="e.g. Move the text to the bottom and change duration to 15 seconds..."
                            value={chatPrompt}
                            onChange={(e) => setChatPrompt(e.target.value)}
                            className="bg-black/30 border-white/10 focus:border-accent/50 min-h-[120px] text-base leading-relaxed"
                        />
                        <div className="flex gap-3">
                            <Button
                                onClick={handleIterate}
                                disabled={isIterating || !chatPrompt}
                                className="flex-1 bg-accent hover:bg-accent/80 h-14 text-base font-bold shadow-accent/20 shadow-xl"
                            >
                                {isIterating ? 'Processing AI...' : 'Iterate Composition'}
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* 2. Manual Schema Editor */}
                <Card className="p-6 bg-white/5 border-white/10 flex-1 flex flex-col min-h-[450px]">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30">Raw Schema Node</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleUndo}
                                disabled={history.length === 0}
                                className="h-8 px-3 text-white/40 hover:text-white hover:bg-white/10 gap-2 border border-white/5 rounded-full transition-all"
                            >
                                <Undo2 size={14} />
                                <span className="text-[10px] font-bold">UNDO</span>
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] text-white/40 italic">Live syncing enabled</span>
                        </div>
                    </div>
                    <div className="flex-1 relative font-mono text-[11px]">
                        <textarea
                            value={jsonText}
                            onChange={onJsonChange}
                            onBlur={onJsonBlur}
                            className="absolute inset-0 w-full h-full bg-black/40 p-5 rounded-xl border border-white/10 focus:border-accent/40 outline-none resize-none overflow-auto leading-relaxed text-blue-300/80 selection:bg-accent/20 transition-all custom-scrollbar"
                            spellCheck={false}
                        />
                    </div>
                </Card>

                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full bg-success/80 hover:bg-success h-16 text-white text-lg font-black rounded-2xl shadow-success/10 shadow-2xl uppercase tracking-wider"
                >
                    <Save size={24} className="mr-3" />
                    {isSaving ? 'Deploying...' : 'Save & Publish Template'}
                </Button>
            </div>

            {/* RIGHT: High-Fidelity Preview */}
            <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="sticky top-8 space-y-6">

                    {/* Preview Context Label */}
                    <div className="flex items-center justify-between p-2 bg-white/5 border border-white/5 rounded-full px-4">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">
                            <Smartphone size={12} />
                            <span>Preview Mode: {schemaJson.width}x{schemaJson.height}</span>
                        </div>
                    </div>

                    {!hasSufficientAssets && (
                        <div className="bg-error/10 border border-error/20 p-5 rounded-2xl flex items-start gap-4 backdrop-blur-md">
                            <AlertTriangle className="text-error mt-0.5" size={24} />
                            <div>
                                <p className="text-sm font-black text-error uppercase tracking-tight">Production Alert</p>
                                <p className="text-xs text-error/70 mt-1 leading-relaxed">Structural video slots exceed available library assets. Add content to calibrate this template correctly.</p>
                                <Link
                                    href={`/dashboard/templates/${template.id}?tab=assets`}
                                    className="text-[10px] mt-3 inline-block px-3 py-1.5 bg-error text-white font-black uppercase rounded shadow-lg shadow-error/20"
                                >
                                    Open Assets Manager
                                </Link>
                            </div>
                        </div>
                    )}

                    <div className="p-4 bg-white/5 border border-white/5 rounded-[2rem] shadow-2xl flex justify-center items-center min-h-[300px]">
                        <PlayerWrapper
                            previewSchema={previewSchema}
                            isFullscreen={isFullscreen}
                            setIsFullscreen={setIsFullscreen}
                            playerRef={playerRef}
                        />
                    </div>

                    <Card className="p-5 bg-white/5 border-white/10 rounded-2xl">
                        <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4">Metadata Analysis</h4>
                        <div className="grid grid-cols-2 gap-6 text-xs">
                            <div className="flex flex-col gap-2">
                                <span className="text-white/30 font-bold uppercase tracking-tighter">Native Resolution</span>
                                <span className="text-sm font-medium">{schemaJson.width}x{schemaJson.height}</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-white/30 font-bold uppercase tracking-tighter">Timeline Length</span>
                                <span className="text-sm font-medium">{(schemaJson.durationInFrames / schemaJson.fps).toFixed(1)}s</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* FULLSCREEN FOCUS VIEW (Pseudo-Modal) */}
            {isFullscreen && (
                <div className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-xl animate-in fade-in zoom-in duration-300 flex items-center justify-center p-4">
                    <button
                        onClick={() => setIsFullscreen(false)}
                        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white/70 hover:text-white transition-all z-[1000]"
                    >
                        <X size={32} />
                    </button>

                    <div className="w-full h-full max-w-[95vw] max-h-[95vh] flex items-center justify-center">
                        <PlayerWrapper
                            previewSchema={previewSchema}
                            isFullscreen={isFullscreen}
                            setIsFullscreen={setIsFullscreen}
                            playerRef={playerRef}
                            isFocus={true}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
