import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

/**
 * Journal captures. The intent is implicit here — these are called from the
 * journal, so what comes back is always a journal entry. There is no
 * confirmation step, unlike Telegram, where one recording might be an entry, a
 * task or an idea.
 */

export const useCaptureText = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { text: string; workspaceId?: string; capturedAt?: string }) =>
      apiClient.post('/captures/text', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks'] })
      queryClient.invalidateQueries({ queryKey: ['journal', 'entries'] })
    },
  })
}

export const useCaptureVoice = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { audio: Blob; workspaceId?: string; capturedAt?: string }) => {
      // The recording goes straight to private storage with a presigned URL, so
      // audio never travels through the API server and no bucket credential
      // reaches the browser.
      const { uploadUrl, audioKey } = await apiClient.post<{
        uploadUrl: string
        audioKey: string
      }>('/captures/voice/upload-url', { mimeType: input.audio.type || 'audio/webm' })

      const put = await fetch(uploadUrl, {
        method: 'PUT',
        body: input.audio,
        headers: { 'Content-Type': input.audio.type || 'audio/webm' },
      })
      if (!put.ok) throw new Error(`Upload failed (${put.status})`)

      return apiClient.post('/captures/voice', {
        audioKey,
        workspaceId: input.workspaceId,
        capturedAt: input.capturedAt,
        source: 'web_voice',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks'] })
      queryClient.invalidateQueries({ queryKey: ['journal', 'entries'] })
    },
  })
}

/** A link that expires, for replaying a stored capture. */
export const usePlaybackUrl = () =>
  useMutation({
    mutationFn: (audioKey: string) =>
      apiClient.post<{ url: string }>('/captures/playback-url', { audioKey }),
  })
