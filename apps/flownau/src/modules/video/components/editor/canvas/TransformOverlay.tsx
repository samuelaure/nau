
import React, { useRef, useEffect, useState } from 'react';
import { useVideoEditor } from '@/modules/video/context/VideoEditorContext';

interface TransformOverlayProps {
    containerWidth: number;
    containerHeight: number;
}

export const TransformOverlay: React.FC<TransformOverlayProps> = ({ containerWidth, containerHeight }) => {
    const { template, selectedElementId, updateElement } = useVideoEditor();

    // Local state for dragging/resizing
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [elementStart, setElementStart] = useState({ x: 0, y: 0, w: 0, h: 0 });

    const selectedElement = template.elements.find(el => el.id === selectedElementId);

    // Handlers
    const handleMouseUp = () => {
        setIsDragging(false);
        setIsResizing(null);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!selectedElement) return;

        const scaleX = containerWidth / template.width;
        const scaleY = containerHeight / template.height;

        const dx = (e.clientX - dragStart.x) / scaleX;
        const dy = (e.clientY - dragStart.y) / scaleY;

        if (isDragging) {
            updateElement(selectedElement.id, {
                x: elementStart.x + dx,
                y: elementStart.y + dy
            });
        } else if (isResizing) {
            let newX = elementStart.x;
            let newY = elementStart.y;
            let newW = elementStart.w;
            let newH = elementStart.h;

            const isCorner = ['nw', 'ne', 'sw', 'se'].includes(isResizing);
            const aspectRatio = elementStart.h !== 0 ? elementStart.w / elementStart.h : 1; // Default to 1 if height is 0 to avoid division by zero

            // Calculate potential new dimensions based on raw mouse movement
            let potentialNewW = elementStart.w;
            let potentialNewH = elementStart.h;

            if (isResizing.includes('w')) {
                potentialNewW = elementStart.w - dx;
            }
            if (isResizing.includes('e')) {
                potentialNewW = elementStart.w + dx;
            }
            if (isResizing.includes('n')) {
                potentialNewH = elementStart.h - dy;
            }
            if (isResizing.includes('s')) {
                potentialNewH = elementStart.h + dy;
            }

            // Apply aspect ratio lock for corner handles
            if (isCorner) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    // Width change is dominant
                    newW = potentialNewW;
                    newH = newW / aspectRatio;
                } else {
                    // Height change is dominant or equal
                    newH = potentialNewH;
                    newW = newH * aspectRatio;
                }
            } else {
                // For side handles, no aspect ratio lock
                newW = potentialNewW;
                newH = potentialNewH;
            }

            // Ensure minimum size
            newW = Math.max(10, newW);
            newH = Math.max(10, newH);

            // Adjust position based on handle and new dimensions
            if (isResizing.includes('w')) {
                newX = elementStart.x + (elementStart.w - newW);
            }
            if (isResizing.includes('n')) {
                newY = elementStart.y + (elementStart.h - newH);
            }

            updateElement(selectedElement.id, {
                x: newX,
                y: newY,
                width: newW,
                height: newH
            });
        }
    };

    useEffect(() => {
        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, isResizing, selectedElement, dragStart, elementStart, containerWidth, containerHeight, template.width, template.height]);

    // EARLY RETURN HERE - AFTER HOOKS
    if (!selectedElement) return null;

    // Calculations for Rendering
    const scaleX = containerWidth / template.width;
    const scaleY = containerHeight / template.height;

    // TODO: Handle aspect ratio mismatch (letterboxing)

    const { x, y, width, height, rotation, scale: itemScale } = selectedElement.style;

    const elWidth = width || (template.width);
    // Fallback height logic: use provided height, OR if width provided use 16:9 ratio, OR use full template height
    const elHeight = height || (width ? width * (9 / 16) : template.height);

    // Convert composition coordinates to screen coordinates
    const screenX = x * scaleX;
    const screenY = y * scaleY;
    const screenW = elWidth * scaleX * itemScale; // Visual width includes scale
    const screenH = elHeight * scaleY * itemScale; // Visual height includes scale

    const handleMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setElementStart({ x, y, w: elWidth, h: elHeight });
    };

    const handleResizeStart = (e: React.MouseEvent, direction: string) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(direction);
        setDragStart({ x: e.clientX, y: e.clientY });
        setElementStart({ x, y, w: elWidth, h: elHeight });
    };

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 10
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    left: screenX,
                    top: screenY,
                    width: screenW,
                    height: screenH,
                    transform: `rotate(${rotation}deg)`,
                    border: '2px solid #3b82f6',
                    pointerEvents: 'all',
                    cursor: 'move'
                }}
                onMouseDown={handleMouseDown}
            >
                {/* Resize Handles (Corners + Sides) */}
                {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map((cursor) => (
                    <div
                        key={cursor}
                        onMouseDown={(e) => handleResizeStart(e, cursor)}
                        style={{
                            position: 'absolute',
                            width: 10,
                            height: 10,
                            backgroundColor: 'white',
                            border: '1px solid #3b82f6',
                            borderRadius: '50%',
                            zIndex: 20, /* Above border */
                            ...getHandleStyle(cursor as any)
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

// Helper for positioning handles
function getHandleStyle(pos: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w') {
    const half = 'calc(50% - 5px)'; // Center of edge minus half handle size

    switch (pos) {
        case 'nw': return { top: -5, left: -5, cursor: 'nw-resize' };
        case 'ne': return { top: -5, right: -5, cursor: 'ne-resize' };
        case 'sw': return { bottom: -5, left: -5, cursor: 'sw-resize' };
        case 'se': return { bottom: -5, right: -5, cursor: 'se-resize' };

        case 'n': return { top: -5, left: half, cursor: 'n-resize' };
        case 's': return { bottom: -5, left: half, cursor: 's-resize' };
        case 'e': return { top: half, right: -5, cursor: 'e-resize' };
        case 'w': return { top: half, left: -5, cursor: 'w-resize' };
    }
}

