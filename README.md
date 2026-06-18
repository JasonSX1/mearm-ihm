# MeArm — Interface Homem-Máquina (IHM)

## Sobre o Projeto

Projeto desenvolvido na disciplina de **Interface Homem-Máquina (IHM)** do curso de **Bacharelado em Sistemas de Informação (BSI)** do **IFBA — Instituto Federal da Bahia**, sob orientação do **Prof. Bruno Silvério Costa**.

O projeto consiste em uma interface gráfica desktop (JavaFX) para controle de um braço robótico **MeArm V1.0** acoplado a um **Arduino UNO**, desenvolvida por um grupo de 5 alunos. A IHM permite visualizar e manipular o braço em tempo real via porta serial, além de gravar e reproduzir sequências de movimentos.

---

## Pré-requisitos

| Item | Versão / Detalhes |
|------|--------------------|
| Java | 17 ou superior (testado com Microsoft JDK 17.0.19) |
| Maven | 3.9+ |
| Arduino UNO | Firmware compatível com protocolo serial (baud 9600) |
| Servos | 4x SG90 (base, ombro, cotovelo, garra) |
| Alimentação | Fonte externa 5V 2A para os servos (NÃO usar o pino 5V do Arduino) |

---

## Como Executar

### Opção 1 — Duplo clique (Windows)

```
software/rodar.bat
```

### Opção 2 — Terminal

Dentro da pasta `software/`, execute:

```bat
set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot
C:\maven\apache-maven-3.9.6\bin\mvn.cmd javafx:run
```

Ao iniciar, um diálogo de conexão perguntará a porta serial (ex: `COM4`). Caso não haja Arduino disponível, use o botão **"Modo Simulação"** para rodar sem hardware.

---

## Estrutura do Projeto

```
robo ihm/
├── codigo/          # Firmware Arduino (.ino)
├── esquemas/        # Esquemas elétricos e diagramas de montagem
├── software/        # Aplicação JavaFX (Maven)
│   ├── src/main/java/br/ifba/braco/
│   │   ├── Main.java              # Ponto de entrada; diálogo de conexão
│   │   ├── SerialManager.java     # Comunicação serial via jSerialComm
│   │   ├── model/
│   │   │   ├── ArmState.java      # Estado imutável das 4 articulações
│   │   │   └── Sequence.java      # Sequência gravada de snapshots
│   │   └── view/
│   │       ├── MainWindow.java    # Janela principal (log, undo/redo, rec, play)
│   │       └── ArmPanel.java      # Canvas interativo do braço (drag & drop)
│   ├── rodar.bat                  # Script de execução rápida
│   └── pom.xml                    # Dependências Maven (JavaFX + jSerialComm)
└── teste-base/      # Sketches e testes isolados de hardware
```

---

## Conexão com Arduino

A comunicação é feita via porta serial (baud **9600**, 8N1). O software usa a biblioteca **jSerialComm 2.10.4**.

### Comandos enviados (PC → Arduino)

| Comando | Exemplo | Descrição |
|---------|---------|-----------|
| `base N` | `base 90` | Move a base para N graus |
| `ombro N` | `ombro 45` | Move o ombro para N graus |
| `cotovelo N` | `cotovelo 30` | Move o cotovelo para N graus |
| `garra N` | `garra 0` | Move a garra para N graus |
| `todos B O C G` | `todos 90 90 0 0` | Move todas as juntas simultaneamente |
| `home` | `home` | Retorna à pose inicial (90 90 0 0) |
| `status` | `status` | Solicita leitura dos ângulos atuais |

### Respostas esperadas (Arduino → PC)

```
Base: 90
Ombro: 90
Cotovelo: 0
Garra: 0
```

Cada linha é processada pelo `SerialManager` e encaminhada para o log da interface.

---

## Pinagem Arduino

| Articulação | Pino Arduino | Servo |
|-------------|-------------|-------|
| Base | D11 | SG90 |
| Ombro | D10 | SG90 |
| Cotovelo | D9 | SG90 |
| Garra | D6 | SG90 |

> **Importante:** os servos devem ser alimentados por fonte externa 5V 2A. Usar o pino 5V do Arduino pode causar reset por sobrecorrente.

---

## Rastreabilidade de Requisitos

| RF | Descrição | Guidelines | Estado Visual |
|----|-----------|------------|---------------|
| RF001 | Visualização do braço em tempo real | G005, G007 | Normal, Hover, Arrastando |
| RF002 | Movimentação por manipulação direta (drag) | G005, G007 | Hover, Arrastando, Limite atingido |
| RF003 | Controle da garra (Abrir/Fechar) | G007 | Normal, botão desabilitado |
| RF004 | Undo/Redo | G007 | Normal, botão desabilitado |
| RF005 | Log textual editável com autocomplete | G001, G003, G004, G006, G007 | Normal, diálogo Limpar Log |
| RF006 | Gravação e reprodução de sequências | G001, G003, G004, G007 | Gravando (REC pulsando), Reproduzindo |

---

## Guidelines Implementadas

| ID | Descrição | Onde aparece no código |
|----|-----------|------------------------|
| G001 | Feedback imediato de ações | Log com timestamp em `MainWindow.adicionarLog()` |
| G002 | Consistência visual | Paleta dark unificada (`#1e293b`, `#0f172a`) em todos os componentes |
| G003 | Prevenção de erros | Diálogo de confirmação antes de limpar log (`confirmarLimparLog()`) |
| G004 | Reconhecimento em vez de lembrança | Autocomplete de comandos no log (`setupAutocomplete()`) |
| G005 | Manipulação direta | Drag nas juntas do canvas em `ArmPanel.setupInteraction()` |
| G006 | Controle do usuário | Log editável; usuário pode corrigir/inserir comandos manualmente |
| G007 | Visibilidade do estado do sistema | Botões habilitados/desabilitados conforme contexto (`atualizarBotoes()`); tooltip de ângulo durante drag; flash vermelho no limite |

---

## Paradigmas de Interação

### Manipulação Direta

O canvas (`ArmPanel`) permite arrastar as juntas (base, ombro, cotovelo) com o mouse. O feedback é imediato: a representação visual do braço atualiza em tempo real durante o drag, um tooltip exibe o ângulo atual e a junta pisca em vermelho ao atingir o limite de articulação. Ao soltar o mouse, o comando serial correspondente é enviado automaticamente ao Arduino.

### Abordagem Construtivista

O sistema de gravação e reprodução de sequências (`RF006`) permite ao usuário construir comportamentos complexos incrementalmente: ele move o braço livremente, grava a sequência de movimentos (capturando snapshots a cada 100ms) e pode reproduzi-la quantas vezes desejar. Essa abordagem coloca o usuário no papel de autor da programação do robô, sem necessidade de escrever código.
