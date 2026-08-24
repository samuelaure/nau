import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Block, CreateBlockDto, UpdateBlockDto } from '@9nau/types'
import {
  insertOptimistic,
  replaceOptimistic,
  removeBlock,
  applyBlockEdit,
} from '@9nau/core'

type FindBlocksParams = {
  type?: string
  /** Several types at once, so a view can ask for what it needs and no more. */
  types?: string[]
  status?: string
  workspaceId?: string
  /** ISO dates, inclusive, matched against properties.date on the server. */
  from?: string
  to?: string
  limit?: number
}

export const useGetBlocks = (params: FindBlocksParams) => {
  return useQuery<Block[], Error>({
    queryKey: ['blocks', params],
    queryFn: () => {
      const searchParams = new URLSearchParams()
      if (params.type) searchParams.append('type', params.type)
      // Handle 'not:trash' case
      if (params.status && !params.status.startsWith('not:')) {
        searchParams.append('status', params.status)
      }
      if (params.workspaceId) {
        searchParams.append('workspaceId', params.workspaceId)
      }
      if (params.types?.length) searchParams.append('types', params.types.join(','))
      if (params.from) searchParams.append('from', params.from)
      if (params.to) searchParams.append('to', params.to)
      if (params.limit) searchParams.append('limit', String(params.limit))
      return apiClient.get(`/blocks?${searchParams.toString()}`)
    },
    select: (data) => {
      if (params.status === 'not:trash') {
        return data.filter((block) => block.properties.status !== 'trash')
      }
      return data
    },
  })
}

/** A block, optionally placed on a day in the same request. */
type CreateBlockInput = CreateBlockDto & {
  schedule?: {
    startDate: string
    endDate?: string | null
    rrule?: string | null
    recurrenceMode?: 'FIXED' | 'AFTER_COMPLETION'
  }
}

/**
 * Every cached block list, whatever parameters it was fetched with.
 *
 * The cache key is `['blocks', params]`, not `['blocks']` — each view asks with
 * its own type/workspace/date filter and gets its own entry. Writing to the
 * bare `['blocks']` key, as the optimistic update here used to, therefore
 * matched *nothing*: the edit went into a cache entry no component was reading,
 * the screen kept the old value, and the change only appeared when the refetch
 * came back. That is most of the delay this hook is blamed for.
 */
const patchCachedBlocks = (
  queryClient: ReturnType<typeof useQueryClient>,
  patch: (blocks: Block[]) => Block[],
) => {
  queryClient.setQueriesData<Block[]>({ queryKey: ['blocks'] }, (old) =>
    old ? patch(old) : old,
  )
}

/** A temporary id, so an optimistic row can be found and replaced or removed. */
const tempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

export const useCreateBlock = () => {
  const queryClient = useQueryClient()
  return useMutation<Block, Error, CreateBlockInput, { tempId: string }>({
    mutationFn: (newBlock) => apiClient.post('/blocks', newBlock),

    // The row appears before the request is sent. Typing a line and waiting for
    // a round trip to see it is the difference between an outliner that feels
    // like paper and one that feels like a form.
    onMutate: async (newBlock) => {
      await queryClient.cancelQueries({ queryKey: ['blocks'] })
      const id = tempId()

      const optimistic: Block = {
        id,
        uuid: id,
        type: newBlock.type,
        properties: (newBlock.properties ?? {}) as Block['properties'],
        parentId: newBlock.parentId ?? null,
        createdAt: new Date().toISOString() as unknown as Block['createdAt'],
        updatedAt: new Date().toISOString() as unknown as Block['updatedAt'],
      } as Block

      patchCachedBlocks(queryClient, (blocks) => insertOptimistic(blocks, optimistic))
      return { tempId: id }
    },

    // The server's row replaces the placeholder in place, rather than the whole
    // list being fetched again to learn one id.
    onSuccess: (created, _input, context) => {
      patchCachedBlocks(queryClient, (blocks) =>
        replaceOptimistic(blocks, context?.tempId ?? '', created),
      )
    },

    onError: (_err, _input, context) => {
      patchCachedBlocks(queryClient, (blocks) => removeBlock(blocks, context?.tempId ?? ''))
    },

    // A block that arrived with a schedule is owed somewhere, and what is owed
    // is computed server-side from rules this client does not evaluate. The
    // agenda is the one thing that genuinely has to be asked again.
    onSettled: (_data, _err, input) => {
      if (input.schedule) queryClient.invalidateQueries({ queryKey: ['agenda'] })
    },
  })
}

export const useUpdateBlock = () => {
  const queryClient = useQueryClient()
  return useMutation<
    Block,
    Error,
    { id: string; updateDto: UpdateBlockDto },
    { previous: Array<[readonly unknown[], Block[] | undefined]> }
  >({
    mutationFn: ({ id, updateDto }) => apiClient.patch(`/blocks/${id}`, updateDto),

    onMutate: async ({ id, updateDto }) => {
      await queryClient.cancelQueries({ queryKey: ['blocks'] })

      // Snapshot every matching entry, so a failure restores all of them and
      // not just the one that happened to be keyed plainly.
      const previous = queryClient.getQueriesData<Block[]>({ queryKey: ['blocks'] })

      patchCachedBlocks(queryClient, (blocks) => applyBlockEdit(blocks, id, updateDto))

      return { previous }
    },

    onError: (_err, _variables, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },

    // Deliberately no refetch of ['blocks']. The optimistic patch above already
    // holds every field the server would return for a property edit, so asking
    // for the whole list again costs a round trip to learn nothing. Moving a
    // block between periods does change what is owed, so the agenda still asks.
    onSettled: (_data, _err, { updateDto }) => {
      const movedInTime = 'parentId' in updateDto || updateDto.properties?.date !== undefined
      if (movedInTime) queryClient.invalidateQueries({ queryKey: ['agenda'] })
    },
  })
}

export const useDeleteBlock = () => {
  const queryClient = useQueryClient()
  return useMutation<
    void,
    Error,
    string,
    { previous: Array<[readonly unknown[], Block[] | undefined]> }
  >({
    mutationFn: (id) => apiClient.delete(`/blocks/${id}`),

    // The row leaves immediately. Backspace on an empty line deletes a block,
    // and a line that lingers after the keystroke reads as a dropped input.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['blocks'] })
      const previous = queryClient.getQueriesData<Block[]>({ queryKey: ['blocks'] })
      patchCachedBlocks(queryClient, (blocks) => removeBlock(blocks, id))
      return { previous }
    },

    onError: (_err, _id, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },

    // A deleted block may have been owed somewhere.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['agenda'] }),
  })
}
