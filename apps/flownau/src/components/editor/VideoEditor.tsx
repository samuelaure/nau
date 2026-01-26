
'use client';

import React, { useState, useCallback } from 'react';
import { Player } from '@remotion/player';
import { UniversalComposition } from '@/remotion/UniversalComposition';
import { VideoTemplate, VideoElement, ElementSchema } from '@/types/video-schema';
import Link from 'next/link';
import { Plus, Type, Image as ImageIcon, Video as VideoIcon, Save, Layers, Settings, Trash2, ArrowLeft, ChevronLeft } from 'lucide-react';

interface VideoEditorProps {
    templateId: string;
    templateName: string;
    initialTemplate?: VideoTemplate;
    onSave: (template: VideoTemplate) => void;
    assets?: any[];
}

const defaultTemplate: VideoTemplate = {
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 150,
    elements: [],
};

export default function VideoEditor({ templateId, templateName, initialTemplate = defaultTemplate, onSave, assets = [] }: VideoEditorProps) {
    const [template, setTemplate] = useState<VideoTemplate>(initialTemplate);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [sidebarTab, setSidebarTab] = useState<'layers' | 'assets'>('layers');

    const handleAddElement = (type: VideoElement['type']) => {
        const newElement: VideoElement = {
            id: crypto.randomUUID(),
            type,
            name: `New ${type}`,
            startFrame: 0,
            durationInFrames: template.durationInFrames,
            content: type === 'text' ? 'New Text' : '',
            style: {
                x: 100,
                y: 100,
                width: type === 'text' ? undefined : 400,
                height: type === 'text' ? undefined : 400,
                scale: 1,
                rotation: 0,
                opacity: 1,
                fontSize: 40,
                textAlign: 'left',
                color: '#ffffff',
            },
        };

        setTemplate((prev) => ({
            ...prev,
            elements: [...prev.elements, newElement],
        }));
        setSelectedElementId(newElement.id);
    };

    const updateElement = (id: string, changes: Partial<VideoElement> | Partial<VideoElement['style']>) => {
        setTemplate((prev) => ({
            ...prev,
            elements: prev.elements.map((el) => {
                if (el.id !== id) return el;
                // Check if changes are style or root properties
                const isStyleChange = Object.keys(changes).some(k => k in el.style || ['x', 'y', 'width', 'height', 'scale', 'rotation', 'opacity', 'colors', 'fontSize', 'textAlign'].includes(k));

                if (isStyleChange) {
                    // @ts-ignore
                    return { ...el, style: { ...el.style, ...changes } };
                }
                return { ...el, ...changes };
            }),
        }));
    };

    const deleteElement = (id: string) => {
        setTemplate((prev) => ({
            ...prev,
            elements: prev.elements.filter((el) => el.id !== id),
        }));
        if (selectedElementId === id) setSelectedElementId(null);
    }

    const selectedElement = template.elements.find((el) => el.id === selectedElementId);

    return (
        <div className="flex flex-col h-screen bg-[#0d0d0d] text-white overflow-hidden" style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>

            {/* Top Bar / Header */}
            <div style={{ height: '50px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '16px', background: '#111' }}>
                <Link href={`/dashboard/templates/${templateId}`} style={{
                    color: '#aaa',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    transition: 'color 0.2s'
                }} className="hover-white">
                    <ChevronLeft size={16} /> Back to Dashboard
                </Link>
                <div style={{ width: '1px', height: '20px', background: '#333' }} />
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{templateName}</div>
                <div style={{ flex: 1 }} />
            </div>

            {/* Main Editor Body */}
            <div className="flex flex-1 overflow-hidden" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* Sidebar - Tools */}
                <div style={{ width: '60px', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: '24px', background: '#111' }}>
                    <ToolButton icon={<Plus size={20} />} label="Add" onClick={() => { }} active={false} />
                    <div style={{ width: '30px', height: '1px', background: '#333' }} />
                    <ToolButton icon={<Layers size={20} />} label="Layers" onClick={() => setSidebarTab('layers')} active={sidebarTab === 'layers'} />
                    <ToolButton icon={<ImageIcon size={20} />} label="Assets" onClick={() => setSidebarTab('assets')} active={sidebarTab === 'assets'} />
                    <div style={{ flex: 1 }} />
                    <ToolButton icon={<Save size={20} />} label="Save" onClick={() => onSave(template)} active={false} />
                </div>

                {/* Side Panel (Layers or Assets) */}
                <div style={{ width: '300px', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', background: '#161616' }}>
                    {sidebarTab === 'layers' ? (
                        <>
                            <div style={{ padding: '16px', borderBottom: '1px solid #333', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Layers size={16} /> Layers</div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button onClick={() => handleAddElement('text')} title="Add Text" style={{ background: '#27272a', border: 'none', color: 'white', padding: '4px', borderRadius: '4px', cursor: 'pointer' }}><Type size={14} /></button>
                                    <button onClick={() => handleAddElement('image')} title="Add Image" style={{ background: '#27272a', border: 'none', color: 'white', padding: '4px', borderRadius: '4px', cursor: 'pointer' }}><ImageIcon size={14} /></button>
                                    <button onClick={() => handleAddElement('video')} title="Add Video" style={{ background: '#27272a', border: 'none', color: 'white', padding: '4px', borderRadius: '4px', cursor: 'pointer' }}><VideoIcon size={14} /></button>
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
                                        style={{
                                            padding: '12px 16px',
                                            cursor: 'pointer',
                                            background: selectedElementId === element.id ? 'rgba(124, 58, 237, 0.15)' : 'transparent',
                                            borderLeft: selectedElementId === element.id ? '3px solid #7c3aed' : '3px solid transparent',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            borderBottom: '1px solid #222'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {element.type === 'text' && <Type size={14} color="#aaa" />}
                                            {element.type === 'image' && <ImageIcon size={14} color="#aaa" />}
                                            {element.type === 'video' && <VideoIcon size={14} color="#aaa" />}
                                            <span style={{ fontSize: '13px', color: selectedElementId === element.id ? 'white' : '#aaa' }}>{element.name}</span>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); deleteElement(element.id); }} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#666'}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ padding: '16px', borderBottom: '1px solid #333', fontWeight: 'bold' }}>
                                Assets Library
                            </div>
                            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                {assets.map((asset: any) => (
                                    <div
                                        key={asset.id}
                                        className="asset-item"
                                        onClick={() => {
                                            const type = asset.type === 'VID' ? 'video' : asset.type === 'IMG' ? 'image' : 'video';
                                            const newElement: VideoElement = {
                                                id: crypto.randomUUID(),
                                                type: type as any,
                                                name: asset.originalFilename || 'New Asset',
                                                startFrame: 0,
                                                durationInFrames: template.durationInFrames,
                                                content: asset.url,
                                                style: {
                                                    x: 0,
                                                    y: 0,
                                                    width: template.width,
                                                    height: template.height,
                                                    scale: 1,
                                                    rotation: 0,
                                                    opacity: 1,
                                                    textAlign: 'center',
                                                },
                                            };
                                            setTemplate(prev => ({ ...prev, elements: [...prev.elements, newElement] }));
                                            setSelectedElementId(newElement.id);
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
                                    >
                                        {asset.type === 'IMG' ? (
                                            <img src={asset.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
                                                <VideoIcon size={20} color="#444" />
                                            </div>
                                        )}
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', padding: '4px', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {asset.originalFilename}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Main Canvas / Player Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div
                        onClick={() => setSelectedElementId(null)}
                        style={{
                            flex: 1,
                            background: '#111',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            padding: '40px',
                            backgroundImage: 'radial-gradient(#333 1px, transparent 1px)',
                            backgroundSize: '24px 24px'
                        }}>
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                transform: 'scale(0.8)',
                                transformOrigin: 'center center',
                                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                                border: '1px solid #444',
                                background: 'black'
                            }}>
                            <Player
                                component={UniversalComposition}
                                inputProps={{ template }}
                                durationInFrames={template.durationInFrames}
                                fps={template.fps}
                                compositionWidth={template.width}
                                compositionHeight={template.height}
                                style={{
                                    width: '360px', // Scaling handled by parent
                                    height: '640px',
                                }}
                                controls
                            />
                        </div>
                    </div>

                    {/* Timeline Placeholder */}
                    <div style={{ height: '200px', background: '#161616', borderTop: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '8px 16px', borderBottom: '1px solid #222', fontSize: '12px', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Timeline</span>
                            <span>{template.durationInFrames} frames</span>
                        </div>
                        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative', padding: '10px 0' }}>
                            {template.elements.map((el, i) => (
                                <div key={el.id} style={{ height: '24px', margin: '4px 0', position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <div style={{
                                        position: 'absolute',
                                        left: `${(el.startFrame / template.durationInFrames) * 100}%`,
                                        width: `${(el.durationInFrames / template.durationInFrames) * 100}%`,
                                        height: '20px',
                                        background: el.id === selectedElementId ? '#7c3aed' : '#333',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        padding: '0 8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        overflow: 'hidden',
                                        whiteSpace: 'nowrap',
                                        cursor: 'pointer',
                                        border: el.id === selectedElementId ? '1px solid white' : 'none'
                                    }} onClick={() => setSelectedElementId(el.id)}>
                                        {el.name}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Properties Panel */}
                <div style={{ width: '300px', borderLeft: '1px solid #333', padding: '16px', overflowY: 'auto' }}>
                    <div style={{ marginBottom: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Settings size={16} /> Properties
                    </div>

                    {selectedElement ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="section">
                                <label className="label">Name</label>
                                <input
                                    className="input-field"
                                    value={selectedElement.name}
                                    onChange={(e) => updateElement(selectedElement.id, { name: e.target.value })}
                                />
                            </div>

                            <div className="section">
                                <label className="label">Content / URL</label>
                                {selectedElement.type === 'text' ? (
                                    <textarea
                                        className="input-field"
                                        rows={3}
                                        value={selectedElement.content || ''}
                                        onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                                    />
                                ) : (
                                    <input
                                        className="input-field"
                                        value={selectedElement.content || ''}
                                        onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                                        placeholder="https://..."
                                    />
                                )}
                            </div>

                            <div className="section">
                                <label className="label">Start Frame</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={selectedElement.startFrame}
                                    onChange={(e) => updateElement(selectedElement.id, { startFrame: Number(e.target.value) })}
                                />
                            </div>

                            <div className="section">
                                <label className="label">Duration</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={selectedElement.durationInFrames}
                                    onChange={(e) => updateElement(selectedElement.id, { durationInFrames: Number(e.target.value) })}
                                />
                            </div>

                            <hr style={{ borderColor: '#333' }} />

                            <div className="section">
                                <label className="label">Position X</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={selectedElement.style.x}
                                    onChange={(e) => updateElement(selectedElement.id, { x: Number(e.target.value) })}
                                />
                            </div>
                            <div className="section">
                                <label className="label">Position Y</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={selectedElement.style.y}
                                    onChange={(e) => updateElement(selectedElement.id, { y: Number(e.target.value) })}
                                />
                            </div>
                            <div className="section">
                                <label className="label">Scale</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    className="input-field"
                                    value={selectedElement.style.scale}
                                    onChange={(e) => updateElement(selectedElement.id, { scale: Number(e.target.value) })}
                                />
                            </div>

                            {selectedElement.type === 'text' && (
                                <div className="section">
                                    <label className="label">Font Size</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={selectedElement.style.fontSize}
                                        onChange={(e) => updateElement(selectedElement.id, { fontSize: Number(e.target.value) })}
                                    />
                                </div>
                            )}

                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>Project Settings</div>
                            <div className="section">
                                <label className="label">Resolution Width</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={template.width}
                                    onChange={(e) => setTemplate(prev => ({ ...prev, width: Number(e.target.value) }))}
                                />
                            </div>
                            <div className="section">
                                <label className="label">Resolution Height</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={template.height}
                                    onChange={(e) => setTemplate(prev => ({ ...prev, height: Number(e.target.value) }))}
                                />
                            </div>
                            <div className="section">
                                <label className="label">Total Frames</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={template.durationInFrames}
                                    onChange={(e) => setTemplate(prev => ({ ...prev, durationInFrames: Number(e.target.value) }))}
                                />
                            </div>
                            <div className="section">
                                <label className="label">FPS</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={template.fps}
                                    onChange={(e) => setTemplate(prev => ({ ...prev, fps: Number(e.target.value) }))}
                                />
                            </div>

                            <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(124, 58, 237, 0.1)', borderRadius: '8px', border: '1px solid rgba(124, 58, 237, 0.2)', fontSize: '11px', color: '#aaa' }}>
                                Tip: Select a layer to edit its individual properties.
                            </div>
                        </div>
                    )}
                </div>

            </div>

            <style jsx>{`
                .section { display: flex; flex-direction: column; gap: 4px; }
                .label { font-size: 12px; color: #aaa; }
                .input-field { 
                    background: #27272a; 
                    border: 1px solid #3f3f46; 
                    padding: 8px; 
                    border-radius: 6px; 
                    color: white; 
                    width: 100%;
                }
                .hover-white:hover { color: white !important; }
            `}</style>
        </div>
    );
}

function ToolButton({ icon, label, onClick, active }: { icon: React.ReactNode, label: string, onClick: () => void, active: boolean }) {
    return (
        <button
            onClick={onClick}
            style={{
                background: active ? 'rgba(124, 58, 237, 0.2)' : 'transparent',
                border: 'none',
                color: active ? '#7c3aed' : '#aaa',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                width: '100%',
                padding: '8px 0',
                borderLeft: active ? '2px solid #7c3aed' : '2px solid transparent'
            }}
            onMouseEnter={(e) => !active && (e.currentTarget.style.color = 'white')}
            onMouseLeave={(e) => !active && (e.currentTarget.style.color = '#aaa')}
        >
            {icon}
            <span style={{ fontSize: '9px', fontWeight: 'bold', marginTop: '2px' }}>{label}</span>
        </button>
    )
}
