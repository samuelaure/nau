'use client'

import { useState, useCallback } from 'react'
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
} from 'lucide-react'
import { deleteAsset } from '@/modules/shared/actions'
import ActionMenu from '@/modules/shared/components/ActionMenu'
import Modal from '@/modules/shared/components/Modal'
import R2FolderBrowser from '@/modules/shared/components/R2FolderBrowser'
import { Link as LinkIcon } from 'lucide-react'

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

interface AssetsManagerProps {
  ownerId: string
  ownerType: 'account' | 'template' // Context
  assets: Asset[]
  basePath?: string // Logical root to hide (e.g., account name)
}

export default function AssetsManager({ ownerId, ownerType, assets, basePath }: AssetsManagerProps) {
  const [uploading, setUploading] = useState<boolean>(false)
  const [progress, setProgress] = useState<string>('')
  const [currentPath, setCurrentPath] = useState<string[]>([])
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const [linking, setLinking] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles?.length) return
      setUploading(true)

      try {
        for (const file of acceptedFiles) {
          setProgress(`Processing ${file.name}...`)

          // 1. Calculate Hash
          const buffer = await file.arrayBuffer()
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
          const hashArray = Array.from(new Uint8Array(hashBuffer))
          const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

          // 2. Upload & Optimize via Server
          setProgress(`Uploading & Optimizing ${file.name}...`)

          const formData = new FormData()
          formData.append('file', file)
          formData.append('hash', hash)

          // Pass correct context ID
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

          setProgress(`Completed ${file.name}`)
        }

        window.location.reload()
      } catch (error) {
        console.error('Upload failed', error)
        alert('Upload failed. See console.')
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

      window.location.reload()
    } catch (error: any) {
      console.error('Linking failed', error)
      alert(`Linking failed: ${error.message}`)
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

      // If basePath is provided, filter and slice parts
      if (basePath) {
        const baseParts = basePath.split('/').filter(Boolean)
        // Check if starts with basePath (case-insensitive)
        const startsWithBase = baseParts.every(
          (part, i) => parts[i]?.toLowerCase() === part.toLowerCase(),
        )

        // Only process if it starts with base path, otherwise hide it (it belongs to another account's structure)
        if (startsWithBase) {
          parts = parts.slice(baseParts.length)
        } else {
          return acc
        }
      }

      // Check if asset is within currentPath
      const isInPath = currentPath.every((part, i) => parts[i] === part)
      if (!isInPath) return acc

      const nextPart = parts[currentPath.length]
      if (!nextPart) return acc

      // If it has more parts after currentPath + nextPart, it's in a subfolder
      if (parts.length > currentPath.length + 1) {
        if (!acc.folders.has(nextPart)) {
          acc.folders.add(nextPart)
        }
      } else {
        // It's a file at exactly this level
        acc.files.push(asset)
      }
      return acc
    },
    { folders: new Set<string>(), files: [] as Asset[] },
  )

  const sortedFolders = Array.from(items.folders).sort()

  return (
    <div className="animate-fade-in">
      {/* Breadcrumbs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '24px',
          fontSize: '14px',
          color: 'var(--text-secondary)',
        }}
      >
        <button
          onClick={() => setCurrentPath([])}
          style={{
            background: 'none',
            border: 'none',
            color: currentPath.length === 0 ? 'white' : 'inherit',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'background 0.2s',
          }}
          className="hover-bg"
        >
          <Home size={14} /> Root
        </button>

        {currentPath.map((part, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ChevronRight size={14} />
            <button
              onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}
              style={{
                background: 'none',
                border: 'none',
                color: i === currentPath.length - 1 ? 'white' : 'inherit',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
              }}
              className="hover-bg"
            >
              {part}
            </button>
          </div>
        ))}
      </div>

      <div
        {...getRootProps()}
        style={{
          border: '2px dashed var(--border-color)',
          borderColor: isDragActive ? 'var(--accent-color)' : 'var(--border-color)',
          borderRadius: '16px',
          padding: '40px',
          textAlign: 'center',
          marginBottom: '40px',
          background: isDragActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.02)',
          transition: 'all 0.2s',
          cursor: 'pointer',
        }}
      >
        <input {...getInputProps()} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--panel-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              border: '1px solid var(--border-color)',
            }}
          >
            {uploading ? <Loader2 className="animate-spin" size={32} /> : <Upload size={32} />}
          </div>
          <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>
            {uploading
              ? 'Processing files...'
              : isDragActive
                ? 'Drop files now'
                : 'Drop assets here'}
          </h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            {uploading ? progress : 'or click to browse. Supports Video, Audio, and Images.'}
          </p>
          {!uploading && !isDragActive && (
            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsLinkModalOpen(true)
                }}
                className="btn-secondary"
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                <LinkIcon size={14} className="mr-2" />
                Link Existing Folder
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Folders */}
        {sortedFolders.map((folder) => (
          <div
            key={folder}
            className="card hover-glow"
            style={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              gap: '12px',
            }}
            onClick={() => setCurrentPath([...currentPath, folder])}
          >
            <Folder size={48} style={{ color: 'var(--accent-color)', opacity: 0.8 }} />
            <span
              style={{
                fontSize: '14px',
                fontWeight: '500',
                textAlign: 'center',
                wordBreak: 'break-all',
              }}
            >
              {folder}
            </span>
          </div>
        ))}

        {/* Files */}
        {items.files.map((asset) => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
      </div>

      {sortedFolders.length === 0 && items.files.length === 0 && !uploading && (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '60px 40px' }}>
          <Folder size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
          <p style={{ marginBottom: '24px', fontSize: '16px' }}>No folders or assets found in this directory.</p>
          <button
            onClick={() => setIsLinkModalOpen(true)}
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <LinkIcon size={18} />
            Browse & Link R2 Folder
          </button>
        </div>
      )}

      <Modal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} maxWidth="lg">
        {linking ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Loader2 className="animate-spin" size={48} style={{ margin: '0 auto 24px', color: 'var(--accent-color)' }} />
            <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>Linking assets...</h3>
            <p style={{ color: 'var(--text-secondary)' }}>This may take a moment depending on the number of files.</p>
          </div>
        ) : (
          <R2FolderBrowser
            onSelect={handleLinkFolder}
            onCancel={() => setIsLinkModalOpen(false)}
          />
        )}
      </Modal>

      <style jsx global>{`
        .hover-bg:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .hover-glow:hover {
          border-color: var(--accent-color);
          box-shadow: 0 0 15px rgba(59, 130, 246, 0.2);
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  )
}

function AssetCard({ asset }: { asset: Asset }) {
  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10 }}>
        <ActionMenu onDelete={deleteAsset.bind(null, asset.id)} />
      </div>

      <div
        style={{
          aspectRatio: '16/9',
          background: '#111',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        {asset.type === 'VID' && <FileVideo size={48} style={{ opacity: 0.5 }} />}
        {asset.type === 'AUD' && <FileAudio size={48} style={{ opacity: 0.5 }} />}
        {asset.type === 'IMG' && (
          <img
            src={asset.url}
            alt={asset.systemFilename}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        )}
      </div>

      <div style={{ padding: '16px' }}>
        <h4
          style={{
            fontSize: '14px',
            marginBottom: '4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={asset.systemFilename}
        >
          {asset.systemFilename}
        </h4>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          {(asset.size / 1024 / 1024).toFixed(2)} MB
        </p>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-primary"
            style={{ padding: '8px', flex: 1, fontSize: '12px' }}
            onClick={() => {
              window.open(asset.url, '_blank')
            }}
          >
            <Play size={12} /> Open
          </button>
          <button
            style={{
              padding: '8px',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            onClick={() => navigator.clipboard.writeText(asset.url)}
            title="Copy URL"
          >
            <Copy size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
