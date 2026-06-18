package br.ifba.braco.view;

import br.ifba.braco.SerialManager;
import br.ifba.braco.model.ArmState;
import br.ifba.braco.model.Sequence;
import javafx.animation.KeyFrame;
import javafx.animation.KeyValue;
import javafx.animation.Timeline;
import javafx.application.Platform;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.*;
import javafx.stage.Modality;
import javafx.stage.Stage;
import javafx.util.Duration;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

public class MainWindow extends BorderPane {

    private final ArmPanel armPanel;
    private final TextArea logArea;
    private final Button btnUndo, btnRedo, btnRec, btnPlay;
    private final Button btnAbrirGarra, btnFecharGarra;

    private final SerialManager serial;
    private ArmState current;
    private final Deque<ArmState> undoStack = new ArrayDeque<>();
    private final Deque<ArmState> redoStack = new ArrayDeque<>();

    private boolean recording    = false;
    private boolean reproduzindo = false;
    private Timeline recTimeline;
    private Timeline recPulse;
    private final List<ArmState> recordBuffer = new ArrayList<>();
    private final ObservableList<Sequence> sequences = FXCollections.observableArrayList();
    private Timeline playTimeline;

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm:ss");

    private static final List<String> SUGGESTIONS = List.of(
            "base 90", "base 0", "base 180",
            "ombro 90", "ombro 30", "ombro 150",
            "cotovelo 0", "cotovelo 45", "cotovelo 135",
            "garra 0", "garra 90",
            "home", "status", "ajuda"
    );

    public MainWindow(Stage stage, SerialManager serial, ArmState estadoInicial) {
        this.serial  = serial;
        this.current = estadoInicial;

        // Linhas recebidas do Arduino vão para o log
        serial.setLineCallback(linha -> adicionarLog("[Arduino] " + linha));

        // ---- Canvas ----
        armPanel = new ArmPanel(700, 500);
        armPanel.setState(current);
        armPanel.setOnStateChange(s -> current = s);
        armPanel.setOnDragEnd(this::handleDragEnd);

        StackPane canvasContainer = new StackPane(armPanel);
        canvasContainer.setStyle("-fx-background-color: #0f172a;");
        canvasContainer.widthProperty().addListener((obs, ov, nv) -> {
            armPanel.setWidth(nv.doubleValue());
            armPanel.draw();
        });
        canvasContainer.heightProperty().addListener((obs, ov, nv) -> {
            armPanel.setHeight(nv.doubleValue());
            armPanel.draw();
        });

        // ---- Barra inferior ----
        btnUndo = criarBotao("↩", "Desfazer");
        btnRedo = criarBotao("↪", "Refazer");
        btnRec  = criarBotaoPrincipal("⏺ REC", "#dc2626");
        btnPlay = criarBotaoPrincipal("▶ Reproduzir", "#2563eb");

        btnAbrirGarra  = criarBotaoPrincipal("Abrir Garra", "#0f766e");
        btnFecharGarra = criarBotaoPrincipal("Fechar Garra", "#0f766e");

        logArea = new TextArea();
        logArea.setEditable(true);
        logArea.setWrapText(true);
        logArea.setPrefRowCount(3);
        logArea.setStyle(
            "-fx-control-inner-background: #0f172a;" +
            "-fx-text-fill: #e2e8f0;" +
            "-fx-font-family: 'Consolas', monospace;" +
            "-fx-font-size: 12px;" +
            "-fx-border-color: #334155;" +
            "-fx-border-radius: 4;" +
            "-fx-background-radius: 4;"
        );
        HBox.setHgrow(logArea, Priority.ALWAYS);

        setupAutocomplete(logArea);
        setupLogContextMenu(logArea, stage);

        HBox toolbar = new HBox(8,
                btnUndo, btnRedo, logArea, btnRec, btnPlay, btnAbrirGarra, btnFecharGarra
        );
        toolbar.setPadding(new Insets(8));
        toolbar.setAlignment(Pos.CENTER_LEFT);
        toolbar.setStyle("-fx-background-color: #1e293b; -fx-border-color: #334155; -fx-border-width: 1 0 0 0;");
        toolbar.setMinHeight(80);
        toolbar.setMaxHeight(80);

        setCenter(canvasContainer);
        setBottom(toolbar);
        setStyle("-fx-background-color: #1e293b;");

        btnUndo.setOnAction(e -> desfazer());
        btnRedo.setOnAction(e -> refazer());
        btnRec.setOnAction(e -> toggleRec(stage));
        btnPlay.setOnAction(e -> abrirDialogReproduzir(stage));
        btnAbrirGarra.setOnAction(e -> aplicarGarra(ArmState.GARRA_MAX));
        btnFecharGarra.setOnAction(e -> aplicarGarra(ArmState.GARRA_MIN));

        atualizarBotoes();

        String modoStr = serial.isMock() ? " [SIMULAÇÃO]" : " [SERIAL]";
        adicionarLog("Sistema iniciado" + modoStr + ". Estado: " + estadoInicial);
    }

