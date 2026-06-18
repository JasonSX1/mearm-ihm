# Braço Robótico MeArm — Interface IHM

Interface Homem-Máquina em JavaFX para controle do braço robótico MeArm via drag-and-drop visual.

## Pré-requisitos

| Ferramenta | Versão mínima |
|------------|--------------|
| Java JDK   | 17+          |
| Maven      | 3.8+         |

> JavaFX 21 é baixado automaticamente pelo Maven como dependência.

## Executar

```bash
mvn javafx:run
```

## Compilar sem executar

```bash
mvn compile
```

## Estrutura do Projeto

```
software/
├── pom.xml
├── README.md
└── src/main/java/br/ifba/braco/
    ├── Main.java            — Ponto de entrada JavaFX
    ├── model/
    │   ├── ArmState.java    — Estado das articulações (ângulos)
    │   └── Sequence.java    — Sequência gravada de snapshots
    └── view/
        ├── MainWindow.java  — Janela principal, barra de controles
        └── ArmPanel.java    — Canvas de renderização + interação drag
```

## Articulações

| Junta    | Faixa    | Controle          |
|----------|----------|-------------------|
| Base     | 0–180°   | Drag no canvas    |
| Ombro    | 30–150°  | Drag no canvas    |
| Cotovelo | 0–135°   | Drag no canvas    |
| Garra    | 0–90°    | Botões Abrir/Fechar|

## Tabela de Rastreabilidade RF × Guideline

| Requisito | Descrição                                      | Guidelines        |
|-----------|------------------------------------------------|-------------------|
| RF001     | Renderização em tempo real do braço no canvas  | —                 |
| RF002     | Drag p/ mover joints + log + undo              | G005, G006        |
| RF003     | Abrir/Fechar Garra com botões desabilitados    | G007              |
| RF004     | Undo (↩) / Redo (↪) com pilhas               | G004, G007        |
| RF005     | Log editável com autocomplete + menu de contexto| G006             |
| RF006     | REC gravar sequência + reproduzir              | G001, G002, G003, G004 |
| —         | Layout barra inferior                          | G007              |
| —         | Dialogs com botões posicionados corretamente   | G001, G002, G003, G004 |
| —         | Cursor CROSSHAIR sobre joints                  | G005              |
| —         | Piscar vermelho ao atingir limite              | G005              |
| —         | REC pulsa vermelho durante gravação            | —                 |

## Comandos Serial (Mock)

Durante a execução, os comandos que seriam enviados ao Arduino são impressos no console:

```
MOCK SERIAL: BASE:90
MOCK SERIAL: OMBRO:75
MOCK SERIAL: COTOVELO:45
MOCK SERIAL: GARRA:0
```
