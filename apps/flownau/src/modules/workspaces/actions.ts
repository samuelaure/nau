'use server'

import { prisma } from '@/modules/shared/prisma'
import { revalidatePath } from 'next/cache'
import { checkAuth } from '@/modules/shared/actions'
import { z } from 'zod'

const CreateWorkspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters'),
})

const RenameWorkspaceSchema = z.object({
  workspaceId: z.string(),
  name: z.string().min(2, 'Workspace name must be at least 2 characters'),
})

export async function createWorkspace(formData: FormData) {
  const { user } = await checkAuth()

  const rawData = { name: formData.get('name')?.toString() || '' }
  const { name } = CreateWorkspaceSchema.parse(rawData)

  await prisma.workspace.create({
    data: {
      name,
      users: {
        create: {
          platformUserId: user.id,
          role: 'owner',
        },
      },
    },
  })

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard')
}

export async function renameWorkspace(formData: FormData) {
  const { user } = await checkAuth()

  const rawData = {
    name: formData.get('name')?.toString() || '',
    workspaceId: formData.get('workspaceId')?.toString() || '',
  }
  const { name, workspaceId } = RenameWorkspaceSchema.parse(rawData)

  // Verify ownership
  const wu = await prisma.workspaceUser.findUnique({
    where: { platformUserId_workspaceId: { platformUserId: user.id, workspaceId } },
  })

  if (!wu || wu.role !== 'owner') {
    throw new Error('Forbidden: Only owners can rename workspaces')
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { name },
  })

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard')
}

export async function deleteWorkspace(workspaceId: string) {
  const { user } = await checkAuth()

  // Verify ownership
  const wu = await prisma.workspaceUser.findUnique({
    where: { platformUserId_workspaceId: { platformUserId: user.id, workspaceId } },
  })

  if (!wu || wu.role !== 'owner') {
    throw new Error('Forbidden: Only owners can delete workspaces')
  }

  await prisma.workspace.delete({
    where: { id: workspaceId },
  })

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard')
}

// User CRUD operations

const InviteUserSchema = z.object({
  workspaceId: z.string(),
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member']).default('member'),
})

export async function inviteUserToWorkspace(formData: FormData) {
  const { user: currentUser } = await checkAuth()

  const rawData = {
    workspaceId: formData.get('workspaceId'),
    email: formData.get('email'),
    role: formData.get('role') || 'member',
  }

  const { workspaceId, email, role } = InviteUserSchema.parse(rawData)

  // Verify current user is owner or admin
  const wu = await prisma.workspaceUser.findUnique({
    where: { platformUserId_workspaceId: { platformUserId: currentUser.id, workspaceId } },
  })

  if (!wu || !['owner', 'admin'].includes(wu.role)) {
    throw new Error('Forbidden: Insufficient permissions to invite users')
  }

  // Look up platformUserId from 9naŭ API by email
  const nauApiUrl = process.env.NAU_API_URL ?? 'http://9nau-api:3000'
  const userResp = await fetch(`${nauApiUrl}/api/auth/lookup?email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${process.env.NAU_SERVICE_KEY}` },
  })
  if (!userResp.ok) {
    throw new Error('User not found. They must register on 9naŭ first.')
  }
  const { id: platformUserId } = (await userResp.json()) as { id: string }

  const existingWu = await prisma.workspaceUser.findUnique({
    where: { platformUserId_workspaceId: { platformUserId, workspaceId } },
  })

  if (existingWu) {
    throw new Error('User is already a member of this workspace.')
  }

  await prisma.workspaceUser.create({
    data: { platformUserId, workspaceId, role },
  })

  revalidatePath('/dashboard/settings')
}

export async function removeUserFromWorkspace(workspaceId: string, userIdTarget: string) {
  const { user: currentUser } = await checkAuth()

  if (currentUser.id === userIdTarget) {
    // User is leaving the workspace
    const wu = await prisma.workspaceUser.findUnique({
      where: { platformUserId_workspaceId: { platformUserId: currentUser.id, workspaceId } },
    })
    if (wu?.role === 'owner') {
      const ownerCount = await prisma.workspaceUser.count({ where: { workspaceId, role: 'owner' } })
      if (ownerCount <= 1) {
        throw new Error(
          'Cannot leave workspace as the only owner. Assign another owner or delete the workspace.',
        )
      }
    }
  } else {
    // Current user is kicking someone else
    const wu = await prisma.workspaceUser.findUnique({
      where: { platformUserId_workspaceId: { platformUserId: currentUser.id, workspaceId } },
    })

    if (!wu || !['owner', 'admin'].includes(wu.role)) {
      throw new Error('Forbidden: Insufficient permissions to remove users')
    }
  }

  await prisma.workspaceUser.delete({
    where: { platformUserId_workspaceId: { platformUserId: userIdTarget, workspaceId } },
  })

  revalidatePath('/dashboard/settings')
}