    // =========================================================================
    // Log
    // =========================================================================

    public void adicionarLog(String msg) {
        String ts = LocalTime.now().format(TIME_FMT);
        Platform.runLater(() -> {
            logArea.appendText("[" + ts + "] " + msg + "\n");
        });
    }

    private void setupAutocomplete(TextArea area) {
        ContextMenu popup = new ContextMenu();
        popup.setStyle("-fx-background-color: #1e293b; -fx-border-color: #334155;");

        // Enter executa a última linha digitada
        area.setOnKeyPressed(e -> {
            if (e.getCode() == KeyCode.ENTER) {
                String text = area.getText();
                if (text.isEmpty()) return;
                String[] lines = text.split("\n");
                String lastLine = lines[lines.length - 1].trim().toLowerCase();
                if (!lastLine.isEmpty() && !lastLine.startsWith("[")) {
                    e.consume();
                    // Remove a última linha (será substituída pela entrada do log)
                    int lastNL = text.lastIndexOf('\n');
                    area.setText(lastNL >= 0 ? text.substring(0, lastNL + 1) : "");
                    area.positionCaret(area.getText().length());
                    popup.hide();
                    executarComando(lastLine);
                }
            }
        });

        area.setOnKeyReleased(e -> {
            String text = area.getText();
            if (text.isEmpty()) { popup.hide(); return; }

            String[] lines = text.split("\n");
            String lastLine = lines[lines.length - 1].trim().toLowerCase();
            if (lastLine.isEmpty() || lastLine.startsWith("[")) { popup.hide(); return; }

            List<MenuItem> items = new ArrayList<>();
            for (String sug : SUGGESTIONS) {
                if (sug.startsWith(lastLine) && !sug.equals(lastLine)) {
                    MenuItem mi = new MenuItem(sug);
                    mi.setStyle("-fx-text-fill: #e2e8f0; -fx-background-color: #1e293b;");
                    mi.setOnAction(ev -> {
                        String antes = text.substring(0, text.lastIndexOf('\n') + 1);
                        area.setText(antes + sug);
                        area.positionCaret(area.getText().length());
                        executarComando(sug);
                        popup.hide();
                    });
                    items.add(mi);
                    if (items.size() >= 6) break;
                }
            }

            if (items.isEmpty()) {
                popup.hide();
            } else {
                popup.getItems().setAll(items);
                if (!popup.isShowing()) popup.show(area, javafx.geometry.Side.TOP, 0, 0);
            }
        });
    }

    private void executarComando(String cmd) {
        cmd = cmd.trim().toLowerCase();
        try {
            if (cmd.equals("home")) {
                ArmState antes = current;
                current = ArmState.inicial();
                armPanel.setState(current);
                pushUndo(antes);
                serial.enviar("home");
                adicionarLog("→ home");

            } else if (cmd.equals("status")) {
                serial.enviar("status");
                adicionarLog("→ status (aguardando resposta do Arduino...)");

            } else if (cmd.equals("ajuda")) {
                serial.enviar("ajuda");
                adicionarLog("→ ajuda");

            } else {
                String[] parts = cmd.split("\\s+");
                if (parts.length == 2) {
                    double val = Double.parseDouble(parts[1]);
                    ArmState antes = current;
                    switch (parts[0]) {
                        case "base"     -> current = current.comBase(val);
                        case "ombro"    -> current = current.comOmbro(val);
                        case "cotovelo" -> current = current.comCotovelo(val);
                        case "garra"    -> current = current.comGarra(val);
                        default -> { adicionarLog("Comando desconhecido: " + cmd); return; }
                    }
                    armPanel.setState(current);
                    pushUndo(antes);
                    serial.enviar(cmd);
                    adicionarLog("→ " + cmd);
                } else {
                    adicionarLog("Sintaxe: SERVO ANGULO  (ex: ombro 90)");
                }
            }
        } catch (NumberFormatException ex) {
            adicionarLog("Valor inválido: " + cmd);
        }
        atualizarBotoes();
    }

