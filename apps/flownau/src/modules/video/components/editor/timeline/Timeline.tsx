import React, { useRef, useState, useEffect, MouseEvent } from 'react';
import { useVideoEditor } from '@/modules/video/context/VideoEditorContext';

export function Timeline() {
    const { template, selectedElementId, setSelectedElementId, currentFrame, setCurrentFrame, updateElement } = useVideoEditor();
    const timelineRef = useRef<HTMLDivElement>(null);

    // Drag State
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragStartX, setDragStartX] = useState(0);
    const [originalStartFrame, setOriginalStartFrame] = useState(0);
    const [dragFrameDelta, setDragFrameDelta] = useState(0);

    // Resize State
    const [resizingId, setResizingId] = useState<string | null>(null);
    const [resizeHandle, setResizeHandle] = useState<'start' | 'end' | null>(null);
    const [originalDuration, setOriginalDuration] = useState(0);
    const [originalMediaStartOffset, setOriginalMediaStartOffset] = useState(0); // Store original offset

    // Scrubbing Logic
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

    // Clip Drag Logic
    const handleClipMouseDown = (e: MouseEvent<HTMLDivElement>, id: string, startFrame: number) => {
        e.stopPropagation(); // Prevent scrubbing
        setDraggingId(id);
        setDragStartX(e.clientX);
        setOriginalStartFrame(startFrame);
        setDragFrameDelta(0);
        setSelectedElementId(id);
    };

    // Resize Logic
    const handleResizeMouseDown = (e: MouseEvent<HTMLDivElement>, id: string, startFrame: number, duration: number, mediaStartOffset: number, handle: 'start' | 'end') => {
        e.stopPropagation();
        setResizingId(id);
        setResizeHandle(handle);
        setDragStartX(e.clientX);
        setOriginalStartFrame(startFrame);
        setOriginalDuration(duration);
        setOriginalMediaStartOffset(mediaStartOffset); // Capture initial offset
        setDragFrameDelta(0);
        setSelectedElementId(id);
    };

    useEffect(() => {
        if (!draggingId && !resizingId) return;

        const handleWindowMouseMove = (e: globalThis.MouseEvent) => {
            if (!timelineRef.current) return;

            const rect = timelineRef.current.getBoundingClientRect();
            const padding = 16;
            const availableWidth = rect.width - (padding * 2);

            const pixelDelta = e.clientX - dragStartX;
            const frameDelta = Math.round((pixelDelta / availableWidth) * template.durationInFrames);

            setDragFrameDelta(frameDelta);
        };

        const handleWindowMouseUp = () => {
            // Commit Drag
            if (draggingId) {
                const newStartFrame = Math.max(0, originalStartFrame + dragFrameDelta);
                updateElement(draggingId, { startFrame: newStartFrame });
            }
            // Commit Resize
            else if (resizingId && resizeHandle) {
                if (resizeHandle === 'start') {
                    const newStart = Math.max(0, Math.min(originalStartFrame + dragFrameDelta, originalStartFrame + originalDuration - 1)); // Min 1 frame
                    const changeInStart = newStart - originalStartFrame;
                    const newDuration = originalDuration - changeInStart;

                    // Update mediaStartOffset so the content shifts correctly (non-destructive trim)
                    const newMediaStartOffset = Math.max(0, originalMediaStartOffset + changeInStart);

                    updateElement(resizingId, {
                        startFrame: newStart,
                        durationInFrames: newDuration,
                        mediaStartOffset: newMediaStartOffset
                    });
                } else {
                    const newDuration = Math.max(1, originalDuration + dragFrameDelta);
                    updateElement(resizingId, { durationInFrames: newDuration });
                }
            }

            setDraggingId(null);
            setResizingId(null);
            setResizeHandle(null);
            setDragFrameDelta(0);
        };

        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
        };
    }, [draggingId, resizingId, resizeHandle, dragStartX, originalStartFrame, originalDuration, originalMediaStartOffset, dragFrameDelta, template.durationInFrames, updateElement]);

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
                onMouseDown={handleScrub}
                onMouseMove={(e) => e.buttons === 1 && !draggingId && !resizingId && handleScrub(e)}
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
                    {template.elements.map((el) => {
                        // Dragging Logic
                        const isDragging = draggingId === el.id;
                        let displayStartFrame = el.startFrame;
                        let displayDuration = el.durationInFrames;

                        if (isDragging) {
                            displayStartFrame = Math.max(0, originalStartFrame + dragFrameDelta);
                        } else if (resizingId === el.id) {
                            if (resizeHandle === 'start') {
                                // Constrain start resizing
                                const maxStart = originalStartFrame + originalDuration - 1;
                                const rawNewStart = originalStartFrame + dragFrameDelta;
                                displayStartFrame = Math.max(0, Math.min(rawNewStart, maxStart));
                                displayDuration = originalDuration - (displayStartFrame - originalStartFrame);
                            } else {
                                // Constrain end resizing
                                displayDuration = Math.max(1, originalDuration + dragFrameDelta);
                            }
                        }

                        return (
                            <div key={el.id} className="h-8 my-2 relative flex items-center group">
                                <div
                                    onMouseDown={(e) => handleClipMouseDown(e, el.id, el.startFrame)}
                                    className={`absolute h-6 rounded px-2 text-[10px] flex items-center border cursor-grab active:cursor-grabbing transition-colors group-hover:z-20 ${el.id === selectedElementId
                                        ? 'bg-violet-600 border-white text-white z-10'
                                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                                        } ${isDragging || resizingId === el.id ? 'opacity-90 ring-2 ring-violet-500 ring-offset-1 ring-offset-zinc-900' : ''}`}
                                    style={{
                                        left: `${(displayStartFrame / template.durationInFrames) * 100}%`,
                                        width: `${(displayDuration / template.durationInFrames) * 100}%`,
                                        transition: (isDragging || resizingId === el.id) ? 'none' : 'left 0.1s ease-out, width 0.1s ease-out'
                                    }}
                                >
                                    <span className="overflow-hidden whitespace-nowrap pointer-events-none select-none w-full">{el.name}</span>

                                    {/* Resize Handles - Only visible when selected or hovering */}
                                    <div
                                        className={`absolute left-0 top-0 bottom-0 w-2 cursor-w-resize hover:bg-white/50 z-20 ${el.id === selectedElementId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                        onMouseDown={(e) => handleResizeMouseDown(e, el.id, el.startFrame, el.durationInFrames, el.mediaStartOffset, 'start')}
                                    />
                                    <div
                                        className={`absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-white/50 z-20 ${el.id === selectedElementId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                        onMouseDown={(e) => handleResizeMouseDown(e, el.id, el.startFrame, el.durationInFrames, el.mediaStartOffset, 'end')}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style jsx>{`
                /* Custom scrollbar if needed */
            `}</style>
        </div>
    );
}
