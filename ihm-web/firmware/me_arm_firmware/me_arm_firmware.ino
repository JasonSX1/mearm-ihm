#include <Servo.h>

const byte AXIS_COUNT = 4;
const char *AXIS_NAMES[AXIS_COUNT] = {"base", "shoulder", "elbow", "gripper"};

Servo servos[AXIS_COUNT];
byte servoPins[AXIS_COUNT] = {11, 10, 9, 6};  // Base=D11, Ombro=D10, Cotovelo=D9, Garra=D6
int currentAngle[AXIS_COUNT] = {90, 90, 95, 70};
int targetAngle[AXIS_COUNT] = {90, 90, 95, 70};
bool servoAttached[AXIS_COUNT] = {false, false, false, false};

String inputLine = "";
unsigned long lastStepAt = 0;
int stepIntervalMs = 8;

int clampServo(int value) {
  if (value < 0) return 0;
  if (value > 180) return 180;
  return value;
}

int axisIndex(const String &name) {
  for (byte index = 0; index < AXIS_COUNT; index++) {
    if (name == AXIS_NAMES[index]) return index;
  }
  return -1;
}

int readValue(const String &line, const char *key, int fallback) {
  String token = String(key) + "=";
  int start = line.indexOf(token);
  if (start < 0) return fallback;

  start += token.length();
  int end = line.indexOf(' ', start);
  if (end < 0) end = line.length();

  return line.substring(start, end).toInt();
}

String readTextValue(const String &line, const char *key) {
  String token = String(key) + "=";
  int start = line.indexOf(token);
  if (start < 0) return "";

  start += token.length();
  int end = line.indexOf(' ', start);
  if (end < 0) end = line.length();

  return line.substring(start, end);
}

void attachAxis(byte index) {
  if (servoPins[index] < 2 || servoPins[index] > 13) return;
  if (!servoAttached[index]) {
    servos[index].attach(servoPins[index]);
    servoAttached[index] = true;
  }
  servos[index].write(clampServo(currentAngle[index]));
}

void attachAll() {
  for (byte index = 0; index < AXIS_COUNT; index++) {
    attachAxis(index);
  }
}

void detachAxis(byte index) {
  if (servoAttached[index]) {
    servos[index].detach();
    servoAttached[index] = false;
  }
}

void printHello() {
  Serial.println(F("{\"type\":\"hello\",\"name\":\"me-arm-firmware\",\"version\":\"1.0.0\",\"board\":\"arduino-avr\"}"));
}

void printStatus(const char *message) {
  Serial.print(F("{\"type\":\"status\",\"message\":\""));
  Serial.print(message);
  Serial.print(F("\",\"angles\":{"));
  for (byte index = 0; index < AXIS_COUNT; index++) {
    if (index > 0) Serial.print(',');
    Serial.print('"');
    Serial.print(AXIS_NAMES[index]);
    Serial.print(F("\":"));
    Serial.print(currentAngle[index]);
  }
  Serial.println(F("}}"));
}

void configurePins(const String &line) {
  for (byte index = 0; index < AXIS_COUNT; index++) {
    int pin = readValue(line, AXIS_NAMES[index], servoPins[index]);
    if (pin >= 2 && pin <= 13) {
      detachAxis(index);
      servoPins[index] = pin;
      attachAxis(index);
    }
  }
  printStatus("pins-configured");
}

void moveTargets(const String &line) {
  stepIntervalMs = readValue(line, "step", stepIntervalMs);
  if (stepIntervalMs < 4) stepIntervalMs = 4;
  if (stepIntervalMs > 40) stepIntervalMs = 40;

  attachAll();
  for (byte index = 0; index < AXIS_COUNT; index++) {
    int value = readValue(line, AXIS_NAMES[index], targetAngle[index]);
    targetAngle[index] = clampServo(value);
  }
}

void stopMotion() {
  for (byte index = 0; index < AXIS_COUNT; index++) {
    targetAngle[index] = currentAngle[index];
  }
  printStatus("stopped");
}

void detachFromCommand(const String &line) {
  String axis = readTextValue(line, "axis");
  if (axis.length() == 0) {
    for (byte index = 0; index < AXIS_COUNT; index++) detachAxis(index);
    printStatus("detached-all");
    return;
  }

  int index = axisIndex(axis);
  if (index >= 0) {
    detachAxis(index);
    printStatus("detached-axis");
  }
}

void handleCommand(String line) {
  line.trim();
  if (line.length() == 0) return;

  if (line == "HELLO") {
    printHello();
    return;
  }

  if (line == "STATUS") {
    printStatus("ready");
    return;
  }

  if (line.startsWith("CFG")) {
    configurePins(line);
    return;
  }

  if (line.startsWith("MOVE")) {
    moveTargets(line);
    return;
  }

  if (line == "STOP") {
    stopMotion();
    return;
  }

  if (line.startsWith("DETACH")) {
    detachFromCommand(line);
    return;
  }

  if (line == "ATTACH") {
    attachAll();
    printStatus("attached");
    return;
  }

  printStatus("unknown-command");
}

void readSerial() {
  while (Serial.available() > 0) {
    char character = (char)Serial.read();
    if (character == '\n') {
      handleCommand(inputLine);
      inputLine = "";
    } else if (character != '\r') {
      inputLine += character;
      if (inputLine.length() > 160) inputLine = "";
    }
  }
}

void updateServos() {
  if (millis() - lastStepAt < (unsigned long)stepIntervalMs) return;
  lastStepAt = millis();

  for (byte index = 0; index < AXIS_COUNT; index++) {
    if (currentAngle[index] == targetAngle[index]) continue;

    if (currentAngle[index] < targetAngle[index]) currentAngle[index]++;
    if (currentAngle[index] > targetAngle[index]) currentAngle[index]--;

    if (servoAttached[index]) {
      servos[index].write(clampServo(currentAngle[index]));
    }
  }
}

void setup() {
  Serial.begin(115200);
  attachAll();
  printHello();
}

void loop() {
  readSerial();
  updateServos();
}
