ViperLink Flipper Zero install scripts
Select the component AND operating system in the filename.
cloud: Cloud Fleet command receiver; Node.js 22+ required.
status: Status JSON reporter only; Node.js 22+ required.
lan: LAN/VPN controller only; Python 3.10+ with OpenSSL TLS 1.3 required.

Windows Cloud Fleet has two choices:
- ViperLink-cloud-windows.txt: current user only, foreground receiver, Node.js
  22+ installed separately, no elevation or automatic startup.
- ViperLink-cloud-windows-admin.txt: normal UAC approval, protected Program Files
  installation for all users, verified private Node runtime, and the visible
  "Orbitus ViperLink Cloud" task in Task Scheduler. It runs as LocalService at
  boot before login, starts now, and waits for enrollment. A one-minute recovery
  trigger restarts it if stopped; existing running instances are left alone.
  Put private receiver.json and fleet-private.pem in
  %ProgramData%\Orbitus\ViperLink; use its Workspace as the shared root.
  Only the installing operator and administrators can provision credentials.
  Set enabled=true when ready. startup-status.json records the latest state.
  For fire-and-forget enrollment, use your administrator's PRIVATE automatic-
  enrollment script instead. It creates a fresh identity on each new PC, enables
  check-ins and preserves existing enrollment on repeat installs. Public scripts
  cannot contain your fleet credentials. See the automatic-enrollment section
  at https://www.orbitusrobotics.com/v/#automatic-enrollment.
  Keep only one receiver for an enrollment; stop the foreground receiver first.
  To stop automatic operation, disable the task, then end its running instance.
  To uninstall, delete that task and the Program Files installation. Preserve
  or revoke private enrollment separately; deleting files does not revoke keys.
The status reporter and LAN controller retain their user installation scripts.

Copy .txt scripts into SD Card/badusb/ using qFlipper or the mobile app.
Close qFlipper. Unlock your authorized computer. Choose the matching script,
USB mode and keyboard layout, connect the cable and press Run on the Flipper.
macOS uses Spotlight and Terminal; Linux assumes Ctrl+Alt+T opens a terminal.
Handle first-use keyboard, USB and OS prompts normally. Adjust delays if needed.
The visible terminal types exactly the command shown at:
https://www.orbitusrobotics.com/v/

Windows: replace older .txt files if you saw "running scripts is disabled".
The updated command verifies the installer SHA-256, then runs its contents as
visible console commands. It does not launch a .ps1 file or change execution policy.
It stops for configured Group Policy, AllSigned, or constrained language sessions;
use your administrator-approved distribution process on those machines.
If the installer checksum changes, download fresh Flipper scripts from the website.

The user scripts do not install startup tasks or start receivers. Their runtime
installation remains separate. The Windows Cloud administrator script installs
its runtime and startup task explicitly after UAC approval. No script alters
execution policy, enters passwords, enables commands or embeds credentials.
Normal managed-device policy applies to these unsigned source pilot scripts.
Physical Flipper execution and timing have not been verified.
https://docs.flipper.net/zero/bad-usb
https://developer.flipper.net/flipperzero/doxygen/badusb_file_format.html
