Set-Location "D:\VCP\vcp\VCPToolBox"
if (!(Test-Path ".git")) {
    git init
    git remote add origin https://github.com/lioensky/VCPToolBox.git
}
while($true){
    try {
        git fetch origin main --quiet
        git reset --hard origin/main --quiet
        $t = Get-Date;
        $l = git log -1 --oneline;
        "$t - VCPToolBox Sync Success: $l" | Out-File -FilePath "D:\VCP\vcp\VCPToolBox\sync.log" -Append;
    } catch {
        "Error at $(Get-Date)" | Out-File -FilePath "D:\VCP\vcp\VCPToolBox\sync.log" -Append;
    };
    Start-Sleep -Seconds 60
}
