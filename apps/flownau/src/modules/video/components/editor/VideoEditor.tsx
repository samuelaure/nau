'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { VideoTemplate } from '@/types/video-schema';
import { VideoEditorProvider, useVideoEditor } from '@/modules/video/context/VideoEditorContext';

// Components
import { EditorSidebar } from './EditorSidebar';
import { LayerList } from './layers/LayerList';
import { AssetBrowser } from './assets/AssetBrowser';
import { EditorCanvas } from './canvas/EditorCanvas';
import { PropertiesPanel } from './properties/PropertiesPanel';
import { Timeline } from './timeline/Timeline';

interface VideoEditorProps {
    templateId: string;
    templateName: string;
    initialTemplate?: VideoTemplate;
    onSave: (template: VideoTemplate) => void;
    assets?: any[];
    assetsRoot?: string;
}

const defaultTemplate: VideoTemplate = {
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 150,
    elements: [],
};

export default function VideoEditor(props: VideoEditorProps) {
    const { initialTemplate = defaultTemplate, onSave } = props;

    return (
        <VideoEditorProvider initialTemplate={initialTemplate} onSave={onSave}>
            <VideoEditorLayout {...props} />
        </VideoEditorProvider>
    );
}

function VideoEditorLayout({ templateId, templateName, onSave, assets = [], assetsRoot }: VideoEditorProps) {
    const { template } = useVideoEditor();
    const [sidebarTab, setSidebarTab] = useState<'layers' | 'assets'>('layers');

    return (
        <div className="flex flex-col h-screen bg-[#0d0d0d] text-white overflow-hidden w-screen">

            {/* Top Bar / Header */}
            <div style={{ height: '50px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '16px', background: '#111' }}>
                <Link href={`/dashboard/templates/${templateId}`} className="text-zinc-400 hover:text-white no-underline flex items-center gap-1.5 text-[13px] transition-colors">
                    <ChevronLeft size={16} /> Back to Dashboard
                </Link>
                <div style={{ width: '1px', height: '20px', background: '#333' }} />
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{templateName}</div>
                <div style={{ flex: 1 }} />
            </div>

            {/* Main Editor Body */}
            <div className="flex flex-1 overflow-hidden">

                {/* Sidebar - Tools */}
                <EditorSidebar
                    activeTab={sidebarTab}
                    setActiveTab={setSidebarTab}
                    onSave={() => onSave(template)}
                />

                {/* Side Panel (Layers or Assets) */}
                <div style={{ width: '300px', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', background: '#161616' }}>
                    {sidebarTab === 'layers' ? <LayerList /> : <AssetBrowser assets={assets} assetsRoot={assetsRoot} />}
                </div>

                {/* Main Canvas / Player Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <EditorCanvas />
                    <Timeline />
                </div>

                {/* Properties Panel */}
                <div style={{ width: '300px', borderLeft: '1px solid #333', background: '#111' }}>
                    <PropertiesPanel />
                </div>

            </div>
        </div>
    );
}
