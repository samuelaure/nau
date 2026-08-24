import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Block, CreateBlockDto, UpdateBlockDto } from '@9nau/types'

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

export const useCreateBlock = () => {
  const queryClient = useQueryClient()
  return useMutation<Block, Error, CreateBlockInput>({
    mutationFn: (newBlock) => apiClient.post('/blocks', newBlock),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks'] })
      // A block that arrived with a schedule is owed somewhere, so the agenda
      // has to be asked again too.
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
    },
  })
}

export const useUpdateBlock = () => {
  const queryClient = useQueryClient()
  return useMutation<Block, Error, { id: string; updateDto: UpdateBlockDto }, { previousBlocks: Block[] | undefined }>({
    mutationFn: ({ id, updateDto }) => apiClient.patch(`/blocks/${id}`, updateDto),
    onMutate: async ({ id, updateDto }) => {
      await queryClient.cancelQueries({ queryKey: ['blocks'] })
      const previousBlocks = queryClient.getQueryData<Block[]>(['blocks'])

      queryClient.setQueryData<Block[]>(['blocks'], (old) => {
        if (!old) return []
        return old.map((block) => {
          if (block.id !== id) return block

          const newBlock: Block = {
            ...block,
            properties: { ...block.properties, ...updateDto.properties },
          }

          if (updateDto.type) {
            newBlock.type = updateDto.type
          }

          if ('parentId' in updateDto) {
            newBlock.parentId = updateDto.parentId ?? null
          }

          return newBlock
        })
      })
      return { previousBlocks: previousBlocks }
    },
    onError: (err, variables, context) => {
      if (context?.previousBlocks) {
        queryClient.setQueryData(['blocks'], context.previousBlocks)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks'] })
    },
  })
}

export const useDeleteBlock = () => {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id) => apiClient.delete(`/blocks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks'] })
    },
  })
}
