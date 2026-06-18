#include <Servo.h>

Servo servoBase;
const int PIN_BASE = 11;
int posBase = 90;

void setup() {
  Serial.begin(9600);
  servoBase.attach(PIN_BASE);
  servoBase.write(posBase);
  Serial.println("Teste base pronto. Digite 0-180:");
}

void loop() {
  if (Serial.available()) {
    String entrada = Serial.readStringUntil('\n');
    entrada.trim();
    int angulo = entrada.toInt();
    if (angulo >= 0 && angulo <= 180) {
      posBase = angulo;
      servoBase.write(posBase);
      Serial.print("Base -> ");
      Serial.println(posBase);
    } else {
      Serial.println("Valor invalido (0-180)");
    }
  }
}
