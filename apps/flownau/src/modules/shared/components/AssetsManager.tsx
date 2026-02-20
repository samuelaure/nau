'use client'

import { useState, useCallback } from 'react'
import NextImage from 'next/image'
import { useDropzone } from 'react-dropzone'
import {
  Upload,
  FileAudio,
  FileVideo,
  Image as ImageIcon,
  Copy,
  Loader2,
  Play,
  Folder,
  ChevronRight,
  Home,
  Sparkles,
  Link as LinkIcon,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { deleteAsset } from '@/modules/shared/actions'
import ActionMenu from '@/modules/shared/components/ActionMenu'
import Modal from '@/modules/shared/components/Modal'
import R2FolderBrowser from '@/modules/shared/components/R2FolderBrowser'
import { Asset } from '@/types/video-schema'

interface AssetsManagerProps {
  ownerId: string
  ownerType: 'account' | 'template'
  assets: Asset[]
  basePath?: string
}

export default function AssetsManager({
  ownerId,
  ownerType,
  assets,
  basePath,
}: AssetsManagerProps) {
  const [uploading, setUploading] = useState<boolean>(false)
  const [progress, setProgress] = useState<string>('')
  const [currentPath, setCurrentPath] = useState<string[]>([])
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const [linking, setLinking] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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
    } catch (error) {
      toast.error('Bulk delete failed', { id: toastId })
    }
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles?.length) return
      setUploading(true)

      try {
        for (const file of acceptedFiles) {
          setProgress(`Processing ${file.name}...`)

          const buffer = await file.arrayBuffer()
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
          const hashArray = Array.from(new Uint8Array(hashBuffer))
          const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

          setProgress(`Uploading & Optimizing ${file.name}...`)

          const formData = new FormData()
          formData.append('file', file)
          formData.append('hash', hash)

          if (ownerType === 'account') {
            formData.append('accountId', ownerId)
          } else {
            formData.append('templateId', ownerId)
          }

          const response = await fetch('/api/protected/upload', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Upload failed')
          }
        }
        toast.success('Assets uploaded successfully')
        window.location.reload()
      } catch (error: unknown) {
        console.error('Upload failed', error)
        toast.error(`Upload failed: ${(error as Error).message}`)
      } finally {
        setUploading(false)
        setProgress('')
      }
    },
    [ownerId, ownerType],
  )

  const handleLinkFolder = async (prefix: string) => {
    setLinking(true)
    try {
      const response = await fetch('/api/protected/r2/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix,
          accountId: ownerType === 'account' ? ownerId : null,
          templateId: ownerType === 'template' ? ownerId : null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Linking failed')
      }

      toast.success('R2 folder linked successfully')
      window.location.reload()
    } catch (error: unknown) {
      console.error('Linking failed', error)
      toast.error(`Linking failed: ${(error as Error).message}`)
    } finally {
      setLinking(false)
      setIsLinkModalOpen(false)
    }
  }

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
          <button
            onClick={() => setIsLinkModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all"
          >
            <LinkIcon size={14} /> Link R2 Folder
          </button>
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
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">
              {uploading
                ? 'System Operating...'
                : isDragActive
                  ? 'Release to Upload'
                  : 'Deploy Assets'}
            </h3>
            <p className="text-xs max-w-xs mx-auto leading-relaxed opacity-50 font-medium">
              {uploading
                ? progress
                : 'Drag & drop media files directly into this target area to initialize processing.'}
            </p>
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

      {/* Modals */}
      <Modal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} maxWidth="lg">
        {linking ? (
          <div className="flex flex-col items-center justify-center py-16 gap-6">
            <Loader2 className="animate-spin text-accent" size={48} />
            <div className="flex flex-col gap-1 text-center">
              <h3 className="text-lg font-bold text-white uppercase tracking-widest">
                Handshaking...
              </h3>
              <p className="text-sm opacity-50">
                Indexing remote R2 objects and establishing secure links.
              </p>
            </div>
          </div>
        ) : (
          <R2FolderBrowser onSelect={handleLinkFolder} onCancel={() => setIsLinkModalOpen(false)} />
        )}
      </Modal>
    </div>
  )
}

function AssetCard({
  asset,
  selected,
  onToggleSelect,
}: {
  asset: Asset
  selected: boolean
  onToggleSelect: () => void
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
        {(isImage || (isVideo && asset.thumbnailUrl)) && (
          <div className="w-full h-full relative">
            <NextImage
              src={isImage ? asset.url : asset.thumbnailUrl!}
              alt={asset.originalFilename}
              fill
              className={`object-cover transition-all duration-500 ${selected ? 'scale-110 opacity-100' : 'opacity-70 group-hover:opacity-100 group-hover:scale-110'}`}
              sizes="(max-width: 768px) 50vw, 20vw"
              unoptimized
            />
          </div>
        )}
        {isVideo && asset.thumbnailUrl && (
          <div className="absolute bottom-2 right-2 z-10 p-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white/70">
            <Play size={10} fill="currentColor" />
          </div>
        )}
        {!isImage && (!isVideo || !asset.thumbnailUrl) && (
          <div
            className={`flex flex-col items-center gap-3 transition-colors ${selected ? 'text-accent' : 'text-zinc-600 group-hover:text-white'}`}
          >
            {isVideo ? <FileVideo size={32} /> : isAudio ? <FileAudio size={32} /> : <div />}
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
              } catch (e) {
                toast.error('Failed to delete asset')
              }
            }}
          />
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-1 min-w-0">
        <h4
          className={`text-[11px] font-bold truncate tracking-tight transition-colors ${selected ? 'text-accent' : 'text-zinc-300 group-hover:text-white'}`}
          title={asset.originalFilename}
        >
          {asset.originalFilename}
        </h4>
        <div
          className={`flex items-center justify-between text-[9px] font-bold uppercase tracking-widest transition-colors ${selected ? 'text-accent/60' : 'text-text-secondary/40 group-hover:text-accent/60'}`}
        >
          <span>{(asset.size / 1024 / 1024).toFixed(2)} MB</span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity">Asset Entity</span>
        </div>
      </div>
    </div>
  )
}
