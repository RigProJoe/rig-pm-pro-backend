@echo off
cd /d "C:\Users\joe\OneDrive\Desktop\RigPMPro"
echo Verifying git commit...
echo. > git-status.txt
echo === Git Status === >> git-status.txt
git status >> git-status.txt 2>&1
echo. >> git-status.txt
echo === Git Log (Last 3 commits) === >> git-status.txt
git log --oneline -3 >> git-status.txt 2>&1
echo. >> git-status.txt
echo Verification complete. Check git-status.txt for details.
