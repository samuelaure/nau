import React, { useEffect, useRef } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { useVideoEditor } from '@/modules/video/context/VideoEditorContext';
import { UniversalComposition } from '@/modules/video/remotion/UniversalComposition';
import { TransformOverlay } from './TransformOverlay';

export function EditorCanvas() {
    const { template, setSelectedElementId, currentFrame, setCurrentFrame, isPlaying, setIsPlaying } = useVideoEditor();
    const playerRef = useRef<PlayerRef>(null);

    const isUpdatingFromPlayer = useRef(false);

    // Sync Context -> Player (seeking)
    useEffect(() => {
        if (!playerRef.current) return;

        // Break loop if this update originated from the player
        if (isUpdatingFromPlayer.current) {
            isUpdatingFromPlayer.current = false;
            return;
        }

        const playerFrame = playerRef.current.getCurrentFrame();
        // Only seek if difference is significant (prevents infinite loop during playback)
        if (Math.abs(playerFrame - currentFrame) > 1) {
            playerRef.current.seekTo(currentFrame);
        }
    }, [currentFrame]);

    // Sync Context -> Player (Play/Pause)
    useEffect(() => {
        if (!playerRef.current) return;

        const playerIsPlaying = playerRef.current.isPlaying();
        if (isPlaying && !playerIsPlaying) {
            playerRef.current.play();
        } else if (!isPlaying && playerIsPlaying) {
            playerRef.current.pause();
        }
    }, [isPlaying]);

    // Event Listeners for Player -> Context sync
    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;

        const onFrameUpdate = (e: { detail: { frame: number } }) => {
            isUpdatingFromPlayer.current = true;
            setCurrentFrame(e.detail.frame);
        };

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onSeeked = (e: { detail: { frame: number } }) => {
            isUpdatingFromPlayer.current = true;
            setCurrentFrame(e.detail.frame);
        };

        player.addEventListener('frameupdate', onFrameUpdate);
        player.addEventListener('play', onPlay);
        player.addEventListener('pause', onPause);
        player.addEventListener('seeked', onSeeked);

        return () => {
            player.removeEventListener('frameupdate', onFrameUpdate);
            player.removeEventListener('play', onPlay);
            player.removeEventListener('pause', onPause);
            player.removeEventListener('seeked', onSeeked);
        };
    }, [setCurrentFrame, setIsPlaying]);

    return (
        <div
            onClick={() => setSelectedElementId(null)}
            className="flex-1 bg-[#111] flex items-center justify-center relative p-10 overflow-hidden"
            style={{
                backgroundImage: 'radial-gradient(#333 1px, transparent 1px)',
                backgroundSize: '24px 24px'
            }}>
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    transform: 'scale(0.8)', // TODO: Make this dynamic zoom
                    transformOrigin: 'center center',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    border: '1px solid #444',
                    background: 'black',
                    display: 'flex',
                    position: 'relative', // Necessary for absolute overlay
                    width: '360px', // Move size here to ensure container matches player
                    height: '640px',
                }}>
                <Player
                    ref={playerRef}
                    component={UniversalComposition}
                    inputProps={{ template }}
                    durationInFrames={template.durationInFrames}
                    fps={template.fps}
                    compositionWidth={template.width}
                    compositionHeight={template.height}
                    style={{
                        width: '100%',
                        height: '100%',
                    }}
                    controls
                    clickToPlay={false}
                />
                <TransformOverlay containerWidth={360} containerHeight={640} />
            </div>
        </div>
    );
}
