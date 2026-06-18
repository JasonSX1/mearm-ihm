# Contexto do Projeto — MeArm IHM (para uso por IAs)

> Este documento é um prompt de contexto completo para que uma IA possa entender e dar suporte ao projeto sem acesso ao repositório. Leia tudo antes de responder qualquer pergunta sobre o sistema.

---

## 1. Contexto Acadêmico

- **Instituição:** IFBA — Instituto Federal da Bahia
- **Curso:** Bacharelado em Sistemas de Informação (BSI)
- **Disciplina:** Interface Homem-Máquina (IHM)
- **Professor:** Bruno Silvério Costa
- **Grupo:** 5 alunos
- **Objetivo:** Desenvolver uma IHM desktop para controlar um braço robótico MeArm V1.0 via Arduino UNO, aplicando guidelines de usabilidade e paradigmas de interação estudados na disciplina.

---

## 2. Hardware

### Braço Robótico

- **Modelo:** MeArm V1.0 (kit de acrílico cortado a laser)
- **Controlador:** Arduino UNO
- **Servos:** 4x SG90 (180°)
  - Base (rotação horizontal): pino **D11**
  - Ombro (segmento inferior): pino **D10**
  - Cotovelo (segmento superior): pino **D9**
  - Garra (pinça): pino **D6**

### Alimentação dos Servos

Os servos SG90 são alimentados por **fonte externa 5V 2A**, com GND comum ao Arduino. **Nunca** use o pino 5V do Arduino para alimentar os servos — a sobrecorrente provoca reset do microcontrolador.

### Issues conhecidos de hardware

- **Servo da base danificado:** O servo da base apresenta comportamento errático. A solução adotada foi usar um potenciômetro com divisor de tensão 2x (resistência dobrada) para reduzir o range de movimento e proteger o servo. A calibração fina pode ser feita via offset no firmware do Arduino (comando serial).
- **Ruído de alimentação:** Em caso de jitter nos servos, adicionar capacitor de 100µF entre 5V e GND próximo aos conectores dos servos.

---

## 3. Software

### Stack Tecnológica

| Item | Detalhe |
|------|---------|
| Linguagem | Java 17 |
| UI Framework | JavaFX (via Maven plugin `javafx-maven-plugin`) |
| Serial | jSerialComm 2.10.4 |
| Build | Apache Maven 3.9.6 |
| JDK | Microsoft Build of OpenJDK 17.0.19 |

### Caminhos no ambiente de desenvolvimento

```
JDK:   C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot
Maven: C:\maven\apache-maven-3.9.6
Projeto: C:\Users\Usuario\Documents\robo ihm\
```

### Como executar

**Opção 1 — Script de conveniência:**
```
software/rodar.bat
```

**Opção 2 — Terminal (dentro de `software/`):**
```bat
set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot
C:\maven\apache-maven-3.9.6\bin\mvn.cmd javafx:run
```

---

## 4. Estrutura de Pastas

```
robo ihm/
├── .gitignore
├── README.md
├── CONTEXT_AI.md            ← este arquivo
├── codigo/                  # Firmware Arduino (.ino)
├── esquemas/                # Esquemas elétricos e diagramas
├── teste-base/              # Sketches isolados para teste de hardware
└── software/                # Aplicação JavaFX (Maven)
    ├── pom.xml
    ├── rodar.bat
    └── src/main/java/br/ifba/braco/
        ├── Main.java
        ├── SerialManager.java
        ├── model/
        │   ├── ArmState.java
        │   └── Sequence.java
        └── view/
            ├── MainWindow.java
            └── ArmPanel.java
```

---

## 5. Descrição Detalhada de Cada Arquivo Java

### `Main.java` — Ponto de entrada da aplicação

Estende `javafx.application.Application`. Exibe um **diálogo modal de conexão** antes de abrir a janela principal.

**Fluxo de conexão:**
1. Lista as portas COM disponíveis via `SerialManager.listarPortas()`. Preseleciona `COM4` se disponível.
2. Ao clicar em "Conectar": abre a porta, aguarda 1,5s (Arduino reinicia ao conectar via USB), envia o comando `status` e espera as 4 linhas de resposta (`Base:`, `Ombro:`, `Cotovelo:`, `Garra:`).
3. Timeout de 6s: se não receber resposta completa, abre a janela com o estado padrão (`ArmState.inicial()`).
4. Botão "Modo Simulação": chama `serial.ativarMock()` e abre a janela sem conexão real — todos os comandos são impressos no console.
5. Após conexão bem-sucedida, cria a `Scene` principal com `MainWindow` (900×650px, mínimo 700×500px).

