# Documentação do Projeto IHM-MeArm

## Contexto

O IHM-MeArm foi desenvolvido como uma interface local para manipulação de um braço robótico MeArm conectado a um Arduino. O foco do trabalho é a relação entre usuário, interface e máquina física, com ênfase em feedback visual, controle direto e redução de risco durante a operação.

## Objetivo

Criar uma interface homem-máquina capaz de:

- identificar e conectar o Arduino via USB;
- controlar os quatro servos do braço;
- representar o estado do braço em uma cena 3D;
- permitir manipulação direta das articulações;
- calibrar limites físicos de forma assistida;
- operar localmente em um computador comum.

## Arquitetura

O sistema é dividido em três camadas:

```text
Interface Web  <->  Backend Node.js  <->  Arduino/Firmware  <->  Servos
```

### Interface Web

Responsável pela experiência de uso:

- cena 3D do braço;
- seleção de eixos;
- controles de movimento;
- painel de conexão;
- painel de calibração;
- botão de parada.

### Backend

Responsável por intermediar a comunicação:

- lista portas seriais;
- escolhe portas prováveis de Arduino;
- abre conexão serial;
- envia comandos de movimento;
- mantém estado compartilhado por WebSocket;
- salva calibração local.

### Firmware

Responsável por atuar nos servos:

- recebe comandos via Serial;
- configura pinos dos servos;
- movimenta os servos gradualmente;
- responde mensagens de status.

## Decisões de Interface Homem-Máquina

### Manipulação direta

A cena 3D permite selecionar e mover juntas do braço visualmente. Isso aproxima o controle da representação física, reduzindo a distância entre intenção e ação.

### Feedback imediato

Ao mover uma junta, a posição 3D muda imediatamente. Se o Arduino estiver conectado, o backend envia o mesmo estado para o firmware.

### Separação de conexão e controle

O usuário precisa conectar explicitamente o Arduino. Isso evita que movimentos sejam enviados para uma porta errada ou dispositivo incorreto.

### Parada de emergência

O botão `Parar` fica disponível no painel principal para interromper o envio de movimento.

### Calibração assistida

Servos comuns não possuem feedback de posição real. Por isso, o sistema não tenta encontrar limites automaticamente empurrando a mecânica. O usuário confirma os limites seguros.

### Garra binária

A garra foi tratada como uma ação simples de abrir/fechar, pois esse controle é mais adequado ao uso real do atuador do que um ajuste angular contínuo.

## Protocolo Serial

O backend envia comandos simples por linha:

```text
HELLO
STATUS
CFG base=3 shoulder=5 elbow=6 gripper=9
MOVE base=90 shoulder=90 elbow=95 gripper=70 step=8
STOP
DETACH
```

O firmware responde com mensagens JSON curtas para identificação e status.

## Limitações

- Servos comuns não informam posição real.
- O sistema não detecta força mecânica nem colisão.
- A calibração automática completa exigiria sensores extras.
- A precisão depende da montagem física e da alimentação dos servos.

## Possíveis melhorias

- Adicionar sensor de corrente para detectar travamento.
- Adicionar fim de curso por eixo.
- Usar servos com feedback ou smart servos.
- Adicionar perfis de calibração por usuário ou por braço.
- Criar modo de demonstração com trajetórias gravadas.
