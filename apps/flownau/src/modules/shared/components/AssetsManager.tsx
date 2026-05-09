'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import axios from 'axios'
import NextImage from 'next/image'
import { useDropzone } from 'react-dropzone'
import {
  Upload,
  FileAudio,
  Copy,
  Loader2,
  Play,
  Folder,
  ChevronRight,
  Home,
  Sparkles,
  Trash2,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { deleteAsset } from '@/modules/shared/actions'
import ActionMenu from '@/modules/shared/components/ActionMenu'
import { Asset } from '@/types/video-schema'

// ─── Upload singleton — survives tab navigation ───────────────────────────────
// Component state is lost on unmount. This module-level object keeps the active
// upload alive so that when the user returns to the Assets tab, progress resumes.

const TOAST_ID = 'asset-upload-progress'

interface UploadSnapshot {
  uploading: boolean
  progress: string
  currentFileIndex: number
  totalFiles: number
  uploadPercentage: number
}

let _upload: UploadSnapshot = {
  uploading: false, progress: '', currentFileIndex: 0, totalFiles: 0, uploadPercentage: 0,
}
const _listeners = new Set<() => void>()

function setUpload(patch: Partial<UploadSnapshot>) {
  _upload = { ..._upload, ...patch }
  _listeners.forEach((fn) => fn())
}

// ─────────────────────────────────────────────────────────────────────────────

interface AssetsManagerProps {
  ownerId: string
  ownerType: 'brand' | 'template'
  assets: Asset[]
  basePath?: string
}

export default function AssetsManager({
  ownerId,
  ownerType,
  assets: initialAssets,
  basePath,
}: AssetsManagerProps) {
  // Mirror the module-level singleton into component state so the UI re-renders
  const [uploadSnap, setUploadSnap] = useState<UploadSnapshot>(() => ({ ..._upload }))
  const { uploading, progress, currentFileIndex, totalFiles, uploadPercentage } = uploadSnap

  // Re-sync whenever another instance (or this one) updates the singleton
  useEffect(() => {
    const sync = () => setUploadSnap({ ..._upload })
    _listeners.add(sync)
    sync()
    return () => { _listeners.delete(sync) }
  }, [])

  // Live asset state — poll while any asset is pending/processing
  const [assets, setAssets] = useState<Asset[]>(initialAssets)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const needsPoll = assets.some(
    (a) => a.optimizationStatus === 'pending' || a.optimizationStatus === 'processing',
  )

  useEffect(() => {
    if (ownerType !== 'brand') return
    if (!needsPoll) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`/api/protected/assets?brandId=${ownerId}`)
        setAssets(res.data.assets)
      } catch {}
    }, 3000)
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [needsPoll, ownerId, ownerType])

  const [currentPath, setCurrentPath] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [optimizingAll, setOptimizingAll] = useState(false)

  const pendingCount = assets.filter((a) => a.optimizationStatus !== 'done').length

  const handleOptimizeAll = async () => {
    if (pendingCount === 0) return
    setOptimizingAll(true)
    try {
      const res = await axios.post(`/api/protected/upload/retry-all?brandId=${ownerId}`)
      const { queued } = res.data
      setAssets((prev) => prev.map((a) => a.optimizationStatus !== 'done' ? { ...a, optimizationStatus: 'pending' } : a))
      toast.success(`${queued} asset${queued !== 1 ? 's' : ''} queued for optimization`)
    } catch {
      toast.error('Failed to queue optimization')
    } finally {
      setOptimizingAll(false)
    }
  }

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} assets?`)) return

    const toastId = toast.loading(`Deleting ${selectedIds.size} assets...`)
    try {
      for (const id of Array.from(selectedIds)) {
        await deleteAsset(id)
      }
      toast.success('Assets deleted successfully', { id: toastId })
      window.location.reload()
    } catch {
      toast.error('Bulk delete failed', { id: toastId })
    }
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles?.length) return

      setUpload({ uploading: true, totalFiles: acceptedFiles.length, currentFileIndex: 0, uploadPercentage: 0, progress: '' })
      toast.loading(`Uploading 1 of ${acceptedFiles.length}…`, { id: TOAST_ID, duration: Infinity })

      try {
        for (let i = 0; i < acceptedFiles.length; i++) {
          const file = acceptedFiles[i]
          setUpload({ currentFileIndex: i, uploadPercentage: 0, progress: `Hashing ${file.name}…` })
          toast.loading(`Uploading ${i + 1} of ${acceptedFiles.length} — hashing…`, { id: TOAST_ID, duration: Infinity })

          const buffer = await file.arrayBuffer()
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
          const hash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')

          // Step 1: get a presigned URL (lightweight JSON request — no file bytes through server)
          let presignData: { assetId: string; uploadUrl: string; cdnUrl: string; r2Key: string; ext: string; type: string; contextAccountId: string | null }
          try {
            const presignRes = await axios.post('/api/protected/upload/presign', {
              filename: file.name,
              mimeType: file.type,
              size: file.size,
              hash,
              ...(ownerType === 'brand' ? { brandId: ownerId } : { templateId: ownerId }),
            })
            presignData = presignRes.data
          } catch (error: any) {
            if (error.response?.status === 409) {
              const msg = error.response.data?.message || 'duplicate detected'
              toast.warning(`Skipped "${file.name}" — ${msg}`)
              continue
            }
            throw error
          }

          // Step 2: upload directly to R2 (bypasses server — no memory pressure)
          setUpload({ progress: `Uploading ${file.name}…` })
          await axios.put(presignData.uploadUrl, file, {
            headers: { 'Content-Type': file.type },
            onUploadProgress: (progressEvent) => {
              const total = progressEvent.total || 0
              if (total > 0) {
                const pct = Math.round((progressEvent.loaded * 100) / total)
                setUpload({ uploadPercentage: pct, progress: `Uploading ${file.name}…` })
                toast.loading(
                  `Uploading ${i + 1} of ${acceptedFiles.length} — ${file.name} (${pct}%)`,
                  { id: TOAST_ID, duration: Infinity },
                )
              }
            },
          })

          // Step 3: confirm — server creates DB record and queues background optimization
          await axios.post('/api/protected/upload/confirm', {
            assetId: presignData.assetId,
            r2Key: presignData.r2Key,
            cdnUrl: presignData.cdnUrl,
            ext: presignData.ext,
            type: presignData.type,
            contextAccountId: presignData.contextAccountId,
            templateId: ownerType === 'template' ? ownerId : null,
            originalFilename: file.name,
            mimeType: file.type,
            hash,
            size: file.size,
          })
        }
        toast.success('All assets uploaded successfully', { id: TOAST_ID })
        if (ownerType === 'brand') {
          const res = await axios.get(`/api/protected/assets?brandId=${ownerId}`)
          setAssets(res.data.assets)
        } else {
          window.location.reload()
        }
      } catch (error: unknown) {
        console.error('Upload failed', error)
        toast.error(`Upload failed: ${(error as Error).message}`, { id: TOAST_ID })
      } finally {
        setUpload({ uploading: false, progress: '', uploadPercentage: 0, currentFileIndex: 0, totalFiles: 0 })
      }
    },
    [ownerId, ownerType],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': [],
      'audio/*': [],
      'image/*': [],
    },
  })

  // Grouping logic
  const items = assets.reduce(
    (acc, asset) => {
      let parts = asset.r2Key ? asset.r2Key.split('/') : [asset.systemFilename]

      if (basePath) {
        const baseParts = basePath.split('/').filter(Boolean)
        const startsWithBase = baseParts.every(
          (part, i) => parts[i]?.toLowerCase() === part.toLowerCase(),
        )

        if (startsWithBase) {
          parts = parts.slice(baseParts.length)
        } else {
          return acc
        }
      }

      const isInPath = currentPath.every((part, i) => parts[i] === part)
      if (!isInPath) return acc

      const nextPart = parts[currentPath.length]
      if (!nextPart) return acc

      if (parts.length > currentPath.length + 1) {
        if (!acc.folders.has(nextPart)) {
          acc.folders.add(nextPart)
        }
      } else {
        acc.files.push(asset)
      }
      return acc
    },
    { folders: new Set<string>(), files: [] as Asset[] },
  )

  const sortedFolders = Array.from(items.folders).sort()

  return (
    <div className="flex flex-col gap-8 animate-fade-in text-text-secondary relative">
      {/* Floating Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 px-6 py-4 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 pr-6 border-r border-white/10">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-black">
              {selectedIds.size}
            </div>
            <span className="text-xs font-bold text-white uppercase tracking-widest whitespace-nowrap">
              Items Selected
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const urls = Array.from(selectedIds)
                  .map((id) => assets.find((a) => a.id === id)?.url)
                  .filter(Boolean)
                  .join('\n')
                navigator.clipboard.writeText(urls)
                toast.success(`${selectedIds.size} URLs copied`)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/10"
            >
              <Copy size={14} /> Copy URLs
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-bold transition-all border border-red-500/20"
            >
              <Trash2 size={14} /> Bulk Delete
            </button>
            <button
              onClick={clearSelection}
              className="text-xs font-bold hover:text-white transition-colors uppercase tracking-widest px-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Header & Breadcrumbs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-accent" />
            <h2 className="text-xl font-bold text-white tracking-tight">Asset Library</h2>
          </div>
          {ownerType === 'brand' && pendingCount > 0 && (
            <button
              onClick={handleOptimizeAll}
              disabled={optimizingAll}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 transition-all disabled:opacity-50"
            >
              {optimizingAll ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              Optimize all ({pendingCount})
            </button>
          )}
        </div>

        <nav className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-text-secondary/50 overflow-x-auto pb-1 custom-scrollbar">
          <button
            onClick={() => setCurrentPath([])}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${currentPath.length === 0 ? 'text-accent bg-accent/5' : 'hover:text-white'}`}
          >
            <Home size={12} /> Root
          </button>

          {currentPath.map((part, i) => (
            <div key={i} className="flex items-center gap-1">
              <ChevronRight size={12} className="opacity-20" />
              <button
                onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}
                className={`px-3 py-1.5 rounded-lg transition-colors ${i === currentPath.length - 1 ? 'text-accent bg-accent/5' : 'hover:text-white'}`}
              >
                {part}
              </button>
            </div>
          ))}
        </nav>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
            relative p-12 border-2 border-dashed rounded-2xl text-center transition-all cursor-pointer group
            ${isDragActive ? 'border-accent bg-accent/5' : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10'}
            ${uploading ? 'pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <div
            className={`p-4 rounded-full transition-all duration-300 ${uploading ? 'bg-accent/20 text-accent animate-pulse' : 'bg-white/5 text-zinc-500 group-hover:scale-110 group-hover:text-white'}`}
          >
            {uploading ? <Loader2 className="animate-spin" size={32} /> : <Upload size={32} />}
          </div>
          <div className="flex flex-col gap-1 items-center w-full px-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">
              {uploading
                ? 'System Operating...'
                : isDragActive
                  ? 'Release to Upload'
                  : 'Deploy Assets'}
            </h3>
            <p className="text-xs max-w-sm mx-auto leading-relaxed opacity-50 font-medium overflow-hidden truncate w-full text-center">
              {uploading
                ? progress
                : 'Drag & drop media files directly into this target area to initialize processing.'}
            </p>

            {uploading && (
              <div className="w-full max-w-sm mt-8 space-y-6 px-6 py-6 bg-white/[0.03] rounded-3xl border border-white/5 backdrop-blur-3xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-700">
                {/* Global Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-[0.2em] text-accent">
                    <span className="opacity-50 text-white">Global Progress</span>
                    <span>
                      {currentFileIndex + 1} / {totalFiles}
                    </span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-700 ease-out shadow-xl shadow-accent/20"
                      style={{
                        width: `${Math.min(100, ((currentFileIndex + uploadPercentage / 100) / totalFiles) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* File Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-[0.2em]">
                    <span className="text-white/20 truncate max-w-[200px]">{progress}</span>
                    <span className="text-accent/60">{uploadPercentage}%</span>
                  </div>
                  <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-white/10 transition-all duration-300 ${uploadPercentage === 100 ? 'animate-pulse bg-accent/30' : ''}`}
                      style={{ width: `${uploadPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {/* Folders */}
        {sortedFolders.map((folder) => (
          <div
            key={folder}
            onClick={() => setCurrentPath([...currentPath, folder])}
            className="group p-6 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer flex flex-col items-center gap-4 text-center"
          >
            <div className="p-4 rounded-xl bg-accent/10 text-accent group-hover:scale-110 transition-transform shadow-2xl shadow-accent/20">
              <Folder size={40} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-zinc-400 group-hover:text-white transition-colors">
                {folder}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/30">
                Directory
              </span>
            </div>
          </div>
        ))}

        {/* Files */}
        {items.files.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            selected={selectedIds.has(asset.id)}
            onToggleSelect={() => toggleSelect(asset.id)}
            onRetry={async () => {
              try {
                await axios.post(`/api/protected/upload/retry/${asset.id}`)
                toast.success('Re-queued for optimization')
                setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, optimizationStatus: 'pending' } : a))
              } catch {
                toast.error('Failed to retry')
              }
            }}
          />
        ))}
      </div>

      {/* Empty States */}
      {sortedFolders.length === 0 && items.files.length === 0 && !uploading && (
        <div className="flex flex-col items-center justify-center py-20 px-10 gap-6 grayscale opacity-20">
          <Folder size={64} strokeWidth={1} />
          <div className="flex flex-col gap-1 text-center">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em]">Zero Data Points</h3>
            <p className="text-xs max-w-xs mx-auto leading-relaxed">
              No entities found in this logical path. Initialize an upload or link a remote
              repository.
            </p>
          </div>
        </div>
      )}

    </div>
  )
}