    private void setupLogContextMenu(TextArea area, Stage owner) {
        ContextMenu ctx = new ContextMenu();
        MenuItem limpar = new MenuItem("Limpar Log");
        limpar.setStyle("-fx-text-fill: #ef4444;");
        limpar.setOnAction(e -> confirmarLimparLog(owner));
        ctx.getItems().add(limpar);
        area.setContextMenu(ctx);
    }

    private void confirmarLimparLog(Stage owner) {
        Stage dialog = criarDialog(owner, "Limpar Log");

        Label msg = new Label("Deseja limpar o log e as pilhas de desfazer/refazer?");
        msg.setStyle("-fx-text-fill: #e2e8f0; -fx-font-size: 14px;");
        msg.setWrapText(true);

        Button btnCancelar = criarBotaoPrincipal("Cancelar", "#ef4444");
        Button btnConfirmar = criarBotaoPrincipal("Confirmar", "#22c55e");
        btnCancelar.setOnAction(e -> dialog.close());
        btnConfirmar.setOnAction(e -> {
            logArea.clear();
            undoStack.clear();
            redoStack.clear();
            atualizarBotoes();
            dialog.close();
        });

        BorderPane root = montarDialogLayout(msg, btnCancelar, btnConfirmar);
        dialog.setScene(new Scene(root, 400, 160));
        dialog.showAndWait();
    }

    // =========================================================================
    // Undo / Redo
    // =========================================================================

    private void handleDragEnd(ArmState antes, ArmState depois) {
        String jointLog = "";
        String serialCmd = null;

        if (Math.abs(antes.getBase() - depois.getBase()) > 0.5) {
            jointLog  = String.format("Base: %.0f° → %.0f°", antes.getBase(), depois.getBase());
            serialCmd = String.format("base %d", (int) depois.getBase());
        } else if (Math.abs(antes.getOmbro() - depois.getOmbro()) > 0.5) {
            jointLog  = String.format("Ombro: %.0f° → %.0f°", antes.getOmbro(), depois.getOmbro());
            serialCmd = String.format("ombro %d", (int) depois.getOmbro());
        } else if (Math.abs(antes.getCotovelo() - depois.getCotovelo()) > 0.5) {
            jointLog  = String.format("Cotovelo: %.0f° → %.0f°", antes.getCotovelo(), depois.getCotovelo());
            serialCmd = String.format("cotovelo %d", (int) depois.getCotovelo());
        }

        if (serialCmd != null) {
            serial.enviar(serialCmd);
            adicionarLog("→ " + serialCmd);
        }
        if (!jointLog.isEmpty()) adicionarLog(jointLog);

        pushUndo(antes);
        current = depois;
        atualizarBotoes();
    }

    private void pushUndo(ArmState estado) {
        undoStack.push(estado);
        redoStack.clear();
        atualizarBotoes();
    }

    private void desfazer() {
        if (undoStack.isEmpty()) return;
        redoStack.push(current);
        current = undoStack.pop();
        armPanel.setState(current);
        sincronizarSerial();
        adicionarLog("Ação desfeita.");
        atualizarBotoes();
    }

    private void refazer() {
        if (redoStack.isEmpty()) return;
        undoStack.push(current);
        current = redoStack.pop();
        armPanel.setState(current);
        sincronizarSerial();
        adicionarLog("Ação refeita.");
        atualizarBotoes();
    }

    /** Envia o estado atual completo ao Arduino via comando "todos". */
    private void sincronizarSerial() {
        String cmd = String.format("todos %d %d %d %d",
            (int) current.getBase(), (int) current.getOmbro(),
            (int) current.getCotovelo(), (int) current.getGarra());
        serial.enviar(cmd);
    }

    // =========================================================================
    // Garra
    // =========================================================================

    private void aplicarGarra(double angulo) {
        ArmState antes = current;
        current = current.comGarra(angulo);
        armPanel.setState(current);
        pushUndo(antes);
        String acao = (angulo >= ArmState.GARRA_MAX) ? "aberta" : "fechada";
        String cmd  = String.format("garra %d", (int) angulo);
        serial.enviar(cmd);
        adicionarLog("→ " + cmd + "  (" + acao + ")");
        atualizarBotoes();
    }

    // =========================================================================
    // REC
    // =========================================================================

    private void toggleRec(Stage owner) {
        if (!recording) iniciarGravacao();
        else pararGravacao(owner);
    }

