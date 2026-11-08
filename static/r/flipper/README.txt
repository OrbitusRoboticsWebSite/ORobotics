RedAgent 0.2.0 - Flipper Zero USB installation scripts

1. Copy the three .txt scripts to SD Card/badusb/ using qFlipper or the Flipper mobile app.
2. Close qFlipper. Unlock your corporate computer and select its OS script in Bad USB.
3. Choose USB mode and the keyboard layout that matches the computer.
4. Connect by USB, then press Run on the Flipper. Standard firmware requires this Run action.
5. Watch the visible terminal for "Installed RedAgent" or "already installed".

These scripts type the same commands shown at https://www.orbitusrobotics.com/r/.
They do not detect the host OS: select the Windows, macOS, or Linux script yourself.
The website recommends a platform; the installer independently detects architecture.
Linux uses Ctrl+Alt+T; configure that terminal shortcut first if your desktop lacks it.
macOS uses Spotlight (Cmd+Space) and opens a new Terminal window. First-time keyboard,
USB accessory, or system approval prompts may need your normal interaction. Increase
DELAY values if a slower machine is not ready before typing starts.

Internet access to www.orbitusrobotics.com and GitHub release assets is needed.
This is a development pilot without production signing/notarization. Managed device
policies may block scripts or unsigned apps; use your approved administration process.
The scripts do not change execution policy, disable security tools, enter passwords,
enroll in MDM, or start a test. Python/Tk are bundled; scanning tools are separate.
After installation open the GUI from the location printed by the installer.

Hardware execution on a Flipper has not yet been verified.
Official instructions: https://docs.flipper.net/zero/bad-usb
Script syntax: https://developer.flipper.net/flipperzero/doxygen/badusb_file_format.html
