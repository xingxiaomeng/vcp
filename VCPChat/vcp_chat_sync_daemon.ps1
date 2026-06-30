$repoPath = "D:\VCP\vcp\VCPChat"
$logPath = Join-Path $repoPath "sync.log"
$syncIntervalSeconds = 60
$maxRetry = 99
$retryDelaySeconds = 5

Set-Location $repoPath

while ($true) {
    $fetchOk = $false
    for ($attempt = 1; $attempt -le $maxRetry; $attempt++) {
        try {
            $fetchOutput = git fetch origin main 2>&1
            if ($LASTEXITCODE -eq 0) {
                $fetchOk = $true
                break
            }

            $errText = ($fetchOutput | Out-String).Trim()
            if (-not $errText) { $errText = "(no stderr)" }
            "$(Get-Date) - Fetch failed (attempt $attempt/$maxRetry), exit code: $LASTEXITCODE - $errText" |
                Out-File -FilePath $logPath -Append
        }
        catch {
            "$(Get-Date) - Fetch exception (attempt $attempt/$maxRetry): $($_.Exception.Message)" |
                Out-File -FilePath $logPath -Append
        }

        Start-Sleep -Seconds $retryDelaySeconds
    }

    if ($fetchOk) {
        try {
            git reset --hard origin/main --quiet
            if ($LASTEXITCODE -ne 0) {
                "$(Get-Date) - Reset failed, exit code: $LASTEXITCODE" | Out-File -FilePath $logPath -Append
            }
            else {
                $latest = git log -1 --oneline
                "$(Get-Date) - Sync Success: $latest" | Out-File -FilePath $logPath -Append
            }
        }
        catch {
            "$(Get-Date) - Reset exception: $($_.Exception.Message)" | Out-File -FilePath $logPath -Append
        }
    }
    else {
        "$(Get-Date) - Sync failed after $maxRetry retries, skip reset this round." |
            Out-File -FilePath $logPath -Append
    }

    Start-Sleep -Seconds $syncIntervalSeconds
}
