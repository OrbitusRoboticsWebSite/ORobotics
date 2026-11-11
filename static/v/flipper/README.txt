ViperLink Flipper Zero install scripts
Select the component AND operating system in the filename.
cloud: Cloud Fleet command receiver; Node.js 22+ required.
status: Status JSON reporter only; Node.js 22+ required.
lan: LAN/VPN controller only; Python 3.10+ with OpenSSL TLS 1.3 required.

Copy .txt scripts into SD Card/badusb/ using qFlipper or the mobile app.
Close qFlipper. Unlock your authorized computer. Choose the matching script,
USB mode and keyboard layout, connect the cable and press Run on the Flipper.
macOS uses Spotlight and Terminal; Linux assumes Ctrl+Alt+T opens a terminal.
Handle first-use keyboard, USB and OS prompts normally. Adjust delays if needed.
The visible terminal types exactly the command shown at:
https://www.orbitusrobotics.com/v/

Runtime installation and private enrollment remain separate. These scripts do
not install a service, start a receiver, alter execution policy, enter passwords
or embed credentials. A missing runtime causes a clear error before installation.
Normal managed-device policy applies to these unsigned source pilot scripts.
Physical Flipper execution and timing have not been verified.
https://docs.flipper.net/zero/bad-usb
https://developer.flipper.net/flipperzero/doxygen/badusb_file_format.html
