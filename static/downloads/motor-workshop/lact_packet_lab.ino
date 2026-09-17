// Default mode prints packets over USB. It does not initialize the LACT UART.
#include <SoftwareSerial.h>
SoftwareSerial smcSerial(22, 23);  // Preserved ROB Base TX is D23; RX D22 unused.
constexpr bool LIVE_BENCH = false;

bool sendLact(int speed) {
  if (speed < -3200 || speed > 3200) return false;
  uint16_t magnitude = speed < 0 ? -speed : speed;
  uint8_t packet[3] = {
    uint8_t(speed < 0 ? 0x86 : 0x85),
    uint8_t(magnitude & 0x1F), uint8_t(magnitude >> 5)
  };
  if (LIVE_BENCH) smcSerial.write(packet, sizeof(packet));
  else {
    for (uint8_t value : packet) { Serial.print(value, HEX); Serial.print(' '); }
    Serial.println();
  }
  return true;
}

void setup() {
  Serial.begin(115200);  // Packet-lab console only; ROB Base uses 250000.
  if (LIVE_BENCH) {
    smcSerial.begin(19200);
    delay(5);
    smcSerial.write(0xAA);  // Autobaud only when configured on the controller.
    sendLact(0);           // No safe-start release is performed here.
  } else {
    sendLact(1600); sendLact(-1600); sendLact(0);
  }
}
void loop() {}  // Never repeats a nonzero command.
