'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileAudio, FileVideo, Image as ImageIcon, Copy, Loader2, Play } from 'lucide-react'
import { deleteAsset } from '@/app/dashboard/actions'
import ActionMenu from '@/components/ActionMenu'

interface Asset {
  id: string
  url: string
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
}

export default function AssetsManager({ ownerId, ownerType, assets }: AssetsManagerProps) {
  const [uploading, setUploading] = useState<boolean>(false)
  const [progress, setProgress] = useState<string>('')

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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': [],
      'audio/*': [],
      'image/*': [],
    },
  })

  return (
    <div className="animate-fade-in">
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
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '24px',
        }}
      >
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
      </div>

      {assets.length === 0 && !uploading && (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
          No assets found.
        </div>
      )}
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
