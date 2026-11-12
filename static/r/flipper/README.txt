RedAgent 0.4.0 - Flipper Zero USB installation scripts

1. Copy the .txt scripts to SD Card/badusb/ using qFlipper or the Flipper mobile app.
2. Close qFlipper. Unlock your corporate computer and select its OS script in Bad USB.
3. Choose USB mode and the keyboard layout that matches the computer.
4. Connect by USB, then press Run on the Flipper. Standard firmware requires this Run action.
5. Watch the visible terminal for "Installed RedAgent" or "already installed".

These scripts type the same commands shown at https://www.orbitusrobotics.com/r/.
Windows has two choices:
- RedAgent-windows.txt: current user only, no automatic startup or elevation.
- RedAgent-windows-admin.txt: normal UAC approval, app in Program Files for all
  users, common Start menu shortcut, and Windows Service starting before login.
  The service runs as LocalService. The original operator and administrators
  control it; fleet credentials are not shared with every Windows user.
  Private enrollment and enabling cloud commands still require your action.
  To stop it, use Windows Services > Orbitus RedAgent Helper. To remove the
  service, run RedAgentHelper.exe uninstall from an administrator terminal;
  enrollment and evidence are retained.
They do not detect the host OS: select the Windows, macOS, or Linux script yourself.
The website recommends a platform; the installer independently detects architecture.
Linux uses Ctrl+Alt+T; configure that terminal shortcut first if your desktop lacks it.
macOS uses Spotlight (Cmd+Space) and opens a new Terminal window. First-time keyboard,
USB accessory, or system approval prompts may need your normal interaction. Increase
DELAY values if a slower machine is not ready before typing starts.

Internet access to www.orbitusrobotics.com and GitHub release assets is needed.
Windows: replace older .txt files if you saw "running scripts is disabled".
The updated command verifies the installer SHA-256, then runs its contents as
visible console commands. It does not launch a .ps1 file or change execution policy.
It stops for configured Group Policy, AllSigned, or constrained language sessions;
use your administrator-approved distribution process on those machines.
If the installer checksum changes, download fresh Flipper scripts from the website.
This is a development pilot without production signing/notarization. Managed device
policies may block scripts or unsigned apps; use your approved administration process.
The scripts do not change execution policy, disable security tools, enter passwords,
enroll in MDM, or start a test. Python/Tk are bundled; scanning tools are separate.
After installation open the GUI from the location printed by the installer.
Cloud Fleet > Install system helper opens the normal administrator prompt.
The helper uses launchd, Windows Services, or systemd to keep accepted jobs and
enabled Cloud Fleet check-ins running across GUI closure and user sessions.
The Windows administrator script performs this helper step after normal UAC approval.
The other scripts leave the helper installation as a separate visible step.
Import your private enrollment afterward; Python/Tk and Node.js are bundled.

Hardware execution on a Flipper has not yet been verified.
Official instructions: https://docs.flipper.net/zero/bad-usb
Script syntax: https://developer.flipper.net/flipperzero/doxygen/badusb_file_format.html
