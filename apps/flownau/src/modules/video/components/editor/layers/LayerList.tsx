'use client';

import React from 'react';
import { Type, Image as ImageIcon, Video as VideoIcon, Trash2, Layers, ArrowUp, ArrowDown } from 'lucide-react';
import { useVideoEditor } from '@/modules/video/context/VideoEditorContext';

export function LayerList() {
    const { template, selectedElementId, setSelectedElementId, deleteElement, addElement, reorderElement } = useVideoEditor();

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
                {[...template.elements].reverse().map((element, index, arr) => {
                    const isFirst = index === 0; // Top of the list (Last in array)
                    const isLast = index === arr.length - 1; // Bottom of the list (First in array)

                    return (
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                                {element.type === 'text' && <Type size={14} color="#aaa" />}
                                {element.type === 'image' && <ImageIcon size={14} color="#aaa" />}
                                {element.type === 'video' && <VideoIcon size={14} color="#aaa" />}
                                {element.type === 'audio' && <VideoIcon size={14} color="#aaa" />}
                                <span className="truncate" style={{ fontSize: '13px', color: selectedElementId === element.id ? 'white' : '#aaa' }}>{element.name}</span>
                            </div>

                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); reorderElement(element.id, 'up'); }}
                                    disabled={isFirst}
                                    className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500"
                                    title="Bring Forward"
                                >
                                    <ArrowUp size={14} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); reorderElement(element.id, 'down'); }}
                                    disabled={isLast}
                                    className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500"
                                    title="Send Backward"
                                >
                                    <ArrowDown size={14} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteElement(element.id); }}
                                    className="p-1 text-zinc-500 hover:text-red-500"
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
