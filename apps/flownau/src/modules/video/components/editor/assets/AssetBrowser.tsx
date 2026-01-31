'use client';

import React from 'react';
import { Video as VideoIcon } from 'lucide-react';
import { useVideoEditor } from '@/modules/video/context/VideoEditorContext';

interface AssetBrowserProps {
    assets: any[]; // TODO: Type this properly
}

export function AssetBrowser({ assets }: AssetBrowserProps) {
    const { addElement } = useVideoEditor();

    return (
        <div className="flex flex-col h-full">
            <div style={{ padding: '16px', borderBottom: '1px solid #333', fontWeight: 'bold' }}>
                Assets Library
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {assets.map((asset: any) => (
                    <div
                        key={asset.id}
                        onClick={() => {
                            const type = asset.type === 'VID' ? 'video' : asset.type === 'IMG' ? 'image' : 'video';
                            addElement(type, { url: asset.url, name: asset.originalFilename });
                        }}
                        style={{
                            aspectRatio: '1',
                            background: '#222',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            position: 'relative',
                            border: '1px solid #333'
                        }}
                        className="hover:border-zinc-500 transition-colors"
                    >
                        {asset.type === 'IMG' ? (
                            <img src={asset.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
                                <VideoIcon size={20} color="#444" />
                            </div>
                        )}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', padding: '4px', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'white' }}>
                            {asset.originalFilename}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
