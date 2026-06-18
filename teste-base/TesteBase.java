import javax.swing.*;
import java.awt.*;
import java.io.*;
import java.util.*;

/**
 * Controle simples da base do MeArm via serial.
 * Compilar:  javac TesteBase.java
 * Rodar:     java TesteBase
 */
public class TesteBase extends JFrame {

    private OutputStream serialOut;
    private JLabel lblAngulo;
    private JSlider slider;
    private JComboBox<String> comboCom;
    private JButton btnConectar;
    private boolean conectado = false;

    public TesteBase() {
        super("Teste Base — MeArm");
        setDefaultCloseOperation(EXIT_ON_CLOSE);
        setSize(420, 220);
        setLocationRelativeTo(null);
        setLayout(new BorderLayout(10, 10));

        // Painel topo: porta COM
        JPanel topPanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        topPanel.add(new JLabel("Porta:"));
        String[] portas = {"COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8"};
        comboCom = new JComboBox<>(portas);
        comboCom.setSelectedItem("COM4");
        topPanel.add(comboCom);
        btnConectar = new JButton("Conectar");
        btnConectar.addActionListener(e -> toggleConexao());
        topPanel.add(btnConectar);
        add(topPanel, BorderLayout.NORTH);

        // Painel central: slider
        JPanel centerPanel = new JPanel(new BorderLayout(5, 5));
        centerPanel.setBorder(BorderFactory.createEmptyBorder(5, 15, 5, 15));

        lblAngulo = new JLabel("90°", SwingConstants.CENTER);
        lblAngulo.setFont(new Font("SansSerif", Font.BOLD, 28));
        centerPanel.add(lblAngulo, BorderLayout.NORTH);

        slider = new JSlider(0, 180, 90);
        slider.setMajorTickSpacing(45);
        slider.setMinorTickSpacing(15);
        slider.setPaintTicks(true);
        slider.setPaintLabels(true);
        slider.setEnabled(false);
        slider.addChangeListener(e -> {
            int val = slider.getValue();
            lblAngulo.setText(val + "°");
            if (!slider.getValueIsAdjusting() && conectado) {
                enviarAngulo(val);
            }
        });
        centerPanel.add(slider, BorderLayout.CENTER);
        add(centerPanel, BorderLayout.CENTER);

        // Painel baixo: botão home
        JPanel botPanel = new JPanel();
        JButton btnHome = new JButton("Home (90°)");
        btnHome.addActionListener(e -> {
            slider.setValue(90);
            enviarAngulo(90);
        });
        botPanel.add(btnHome);
        add(botPanel, BorderLayout.SOUTH);
    }

    private void toggleConexao() {
        if (conectado) {
            desconectar();
        } else {
            conectar();
        }
    }

    private void conectar() {
        String porta = (String) comboCom.getSelectedItem();
        try {
            // Abre a porta serial no Windows via modo COM
            ProcessBuilder pb = new ProcessBuilder("cmd", "/c", "mode " + porta + ": BAUD=9600 PARITY=N DATA=8 STOP=1");
            pb.start().waitFor();

            // Abre stream de escrita
            serialOut = new FileOutputStream("\\\\.\\" + porta);
            conectado = true;
            slider.setEnabled(true);
            btnConectar.setText("Desconectar");
            comboCom.setEnabled(false);
            JOptionPane.showMessageDialog(this, "Conectado em " + porta);
        } catch (Exception ex) {
            JOptionPane.showMessageDialog(this, "Erro ao conectar: " + ex.getMessage(),
                    "Erro", JOptionPane.ERROR_MESSAGE);
        }
    }

    private void desconectar() {
        try {
            if (serialOut != null) serialOut.close();
        } catch (Exception ignored) {}
        serialOut = null;
        conectado = false;
        slider.setEnabled(false);
        btnConectar.setText("Conectar");
        comboCom.setEnabled(true);
    }

    private void enviarAngulo(int angulo) {
        if (serialOut == null) return;
        try {
            String cmd = angulo + "\n";
            serialOut.write(cmd.getBytes());
            serialOut.flush();
        } catch (Exception ex) {
            JOptionPane.showMessageDialog(this, "Erro serial: " + ex.getMessage(),
                    "Erro", JOptionPane.ERROR_MESSAGE);
            desconectar();
        }
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> new TesteBase().setVisible(true));
    }
}
