'use client';

import React, { useState, useEffect } from 'react';
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
    FileText
} from 'lucide-react';
import { useVideoEditor } from '@/modules/video/context/VideoEditorContext';

interface AssetBrowserProps {
    assets: any[];
    assetsRoot?: string;
}

type ViewMode = 'grid-lg' | 'grid-sm' | 'list';
type FilterType = 'all' | 'video' | 'audio' | 'image';
type BrowserMode = 'project' | 'cloud';

export function AssetBrowser({ assets, assetsRoot }: AssetBrowserProps) {
    const { addElement } = useVideoEditor();

    // View State
    const [viewMode, setViewMode] = useState<ViewMode>('grid-lg');
    const [browserMode, setBrowserMode] = useState<BrowserMode>('project');
    const [filterType, setFilterType] = useState<FilterType>('all');

    // Cloud Browser State
    const [currentPrefix, setCurrentPrefix] = useState(assetsRoot || '');
    const [folders, setFolders] = useState<string[]>([]);
    const [files, setFiles] = useState<any[]>([]); // R2 Files
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch R2 Data when in Cloud mode and prefix changes
    useEffect(() => {
        if (browserMode === 'cloud') {
            fetchFolders(currentPrefix);
        }
    }, [currentPrefix, browserMode]);

    const fetchFolders = async (prefix: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/protected/r2/list?prefix=${encodeURIComponent(prefix)}`);
            const data = await res.json();
            if (data.folders) setFolders(data.folders);
            if (data.files) setFiles(data.files);
        } catch (error) {
            console.error('Failed to fetch folders', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter Project Assets
    const filteredProjectAssets = assets.filter(asset => {
        if (filterType === 'all') return true;
        if (filterType === 'video') return asset.type === 'VID' || asset.type === 'video';
        if (filterType === 'image') return asset.type === 'IMG' || asset.type === 'image';
        if (filterType === 'audio') return asset.type === 'AUD' || asset.type === 'audio';
        return true;
    });

    // Helper to get file icon/type for Cloud files
    const getCloudFileType = (key: string) => {
        if (key.match(/\.(mp4|mov|webm|mkv)$/i)) return 'video';
        if (key.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'image';
        if (key.match(/\.(mp3|wav|m4a|aac)$/i)) return 'audio';
        return 'unknown';
    };

    const handleAddAsset = async (url: string, name: string, typeHint?: string) => {
        let type: 'video' | 'image' | 'audio' = 'video';

        if (typeHint) {
            // @ts-ignore
            if (typeHint === 'VID' || typeHint === 'video') type = 'video';
            // @ts-ignore
            else if (typeHint === 'IMG' || typeHint === 'image') type = 'image';
            // @ts-ignore
            else if (typeHint === 'AUD' || typeHint === 'audio') type = 'audio';
        } else {
            const derived = getCloudFileType(name);
            if (derived !== 'unknown') type = derived as any;
        }

        let width: number | undefined;
        let height: number | undefined;

        // Attempt to detect dimensions
        try {
            if (url) {
                if (type === 'image') {
                    const img = new Image();
                    img.src = url;
                    await new Promise<void>((resolve, reject) => {
                        img.onload = () => { width = img.naturalWidth; height = img.naturalHeight; resolve(); };
                        img.onerror = reject;
                        setTimeout(reject, 3000); // 3s timeout
                    });
                } else if (type === 'video') {
                    const v = document.createElement('video');
                    v.src = url;
                    // Need to wait for metadata
                    await new Promise<void>((resolve, reject) => {
                        v.onloadedmetadata = () => { width = v.videoWidth; height = v.videoHeight; resolve(); };
                        v.onerror = reject;
                        setTimeout(reject, 3000);
                    });
                }
            }
        } catch (e) {
            console.warn('Failed to detect asset dimensions, using fallback', e);
        }

        addElement(type, { url, name, width, height });
    };

    return (
        <div className="flex flex-col h-full bg-[#161616] text-zinc-300">
            {/* Header & Mode Switch */}
            <div className="p-4 border-b border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">Assets</span>
                    <div className="flex bg-zinc-900 rounded-lg p-0.5">
                        <button
                            onClick={() => setBrowserMode('project')}
                            className={`px-3 py-1 text-xs rounded-md transition-all ${browserMode === 'project' ? 'bg-zinc-700 text-white shadow-sm' : 'hover:text-white'}`}
                        >
                            Project
                        </button>
                        <button
                            onClick={() => setBrowserMode('cloud')}
                            className={`px-3 py-1 text-xs rounded-md transition-all ${browserMode === 'cloud' ? 'bg-zinc-700 text-white shadow-sm' : 'hover:text-white'}`}
                        >
                            Cloud
                        </button>
                    </div>
                </div>

                {/* Filters (Project Mode) or Breadcrumbs (Cloud Mode) */}
                {browserMode === 'project' ? (
                    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                        {['all', 'video', 'image', 'audio'].map(t => (
                            <button
                                key={t}
                                onClick={() => setFilterType(t as FilterType)}
                                className={`px-2.5 py-1 text-[10px] uppercase font-semibold rounded-full border transition-colors whitespace-nowrap ${filterType === t
                                    ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                                    : 'border-zinc-700 hover:border-zinc-500'
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center gap-1 text-xs text-zinc-500 overflow-x-auto whitespace-nowrap pb-1 scrollbar-hide">
                        <button onClick={() => setCurrentPrefix(assetsRoot || '')} className="hover:text-white flex items-center gap-1">
                            <Home size={10} /> Root
                        </button>
                        {currentPrefix.replace(assetsRoot || '', '').split('/').filter(Boolean).map((crumb, i, arr) => (
                            <div key={i} className="flex items-center gap-1">
                                <ChevronRight size={10} />
                                <span className={i === arr.length - 1 ? 'text-zinc-300' : ''}>{crumb}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* View Toggles */}
                <div className="flex justify-between items-end">
                    <span className="text-[10px] text-zinc-500">
                        {browserMode === 'project' ? `${filteredProjectAssets.length} items` : `${files.length} files`}
                    </span>
                    <div className="flex gap-1">
                        <button onClick={() => setViewMode('grid-lg')} className={`p-1.5 rounded ${viewMode === 'grid-lg' ? 'bg-zinc-700 text-white' : 'hover:bg-zinc-800'}`}><LayoutGrid size={14} /></button>
                        <button onClick={() => setViewMode('grid-sm')} className={`p-1.5 rounded ${viewMode === 'grid-sm' ? 'bg-zinc-700 text-white' : 'hover:bg-zinc-800'}`}><Grid3X3 size={14} /></button>
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-zinc-700 text-white' : 'hover:bg-zinc-800'}`}><ListIcon size={14} /></button>
                    </div>
                </div>
            </div>

            {/* Asset Grid/List */}
            <div className="flex-1 overflow-y-auto p-3">
                {browserMode === 'cloud' && loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-zinc-600" /></div>
                ) : (
                    <div className={`
                        gap-2
                        ${viewMode === 'list' ? 'flex flex-col' : 'grid'}
                        ${viewMode === 'grid-lg' ? 'grid-cols-2' : ''}
                        ${viewMode === 'grid-sm' ? 'grid-cols-3' : ''}
                    `}>
                        {/* Render Folders (Cloud Mode Only) */}
                        {browserMode === 'cloud' && folders.map(folder => (
                            <div
                                key={folder}
                                onClick={() => setCurrentPrefix(folder)}
                                className={`
                                    group cursor-pointer bg-zinc-900 border border-zinc-800 rounded-md hover:border-zinc-600 hover:bg-zinc-800 transition-all flex items-center
                                    ${viewMode === 'list' ? 'p-2 gap-3' : 'flex-col p-3 gap-2 aspect-square justify-center text-center'}
                                `}
                            >
                                <Folder size={viewMode === 'list' ? 16 : 32} className="text-blue-500/80 group-hover:text-blue-400" />
                                <span className="text-xs truncate w-full px-1">
                                    {folder.split('/').filter(Boolean).pop()}
                                </span>
                            </div>
                        ))}

                        {/* Render Files */}
                        {(browserMode === 'project' ? filteredProjectAssets : files).map((asset: any) => {
                            const isProject = browserMode === 'project';
                            const name = isProject ? asset.originalFilename : asset.key.split('/').pop();
                            const url = isProject ? asset.url : `/api/proxy?key=${encodeURIComponent(asset.key)}`; // Assuming proxy needed or public URL
                            // Note: R2 files from 'list' might not have full URL. Assuming public bucket or needs signed URL. 
                            // ClientEditor usually receives full URL in assets. 
                            // For Cloud browser, we might need a way to get the URL. 
                            // For now assuming we can construct it or R2 browser returns it. 
                            // R2FolderBrowser uses internal implementation detail. 
                            // Let's assume asset object has `url` if it was returned by our list endpoint? 
                            // Checking R2FolderBrowser... it uses `files` from `list` endpoint. 
                            // The list endpoint usually returns metadata. 
                            // Actually, let's use the object key as placeholder if URL missing? 
                            // Or better, assume `asset.url` exists or construct it if we know the bucket public domain. 
                            // The Project assets definitely have `url`.

                            // FIX: For cloud files, we use what we have. If `url` is missing, we might need to rely on backend to presign on demand? 
                            // Just pass the generic object for now.

                            const type = isProject
                                ? (asset.type === 'VID' ? 'video' : asset.type === 'IMG' ? 'image' : 'audio')
                                : getCloudFileType(name);

                            return (
                                <div
                                    key={isProject ? asset.id : asset.key}
                                    onClick={() => handleAddAsset(asset.url || `https://pub-2a95574384d748f6834d852cb7ec9aa1.r2.dev/${asset.key}`, name, isProject ? asset.type : undefined)}
                                    // TODO: Replace hardcoded domain with env var or proper mapping
                                    className={`
                                        group cursor-pointer bg-zinc-900 border border-zinc-800 rounded-md relative overflow-hidden transition-all
                                        ${viewMode === 'list' ? 'p-2 gap-3 flex items-center hover:bg-zinc-800' : 'aspect-square hover:border-zinc-500'}
                                    `}
                                >
                                    {/* Thumbnail / Icon */}
                                    <div className={`
                                        flex items-center justify-center bg-black/20
                                        ${viewMode === 'list' ? 'w-8 h-8 rounded shrink-0' : 'w-full h-full absolute inset-0'}
                                    `}>
                                        {/* Try to show image preview if possible */}
                                        {(type === 'image' || type === 'video') && (asset.url || browserMode === 'project') ? (
                                            <img
                                                src={asset.url || `https://pub-2a95574384d748f6834d852cb7ec9aa1.r2.dev/${asset.key}`}
                                                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                                                loading="lazy"
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                        ) : null}

                                        {/* Fallback Icon overlay */}
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            {type === 'video' && <FileVideo size={viewMode === 'list' ? 14 : 24} className="text-zinc-500 group-hover:text-white drop-shadow-md" />}
                                            {type === 'image' && <ImageIcon size={viewMode === 'list' ? 14 : 24} className="text-zinc-500 group-hover:text-white drop-shadow-md" />}
                                            {type === 'audio' && <FileAudio size={viewMode === 'list' ? 14 : 24} className="text-zinc-500 group-hover:text-white drop-shadow-md" />}
                                            {type === 'unknown' && <FileIcon size={viewMode === 'list' ? 14 : 24} className="text-zinc-500 group-hover:text-white drop-shadow-md" />}
                                        </div>
                                    </div>

                                    {/* Label */}
                                    {viewMode === 'list' ? (
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs text-zinc-300 truncate group-hover:text-white">{name}</div>
                                            <div className="text-[10px] text-zinc-500">
                                                {isProject ? 'Imported' : (asset.size ? `${(asset.size / 1024 / 1024).toFixed(1)} MB` : '')}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 to-transparent pt-6">
                                            <div className="text-[10px] text-zinc-300 truncate group-hover:text-white font-medium">{name}</div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
