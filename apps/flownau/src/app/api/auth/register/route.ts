import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json()

    if (!name || !email || !password || password.length < 8) {
      return NextResponse.json({ message: 'Invalid input' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json({ message: 'Email already registered' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user and their personal workspace atomically
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        workspaces: {
          create: {
            role: 'owner',
            workspace: {
              create: {
                name: `${name}'s Workspace`,
              },
            },
          },
        },
      },
      include: {
        workspaces: true,
      },
    })

    return NextResponse.json({
      message: 'Account created successfully',
      userId: user.id,
    })
  } catch (error: unknown) {
    console.error('Registration Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
