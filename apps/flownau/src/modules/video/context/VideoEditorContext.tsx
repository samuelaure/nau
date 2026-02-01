'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { VideoTemplate, VideoElement } from '@/types/video-schema';

interface VideoEditorContextType {
    template: VideoTemplate;
    selectedElementId: string | null;
    setSelectedElementId: (id: string | null) => void;
    updateTemplate: (updates: Partial<VideoTemplate>) => void;
    addElement: (type: VideoElement['type'], asset?: { url: string; name: string }) => void;
    updateElement: (id: string, changes: Partial<VideoElement> | Partial<VideoElement['style']>) => void;
    deleteElement: (id: string) => void;
    splitElement: (id: string, frame: number) => void;

    // Playback State
    currentFrame: number;
    setCurrentFrame: (frame: number) => void;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
}

const VideoEditorContext = createContext<VideoEditorContextType | undefined>(undefined);

interface VideoEditorProviderProps {
    children: ReactNode;
    initialTemplate: VideoTemplate;
    onSave?: (template: VideoTemplate) => void;
}

export function VideoEditorProvider({ children, initialTemplate, onSave }: VideoEditorProviderProps) {
    const [template, setTemplate] = useState<VideoTemplate>(initialTemplate);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

    // Playback State
    const [currentFrame, setCurrentFrame] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const updateTemplate = useCallback((updates: Partial<VideoTemplate>) => {
        setTemplate((prev) => ({ ...prev, ...updates }));
    }, []);

    const addElement = useCallback((type: VideoElement['type'], asset?: { url: string; name: string }) => {
        const newElement: VideoElement = {
            id: crypto.randomUUID(),
            type,
            name: asset?.name || `New ${type}`,
            startFrame: 0,
            durationInFrames: template.durationInFrames,
            mediaStartOffset: 0,
            content: asset?.url || (type === 'text' ? 'New Text' : ''),
            style: {
                x: 0,
                y: 0,
                width: type === 'text' ? undefined : template.width * 0.5, // 50% width by default
                height: type === 'text' ? undefined : template.width * 0.5, // Square aspect ratio default
                scale: 1,
                rotation: 0,
                opacity: 1,
                fontSize: 40,
                textAlign: 'left',
                color: '#ffffff',
            },
        };

        // Center the element
        if (newElement.style.width && newElement.style.height) {
            newElement.style.x = (template.width - newElement.style.width) / 2;
            newElement.style.y = (template.height - newElement.style.height) / 2;
        } else {
            newElement.style.x = template.width / 2;
            newElement.style.y = template.height / 2;
        }

        setTemplate((prev) => ({
            ...prev,
            elements: [...prev.elements, newElement],
        }));
        setSelectedElementId(newElement.id);
    }, [template.durationInFrames, template.width, template.height]);

    const updateElement = useCallback((id: string, changes: Partial<VideoElement> | Partial<VideoElement['style']>) => {
        setTemplate((prev) => ({
            ...prev,
            elements: prev.elements.map((el) => {
                if (el.id !== id) return el;

                // Helper to detect if key belongs to style or root
                // This is a bit naive but works for the current schema
                const styleKeys = ['x', 'y', 'width', 'height', 'scale', 'rotation', 'opacity', 'color', 'backgroundColor', 'fontSize', 'fontFamily', 'textAlign', 'colors'];
                const isStyleChange = Object.keys(changes).some(k => k in el.style || styleKeys.includes(k));

                if (isStyleChange) {
                    // @ts-ignore - complex union type merging
                    return { ...el, style: { ...el.style, ...changes } };
                }
                return { ...el, ...changes };
            }),
        }));
    }, []);

    const deleteElement = useCallback((id: string) => {
        setTemplate((prev) => ({
            ...prev,
            elements: prev.elements.filter((el) => el.id !== id),
        }));
        if (selectedElementId === id) setSelectedElementId(null);
    }, [selectedElementId]);

    const splitElement = useCallback((id: string, splitFrame: number) => {
        setTemplate((prev) => {
            const element = prev.elements.find(e => e.id === id);
            if (!element) return prev;

            // Validate split point
            if (splitFrame <= element.startFrame || splitFrame >= element.startFrame + element.durationInFrames) {
                return prev;
            }

            const splitOffset = splitFrame - element.startFrame;

            // Updated First Clip
            const leftClip: VideoElement = {
                ...element,
                durationInFrames: splitOffset,
            };

            // New Second Clip
            const rightClip: VideoElement = {
                ...element,
                id: crypto.randomUUID(),
                startFrame: splitFrame,
                durationInFrames: element.durationInFrames - splitOffset,
                mediaStartOffset: element.mediaStartOffset + splitOffset,
                name: `${element.name} (Split)`,
            };

            // Replace original with both
            const elementIndex = prev.elements.findIndex(e => e.id === id);
            const newElements = [...prev.elements];
            newElements.splice(elementIndex, 1, leftClip, rightClip);

            return {
                ...prev,
                elements: newElements,
            };
        });

        // Select the right clip after split for continuity
        // setTimeout(() => setSelectedElementId(rightClip.id), 0); // Logic difficult inside setState callback
    }, []);

    // Construct the value object
    const value = {
        template,
        selectedElementId,
        setSelectedElementId,
        updateTemplate,
        addElement,
        updateElement,
        deleteElement,
        splitElement,
        currentFrame,
        setCurrentFrame,
        isPlaying,
        setIsPlaying
    };

    return (
        <VideoEditorContext.Provider value={value}>
            {children}
        </VideoEditorContext.Provider>
    );
}

export function useVideoEditor() {
    const context = useContext(VideoEditorContext);
    if (!context) {
        throw new Error('useVideoEditor must be used within a VideoEditorProvider');
    }
    return context;
}
