/*Exemplos de comandos
base 90
ombro 70
cotovelo 120
garra 40
todos 90 80 120 50
home
status
ajuda*/

#include <Servo.h>

// Servos do meArm
Servo servoBase;
Servo servoOmbro;
Servo servoCotovelo;
Servo servoGarra;

// Pinos dos servos
const int PIN_BASE     = 11;
const int PIN_OMBRO    = 10;
const int PIN_COTOVELO = 9;
const int PIN_GARRA    = 6;

// Posições atuais
int posBase     = 90;
int posOmbro    = 90;
int posCotovelo = 90;
int posGarra    = 90;

// =============================================================
// CALIBRAÇÃO — ajuste esses valores se o braço estiver torto
// Positivo = gira para um lado, Negativo = gira para o outro
// Exemplo: se "home" coloca o ombro 15° inclinado, ponha -15
// =============================================================
int OFFSET_BASE     =  0;
int OFFSET_OMBRO    =  0;
int OFFSET_COTOVELO =  0;
int OFFSET_GARRA    =  0;

// Limites de segurança
const int MIN_ANGULO = 0;
const int MAX_ANGULO = 180;

String entrada = "";

void setup() {
  Serial.begin(9600);

  servoBase.attach(PIN_BASE);
  servoOmbro.attach(PIN_OMBRO);
  servoCotovelo.attach(PIN_COTOVELO);
  servoGarra.attach(PIN_GARRA);

  moverTodos(posBase, posOmbro, posCotovelo, posGarra);

  Serial.println("Controle do braco robotico meArm iniciado.");
  Serial.println("Digite 'ajuda' para ver os comandos.");
}

void loop() {
  if (Serial.available()) {
    entrada = Serial.readStringUntil('\n');
    entrada.trim();
    entrada.toLowerCase();

    if (entrada.length() > 0) {
      processarComando(entrada);
    }
  }
}

void processarComando(String comando) {
  if (comando == "ajuda") {
    mostrarAjuda();
  }
  else if (comando == "home") {
    moverTodos(90, 90, 90, 90);
    Serial.println("Braco movido para posicao inicial.");
  }
  else if (comando == "status") {
    mostrarStatus();
  }
  else if (comando.startsWith("base ")) {
    int angulo = comando.substring(5).toInt();
    moverBase(angulo);
  }
  else if (comando.startsWith("ombro ")) {
    int angulo = comando.substring(6).toInt();
    moverOmbro(angulo);
  }
  else if (comando.startsWith("cotovelo ")) {
    int angulo = comando.substring(9).toInt();
    moverCotovelo(angulo);
  }
  else if (comando.startsWith("garra ")) {
    int angulo = comando.substring(6).toInt();
    moverGarra(angulo);
  }
  else if (comando.startsWith("todos ")) {
    processarComandoTodos(comando);
  }
  else if (comando.startsWith("offset ")) {
    processarOffset(comando);
  }
  else if (comando == "offsets") {
    Serial.println("Offsets atuais:");
    Serial.print("base=");     Serial.println(OFFSET_BASE);
    Serial.print("ombro=");    Serial.println(OFFSET_OMBRO);
    Serial.print("cotovelo="); Serial.println(OFFSET_COTOVELO);
    Serial.print("garra=");    Serial.println(OFFSET_GARRA);
  }
  else {
    Serial.println("Comando invalido. Digite 'ajuda'.");
  }
}

void processarComandoTodos(String comando) {
  int valores[4];
  int indice = 0;

  comando = comando.substring(6);
  comando.trim();

  while (comando.length() > 0 && indice < 4) {
    int espaco = comando.indexOf(' ');

    if (espaco == -1) {
      valores[indice] = comando.toInt();
      comando = "";
    } else {
      valores[indice] = comando.substring(0, espaco).toInt();
      comando = comando.substring(espaco + 1);
      comando.trim();
    }

    indice++;
  }

  if (indice == 4) {
    moverTodos(valores[0], valores[1], valores[2], valores[3]);
  } else {
    Serial.println("Uso correto: todos BASE OMBRO COTOVELO GARRA");
    Serial.println("Exemplo: todos 90 80 120 50");
  }
}

