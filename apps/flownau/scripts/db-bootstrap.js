import { execSync } from 'child_process'

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production'

  try {
    if (isProduction) {
      console.log('Production detected. Running prisma migrate deploy...')
      execSync('npx prisma migrate deploy', { stdio: 'inherit' })
    } else {
      console.log('Development detected. Checking database sync...')
      try {
        // Attempt to run migrate dev.
        execSync('npx prisma migrate dev', { stdio: 'inherit' })
      } catch (error) {
        console.warn('Migration drift detected or interactive prompt required.')
        console.warn('Falling back to db push for development unblocking...')
        // db push might change the schema state, so we generate the client to be safe
        execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' })
        execSync('npx prisma generate', { stdio: 'inherit' })
      }
      // Always generate at the end of dev bootstrap to ensure client is fresh
      execSync('npx prisma generate', { stdio: 'inherit' })
    }
  } catch (error) {
    console.error('Database bootstrap failed:', error)
    process.exit(1)
  }
}

bootstrap()
