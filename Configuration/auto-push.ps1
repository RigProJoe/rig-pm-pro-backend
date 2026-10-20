# Auto-push script for Rig PM Pro
# This script automatically pushes commits to GitHub every 5 minutes

$repoPath = "C:\Users\joe\OneDrive\Desktop\RigPMPro"
$logFile = "$repoPath\auto-push.log"

# Change to repo directory
Set-Location $repoPath

# Log timestamp
Add-Content $logFile "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Checking for changes..."

# Check if there are unpushed commits
$unpushed = git log origin/main..HEAD --oneline 2>$null
if ($unpushed) {
    Add-Content $logFile "Found unpushed commits, pushing..."
    git push origin main 2>&1 | Add-Content $logFile
    Add-Content $logFile "Push completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
} else {
    Add-Content $logFile "No changes to push"
}