int limitarAngulo(int angulo) {
  if (angulo < MIN_ANGULO) return MIN_ANGULO;
  if (angulo > MAX_ANGULO) return MAX_ANGULO;
  return angulo;
}

void moverBase(int angulo) {
  posBase = limitarAngulo(angulo);
  servoBase.write(limitarAngulo(posBase + OFFSET_BASE));
  Serial.print("Base movida para ");
  Serial.println(posBase);
}

void moverOmbro(int angulo) {
  posOmbro = limitarAngulo(angulo);
  servoOmbro.write(limitarAngulo(posOmbro + OFFSET_OMBRO));
  Serial.print("Ombro movido para ");
  Serial.println(posOmbro);
}

void moverCotovelo(int angulo) {
  posCotovelo = limitarAngulo(angulo);
  servoCotovelo.write(limitarAngulo(posCotovelo + OFFSET_COTOVELO));
  Serial.print("Cotovelo movido para ");
  Serial.println(posCotovelo);
}

void moverGarra(int angulo) {
  posGarra = limitarAngulo(angulo);
  servoGarra.write(limitarAngulo(posGarra + OFFSET_GARRA));
  Serial.print("Garra movida para ");
  Serial.println(posGarra);
}

void moverTodos(int base, int ombro, int cotovelo, int garra) {
  moverBase(base);
  delay(200);

  moverOmbro(ombro);
  delay(200);

  moverCotovelo(cotovelo);
  delay(200);

  moverGarra(garra);
  delay(200);
}

void mostrarStatus() {
  Serial.println("Status atual:");
  Serial.print("Base: ");
  Serial.println(posBase);

  Serial.print("Ombro: ");
  Serial.println(posOmbro);

  Serial.print("Cotovelo: ");
  Serial.println(posCotovelo);

  Serial.print("Garra: ");
  Serial.println(posGarra);
}

void processarOffset(String comando) {
  // Formato: offset base 15  |  offset ombro -10  etc.
  comando = comando.substring(7);
  comando.trim();
  int espaco = comando.indexOf(' ');
  if (espaco == -1) {
    Serial.println("Uso: offset SERVO VALOR  (ex: offset ombro -15)");
    return;
  }
  String servo = comando.substring(0, espaco);
  int valor = comando.substring(espaco + 1).toInt();

  if (servo == "base")          { OFFSET_BASE = valor;     Serial.print("Offset base = ");     Serial.println(OFFSET_BASE); }
  else if (servo == "ombro")    { OFFSET_OMBRO = valor;    Serial.print("Offset ombro = ");    Serial.println(OFFSET_OMBRO); }
  else if (servo == "cotovelo") { OFFSET_COTOVELO = valor; Serial.print("Offset cotovelo = "); Serial.println(OFFSET_COTOVELO); }
  else if (servo == "garra")    { OFFSET_GARRA = valor;    Serial.print("Offset garra = ");    Serial.println(OFFSET_GARRA); }
  else { Serial.println("Servo invalido. Use: base, ombro, cotovelo ou garra"); return; }

  // Reaplicar posição atual com novo offset
  moverBase(posBase);
  moverOmbro(posOmbro);
  moverCotovelo(posCotovelo);
  moverGarra(posGarra);
}

void mostrarAjuda() {
  Serial.println("Comandos disponiveis:");
  Serial.println("base ANGULO");
  Serial.println("ombro ANGULO");
  Serial.println("cotovelo ANGULO");
  Serial.println("garra ANGULO");
  Serial.println("todos BASE OMBRO COTOVELO GARRA");
  Serial.println("home");
  Serial.println("status");
  Serial.println("ajuda");
  Serial.println();
  Serial.println("Exemplos:");
  Serial.println("base 90");
  Serial.println("ombro 70");
  Serial.println("cotovelo 120");
  Serial.println("garra 40");
  Serial.println("todos 90 80 120 50");
}