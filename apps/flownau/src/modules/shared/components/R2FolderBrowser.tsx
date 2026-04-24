'use client'

import React, { useState, useEffect } from 'react'
import {
  Folder,
  ChevronRight,
  Home,
  Loader2,
  Link as LinkIcon,
  Search,
  FileVideo,
  FileAudio,
  Image as ImageIcon,
  FileText,
} from 'lucide-react'

interface R2File {
  key: string
  size: number
  lastModified?: string
}

interface R2FolderBrowserProps {
  onSelect: (prefix: string) => void
  onCancel: () => void
}

export default function R2FolderBrowser({ onSelect, onCancel }: R2FolderBrowserProps) {
  const [currentPrefix, setCurrentPrefix] = useState('')
  const [folders, setFolders] = useState<string[]>([])
  const [files, setFiles] = useState<R2File[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchFolders(currentPrefix)
  }, [currentPrefix])

  const fetchFolders = async (prefix: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/protected/r2/list?prefix=${encodeURIComponent(prefix)}`)
      const data = await res.json()
      if (data.folders) setFolders(data.folders)
      if (data.files) setFiles(data.files)
    } catch (error) {
      console.error('Failed to fetch folders', error)
    } finally {
      setLoading(false)
    }
  }

  const breadcrumbs = currentPrefix.split('/').filter(Boolean)
  const filteredFolders = folders.filter((f) => f.toLowerCase().includes(searchTerm.toLowerCase()))
  const filteredFiles = files.filter((f) => f.key.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="flex flex-col gap-8 animate-fade-in py-2">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold font-heading text-white uppercase tracking-wider">
          Cloud Explorer
        </h2>
        <p className="text-text-secondary text-xs font-medium opacity-50 uppercase tracking-widest">
          Navigate R2 bucket to establish data links
        </p>
      </div>

      {/* Navigation & Search */}
      <div className="flex flex-col gap-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-text-secondary uppercase tracking-widest overflow-x-auto pb-1 custom-scrollbar whitespace-nowrap">
          <button
            onClick={() => setCurrentPrefix('')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${currentPrefix === '' ? 'text-accent bg-accent/10' : 'hover:text-white'}`}
          >
            <Home size={12} /> Root
          </button>
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              <ChevronRight size={12} className="opacity-20" />
              <button
                onClick={() => setCurrentPrefix(breadcrumbs.slice(0, i + 1).join('/') + '/')}
                className={`px-2 py-1 rounded transition-colors ${i === breadcrumbs.length - 1 ? 'text-accent bg-accent/10' : 'hover:text-white'}`}
              >
                {crumb}
              </button>
            </React.Fragment>
          ))}
        </nav>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
          <input
            type="text"
            placeholder="Filter path..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-accent transition-all placeholder:text-white/10"
          />
        </div>
      </div>

      {/* Content List */}
      <div className="min-h-[300px] max-h-[400px] overflow-y-auto border border-white/5 rounded-2xl bg-black/40 p-2 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[300px] gap-4 opacity-20">
            <Loader2 className="animate-spin text-accent" size={32} />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Indexing Objects...
            </span>
          </div>
        ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-text-secondary gap-4 opacity-20">
            <Folder size={48} strokeWidth={1} />
            <p className="text-[10px] font-bold uppercase tracking-widest">
              No matching entities found
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {/* Folders */}
            {filteredFolders.map((folder) => (
              <button
                key={folder}
                onClick={() => {
                  setCurrentPrefix(folder)
                  setSearchTerm('')
                }}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 shadow-lg shadow-accent/5">
                  <Folder
                    size={20}
                    className="text-accent group-hover:scale-110 transition-transform"
                  />
                </div>
                <div className="flex flex-col overflow-hidden gap-0.5">
                  <span className="truncate text-xs font-bold text-zinc-300 group-hover:text-white transition-colors">
                    {folder.split('/').filter(Boolean).pop()}
                  </span>
                  <span className="truncate text-[9px] font-bold uppercase tracking-widest text-text-secondary opacity-30">
                    Subdirectory
                  </span>
                </div>
                <ChevronRight
                  size={14}
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 text-white/20"
                />
              </button>
            ))}

            {/* Files */}
            {filteredFiles.map((file) => (
              <div
                key={file.key}
                className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.01] border border-white/[0.02] group"
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  {file.key.match(/\.(mp4|mov|webm)$/i) ? (
                    <FileVideo size={20} className="text-blue-400 opacity-60" />
                  ) : file.key.match(/\.(mp3|wav|m4a)$/i) ? (
                    <FileAudio size={20} className="text-green-400 opacity-60" />
                  ) : file.key.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <ImageIcon size={20} className="text-purple-400 opacity-60" />
                  ) : (
                    <FileText size={20} className="text-zinc-500 opacity-60" />
                  )}
                </div>
                <div className="flex flex-col overflow-hidden gap-0.5">
                  <span className="truncate text-xs font-medium text-zinc-400">
                    {file.key.split('/').pop()}
                  </span>
                  <span className="truncate text-[9px] font-bold uppercase tracking-widest text-text-secondary opacity-20">
                    {(file.size / 1024 / 1024).toFixed(2)} MB • Data Object
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all text-text-secondary hover:text-white"
        >
          Abort
        </button>
        <button
          onClick={() => onSelect(currentPrefix)}
          disabled={!currentPrefix || loading}
          className="flex-[2] flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-accent text-white text-xs font-bold uppercase tracking-widest shadow-2xl shadow-accent/20 hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:hover:scale-100 transition-all"
        >
          <LinkIcon size={16} />
          Confirm Handshake
        </button>
      </div>
    </div>
  )
}
