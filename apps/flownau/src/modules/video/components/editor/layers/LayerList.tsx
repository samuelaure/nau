'use client';

import React from 'react';
import { Type, Image as ImageIcon, Video as VideoIcon, Trash2, Layers } from 'lucide-react';
import { useVideoEditor } from '@/modules/video/context/VideoEditorContext';

export function LayerList() {
    const { template, selectedElementId, setSelectedElementId, deleteElement, addElement } = useVideoEditor();

    return (
        <div className="flex flex-col h-full">
            <div style={{ padding: '16px', borderBottom: '1px solid #333', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Layers size={16} /> Layers</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => addElement('text')} title="Add Text" className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"><Type size={14} /></button>
                    <button onClick={() => addElement('image')} title="Add Image" className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"><ImageIcon size={14} /></button>
                    <button onClick={() => addElement('video')} title="Add Video" className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"><VideoIcon size={14} /></button>
                </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {template.elements.length === 0 && (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
                        No layers yet. Add one to get started.
                    </div>
                )}
                {[...template.elements].reverse().map(element => (
                    <div
                        key={element.id}
                        onClick={() => setSelectedElementId(element.id)}
                        className={`flex justify-between items-center border-b border-zinc-900 group`}
                        style={{
                            padding: '12px 16px',
                            cursor: 'pointer',
                            background: selectedElementId === element.id ? 'rgba(124, 58, 237, 0.15)' : 'transparent',
                            borderLeft: selectedElementId === element.id ? '3px solid #7c3aed' : '3px solid transparent',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {element.type === 'text' && <Type size={14} color="#aaa" />}
                            {element.type === 'image' && <ImageIcon size={14} color="#aaa" />}
                            {element.type === 'video' && <VideoIcon size={14} color="#aaa" />}
                            {element.type === 'audio' && <VideoIcon size={14} color="#aaa" />}
                            <span style={{ fontSize: '13px', color: selectedElementId === element.id ? 'white' : '#aaa' }}>{element.name}</span>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); deleteElement(element.id); }}
                            className="bg-transparent border-none text-zinc-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
