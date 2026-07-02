# IHM-MeArm

Sistema web local para controle de um braço robótico MeArm com Arduino, desenvolvido como trabalho da disciplina de Interface Homem-Máquina.

O projeto integra uma interface 3D em TypeScript com um backend Node.js que se comunica com o Arduino via USB/Serial. A proposta é permitir controle direto das juntas do braço, calibração assistida dos servos e operação local sem depender de internet após a instalação.

## Funcionalidades

- Detecção de portas USB/Serial compatíveis com Arduino.
- Comunicação em tempo real entre frontend, backend e firmware.
- Interface 3D manipulável para base, ombro, cotovelo e garra.
- Garra com ação binária: clique para abrir ou fechar.
- Calibração assistida dos limites de cada servo.
- Botão de parada de emergência.
- Persistência local da calibração.
- Firmware próprio para Arduino Uno usando `Servo.h`.

## Tecnologias

- TypeScript
- React
- Three.js com React Three Fiber
- Node.js
- Express
- WebSocket
- SerialPort
- Arduino C/C++

## Estrutura

```text
IHM-MeArm/
├── firmware/              # Sketch Arduino
├── server/                # API local, WebSocket e controle serial
├── src/                   # Interface React/Three.js
├── scripts/               # Script de upload do firmware
├── tests/                 # Verificação visual opcional
└── .me-arm-data/          # Dados locais ignorados pelo git
```

## Requisitos

- macOS, Linux ou Windows com Node.js instalado.
- Arduino Uno ou compatível.
- Braço MeArm com 4 servos.
- Cabo USB de dados.
- Fonte externa 5V/6V para os servos.
- `arduino-cli` ou Arduino IDE para enviar o firmware.

Importante: não alimente todos os servos pelo pino 5V do Arduino. Use uma fonte externa para os servos e conecte o GND da fonte ao GND do Arduino.

## Instalação

```bash
cd /Users/davidjunior/Dev/IHM-MeArm
npm install
```

## Rodar o sistema

```bash
npm run dev
```

Abra:

```text
http://localhost:5173
```

O backend local roda em:

```text
http://localhost:8787
```

## Firmware do Arduino

Com `arduino-cli`:

```bash
brew install arduino-cli
npm run firmware:upload
```

Se a porta não for detectada automaticamente:

```bash
npm run firmware:upload -- --port /dev/cu.usbmodemXXXX
```

Também é possível abrir o arquivo abaixo no Arduino IDE e enviar para uma placa Arduino Uno:

```text
firmware/me_arm_firmware/me_arm_firmware.ino
```

## Ligações padrão

| Eixo | Pino de sinal |
| --- | ---: |
| Base | D3 |
| Ombro | D5 |
| Cotovelo | D6 |
| Garra | D9 |

Alimentação recomendada:

```text
Fonte externa +5V/6V -> VCC dos servos
Fonte externa GND    -> GND dos servos
Arduino GND          -> GND da fonte externa
Arduino Dx           -> sinal de cada servo
```

## Uso

1. Envie o firmware para o Arduino.
2. Ligue o Arduino via USB.
3. Rode `npm run dev`.
4. Abra `http://localhost:5173`.
5. Clique em `Detectar`.
6. Clique em `Conectar`.
7. Use a interface 3D ou os controles laterais para movimentar o braço.

Quando a conexão estiver correta, o app deve mostrar o firmware `me-arm-firmware 1.0.0`.

## Calibração

Servos comuns de hobby não retornam posição real, esforço ou fim de curso. Por isso a calibração é assistida, não totalmente automática.

Fluxo recomendado:

1. Selecione um eixo: Base, Ombro, Cotovelo ou Garra.
2. Mova devagar usando o slider, os botões de grau ou a manipulação 3D.
3. Encontre o menor ponto seguro e clique em `Marcar mínimo`.
4. Encontre o maior ponto seguro e clique em `Marcar máximo`.
5. Clique em `Salvar calibração`.

Mantenha o botão `Parar` acessível durante a calibração. Não deixe o servo forçar contra o limite mecânico.

Os limites são salvos localmente em:

```text
.me-arm-data/calibration.json
```

Esse arquivo é ignorado pelo git porque depende do braço físico de cada montagem.

## Solução de problemas

### O braço mexe na interface, mas não mexe fisicamente

Verifique se o app mostra `Conectado`. Se aparecer `Movimento em simulação local`, o Arduino não está conectado ao backend.

No macOS, confira se apareceu uma porta USB:

```bash
ls /dev/cu.*
```

Devem aparecer portas como:

```text
/dev/cu.usbmodemXXXX
/dev/cu.usbserial-XXXX
```

### A porta USB não aparece

- Use cabo USB de dados.
- Troque a porta USB.
- Confira se o driver CH340/CP210x é necessário para a sua placa.
- Feche Arduino IDE ou Serial Monitor se estiverem usando a mesma porta.

### Servo vibra ou não tem força

- Use fonte externa para os servos.
- Una o GND da fonte ao GND do Arduino.
- Verifique se a fonte entrega corrente suficiente.

### Eixo travado em um único ângulo

Isso normalmente significa que mínimo e máximo foram salvos iguais. Selecione o eixo e clique em `Resetar eixo`.

## Scripts

```bash
npm run dev              # API + frontend em modo desenvolvimento
npm run build            # build de produção
npm run preview          # serve o build pelo backend
npm run firmware:upload  # compila e envia o firmware
npm run visual:check     # verificação visual opcional com Playwright
```

## Documentação do projeto

Veja também:

```text
docs/PROJETO-IHM.md
```