    private void iniciarGravacao() {
        recording = true;
        recordBuffer.clear();
        btnRec.setText("⏹ Parar REC");

        recPulse = new Timeline(
            new KeyFrame(Duration.ZERO,          new KeyValue(btnRec.opacityProperty(), 1.0)),
            new KeyFrame(Duration.millis(500),   new KeyValue(btnRec.opacityProperty(), 0.3)),
            new KeyFrame(Duration.millis(1000),  new KeyValue(btnRec.opacityProperty(), 1.0))
        );
        recPulse.setCycleCount(Timeline.INDEFINITE);
        recPulse.play();

        recTimeline = new Timeline(new KeyFrame(Duration.millis(100), e -> recordBuffer.add(current)));
        recTimeline.setCycleCount(Timeline.INDEFINITE);
        recTimeline.play();

        adicionarLog("Gravação iniciada.");
        setBarraDesabilitada(true, true);
    }

    private void pararGravacao(Stage owner) {
        recording = false;
        if (recTimeline != null) recTimeline.stop();
        if (recPulse    != null) recPulse.stop();
        btnRec.setOpacity(1.0);
        btnRec.setText("⏺ REC");
        setBarraDesabilitada(false, false);
        adicionarLog("Gravação encerrada. " + recordBuffer.size() + " frames.");

        if (!recordBuffer.isEmpty()) abrirDialogSalvarSequencia(owner);
    }

    private void abrirDialogSalvarSequencia(Stage owner) {
        Stage dialog = criarDialog(owner, "Salvar Sequência");

        Label lbl = new Label("Nome da sequência:");
        lbl.setStyle("-fx-text-fill: #e2e8f0; -fx-font-size: 13px;");
        TextField tf = new TextField("Sequência " + (sequences.size() + 1));
        tf.setStyle("-fx-background-color: #0f172a; -fx-text-fill: #e2e8f0;" +
                    "-fx-border-color: #334155; -fx-border-radius: 4;");
        tf.setPrefWidth(260);

        VBox content = new VBox(8, lbl, tf);
        content.setAlignment(Pos.CENTER_LEFT);

        Button btnCancelar = criarBotaoPrincipal("Cancelar", "#ef4444");
        Button btnSalvar   = criarBotaoPrincipal("Salvar", "#22c55e");
        btnCancelar.setOnAction(e -> dialog.close());
        btnSalvar.setOnAction(e -> {
            String nome = tf.getText().trim();
            if (nome.isEmpty()) nome = "Sem nome";
            sequences.add(new Sequence(nome, new ArrayList<>(recordBuffer)));
            adicionarLog("Sequência \"" + nome + "\" salva (" + recordBuffer.size() + " frames).");
            dialog.close();
        });

        BorderPane root = montarDialogLayout(content, btnCancelar, btnSalvar);
        dialog.setScene(new Scene(root, 400, 180));
        dialog.showAndWait();
    }

    // =========================================================================
    // Reprodução
    // =========================================================================

    private void abrirDialogReproduzir(Stage owner) {
        if (sequences.isEmpty()) { adicionarLog("Nenhuma sequência salva."); return; }

        Stage dialog = criarDialog(owner, "Reproduzir Sequência");

        Label lbl = new Label("Selecione uma sequência:");
        lbl.setStyle("-fx-text-fill: #e2e8f0; -fx-font-size: 13px;");

        ListView<Sequence> list = new ListView<>(sequences);
        list.setStyle("-fx-background-color: #0f172a; -fx-text-fill: #e2e8f0;" +
                      "-fx-border-color: #334155; -fx-border-radius: 4;");
        list.setPrefHeight(160);
        list.getSelectionModel().selectFirst();
        list.setCellFactory(lv -> new ListCell<>() {
            @Override protected void updateItem(Sequence item, boolean empty) {
                super.updateItem(item, empty);
                setStyle("-fx-background-color: transparent; -fx-text-fill: #e2e8f0;");
                setText(empty || item == null ? "" : item.toString());
            }
        });

        VBox content = new VBox(8, lbl, list);
        Button btnCancelar   = criarBotaoPrincipal("Cancelar", "#ef4444");
        Button btnReproduzir = criarBotaoPrincipal("Reproduzir", "#22c55e");
        btnCancelar.setOnAction(e -> dialog.close());
        btnReproduzir.setOnAction(e -> {
            Sequence sel = list.getSelectionModel().getSelectedItem();
            if (sel != null) { dialog.close(); reproduzirSequencia(sel, owner); }
        });

        BorderPane root = montarDialogLayout(content, btnCancelar, btnReproduzir);
        dialog.setScene(new Scene(root, 440, 320));
        dialog.showAndWait();
    }

