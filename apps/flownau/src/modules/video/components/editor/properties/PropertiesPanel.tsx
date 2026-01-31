'use client';

import React from 'react';
import { Settings } from 'lucide-react';
import { useVideoEditor } from '@/modules/video/context/VideoEditorContext';

export function PropertiesPanel() {
    const { template, selectedElementId, updateElement, updateTemplate } = useVideoEditor();

    const selectedElement = template.elements.find((el) => el.id === selectedElementId);

    const renderInput = (label: string, value: string | number, onChange: (val: string) => void, type: 'text' | 'number' = 'text', step?: string) => (
        <div className="section">
            <label className="label">{label}</label>
            <input
                type={type}
                step={step}
                className="input-field"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );

    return (
        <div style={{ padding: '16px', overflowY: 'auto', height: '100%' }}>
            <div style={{ marginBottom: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={16} /> Properties
            </div>

            {selectedElement ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">Element</div>

                    {renderInput("Name", selectedElement.name, (val) => updateElement(selectedElement.id, { name: val }))}

                    <div className="section">
                        <label className="label">Content / URL</label>
                        {selectedElement.type === 'text' ? (
                            <textarea
                                className="input-field min-h-[80px]"
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

                    <div className="grid grid-cols-2 gap-2">
                        {renderInput("Start", selectedElement.startFrame, (val) => updateElement(selectedElement.id, { startFrame: Number(val) }), 'number')}
                        {renderInput("Duration", selectedElement.durationInFrames, (val) => updateElement(selectedElement.id, { durationInFrames: Number(val) }), 'number')}
                    </div>

                    <hr className="border-zinc-800 my-2" />

                    <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">Transform</div>

                    <div className="grid grid-cols-2 gap-2">
                        {renderInput("X", selectedElement.style.x, (val) => updateElement(selectedElement.id, { x: Number(val) }), 'number')}
                        {renderInput("Y", selectedElement.style.y, (val) => updateElement(selectedElement.id, { y: Number(val) }), 'number')}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {renderInput("Scale", selectedElement.style.scale, (val) => updateElement(selectedElement.id, { scale: Number(val) }), 'number', "0.1")}
                        {renderInput("Rotation", selectedElement.style.rotation, (val) => updateElement(selectedElement.id, { rotation: Number(val) }), 'number')}
                    </div>

                    {selectedElement.type === 'text' && (
                        <>
                            <hr className="border-zinc-800 my-2" />
                            <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">Text Style</div>
                            {renderInput("Font Size", selectedElement.style.fontSize || 40, (val) => updateElement(selectedElement.id, { fontSize: Number(val) }), 'number')}
                            {/* Add Color Picker here later */}
                        </>
                    )}

                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">Project Settings</div>

                    <div className="grid grid-cols-2 gap-2">
                        {renderInput("Width", template.width, (val) => updateTemplate({ width: Number(val) }), 'number')}
                        {renderInput("Height", template.height, (val) => updateTemplate({ height: Number(val) }), 'number')}
                    </div>

                    {renderInput("Duration (Frames)", template.durationInFrames, (val) => updateTemplate({ durationInFrames: Number(val) }), 'number')}
                    {renderInput("FPS", template.fps, (val) => updateTemplate({ fps: Number(val) }), 'number')}

                    <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(124, 58, 237, 0.1)', borderRadius: '8px', border: '1px solid rgba(124, 58, 237, 0.2)', fontSize: '11px', color: '#aaa' }}>
                        Tip: Select a layer to edit its individual properties.
                    </div>
                </div>
            )}

            <style jsx>{`
                .section { display: flex; flex-direction: column; gap: 4px; }
                .label { font-size: 11px; color: #71717a; font-weight: 500; }
                .input-field { 
                    background: #27272a; 
                    border: 1px solid #3f3f46; 
                    padding: 8px; 
                    border-radius: 6px; 
                    color: white; 
                    width: 100%;
                    font-size: 12px;
                }
                .input-field:focus {
                    outline: none;
                    border-color: #7c3aed;
                }
            `}</style>
        </div>
    );
}
