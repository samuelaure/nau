import { NextResponse } from 'next/server'
import { COOKIE_ACCESS_TOKEN, COOKIE_REFRESH_TOKEN } from '@nau/auth'

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out' })
  response.cookies.delete(COOKIE_ACCESS_TOKEN)
  response.cookies.delete(COOKIE_REFRESH_TOKEN)
  return response
}
