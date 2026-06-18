# Esquema de Fiação — MeArm V1.0 + Arduino UNO

## Pinagem dos Servos

| Servo (meArm) | Nome no código | Pino Arduino | Fio sinal |
|---------------|----------------|--------------|-----------|
| Base (rotação)| BASE           | **D11** (PWM)| Laranja/Amarelo |
| Ombro         | OMBRO          | **D10** (PWM)| Laranja/Amarelo |
| Cotovelo      | COTOVELO       | **D9**  (PWM)| Laranja/Amarelo |
| Garra         | GARRA          | **D6**  (PWM)| Laranja/Amarelo |

## Alimentação (IMPORTANTE)

```
Fonte externa 5V 2A (ou 4x pilha AA ~6V):
  (+) ──── barramento VCC ──── fios VERMELHOS dos 4 servos
  (-) ──── barramento GND ──── fios MARRONS dos 4 servos
                    └───────── GND do Arduino UNO  ← ligar aqui também!

Arduino UNO:
  D11 ──── fio SINAL da Base
  D10 ──── fio SINAL do Ombro
  D9  ──── fio SINAL do Cotovelo
  D6  ──── fio SINAL da Garra
  GND ──── barramento GND da fonte externa
  5V  ──── NÃO conectar nos servos
```

> ⚠️ Os GNDs DEVEM ser comuns entre Arduino e fonte externa.
> ⚠️ Nunca alimente os 4 servos pelo pino 5V do Arduino — ele não aguenta a corrente.

## Posições de referência (calibração)

| Servo     | Ângulo inicial | Posição física             |
|-----------|---------------|----------------------------|
| Base      | 90°           | Braço apontando para frente |
| Ombro     | 90°           | Braço erguido vertical      |
| Cotovelo  | 90°           | Cotovelo em 90°             |
| Garra     | 90°           | Garra semi-aberta           |

## Comandos Serial (InterfaceBracoRobo.ino) — baud rate 9600

| Comando               | Resultado                              |
|-----------------------|----------------------------------------|
| `base 90`             | Move a base para 90°                   |
| `ombro 70`            | Move o ombro para 70°                  |
| `cotovelo 120`        | Move o cotovelo para 120°              |
| `garra 40`            | Fecha a garra (ângulo menor = fechada) |
| `todos 90 80 120 50`  | Move todos ao mesmo tempo              |
| `home`                | Volta à posição inicial (90 90 90 90)  |
| `status`              | Mostra ângulos atuais                  |
| `ajuda`               | Lista todos os comandos                |
