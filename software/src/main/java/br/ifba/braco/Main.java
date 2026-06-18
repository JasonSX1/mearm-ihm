package br.ifba.braco;

import br.ifba.braco.model.ArmState;
import br.ifba.braco.view.MainWindow;
import javafx.animation.KeyFrame;
import javafx.animation.Timeline;
import javafx.application.Application;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.scene.layout.*;
import javafx.scene.paint.Color;
import javafx.stage.Modality;
import javafx.stage.Stage;
import javafx.util.Duration;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Ponto de entrada — exibe o diálogo de conexão antes da janela principal.
 */
public class Main extends Application {

    @Override
    public void start(Stage primaryStage) {
        mostrarDialogConexao(primaryStage);
    }

    private void mostrarDialogConexao(Stage primaryStage) {
        Stage dialog = new Stage();
        dialog.setTitle("MeArm — Conectar");
        dialog.setResizable(false);
        dialog.initModality(Modality.APPLICATION_MODAL);

        // ---- Layout ----
        VBox root = new VBox(12);
        root.setPadding(new Insets(24));
        root.setStyle("-fx-background-color: #1e293b;");
        root.setAlignment(Pos.TOP_LEFT);
        root.setPrefWidth(360);

        Label titulo = new Label("Braço Robótico MeArm");
        titulo.setStyle("-fx-text-fill: #e2e8f0; -fx-font-size: 18px; -fx-font-weight: bold;");

        Separator sep = new Separator();
        sep.setStyle("-fx-background-color: #334155;");

        Label lblPorta = new Label("Porta serial do Arduino:");
        lblPorta.setStyle("-fx-text-fill: #94a3b8; -fx-font-size: 13px;");

        String[] portas = SerialManager.listarPortas();
        ComboBox<String> comboCom = new ComboBox<>();
        comboCom.setStyle(
            "-fx-background-color: #0f172a; -fx-text-fill: #e2e8f0;" +
            "-fx-border-color: #334155; -fx-border-radius: 4;");
        comboCom.setPrefWidth(280);

        if (portas.length > 0) {
            comboCom.getItems().addAll(portas);
            boolean hasCom4 = false;
            for (String p : portas) if (p.equalsIgnoreCase("COM4")) { hasCom4 = true; break; }
            comboCom.setValue(hasCom4 ? "COM4" : portas[0]);
        } else {
            comboCom.getItems().add("Nenhuma porta encontrada");
            comboCom.setValue("Nenhuma porta encontrada");
        }

        Button btnAtualizar = new Button("↻ Atualizar portas");
        btnAtualizar.setStyle(
            "-fx-background-color: #334155; -fx-text-fill: #e2e8f0;" +
            "-fx-font-size: 12px; -fx-padding: 4 10; -fx-cursor: hand; -fx-background-radius: 4;");
        btnAtualizar.setOnAction(e -> {
            String[] novas = SerialManager.listarPortas();
            comboCom.getItems().clear();
            if (novas.length > 0) {
                comboCom.getItems().addAll(novas);
                comboCom.setValue(novas[0]);
            } else {
                comboCom.getItems().add("Nenhuma porta encontrada");
                comboCom.setValue("Nenhuma porta encontrada");
            }
        });

        Label lblStatus = new Label("Selecione a porta e conecte.");
        lblStatus.setStyle("-fx-text-fill: #64748b; -fx-font-size: 12px;");
        lblStatus.setWrapText(true);
        lblStatus.setMaxWidth(310);

        Button btnConectar = new Button("Conectar");
        btnConectar.setStyle(
            "-fx-background-color: #22c55e; -fx-text-fill: white;" +
            "-fx-font-size: 14px; -fx-font-weight: bold;" +
            "-fx-padding: 8 24; -fx-cursor: hand; -fx-background-radius: 6;");

        Button btnMock = new Button("Modo Simulação (sem Arduino)");
        btnMock.setStyle(
            "-fx-background-color: #334155; -fx-text-fill: #94a3b8;" +
            "-fx-font-size: 12px; -fx-padding: 6 14; -fx-cursor: hand; -fx-background-radius: 6;");

        HBox botoesBox = new HBox(10, btnConectar, btnMock);
        botoesBox.setAlignment(Pos.CENTER_LEFT);

        root.getChildren().addAll(titulo, sep, lblPorta, comboCom, btnAtualizar, lblStatus, botoesBox);

        Scene scene = new Scene(root, 360, 260);
        scene.setFill(Color.web("#1e293b"));
        dialog.setScene(scene);

        // ---- Lógica ----
        SerialManager serial = new SerialManager();
        AtomicReference<ArmState> estadoInicial = new AtomicReference<>(ArmState.inicial());

        btnMock.setOnAction(e -> {
            serial.ativarMock();
            dialog.close();
            abrirJanelaPrincipal(primaryStage, serial, estadoInicial.get());
        });

        btnConectar.setOnAction(e -> {
            String porta = comboCom.getValue();
            if (porta == null || porta.startsWith("Nenhuma")) {
                setStatus(lblStatus, "⚠ Nenhuma porta disponível.", "#f97316");
                return;
            }

            btnConectar.setDisable(true);
            btnMock.setDisable(true);
            comboCom.setDisable(true);
            btnAtualizar.setDisable(true);
            setStatus(lblStatus, "Conectando em " + porta + "...", "#fbbf24");

            // Acumulador dos valores de status
            AtomicInteger[] vals = {
                new AtomicInteger(-1), // base
                new AtomicInteger(-1), // ombro
                new AtomicInteger(-1), // cotovelo
                new AtomicInteger(-1)  // garra
            };

            boolean[] janelaAberta = {false};

            boolean ok = serial.conectar(porta, linha -> {
                if (janelaAberta[0]) return;

                // Parsear resposta do "status"
                if (linha.startsWith("Base:"))     vals[0].set(parseInt(linha));
                if (linha.startsWith("Ombro:"))    vals[1].set(parseInt(linha));
                if (linha.startsWith("Cotovelo:")) vals[2].set(parseInt(linha));
                if (linha.startsWith("Garra:"))    vals[3].set(parseInt(linha));

                if (vals[0].get() >= 0 && vals[1].get() >= 0 &&
                    vals[2].get() >= 0 && vals[3].get() >= 0) {

                    estadoInicial.set(new ArmState(
                        vals[0].get(), vals[1].get(),
                        vals[2].get(), vals[3].get()
                    ));
                    setStatus(lblStatus, "✓ Estado lido. Abrindo...", "#22c55e");
                    janelaAberta[0] = true;
                    new Timeline(new KeyFrame(Duration.millis(500), ev -> {
                        dialog.close();
                        abrirJanelaPrincipal(primaryStage, serial, estadoInicial.get());
                    })).play();
                }
            });

            if (!ok) {
                setStatus(lblStatus, "✗ Falha em " + porta + ". Verifique a porta e o cabo.", "#ef4444");
                btnConectar.setDisable(false);
                btnMock.setDisable(false);
                comboCom.setDisable(false);
                btnAtualizar.setDisable(false);
                return;
            }

            setStatus(lblStatus, "Aguardando Arduino inicializar...", "#60a5fa");

            // Espera 1,5s antes de pedir status (Arduino reinicia ao conectar)
            new Timeline(new KeyFrame(Duration.millis(1500), ev -> {
                if (!janelaAberta[0]) {
                    setStatus(lblStatus, "Lendo estado do braço...", "#60a5fa");
                    serial.enviar("status");
                }
            })).play();

            // Timeout de 6s — abre com estado padrão se não receber resposta
            new Timeline(new KeyFrame(Duration.seconds(6), ev -> {
                if (!janelaAberta[0]) {
                    janelaAberta[0] = true;
                    setStatus(lblStatus, "Sem resposta — abrindo com estado padrão.", "#f97316");
                    new Timeline(new KeyFrame(Duration.millis(800), ev2 -> {
                        dialog.close();
                        abrirJanelaPrincipal(primaryStage, serial, estadoInicial.get());
                    })).play();
                }
            })).play();
        });

        dialog.show();
    }

    private void setStatus(Label lbl, String txt, String cor) {
        lbl.setText(txt);
        lbl.setStyle("-fx-text-fill: " + cor + "; -fx-font-size: 12px;");
    }

    private int parseInt(String linha) {
        try {
            return Integer.parseInt(linha.substring(linha.indexOf(':') + 1).trim());
        } catch (Exception e) {
            return -1;
        }
    }

    private void abrirJanelaPrincipal(Stage stage, SerialManager serial, ArmState estadoInicial) {
        MainWindow mainWindow = new MainWindow(stage, serial, estadoInicial);

        Scene scene = new Scene(mainWindow, 900, 650);
        scene.setFill(Color.web("#1e293b"));

        stage.setTitle("IHM — Braço Robótico MeArm");
        stage.setScene(scene);
        stage.setMinWidth(700);
        stage.setMinHeight(500);
        stage.setOnCloseRequest(e -> serial.desconectar());
        stage.show();
    }

    public static void main(String[] args) {
        launch(args);
    }
}
