'use client';

import React from 'react';
import { Plus, Layers, Image as ImageIcon, Save } from 'lucide-react';
import { useVideoEditor } from '@/modules/video/context/VideoEditorContext';

interface EditorSidebarProps {
    activeTab: 'layers' | 'assets';
    setActiveTab: (tab: 'layers' | 'assets') => void;
    onSave: () => void;
}

export function EditorSidebar({ activeTab, setActiveTab, onSave }: EditorSidebarProps) {
    return (
        <div style={{ width: '60px', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: '24px', background: '#111' }}>
            <ToolButton icon={<Plus size={20} />} label="Add" onClick={() => { }} active={false} />
            <div style={{ width: '30px', height: '1px', background: '#333' }} />
            <ToolButton icon={<Layers size={20} />} label="Layers" onClick={() => setActiveTab('layers')} active={activeTab === 'layers'} />
            <ToolButton icon={<ImageIcon size={20} />} label="Assets" onClick={() => setActiveTab('assets')} active={activeTab === 'assets'} />
            <div style={{ flex: 1 }} />
            <ToolButton icon={<Save size={20} />} label="Save" onClick={onSave} active={false} />
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
