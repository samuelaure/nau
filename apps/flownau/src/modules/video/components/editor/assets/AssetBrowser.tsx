'use client'

import React, { useState, useEffect } from 'react'
import {
  Video as VideoIcon,
  Image as ImageIcon,
  Music as MusicIcon,
  Grid3X3,
  List as ListIcon,
  LayoutGrid,
  Folder,
  ChevronRight,
  Home,
  Loader2,
  Search,
  FileIcon,
  FileVideo,
  FileAudio,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import { useEditorStore } from '@/modules/video/store/useEditorStore'
import { retryWithBackoff, isOnline } from '@/modules/video/utils/retry'
import { toast } from 'sonner'
import { AssetCardSkeleton, FolderCardSkeleton } from '../../ui/Skeleton'

interface Asset {
  id: string
  url: string
  r2Key: string
  systemFilename: string
  originalFilename: string
  type: string
  size: number
  mimeType: string
}

interface AssetBrowserProps {
  assets: Asset[]
  assetsRoot?: string
}

type ViewMode = 'grid-lg' | 'grid-sm' | 'list'
type FilterType = 'all' | 'video' | 'audio' | 'image'
type BrowserMode = 'project' | 'cloud'

export function AssetBrowser({ assets, assetsRoot }: AssetBrowserProps) {
  const addElement = useEditorStore((state) => state.addElement)

  // View State
  const [viewMode, setViewMode] = useState<ViewMode>('grid-lg')
  const [browserMode, setBrowserMode] = useState<BrowserMode>('project')
  const [filterType, setFilterType] = useState<FilterType>('all')

  // Cloud Browser State
  const [currentPrefix, setCurrentPrefix] = useState(assetsRoot || '')
  const [folders, setFolders] = useState<string[]>([])
  const [files, setFiles] = useState<any[]>([]) // R2 Files metadata
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loadingAssetId, setLoadingAssetId] = useState<string | null>(null)

  // Fetch R2 Data when in Cloud mode and prefix changes
  useEffect(() => {
    if (browserMode === 'cloud') {
      fetchFolders(currentPrefix)
    }
  }, [currentPrefix, browserMode])

  const fetchFolders = async (prefix: string) => {
    // Check if online
    if (!isOnline()) {
      setError('You are offline. Cloud assets unavailable.')
      toast.error('You are offline. Cloud assets unavailable.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await retryWithBackoff(
        async () => {
          const res = await fetch(`/api/protected/r2/list?prefix=${encodeURIComponent(prefix)}`)

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`)
          }

          const data = await res.json()
          if (data.folders) setFolders(data.folders)
          if (data.files) setFiles(data.files)
        },
        3,
        1000,
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch cloud assets'
      console.error('Failed to fetch folders:', err)
      setError(errorMessage)
      toast.error(errorMessage, {
        action: {
          label: 'Retry',
          onClick: () => fetchFolders(prefix),
        },
      })
    } finally {
      setLoading(false)
    }
  }

  // Filter Project Assets
  const filteredProjectAssets = assets.filter((asset) => {
    const matchesSearch = asset.originalFilename.toLowerCase().includes(searchTerm.toLowerCase())
    if (!matchesSearch) return false

    if (filterType === 'all') return true
    if (filterType === 'video') return asset.type === 'VID' || asset.type === 'video'
    if (filterType === 'image') return asset.type === 'IMG' || asset.type === 'image'
    if (filterType === 'audio') return asset.type === 'AUD' || asset.type === 'audio'
    return true
  })

  // Helper to get file icon/type for Cloud files
  const getCloudFileType = (key: string) => {
    if (key.match(/\.(mp4|mov|webm|mkv)$/i)) return 'video'
    if (key.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'image'
    if (key.match(/\.(mp3|wav|m4a|aac)$/i)) return 'audio'
    return 'unknown'
  }

  const handleAddAsset = async (url: string, name: string, typeHint?: string, assetId?: string) => {
    // Check if online
    if (!isOnline()) {
      toast.error('You are offline. Cannot load asset.')
      return
    }

    let type: 'video' | 'image' | 'audio' = 'video'

    if (typeHint) {
      if (typeHint === 'VID' || typeHint === 'video') type = 'video'
      else if (typeHint === 'IMG' || typeHint === 'image') type = 'image'
      else if (typeHint === 'AUD' || typeHint === 'audio') type = 'audio'
    } else {
      const derived = getCloudFileType(name)
      if (derived !== 'unknown') type = derived as 'video' | 'image' | 'audio'
    }

    let width: number | undefined
    let height: number | undefined

    // Show loading state
    if (assetId) setLoadingAssetId(assetId)

    try {
      if (url && (type === 'image' || type === 'video')) {
        // Retry dimension detection with exponential backoff
        await retryWithBackoff(
          async () => {
            if (type === 'image') {
              const img = new Image()
              img.src = url
              await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                  width = img.naturalWidth
                  height = img.naturalHeight
                  resolve()
                }
                img.onerror = () => reject(new Error('Failed to load image'))
                setTimeout(() => reject(new Error('Image load timeout')), 10000) // 10s timeout
              })
            } else if (type === 'video') {
              const v = document.createElement('video')
              v.src = url
              await new Promise<void>((resolve, reject) => {
                v.onloadedmetadata = () => {
                  width = v.videoWidth
                  height = v.videoHeight
                  resolve()
                }
                v.onerror = () => reject(new Error('Failed to load video'))
                setTimeout(() => reject(new Error('Video load timeout')), 10000) // 10s timeout
              })
            }
          },
          3,
          1000,
        )
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to detect asset dimensions'
      console.warn('Asset dimension detection failed:', e)
      toast.error(`${errorMessage}. Using default dimensions.`, {
        action: {
          label: 'Retry',
          onClick: () => handleAddAsset(url, name, typeHint, assetId),
        },
      })
      // Fallback to default dimensions
      width = undefined
      height = undefined
    } finally {
      if (assetId) setLoadingAssetId(null)
    }

    addElement(type, { url, name, width, height })
    toast.success(`Added ${name} to timeline`)
  }

  return (
    <div className="flex flex-col h-full bg-[#161616] text-text-secondary select-none">
      {/* Header */}
      <header className="p-4 border-b border-white/5 space-y-4 bg-panel/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <span className="font-bold text-sm text-white tracking-tight">Library</span>
          </div>
          <div className="flex bg-white/[0.03] border border-white/5 rounded-lg p-1">
            <button
              onClick={() => setBrowserMode('project')}
              className={`px-4 py-1.5 text-[11px] font-bold rounded-md transition-all ${browserMode === 'project' ? 'bg-accent text-white shadow-lg' : 'hover:text-white'}`}
            >
              Project
            </button>
            <button
              onClick={() => setBrowserMode('cloud')}
              className={`px-4 py-1.5 text-[11px] font-bold rounded-md transition-all ${browserMode === 'cloud' ? 'bg-accent text-white shadow-lg' : 'hover:text-white'}`}
            >
              Cloud
            </button>
          </div>
        </div>

        {/* Sub-navigation: Search & Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-accent transition-all placeholder:text-white/10"
            />
          </div>

          {browserMode === 'project' ? (
            <div className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar">
              {['all', 'video', 'image', 'audio'].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t as FilterType)}
                  className={`px-3 py-1 text-[10px] uppercase font-bold rounded-full border transition-all whitespace-nowrap ${
                    filterType === t
                      ? 'bg-accent border-accent text-white'
                      : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] text-white/40 overflow-x-auto whitespace-nowrap pb-1 custom-scrollbar">
              <button
                onClick={() => setCurrentPrefix(assetsRoot || '')}
                className="hover:text-white flex items-center gap-1 transition-colors"
              >
                <Home size={10} /> Root
              </button>
              {currentPrefix
                .replace(assetsRoot || '', '')
                .split('/')
                .filter(Boolean)
                .map((crumb, i, arr) => (
                  <React.Fragment key={i}>
                    <ChevronRight size={10} className="text-white/10" />
                    <span
                      className={`transition-colors ${i === arr.length - 1 ? 'text-accent font-bold' : 'hover:text-white cursor-pointer'}`}
                    >
                      {crumb}
                    </span>
                  </React.Fragment>
                ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
            {browserMode === 'project'
              ? `${filteredProjectAssets.length} Assets`
              : `${files.length} Objects`}
          </span>
          <div className="flex gap-0.5 bg-white/[0.02] rounded-lg p-0.5 border border-white/5">
            <button
              onClick={() => setViewMode('grid-lg')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid-lg' ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white'}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('grid-sm')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid-sm' ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white'}`}
            >
              <Grid3X3 size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white'}`}
            >
              <ListIcon size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {browserMode === 'cloud' && error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center">
              <AlertCircle className="text-error" size={32} />
            </div>
            <div className="text-center max-w-xs">
              <p className="text-sm font-bold text-text-primary mb-2">Cloud Assets Unavailable</p>
              <p className="text-xs text-text-secondary mb-4">{error}</p>
              <button
                onClick={() => fetchFolders(currentPrefix)}
                className="px-4 py-2 bg-accent hover:bg-accent/90 rounded-lg text-xs font-medium text-white transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        ) : browserMode === 'cloud' && loading ? (
          <div
            className={`
              gap-3
              ${viewMode === 'list' ? 'flex flex-col' : 'grid'}
              ${viewMode === 'grid-lg' ? 'grid-cols-2' : ''}
              ${viewMode === 'grid-sm' ? 'grid-cols-3' : ''}
            `}
          >
            {/* Show skeleton loaders */}
            {Array.from({ length: 6 }).map((_, i) => (
              <React.Fragment key={i}>
                {i < 2 && <FolderCardSkeleton viewMode={viewMode} />}
                {i >= 2 && <AssetCardSkeleton viewMode={viewMode} />}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div
            className={`
                        gap-3
                        ${viewMode === 'list' ? 'flex flex-col' : 'grid'}
                        ${viewMode === 'grid-lg' ? 'grid-cols-2' : ''}
                        ${viewMode === 'grid-sm' ? 'grid-cols-3' : ''}
                    `}
          >
            {/* Folders (Cloud Mode) */}
            {browserMode === 'cloud' &&
              folders.map((folder) => (
                <div
                  key={folder}
                  onClick={() => setCurrentPrefix(folder)}
                  className={`
                                    group cursor-pointer bg-white/[0.02] border border-white/5 rounded-xl hover:border-accent/50 hover:bg-accent/5 transition-all flex items-center
                                    ${viewMode === 'list' ? 'p-3 gap-4' : 'flex-col p-4 gap-3 aspect-square justify-center text-center'}
                                `}
                >
                  <div
                    className={`flex items-center justify-center rounded-lg bg-accent/10 text-accent transition-transform group-hover:scale-110 ${viewMode === 'list' ? 'p-2' : 'p-4'}`}
                  >
                    <Folder size={viewMode === 'list' ? 16 : 24} />
                  </div>
                  <span className="text-[11px] font-bold truncate w-full px-1 text-zinc-400 group-hover:text-white transition-colors">
                    {folder.split('/').filter(Boolean).pop()}
                  </span>
                </div>
              ))}

            {/* Assets */}
            {(browserMode === 'project' ? filteredProjectAssets : files).map((asset: any) => {
              const isProject = browserMode === 'project'
              const name = isProject ? asset.originalFilename : asset.key.split('/').pop()

              // Domain Logic
              const R2_DOMAIN = 'https://pub-2a95574384d748f6834d852cb7ec9aa1.r2.dev'
              const url = isProject ? asset.url : `${R2_DOMAIN}/${asset.key}`

              const type = isProject
                ? asset.type === 'VID'
                  ? 'video'
                  : asset.type === 'IMG'
                    ? 'image'
                    : 'audio'
                : getCloudFileType(name)

              const assetId = isProject ? asset.id : asset.key
              const isLoading = loadingAssetId === assetId

              return (
                <div
                  key={assetId}
                  onClick={() =>
                    !isLoading &&
                    handleAddAsset(url, name, isProject ? asset.type : undefined, assetId)
                  }
                  className={`
                                        group cursor-pointer bg-white/[0.02] border border-white/5 rounded-xl relative overflow-hidden transition-all duration-300
                                        ${viewMode === 'list' ? 'p-3 gap-4 flex items-center hover:bg-white/[0.05]' : 'aspect-square hover:border-accent/50 hover:bg-accent/5 hover:-translate-y-1 shadow-2xl shadow-black/20'}
                                        ${isLoading ? 'opacity-50 cursor-wait' : ''}
                                    `}
                >
                  {/* Thumbnail / Icon Container */}
                  <div
                    className={`
                                        flex items-center justify-center bg-black/40 relative overflow-hidden rounded-lg
                                        ${viewMode === 'list' ? 'w-10 h-10 shrink-0 border border-white/5' : 'w-full h-full absolute inset-0'}
                                    `}
                  >
                    {(type === 'image' || type === 'video') && (
                      <img
                        src={url}
                        className="w-full h-full object-cover opacity-40 group-hover:opacity-80 transition-all duration-500 group-hover:scale-110"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    )}

                    {/* Overlay Icon or Loading Spinner */}
                    <div
                      className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-300 ${viewMode !== 'list' && !isLoading ? 'group-hover:opacity-0 group-hover:scale-150' : ''}`}
                    >
                      {isLoading ? (
                        <div className="p-3 rounded-full bg-accent/20 backdrop-blur-sm border border-accent/30">
                          <Loader2 size={20} className="text-accent animate-spin" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
                          {type === 'video' && <FileVideo size={16} className="text-blue-400" />}
                          {type === 'image' && <ImageIcon size={16} className="text-purple-400" />}
                          {type === 'audio' && <FileAudio size={16} className="text-green-400" />}
                          {type === 'unknown' && <FileIcon size={16} className="text-zinc-500" />}
                        </div>
                      )}
                    </div>

                    {/* Play Indicator for Video */}
                    {type === 'video' && viewMode !== 'list' && (
                      <div className="absolute top-2 right-2 p-1 rounded-md bg-accent/20 border border-accent/20 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* Metadata Overlay */}
                  <div
                    className={`
                                        transition-all duration-300
                                        ${viewMode === 'list' ? 'flex-1 min-w-0' : 'absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/80 to-transparent pt-10 pointer-events-none group-hover:translate-y-0'}
                                    `}
                  >
                    <div className="text-[11px] font-bold text-zinc-300 truncate group-hover:text-white transition-colors">
                      {name}
                    </div>
                    <div className="text-[9px] font-bold text-white/20 uppercase tracking-widest mt-0.5 group-hover:text-accent/60 transition-colors">
                      {isProject
                        ? 'Native'
                        : asset.size
                          ? `${(asset.size / 1024 / 1024).toFixed(1)} MB`
                          : 'Remote'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
