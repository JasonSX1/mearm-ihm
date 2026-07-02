# MeArm — Interface Homem-Máquina (IHM)

## Sobre o Projeto

Projeto desenvolvido na disciplina de **Interface Homem-Máquina (IHM)** do curso de **Bacharelado em Sistemas de Informação (BSI)** do **IFBA — Instituto Federal da Bahia**, sob orientação do **Prof. Bruno Silvério Costa**.

O projeto consiste em duas interfaces gráficas para controle de um braço robótico **MeArm V1.0** acoplado a um **Arduino UNO**, permitindo visualizar e manipular o braço em tempo real via porta serial, gravar e reproduzir sequências de movimentos.

**Alunos:** David Inácio F. da Silva Júnior · Pedro Henrique de O. dos Anjos · Geison de Oliveira Lemos Ferreira · Heder Moreira David · Luiz Castro Ramos

---

## Estrutura do Repositório

```
mearm-ihm/
├── ihm-web/             ⭐ Interface Web (React + Three.js + Node.js)
│   ├── src/                 # Frontend React + TypeScript
│   │   ├── App.tsx              # Layout, Undo/Redo, Log, REC, Garra (RF001-RF006)
│   │   ├── components/
│   │   │   └── ArmScene.tsx     # Modelo 3D + manipulação direta (G005)
│   │   ├── hooks/
│   │   │   └── useRobot.ts      # Estado do robô via WebSocket
│   │   ├── lib/
│   │   │   ├── api.ts           # Chamadas HTTP
│   │   │   └── types.ts         # Tipos e limites dos eixos
│   │   └── styles.css           # Layout, barra inferior, diálogos (G001-G007)
│   ├── server/              # Backend Node.js
│   │   ├── index.ts             # API Express + WebSocket (porta 8787)
│   │   ├── serialController.ts  # Comunicação serial 9600 baud + interpolação
│   │   ├── defaults.ts          # Calibração padrão (pinos, limites)
│   │   └── calibrationStore.ts  # Persistência
│   ├── firmware/            # Firmware alternativo (referência)
│   ├── package.json
│   ├── vite.config.ts
│   └── rodar.bat            # Script Windows para iniciar
│
├── software/            📦 Interface Desktop (JavaFX — Java 17)
│   ├── src/main/java/br/ifba/braco/
│   │   ├── Main.java            # Ponto de entrada + diálogo de conexão
│   │   ├── SerialManager.java   # Comunicação serial via jSerialComm
│   │   ├── model/
│   │   │   ├── ArmState.java    # Estado das 4 articulações
│   │   │   └── Sequence.java    # Sequência gravada
│   │   └── view/
│   │       ├── MainWindow.java  # Janela principal
│   │       └── ArmPanel.java    # Canvas interativo do braço
│   ├── pom.xml
│   └── rodar.bat
│
├── codigo/              🔧 Firmware Arduino
│   ├── InterfaceBracoRobo/      # Firmware principal (protocolo serial)
│   └── TesteBase/               # Teste isolado do servo da base
│
├── esquemas/            📐 Esquemas elétricos e diagramas
├── manual/              📖 Manual de montagem MeArm V1.0
├── teste-base/          🧪 Teste Java isolado para servo da base
└── fotos/               📷 Fotos do robô montado
```

---

## Como Executar

### Interface Web (recomendada)

**Pré-requisitos:** Node.js 18+

```bash
cd ihm-web
npm install       # primeira vez
npm run dev       # inicia servidor + frontend
```

Acesse **http://localhost:5173** no navegador. Conecte o Arduino clicando em **"Conectar"** no header.

### Interface Desktop (JavaFX)

**Pré-requisitos:** Java 17+, Maven 3.9+

```bash
cd software
rodar.bat         # Windows
# ou: mvn javafx:run
```

---

## Hardware

### Pinagem Arduino UNO

| Articulação | Pino | Servo |
|-------------|------|-------|
| Base        | D11  | SG90  |
| Ombro       | D10  | SG90  |
| Cotovelo    | D9   | SG90  |
| Garra       | D6   | SG90  |

> **Importante:** alimentar os servos com fonte externa **5V 2A**. Não usar o pino 5V do Arduino.

### Protocolo Serial (9600 baud, 8N1)

| Comando | Exemplo | Descrição |
|---------|---------|-----------|
| `base N` | `base 90` | Move a base para N graus |
| `ombro N` | `ombro 45` | Move o ombro para N graus |
| `cotovelo N` | `cotovelo 30` | Move o cotovelo para N graus |
| `garra N` | `garra 0` | Move a garra para N graus |
| `todos B O C G` | `todos 90 90 90 90` | Move todas as juntas |
| `home` | `home` | Retorna à pose inicial |
| `status` | `status` | Solicita ângulos atuais |

---

## Tecnologias

| Camada | Interface Web | Interface Desktop |
|--------|--------------|-------------------|
| **Frontend** | React 19 + TypeScript | JavaFX 21 |
| **3D/Canvas** | Three.js + React Three Fiber | Canvas 2D nativo |
| **Servidor** | Node.js + Express + WebSocket | — |
| **Serial** | `serialport` (npm) | jSerialComm 2.10.4 |
| **Build** | Vite | Maven |

---

## Requisitos Funcionais

| RF | Descrição | Guidelines |
|----|-----------|------------|
| RF001 | Visualização do braço em tempo real | G005, G007 |
| RF002 | Movimentação por manipulação direta (drag) | G005, G007 |
| RF003 | Controle da garra (Abrir/Fechar) | G007 |
| RF004 | Undo/Redo | G007 |
| RF005 | Log textual editável com sugestões | G001, G003, G004, G006, G007 |
| RF006 | Gravação e reprodução de sequências | G001, G003, G004, G007 |

## Guidelines

| ID | Descrição |
|----|-----------|
| G001 | Botão de confirmação no canto inferior direito dos diálogos |
| G002 | Botão voltar/cancelar no canto inferior esquerdo |
| G003 | Botão de confirmação em verde |
| G004 | Botão de cancelar em vermelho |
| G005 | Cursor de rotação ao passar sobre articulação |
| G006 | Log editável com sugestões de comandos |
| G007 | Ordem fixa: Undo, Redo, Log, REC, Abrir Garra, Fechar Garra |

---

## Paradigmas de Interação

### Manipulação Direta
As articulações são objetos interativos (bolas 3D / círculos no canvas) que o usuário clica e arrasta com feedback imediato. Ações são reversíveis via Undo/Redo.

### Construtivismo
Sem tutorial obrigatório — o usuário aprende explorando. O log funciona como andaime (*scaffolding*): o usuário observa os comandos gerados pelas ações gráficas e pode evoluir para uso textual.
