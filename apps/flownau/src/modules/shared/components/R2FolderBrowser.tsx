'use client'

import { useState, useEffect } from 'react'
import { Folder, ChevronRight, Home, Loader2, Link as LinkIcon, Search, FileVideo, FileAudio, Image as ImageIcon, FileText } from 'lucide-react'

interface R2FolderBrowserProps {
    onSelect: (prefix: string) => void
    onCancel: () => void
}

export default function R2FolderBrowser({ onSelect, onCancel }: R2FolderBrowserProps) {
    const [currentPrefix, setCurrentPrefix] = useState('')
    const [folders, setFolders] = useState<string[]>([])
    const [files, setFiles] = useState<any[]>([])
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
            if (data.folders) {
                setFolders(data.folders)
            }
            if (data.files) {
                setFiles(data.files)
            }
        } catch (error) {
            console.error('Failed to fetch folders', error)
        } finally {
            setLoading(false)
        }
    }

    const breadcrumbs = currentPrefix.split('/').filter(Boolean)
    const filteredFolders = folders.filter(f =>
        f.toLowerCase().includes(searchTerm.toLowerCase())
    )
    const filteredFiles = files.filter(f =>
        f.key.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold font-heading">Link R2 Folder</h2>
                <p className="text-text-secondary text-sm">
                    Select an existing folder in your R2 bucket to import all assets.
                </p>
            </div>

            {/* Navigation & Search */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-sm text-text-secondary overflow-x-auto pb-2 custom-scrollbar">
                    <button
                        onClick={() => setCurrentPrefix('')}
                        className="flex items-center gap-1 hover:text-white transition-colors shrink-0"
                    >
                        <Home size={14} /> Root
                    </button>
                    {breadcrumbs.map((crumb, i) => (
                        <div key={i} className="flex items-center gap-2 shrink-0">
                            <ChevronRight size={14} />
                            <button
                                onClick={() => setCurrentPrefix(breadcrumbs.slice(0, i + 1).join('/') + '/')}
                                className="hover:text-white transition-colors"
                            >
                                {crumb}
                            </button>
                        </div>
                    ))}
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                    <input
                        type="text"
                        placeholder="Search folders..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 !py-2"
                    />
                </div>
            </div>

            {/* Folder List */}
            <div className="min-h-[300px] max-h-[400px] overflow-y-auto border border-white/10 rounded-2xl bg-black/20 p-2 custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center h-[300px]">
                        <Loader2 className="animate-spin text-accent" size={32} />
                    </div>
                ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[300px] text-text-secondary">
                        <Folder size={48} className="mb-4 opacity-20" />
                        <p>{searchTerm ? 'No items match your search.' : 'This folder is empty.'}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-1">
                        {/* Folders */}
                        {filteredFolders.map((folder) => (
                            <button
                                key={folder}
                                onClick={() => {
                                    setCurrentPrefix(folder)
                                    setSearchTerm('')
                                }}
                                className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                                    <Folder size={20} className="text-accent group-hover:scale-110 transition-transform" />
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="truncate text-sm font-medium">
                                        {folder.split('/').filter(Boolean).pop()}
                                    </span>
                                    <span className="truncate text-xs text-text-secondary">
                                        {folder}
                                    </span>
                                </div>
                                <ChevronRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                            </button>
                        ))}

                        {/* Files */}
                        {filteredFiles.map((file) => (
                            <div
                                key={file.key}
                                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                    {file.key.match(/\.(mp4|mov|webm)$/i) ? (
                                        <FileVideo size={20} className="text-blue-400" />
                                    ) : file.key.match(/\.(mp3|wav|m4a)$/i) ? (
                                        <FileAudio size={20} className="text-green-400" />
                                    ) : file.key.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                        <ImageIcon size={20} className="text-purple-400" />
                                    ) : (
                                        <FileText size={20} className="text-gray-400" />
                                    )}
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="truncate text-sm font-medium">
                                        {file.key.split('/').pop()}
                                    </span>
                                    <span className="truncate text-xs text-text-secondary">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-2">
                <button
                    onClick={onCancel}
                    className="btn-secondary flex-1"
                >
                    Cancel
                </button>
                <button
                    onClick={() => onSelect(currentPrefix)}
                    disabled={!currentPrefix || loading}
                    className="btn-primary flex-[2] !gap-3"
                >
                    <LinkIcon size={18} />
                    Link Current Folder
                </button>
            </div>
        </div>
    )
}
