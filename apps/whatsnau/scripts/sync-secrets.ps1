# scripts/sync-secrets.ps1
# This script synchronizes local .env secrets to GitHub Secrets using the 'gh' CLI.
# Source of truth: root/.env, packages/backend/.env, packages/frontend/.env

$envFiles = @(
    ".env",
    "packages/backend/.env",
    "packages/frontend/.env"
)

Write-Host "🔐 Starting Secret Synchronization to GitHub..." -ForegroundColor Cyan

# Check if gh CLI is installed
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "❌ GitHub CLI ('gh') is not installed. Please install it first: https://cli.github.com/"
    exit 1
}

# Check if authenticated
gh auth status
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Not authenticated with GitHub CLI. Run 'gh auth login' first."
    exit 1
}

$secretsCount = 0

foreach ($file in $envFiles) {
    if (Test-Path $file) {
        Write-Host "📄 Processing $file..." -ForegroundColor Yellow
        $content = Get-Content $file
        
        foreach ($line in $content) {
            # Skip comments and empty lines
            if ($line -match '^\s*#' -or $line -match '^\s*$') {
                continue
            }

            # Parse Key=Value
            if ($line -match '^([^=]+)=(.*)$') {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim()
                
                # Remove surrounding quotes if present
                if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
                    $value = $matches[1]
                }

                if ($key) {
                    Write-Host "  🔑 Setting $key..." -NoNewline
                    gh secret set $key --body "$value"
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host " [OK]" -ForegroundColor Green
                        $secretsCount++
                    } else {
                        Write-Host " [FAILED]" -ForegroundColor Red
                    }
                }
            }
        }
    } else {
        Write-Host "⚠️  $file not found, skipping." -ForegroundColor Gray
    }
}

Write-Host "`n✅ Done! Synchronized $secretsCount secrets." -ForegroundColor Cyan
