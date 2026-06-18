package br.ifba.braco;

import com.fazecast.jSerialComm.SerialPort;
import javafx.application.Platform;

import java.io.*;
import java.util.function.Consumer;

/**
 * Gerencia a comunicação serial com o Arduino.
 * Suporta modo mock para uso sem hardware.
 */
public class SerialManager {

    private SerialPort port;
    private volatile Consumer<String> onLine;
    private boolean mock = false;

    /** Lista as portas COM disponíveis no sistema. */
    public static String[] listarPortas() {
        SerialPort[] ports = SerialPort.getCommPorts();
        String[] nomes = new String[ports.length];
        for (int i = 0; i < ports.length; i++) {
            nomes[i] = ports[i].getSystemPortName();
        }
        return nomes;
    }

    /**
     * Conecta à porta serial.
     * @param portName  ex: "COM4"
     * @param lineCallback chamado na thread JavaFX para cada linha recebida do Arduino
     * @return true se conectou com sucesso
     */
    public boolean conectar(String portName, Consumer<String> lineCallback) {
        this.onLine = lineCallback;

        port = SerialPort.getCommPort(portName);
        port.setComPortParameters(9600, 8, 1, SerialPort.NO_PARITY);
        port.setComPortTimeouts(SerialPort.TIMEOUT_READ_SEMI_BLOCKING, 0, 0);

        if (!port.openPort()) return false;

        Thread reader = new Thread(() -> {
            try (BufferedReader br = new BufferedReader(
                    new InputStreamReader(port.getInputStream()))) {
                String line;
                while (port.isOpen() && (line = br.readLine()) != null) {
                    final String l = line.trim();
                    if (!l.isEmpty()) {
                        Consumer<String> cb = onLine;
                        if (cb != null) Platform.runLater(() -> cb.accept(l));
                    }
                }
            } catch (IOException ignored) {}
        });
        reader.setDaemon(true);
        reader.start();

        return true;
    }

    /** Troca o callback de linhas recebidas (útil após abrir a janela principal). */
    public void setLineCallback(Consumer<String> callback) {
        this.onLine = callback;
    }

    /** Ativa o modo simulação — sem porta real, apenas imprime comandos no console. */
    public void ativarMock() {
        this.mock = true;
    }

    public boolean isMock() { return mock; }

    /**
     * Envia um comando ao Arduino (acrescenta '\n').
     * Em modo mock, imprime no console.
     */
    public void enviar(String comando) {
        if (mock) {
            System.out.println("MOCK → " + comando);
            return;
        }
        if (port == null || !port.isOpen()) return;
        try {
            OutputStream out = port.getOutputStream();
            out.write((comando + "\n").getBytes());
            out.flush();
        } catch (IOException e) {
            System.err.println("Erro ao enviar serial: " + e.getMessage());
        }
    }

    public void desconectar() {
        if (port != null && port.isOpen()) port.closePort();
    }

    public boolean isConectado() {
        return mock || (port != null && port.isOpen());
    }
}
