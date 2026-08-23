'use client'

import { useRef, useState } from 'react'
import { Play, Pause, Loader2 } from 'lucide-react'
import { usePlaybackUrl } from '@/hooks/use-captures-api'

/**
 * Plays back the recording an entry came from.
 *
 * The link is fetched on first play and not before: the bucket is private and
 * every URL it hands out expires, so requesting one for every entry on screen
 * would spend signatures on recordings nobody listens to.
 */
export function EntryAudio({ audioKey }: { audioKey: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const playback = usePlaybackUrl()

  const toggle = async () => {
    if (url && audioRef.current) {
      if (playing) audioRef.current.pause()
      else void audioRef.current.play()
      return
    }

    setError(false)
    try {
      const { url: signed } = await playback.mutateAsync(audioKey)
      setUrl(signed)
      // The element does not exist until the URL does, so play on the next tick.
      requestAnimationFrame(() => void audioRef.current?.play())
    } catch {
      setError(true)
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        onClick={toggle}
        disabled={playback.isPending}
        title={error ? 'No se pudo cargar el audio' : 'Escuchar la grabación'}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
      >
        {playback.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : playing ? (
          <Pause className="h-3 w-3" />
        ) : (
          <Play className="h-3 w-3" />
        )}
        {error ? 'audio no disponible' : 'audio'}
      </button>

      {url && (
        <audio
          ref={audioRef}
          src={url}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          // An expired link fails here rather than at fetch time.
          onError={() => {
            setError(true)
            setUrl(null)
          }}
        />
      )}
    </span>
  )
}