**Campos relevantes:**
- `AtomicInteger[] vals` — acumula os 4 valores de status antes de criar o `ArmState` inicial.
- `janelaAberta[0]` — flag para evitar abrir a janela duas vezes (por timeout e por resposta simultâneos).

---

### `SerialManager.java` — Comunicação serial

Encapsula a biblioteca `jSerialComm`. Suporta **modo mock** (sem hardware).

**Métodos principais:**

| Método | Descrição |
|--------|-----------|
| `listarPortas()` | Estático. Retorna array com nomes das portas COM disponíveis. |
| `conectar(portName, lineCallback)` | Abre a porta a 9600 baud, 8N1. Inicia thread daemon de leitura. Cada linha recebida é entregue ao callback via `Platform.runLater()` (thread JavaFX). Retorna `false` se falhar. |
| `setLineCallback(callback)` | Troca o callback sem reconectar. Usado ao abrir a janela principal (o callback muda de "ler estado inicial" para "mostrar no log"). |
| `enviar(comando)` | Envia string + `\n` ao Arduino. Em modo mock, imprime `MOCK → comando` no console. |
| `ativarMock()` | Habilita modo simulação. |
| `isMock()` | Retorna true se em modo simulação. |
| `desconectar()` | Fecha a porta. Chamado no `setOnCloseRequest` da janela principal. |
| `isConectado()` | True se mock ou porta aberta. |

**Configuração da porta:** 9600 baud, 8 bits de dados, 1 stop bit, sem paridade (`NO_PARITY`), timeout semi-bloqueante.

---

### `MainWindow.java` — Janela principal

Estende `BorderPane`. É o coração da interface.

**Layout:**
- `Center`: `StackPane` contendo o `ArmPanel` (canvas responsivo — redimensiona com a janela).
- `Bottom`: barra de ferramentas horizontal com altura fixa de 80px contendo: ↩ Undo, ↪ Redo, TextArea de log, ⏺ REC, ▶ Reproduzir, Abrir Garra, Fechar Garra.

**Funcionalidades implementadas:**

#### Log com autocomplete (RF005)
- `TextArea` editável com fundo escuro (`#0f172a`) e fonte monospace.
- Ao pressionar Enter na última linha não prefixada por `[`, executa o comando via `executarComando()`.
- `setupAutocomplete()`: ao digitar, exibe `ContextMenu` com até 6 sugestões da lista `SUGGESTIONS` (14 comandos pré-definidos). Selecionar uma sugestão executa o comando imediatamente.
- Clique direito → menu "Limpar Log" → diálogo de confirmação modal.

#### Comandos suportados no log
```
base N      ombro N      cotovelo N      garra N
home        status       ajuda
```

#### Undo / Redo (RF004)
- Pilhas `undoStack` e `redoStack` (ambas `ArrayDeque<ArmState>`).
- `pushUndo(antes)`: empurra estado anterior, limpa redo.
- `desfazer()`: move topo do undo para redo, aplica no painel, envia `todos B O C G` ao Arduino.
- `refazer()`: move topo do redo para undo, aplica no painel, envia ao Arduino.
- Botões ficam desabilitados quando as pilhas estão vazias.

#### Garra (RF003)
- `aplicarGarra(angulo)`: cria novo `ArmState` com o ângulo de garra modificado, envia `garra N` ao Arduino, faz push no undo.
- `GARRA_MAX = 90` (aberta), `GARRA_MIN = 0` (fechada).
- Botão "Abrir Garra" desabilitado quando garra já está no máximo; "Fechar Garra" desabilitado quando está no mínimo.

#### Gravação — REC (RF006)
- `toggleRec(owner)`: alterna entre iniciar e parar gravação.
- `iniciarGravacao()`: inicia `recTimeline` que captura `current` a cada 100ms no `recordBuffer`. Botão REC pulsa (opacidade 1.0 → 0.3 → 1.0 em loop com `recPulse`). Desabilita outros botões.
- `pararGravacao(owner)`: para timelines, abre diálogo para nomear e salvar a sequência em `sequences` (ObservableList).

#### Reprodução (RF006)
- `abrirDialogReproduzir(owner)`: lista as sequências salvas em `ListView`. Selecione e clique "Reproduzir".
- `reproduzirSequencia(seq, owner)`: inicia `playTimeline` que percorre os snapshots a cada 100ms, atualiza o canvas e envia `todos B O C G` ao Arduino para cada frame.
- Botão "Reproduzir" vira "Parar" durante a reprodução.