function OptimizationBadge({ status, onRetry }: { status: string; onRetry: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false)

  if (status === 'done') {
    return (
      <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-green-600/60">
        <CheckCircle2 size={10} /> Optimized
      </span>
    )
  }
  if (status === 'processing') {
    return (
      <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-blue-400">
        <Loader2 size={10} className="animate-spin" /> Optimizing…
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
          <Clock size={10} /> Queued
        </span>
        <button
          onClick={async (e) => { e.stopPropagation(); setRetrying(true); await onRetry(); setRetrying(false) }}
          disabled={retrying}
          className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
        >
          {retrying ? <Loader2 size={9} className="animate-spin" /> : <RotateCcw size={9} />}
          Retry
        </button>
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-red-500/80">
          <AlertTriangle size={10} /> Failed
        </span>
        <button
          onClick={async (e) => { e.stopPropagation(); setRetrying(true); await onRetry(); setRetrying(false) }}
          disabled={retrying}
          className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
        >
          {retrying ? <Loader2 size={9} className="animate-spin" /> : <RotateCcw size={9} />}
          Retry
        </button>
      </div>
    )
  }
  return null
}

function AssetCard({
  asset,
  selected,
  onToggleSelect,
  onRetry,
}: {
  asset: Asset
  selected: boolean
  onToggleSelect: () => void
  onRetry: () => Promise<void>
}) {
  const isImage = asset.type === 'IMG' || asset.mimeType.startsWith('image/')
  const isVideo = asset.type === 'VID' || asset.mimeType.startsWith('video/')
  const isAudio = asset.type === 'AUD' || asset.mimeType.startsWith('audio/')

  return (
    <div
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) {
          onToggleSelect()
        }
      }}
      className={`group relative bg-[#161616] border rounded-2xl overflow-hidden transition-all duration-300 flex flex-col shadow-2xl shadow-black/40 ${selected ? 'border-accent ring-1 ring-accent bg-accent/5' : 'border-white/5 hover:border-accent/50'}`}
    >
      {/* Selection Overlay Checkbox */}
      <div
        onClick={(e) => {
          e.stopPropagation()
          onToggleSelect()
        }}
        className={`absolute top-3 left-3 z-20 w-5 h-5 rounded-md border transition-all cursor-pointer flex items-center justify-center ${selected ? 'bg-accent border-accent text-black shadow-lg shadow-accent/20' : 'bg-black/40 border-white/20 opacity-0 group-hover:opacity-100 hover:border-white/40'}`}
      >
        {selected && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="w-3.5 h-3.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      {/* Media Preview */}
      <div className="relative aspect-video bg-black/40 flex items-center justify-center overflow-hidden border-b border-white/5">
        {(isImage || isVideo) && (
          <div className="w-full h-full relative">
            {isImage ? (
              <NextImage
                src={asset.url}
                alt={asset.originalFilename}
                fill
                className={`object-cover transition-all duration-500 ${selected ? 'scale-110 opacity-100' : 'opacity-70 group-hover:opacity-100 group-hover:scale-110'}`}
                sizes="(max-width: 768px) 50vw, 20vw"
                unoptimized
              />
            ) : (
              <video
                src={asset.url}
                poster={asset.thumbnailUrl || undefined}
                className={`object-cover w-full h-full transition-all duration-500 ${selected ? 'scale-110 opacity-100' : 'opacity-70 group-hover:opacity-100 group-hover:scale-110'}`}
                preload="metadata"
                muted
                loop
                playsInline
                onMouseEnter={(e) => {
                  const target = e.currentTarget
                  target.play().catch(() => {})
                }}
                onMouseLeave={(e) => {
                  const target = e.currentTarget
                  target.pause()
                  target.currentTime = 0
                }}
              />
            )}
          </div>
        )}
        {isVideo && (
          <div className="absolute bottom-2 right-2 z-10 p-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white/70">
            <Play size={10} fill="currentColor" />
          </div>
        )}
        {!isImage && !isVideo && (
          <div
            className={`flex flex-col items-center gap-3 transition-colors ${selected ? 'text-accent' : 'text-zinc-600 group-hover:text-white'}`}
          >
            {isAudio ? <FileAudio size={32} /> : <div />}
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-30">
              {asset.mimeType.split('/')[1] || 'Media'}
            </span>
          </div>
        )}

        {/* Action Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={() => window.open(asset.url, '_blank')}
            className="p-3 rounded-full bg-white text-black hover:scale-110 transition-transform shadow-xl"
            title="Open Source"
          >
            <Play size={16} fill="black" />
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(asset.url)
              toast.success('URL copied to clipboard')
            }}
            className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/10 hover:bg-white/20 transition-all"
            title="Copy URL"
          >
            <Copy size={16} />
          </button>
        </div>

        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all -translate-y-2 group-hover:translate-y-0">
          <ActionMenu
            onDelete={async () => {
              try {
                await deleteAsset(asset.id)
                toast.success('Asset deleted')
                window.location.reload()
              } catch {
                toast.error('Failed to delete asset')
              }
            }}
          />
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-1.5 min-w-0">
        <h4
          className={`text-[11px] font-bold truncate tracking-tight transition-colors ${selected ? 'text-accent' : 'text-zinc-300 group-hover:text-white'}`}
          title={`Original: ${asset.originalFilename}`}
        >
          {asset.systemFilename}
        </h4>
        <div
          className={`flex items-center justify-between text-[9px] font-bold uppercase tracking-widest transition-colors ${selected ? 'text-accent/60' : 'text-text-secondary/40 group-hover:text-accent/60'}`}
        >
          <span>
            {(asset.size / 1024 / 1024).toFixed(2)} MB{' '}
            {asset.duration
              ? `| ${Math.floor(asset.duration / 60)}:${Math.floor(asset.duration % 60)
                  .toString()
                  .padStart(2, '0')}`
              : ''}
          </span>
        </div>
        <OptimizationBadge status={asset.optimizationStatus ?? 'done'} onRetry={onRetry} />
      </div>
    </div>
  )
}
