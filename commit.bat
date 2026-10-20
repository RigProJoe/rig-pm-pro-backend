@echo off
cd /d "C:\Users\joe\OneDrive\Desktop\RigPMPro"
echo Committing fabv22.html...
git add fabv22.html
git commit -m "Fix: Menu now opens by default with toggle functionality across all devices

- Menu opens by default when user is signed in
- Hamburger button toggles menu collapse/expand
- Close button toggles menu collapse/expand  
- Menu stays open during navigation for signed-in users
- Menu auto-closes on mobile when item clicked
- All responsive breakpoints working correctly"
echo.
echo Commit complete. Auto-push will run within 5 minutes.
pause