    private void reproduzirSequencia(Sequence seq, Stage owner) {
        reproduzindo = true;
        setBarraDesabilitada(true, false);
        btnPlay.setText("⏹ Parar");
        btnPlay.setDisable(false);
        btnPlay.setOnAction(e -> pararReproducao());

        adicionarLog("Reproduzindo: \"" + seq.getNome() + "\" (" + seq.getSnapshots().size() + " frames)...");

        List<ArmState> snapshots = seq.getSnapshots();
        final int[] idx = {0};

        playTimeline = new Timeline(new KeyFrame(Duration.millis(100), e -> {
            if (idx[0] >= snapshots.size()) { pararReproducao(); return; }
            current = snapshots.get(idx[0]++);
            armPanel.setState(current);
            // Envia cada frame ao Arduino
            serial.enviar(String.format("todos %d %d %d %d",
                (int) current.getBase(), (int) current.getOmbro(),
                (int) current.getCotovelo(), (int) current.getGarra()));
        }));
        playTimeline.setCycleCount(snapshots.size() + 1);
        playTimeline.setOnFinished(e -> pararReproducao());
        playTimeline.play();
    }

    private void pararReproducao() {
        reproduzindo = false;
        if (playTimeline != null) playTimeline.stop();
        setBarraDesabilitada(false, false);
        btnPlay.setText("▶ Reproduzir");
        btnPlay.setOnAction(e -> abrirDialogReproduzir(null));
        adicionarLog("Reprodução encerrada.");
        atualizarBotoes();
    }

    // =========================================================================
    // Estado dos botões
    // =========================================================================

    private void atualizarBotoes() {
        btnUndo.setDisable(undoStack.isEmpty());
        btnRedo.setDisable(redoStack.isEmpty());
        btnAbrirGarra.setDisable(current.getGarra() >= ArmState.GARRA_MAX);
        btnFecharGarra.setDisable(current.getGarra() <= ArmState.GARRA_MIN);
        btnPlay.setDisable(sequences.isEmpty() && !reproduzindo);
    }

    private void setBarraDesabilitada(boolean disabled, boolean manterRecAtivo) {
        btnUndo.setDisable(disabled || undoStack.isEmpty());
        btnRedo.setDisable(disabled || redoStack.isEmpty());
        btnAbrirGarra.setDisable(disabled);
        btnFecharGarra.setDisable(disabled);
        if (!manterRecAtivo) btnPlay.setDisable(disabled || sequences.isEmpty());
    }

    // =========================================================================
    // Helpers de UI
    // =========================================================================

    private Button criarBotao(String texto, String tooltip) {
        Button b = new Button(texto);
        b.setTooltip(new Tooltip(tooltip));
        b.setStyle(
            "-fx-background-color: #334155;" +
            "-fx-text-fill: #e2e8f0;" +
            "-fx-font-size: 16px;" +
            "-fx-padding: 6 10;" +
            "-fx-cursor: hand;" +
            "-fx-background-radius: 6;"
        );
        b.setOnMouseEntered(e -> b.setStyle(b.getStyle().replace("#334155", "#475569")));
        b.setOnMouseExited(e  -> b.setStyle(b.getStyle().replace("#475569", "#334155")));
        return b;
    }

    private Button criarBotaoPrincipal(String texto, String cor) {
        Button b = new Button(texto);
        b.setStyle(
            "-fx-background-color: " + cor + ";" +
            "-fx-text-fill: #ffffff;" +
            "-fx-font-size: 13px;" +
            "-fx-font-weight: bold;" +
            "-fx-padding: 6 12;" +
            "-fx-cursor: hand;" +
            "-fx-background-radius: 6;"
        );
        return b;
    }

    private Stage criarDialog(Stage owner, String titulo) {
        Stage dialog = new Stage();
        dialog.initModality(Modality.APPLICATION_MODAL);
        if (owner != null) dialog.initOwner(owner);
        dialog.setTitle(titulo);
        dialog.setResizable(false);
        return dialog;
    }

    private BorderPane montarDialogLayout(javafx.scene.Node content, Button btnEsq, Button btnDir) {
        BorderPane root = new BorderPane();
        root.setStyle("-fx-background-color: #1e293b;");
        root.setPadding(new Insets(20));
        root.setCenter(content);

        HBox footer = new HBox();
        footer.setPadding(new Insets(16, 0, 0, 0));
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        footer.getChildren().addAll(btnEsq, spacer, btnDir);
        root.setBottom(footer);
        return root;
    }
}