#### Sincronização com o drag do canvas
- `armPanel.setOnDragEnd(this::handleDragEnd)`: ao soltar o mouse no canvas, `handleDragEnd` detecta qual junta mudou, envia o comando serial individual (`base N`, `ombro N` ou `cotovelo N`) e faz push no undo.

---

### `ArmPanel.java` — Canvas interativo (RF001, RF002)

Estende `javafx.scene.canvas.Canvas`. Renderiza o braço e trata interação de mouse.

**Cinemática direta (2 segmentos):**
- Ponto da base: `(width * 0.2, height * 0.78)`
- Comprimento do segmento 1 (ombro): `height * 0.28`
- Comprimento do segmento 2 (cotovelo): `height * 0.25`
- Posição do ombro: `base + arm1 * (cos θ_ombro, -sin θ_ombro)`
- Posição do cotovelo: `ombro + arm2 * (cos θ_cotovelo, -sin θ_cotovelo)`

**Drag das juntas:**
- `hitTest(x, y)`: detecta qual junta está sob o cursor (raios de detecção: base=42px, ombro/cotovelo=20px).
- `computeAngle(target, mx, my)`: calcula ângulo em graus usando `atan2` em relação ao ponto âncora da junta.
- `applyAngle(target, angle)`: aplica o ângulo clampado no `ArmState`, notifica via `onStateChange`, dispara `flashJoint()` se o limite foi atingido.

**Feedback visual:**
- Cursor muda para `CROSSHAIR` ao passar sobre uma junta.
- Junta ativa (drag): borda amarela (`#fbbf24`), fundo amarelo claro.
- Junta em hover: borda amarela.
- Junta no limite: flash vermelho (`#ef4444`) por 500ms.
- Tooltip de ângulo durante o drag (ex: `Ombro: 45°`), clampado para não sair do canvas.
- Grade de fundo sutil (espaçamento 40px, cor `#1e293b`).
- Garra desenhada como duas curvas bezier quadráticas (tenaz superior e inferior) com abertura proporcional ao ângulo da garra.

**Callbacks expostos:**
```java
setOnLog(Consumer<String>)                   // não usado atualmente
setOnStateChange(Consumer<ArmState>)         // notifica mudança de estado durante drag
setOnDragEnd(BiConsumer<ArmState, ArmState>) // notifica (estadoAntes, estadoDepois) ao soltar
```

---

### `ArmState.java` — Modelo de estado (imutável)

Classe `final` com 4 campos `double` (todos em graus). Segue o padrão **value object** — todas as operações retornam nova instância.

**Limites das articulações:**

| Articulação | Mín | Máx |
|-------------|-----|-----|
| Base | 0° | 180° |
| Ombro | 30° | 150° |
| Cotovelo | 0° | 135° |
| Garra | 0° | 90° |

**Estado inicial (`ArmState.inicial()`):** `base=90, ombro=90, cotovelo=0, garra=0` — pose em "L invertido".

**Métodos `comX(valor)`:** retornam novo `ArmState` com o campo X substituído, aplicando `clamp` automaticamente nos limites.

---

### `Sequence.java` — Sequência gravada

Classe `final` que armazena uma lista imutável de `ArmState` com um nome e calcula a duração:

```java
getDuracaoMs() = snapshots.size() * 100  // 100ms por frame
toString()     = "nome (N frames, ~Xms)"
```

---

## 6. Protocolo Serial — Detalhes Completos

### Configuração da porta
- Baud rate: **9600**
- Data bits: 8
- Stop bits: 1
- Parity: None (8N1)
- Terminador de linha: `\n` (LF)

### Comandos PC → Arduino

```
base 90          → move servo da base para 90°
ombro 45         → move servo do ombro para 45°
cotovelo 30      → move servo do cotovelo para 30°
garra 0          → fecha a garra (0°)
garra 90         → abre a garra (90°)
todos 90 45 30 0 → move todos os servos simultaneamente (base ombro cotovelo garra)
home             → retorna à pose inicial (equivalente a: todos 90 90 0 0)
status           → solicita leitura dos ângulos atuais
ajuda            → solicita lista de comandos (resposta vai para o log)
```

### Respostas Arduino → PC (para o comando `status`)

```
Base: 90
Ombro: 90
Cotovelo: 0
Garra: 0
```

O `Main.java` parseia essas linhas verificando o prefixo (`startsWith`) e extraindo o inteiro após `:`.

