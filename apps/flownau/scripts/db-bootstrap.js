import { execSync } from 'child_process'

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production'

  try {
    if (isProduction) {
      console.log('Production detected. Running prisma migrate deploy...')
      execSync('npx prisma migrate deploy', { stdio: 'inherit' })
    } else {
      console.log('Development detected. Applying migrations...')
      execSync('npx prisma migrate deploy', { stdio: 'inherit' })
      execSync('npx prisma generate', { stdio: 'inherit' })
    }
  } catch (error) {
    console.error('Database bootstrap failed:', error)
    process.exit(1)
  }
}

bootstrap()
