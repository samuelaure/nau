import React, { useRef, MouseEvent } from 'react';
import { useVideoEditor } from '@/modules/video/context/VideoEditorContext';

export function Timeline() {
    const { template, selectedElementId, setSelectedElementId, currentFrame, setCurrentFrame } = useVideoEditor();
    const timelineRef = useRef<HTMLDivElement>(null);

    const handleScrub = (e: MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();

        // Account for 16px padding on left/right
        const padding = 16;
        const availableWidth = rect.width - (padding * 2);
        const x = e.clientX - rect.left - padding;

        const percentage = Math.max(0, Math.min(1, x / availableWidth));
        const frame = Math.round(percentage * template.durationInFrames);
        setCurrentFrame(frame);
    };

    return (
        <div className="h-48 bg-[#161616] border-t border-zinc-800 flex flex-col select-none">
            {/* Toolbar / Header */}
            <div className="px-4 py-2 border-b border-zinc-800 text-xs text-zinc-500 flex justify-between items-center bg-[#111]">
                <span>Timeline</span>
                <div className="flex gap-4">
                    <span>{currentFrame} / {template.durationInFrames} frames</span>
                    <span>{(currentFrame / template.fps).toFixed(2)}s</span>
                </div>
            </div>

            {/* Timeline Tracks Area */}
            <div
                ref={timelineRef}
                className="flex-1 overflow-y-auto relative py-6 px-4 cursor-crosshair"
                onClick={handleScrub}
                onMouseMove={(e) => e.buttons === 1 && handleScrub(e)}
            >
                {/* Playhead Line */}
                <div
                    className="absolute top-0 bottom-0 w-px bg-red-500 z-50 pointer-events-none"
                    style={{
                        left: `calc(16px + (100% - 32px) * ${currentFrame / template.durationInFrames})`,
                    }}
                >
                    <div className="w-3 h-3 bg-red-500 rounded-full -ml-[5px] -mt-1 shadow-md" />
                </div>

                {/* Tracks */}
                <div className="relative min-h-full">
                    {template.elements.map((el) => (
                        <div key={el.id} className="h-8 my-2 relative flex items-center group">
                            <div
                                onClick={(e) => { e.stopPropagation(); setSelectedElementId(el.id); }}
                                className={`absolute h-6 rounded px-2 text-[10px] flex items-center overflow-hidden whitespace-nowrap border cursor-pointer transition-colors ${el.id === selectedElementId
                                        ? 'bg-violet-600 border-white text-white z-10'
                                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                                    }`}
                                style={{
                                    left: `${(el.startFrame / template.durationInFrames) * 100}%`,
                                    width: `${(el.durationInFrames / template.durationInFrames) * 100}%`,
                                }}
                            >
                                {el.name}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <style jsx>{`
                /* Custom scrollbar if needed */
            `}</style>
        </div>
    );
}