### Notas de timing

- O Arduino reinicia quando a porta serial é aberta via USB. O software aguarda **1500ms** antes de enviar `status`.
- Timeout total de **6000ms** para receber a resposta — após isso, abre a janela com o estado padrão.
- Durante reprodução de sequência, um comando `todos` é enviado a cada **100ms**.

---

## 7. Requisitos Funcionais

| RF | Descrição |
|----|-----------|
| RF001 | Visualização do braço em tempo real na tela (canvas 2D com cinemática direta) |
| RF002 | Movimentação por manipulação direta — arrastar as juntas com o mouse |
| RF003 | Controle da garra via botões "Abrir Garra" / "Fechar Garra" |
| RF004 | Undo/Redo ilimitado das posições do braço |
| RF005 | Log textual editável com autocomplete e execução de comandos por Enter |
| RF006 | Gravação de sequência de movimentos e reprodução automática |

---

## 8. Guidelines de Usabilidade

| ID | Guideline | Implementação |
|----|-----------|---------------|
| G001 | Feedback imediato | Log com timestamp em cada ação; resposta do Arduino exibida em tempo real |
| G002 | Consistência visual | Tema dark consistente em todos os componentes (paleta Tailwind slate) |
| G003 | Prevenção de erros | Diálogo de confirmação ao limpar log; botões desabilitados fora de contexto |
| G004 | Reconhecimento em vez de lembrança | Autocomplete no log com 14 comandos sugeridos |
| G005 | Manipulação direta | Drag das juntas no canvas; tooltip de ângulo em tempo real |
| G006 | Controle do usuário | Log editável; usuário pode inserir comandos manualmente |
| G007 | Visibilidade do estado | Botões REC pulsante, ângulos no tooltip, flash vermelho nos limites, indicador de modo (SERIAL/SIMULAÇÃO) no log inicial |

---

## 9. Estado Atual do Projeto

- **Software Java:** funcional. Interface gráfica completa com todas as funcionalidades (RF001–RF006) implementadas.
- **Comunicação serial:** real, via jSerialComm 2.10.4. Testada com Arduino UNO na porta COM4.
- **Modo simulação:** funcional — permite usar a interface sem hardware conectado.
- **Firmware Arduino:** desenvolvido separadamente (pasta `codigo/`). Não faz parte do código Java.
- **Servo da base:** danificado — workaround via potenciômetro 2x e ajuste de offset no firmware.
- **Empacotamento:** execução via `mvn javafx:run` ou `rodar.bat`. Não há JAR fat gerado ainda.

---

## 10. Dicas para Suporte Técnico

### A janela não abre / trava na conexão
- Verifique se o Arduino está conectado e na porta correta.
- Use "Modo Simulação" para testar sem hardware.
- O timeout de 6s abrirá a janela com estado padrão mesmo sem resposta do Arduino.

### Erro de porta serial
- Verifique se o driver do Arduino está instalado (aparece como `COMx` no Gerenciador de Dispositivos).
- Clique em "↻ Atualizar portas" no diálogo de conexão.
- Certifique-se de que nenhum outro programa (Arduino IDE, Monitor Serial) está usando a porta.

### Undo não funciona após ação
- O undo é baseado em pilha em memória. Fechar e reabrir a janela limpa a pilha.
- O log pode ser limpo via clique direito → Limpar Log (com confirmação).

### Compilação falha
```bat
set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot
C:\maven\apache-maven-3.9.6\bin\mvn.cmd clean compile
```
Verifique se o `JAVA_HOME` aponta para o JDK 17 correto (não JRE).

### Dependência jSerialComm não encontrada
```bat
C:\maven\apache-maven-3.9.6\bin\mvn.cmd dependency:resolve
```
Requer conexão com internet na primeira execução para baixar do Maven Central.

---

## 11. Paleta de Cores (Tema Dark)

| Uso | Cor |
|-----|-----|
| Fundo principal | `#1e293b` |
| Fundo do canvas | `#0f172a` |
| Texto principal | `#e2e8f0` |
| Texto secundário | `#94a3b8` |
| Borda / divisor | `#334155` |
| Azul (juntas) | `#3b82f6` |
| Amarelo (ativo) | `#fbbf24` |
| Vermelho (limite/erro) | `#ef4444` |
| Verde (sucesso/garra) | `#22c55e` |
| Verde escuro (garra btn) | `#0f766e` |
| Azul (botão Play) | `#2563eb` |
