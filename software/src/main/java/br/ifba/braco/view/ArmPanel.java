package br.ifba.braco.view;

import br.ifba.braco.model.ArmState;
import javafx.animation.KeyFrame;
import javafx.animation.Timeline;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;
import javafx.scene.shape.StrokeLineCap;
import javafx.scene.Cursor;
import javafx.util.Duration;

import java.util.function.BiConsumer;
import java.util.function.Consumer;

/**
 * Canvas interativo que renderiza o braço robótico MeArm.
 * Suporta drag nas juntas de ombro, cotovelo e base.
 */
public class ArmPanel extends Canvas {

    // Cores
    private static final Color BG_COLOR      = Color.web("#0f172a");
    private static final Color ARM_COLOR     = Color.web("#e2e8f0");
    private static final Color JOINT_FILL    = Color.WHITE;
    private static final Color JOINT_STROKE  = Color.web("#3b82f6");
    private static final Color JOINT_ACTIVE  = Color.web("#fbbf24");
    private static final Color JOINT_LIMIT   = Color.web("#ef4444");

    private static final double JOINT_RADIUS      = 12;
    private static final double BASE_RADIUS        = 22;
    private static final double HOVER_RADIUS       = 20;
    private static final double ARM_WIDTH          = 6;

    // Estado atual do braço
    private ArmState state;

    // Qual junta está sendo arrastada
    private enum DragTarget { NONE, BASE, OMBRO, COTOVELO }
    private DragTarget dragging = DragTarget.NONE;
    private DragTarget hovering = DragTarget.NONE;

    // Ângulo antes do drag (para log de undo)
    private double angleBefore;

    // Piscar vermelho ao atingir limite
    private boolean baseFlash     = false;
    private boolean ombroFlash    = false;
    private boolean cotoveloFlash = false;
    private Timeline flashTimeline;

    // Posição do mouse (para tooltip durante drag)
    private double mouseX, mouseY;

    // Callbacks para a janela principal
    private Consumer<String>             onLog;
    private Consumer<ArmState>           onStateChange;
    private BiConsumer<ArmState, ArmState> onDragEnd; // (antes, depois)

    public ArmPanel(double width, double height) {
        super(width, height);
        state = ArmState.inicial();
        setupInteraction();
        draw();
    }

    public void setState(ArmState newState) {
        this.state = newState;
        draw();
    }

    public ArmState getState() { return state; }

    public void setOnLog(Consumer<String> cb)                       { this.onLog = cb; }
    public void setOnStateChange(Consumer<ArmState> cb)             { this.onStateChange = cb; }
    public void setOnDragEnd(BiConsumer<ArmState, ArmState> cb)     { this.onDragEnd = cb; }

    // -------------------------------------------------------------------------
    // Kinematics — coordenadas de tela
    // -------------------------------------------------------------------------

    private double bx()     { return getWidth() * 0.2; }
    private double by()     { return getHeight() * 0.78; }
    private double arm1()   { return getHeight() * 0.28; }
    private double arm2()   { return getHeight() * 0.25; }

    private double ombroRad()    { return Math.toRadians(state.getOmbro()); }
    private double cotoveloRad() { return Math.toRadians(state.getCotovelo()); }

    private double shoulderX() { return bx() + arm1() * Math.cos(ombroRad()); }
    private double shoulderY() { return by() - arm1() * Math.sin(ombroRad()); }

    private double elbowX() { return shoulderX() + arm2() * Math.cos(cotoveloRad()); }
    private double elbowY() { return shoulderY() - arm2() * Math.sin(cotoveloRad()); }

    // -------------------------------------------------------------------------
    // Renderização
    // -------------------------------------------------------------------------

    public void draw() {
        GraphicsContext gc = getGraphicsContext2D();
        double w = getWidth();
        double h = getHeight();

        // Fundo
        gc.setFill(BG_COLOR);
        gc.fillRect(0, 0, w, h);

        // Grade sutil
        drawGrid(gc, w, h);

        // Coordenadas das juntas
        double bx = bx(), by = by();
        double sx = shoulderX(), sy = shoulderY();
        double ex = elbowX(),   ey = elbowY();

        // Segmento 1: base → ombro
        drawSegment(gc, bx, by, sx, sy);

        // Segmento 2: ombro → cotovelo (garra)
        drawSegment(gc, sx, sy, ex, ey);

        // Garra na ponta do segmento 2
        drawGarra(gc, sx, sy, ex, ey);

        // Junta base
        drawBase(gc, bx, by);

        // Junta ombro
        drawJoint(gc, sx, sy, DragTarget.OMBRO);

        // Junta cotovelo
        drawJoint(gc, ex, ey, DragTarget.COTOVELO);

        // Tooltip durante drag
        if (dragging != DragTarget.NONE) {
            drawTooltip(gc);
        }
    }

    private void drawGrid(GraphicsContext gc, double w, double h) {
        gc.setStroke(Color.web("#1e293b"));
        gc.setLineWidth(1);
        double spacing = 40;
        for (double x = 0; x < w; x += spacing) {
            gc.strokeLine(x, 0, x, h);
        }
        for (double y = 0; y < h; y += spacing) {
            gc.strokeLine(0, y, w, y);
        }
    }

    private void drawSegment(GraphicsContext gc, double x1, double y1, double x2, double y2) {
        gc.setStroke(ARM_COLOR);
        gc.setLineWidth(ARM_WIDTH);
        gc.setLineCap(StrokeLineCap.ROUND);
        gc.strokeLine(x1, y1, x2, y2);
    }

    private void drawBase(GraphicsContext gc, double bx, double by) {
        // Círculo maior da base
        boolean isFlash   = baseFlash;
        boolean isHover   = hovering == DragTarget.BASE;
        boolean isDrag    = dragging == DragTarget.BASE;

        Color stroke = isFlash ? JOINT_LIMIT : (isDrag ? JOINT_ACTIVE : (isHover ? JOINT_ACTIVE : JOINT_STROKE));
        double radius = BASE_RADIUS;

        // Plataforma (elipse achatada)
        gc.setFill(Color.web("#334155"));
        gc.fillOval(bx - radius * 1.6, by - radius * 0.5, radius * 3.2, radius);
        gc.setStroke(stroke);
        gc.setLineWidth(isDrag || isHover ? 3 : 2);
        gc.strokeOval(bx - radius * 1.6, by - radius * 0.5, radius * 3.2, radius);

        // Círculo central da base
        gc.setFill(JOINT_FILL);
        gc.fillOval(bx - radius, by - radius, radius * 2, radius * 2);
        gc.setStroke(stroke);
        gc.setLineWidth(isDrag || isHover ? 3 : 2);
        gc.strokeOval(bx - radius, by - radius, radius * 2, radius * 2);

        // Linha indicadora de ângulo da base
        double baseRad = Math.toRadians(state.getBase());
        double indicLen = radius * 0.75;
        gc.setStroke(isDrag || isHover ? JOINT_ACTIVE : Color.web("#64748b"));
        gc.setLineWidth(2);
        gc.strokeLine(bx, by,
                bx + indicLen * Math.cos(baseRad),
                by - indicLen * Math.sin(baseRad));

        // Rótulo
        gc.setFill(Color.web("#94a3b8"));
        gc.fillText("Base", bx + radius + 4, by + 4);
    }

    private void drawJoint(GraphicsContext gc, double x, double y, DragTarget target) {
        boolean isFlash = (target == DragTarget.OMBRO && ombroFlash)
                       || (target == DragTarget.COTOVELO && cotoveloFlash);
        boolean isHover = hovering == target;
        boolean isDrag  = dragging == target;

        Color stroke = isFlash ? JOINT_LIMIT : (isDrag ? JOINT_ACTIVE : (isHover ? JOINT_ACTIVE : JOINT_STROKE));
        double r = JOINT_RADIUS;

        // Sombra sutil
        gc.setFill(Color.web("#0f172a", 0.5));
        gc.fillOval(x - r - 2, y - r + 2, (r + 2) * 2, (r + 2) * 2);

        gc.setFill(isDrag ? Color.web("#fef3c7") : JOINT_FILL);
        gc.fillOval(x - r, y - r, r * 2, r * 2);
        gc.setStroke(stroke);
        gc.setLineWidth(isDrag || isHover ? 3 : 2);
        gc.strokeOval(x - r, y - r, r * 2, r * 2);

        // Ponto central
        gc.setFill(stroke);
        gc.fillOval(x - 3, y - 3, 6, 6);

        // Rótulo
        gc.setFill(Color.web("#94a3b8"));
        String label = (target == DragTarget.OMBRO) ? "Ombro" : "Cotovelo";
        gc.fillText(label, x + r + 4, y + 4);
    }

    private void drawGarra(GraphicsContext gc, double sx, double sy, double ex, double ey) {
        // Direção do segmento 2
        double dx = ex - sx, dy = ey - sy;
        double len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return;
        double ux = dx / len, uy = dy / len;

        double garraAng = Math.toRadians(state.getGarra());
        double garraLen = getHeight() * 0.09;

        gc.setStroke(ARM_COLOR);
        gc.setLineWidth(4);
        gc.setLineCap(StrokeLineCap.ROUND);

        // Tenaz superior
        double spread = garraAng * 0.5; // quanto abre
        double angUp   = Math.atan2(uy, ux) - spread;
        double angDown = Math.atan2(uy, ux) + spread;

        // Arco da tenaz superior
        drawTenaz(gc, ex, ey, angUp, garraLen, 1);
        // Arco da tenaz inferior
        drawTenaz(gc, ex, ey, angDown, garraLen, -1);
    }

    private void drawTenaz(GraphicsContext gc, double ex, double ey,
                            double baseAngle, double length, int side) {
        // Desenha tenaz como linha curva (bezier) simulando pinça
        double tipX = ex + length * Math.cos(baseAngle);
        double tipY = ey + length * Math.sin(baseAngle);

        // Ponto de controle perpendicular à direção
        double perpX = -Math.sin(baseAngle) * side * length * 0.3;
        double perpY =  Math.cos(baseAngle) * side * length * 0.3;
        double ctrlX = ex + length * 0.5 * Math.cos(baseAngle) + perpX;
        double ctrlY = ey + length * 0.5 * Math.sin(baseAngle) + perpY;

        gc.beginPath();
        gc.moveTo(ex, ey);
        gc.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
        gc.stroke();
    }

    private void drawTooltip(GraphicsContext gc) {
        String text;
        if (dragging == DragTarget.BASE) {
            text = String.format("Base: %.0f\u00b0", state.getBase());
        } else if (dragging == DragTarget.OMBRO) {
            text = String.format("Ombro: %.0f\u00b0", state.getOmbro());
        } else if (dragging == DragTarget.COTOVELO) {
            text = String.format("Cotovelo: %.0f\u00b0", state.getCotovelo());
        } else {
            return;
        }

        double tx = mouseX + 14;
        double ty = mouseY - 8;
        double tw = text.length() * 7.5 + 10;
        double th = 22;

        // Clampar para não sair do canvas
        if (tx + tw > getWidth())  tx = mouseX - tw - 6;
        if (ty - th < 0)           ty = mouseY + 22;

        gc.setFill(Color.web("#1e293b", 0.92));
        gc.fillRoundRect(tx, ty - th + 4, tw, th, 6, 6);
        gc.setStroke(Color.web("#3b82f6"));
        gc.setLineWidth(1);
        gc.strokeRoundRect(tx, ty - th + 4, tw, th, 6, 6);
        gc.setFill(Color.WHITE);
        gc.fillText(text, tx + 5, ty + 1);
    }

    // -------------------------------------------------------------------------
    // Interação — mouse
    // -------------------------------------------------------------------------

    private void setupInteraction() {
        setOnMouseMoved(e -> {
            mouseX = e.getX();
            mouseY = e.getY();
            DragTarget hit = hitTest(e.getX(), e.getY());
            if (hit != hovering) {
                hovering = hit;
                setCursor(hit != DragTarget.NONE ? Cursor.CROSSHAIR : Cursor.DEFAULT);
                draw();
            }
        });

        setOnMousePressed(e -> {
            DragTarget hit = hitTest(e.getX(), e.getY());
            if (hit != DragTarget.NONE) {
                dragging = hit;
                angleBefore = currentAngle(hit);
                draw();
            }
        });

        setOnMouseDragged(e -> {
            if (dragging == DragTarget.NONE) return;
            mouseX = e.getX();
            mouseY = e.getY();

            double newAngle = computeAngle(dragging, e.getX(), e.getY());
            applyAngle(dragging, newAngle);
            draw();
        });

        setOnMouseReleased(e -> {
            if (dragging == DragTarget.NONE) return;
            double angleAfter = currentAngle(dragging);
            DragTarget released = dragging;
            dragging = DragTarget.NONE;

            // Notifica fim do drag com ângulos antes e depois
            if (Math.abs(angleAfter - angleBefore) > 0.5 && onDragEnd != null) {
                ArmState before = stateWithAngle(released, angleBefore);
                onDragEnd.accept(before, state);
            }

            hovering = hitTest(e.getX(), e.getY());
            draw();
        });
    }

    /** Retorna qual junta está sob o ponto (x, y). */
    private DragTarget hitTest(double x, double y) {
        if (dist(x, y, bx(), by()) <= HOVER_RADIUS + BASE_RADIUS) return DragTarget.BASE;
        if (dist(x, y, shoulderX(), shoulderY()) <= HOVER_RADIUS)  return DragTarget.OMBRO;
        if (dist(x, y, elbowX(), elbowY()) <= HOVER_RADIUS)        return DragTarget.COTOVELO;
        return DragTarget.NONE;
    }

    private double dist(double x1, double y1, double x2, double y2) {
        double dx = x1 - x2, dy = y1 - y2;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /** Calcula o ângulo a partir da posição do mouse para a junta em drag. */
    private double computeAngle(DragTarget target, double mx, double my) {
        if (target == DragTarget.BASE || target == DragTarget.OMBRO) {
            return Math.toDegrees(Math.atan2(-(my - by()), mx - bx()));
        } else if (target == DragTarget.COTOVELO) {
            return Math.toDegrees(Math.atan2(-(my - shoulderY()), mx - shoulderX()));
        }
        return 0;
    }

    /** Aplica ângulo à junta, respeitando limites e disparando flash se necessário. */
    private void applyAngle(DragTarget target, double angle) {
        if (target == DragTarget.NONE) return;

        if (target == DragTarget.BASE) {
            if ((angle <= ArmState.BASE_MIN || angle >= ArmState.BASE_MAX) && !baseFlash)
                flashJoint(DragTarget.BASE);
            state = state.comBase(angle);
        } else if (target == DragTarget.OMBRO) {
            if ((angle <= ArmState.OMBRO_MIN || angle >= ArmState.OMBRO_MAX) && !ombroFlash)
                flashJoint(DragTarget.OMBRO);
            state = state.comOmbro(angle);
        } else if (target == DragTarget.COTOVELO) {
            if ((angle <= ArmState.COTOVELO_MIN || angle >= ArmState.COTOVELO_MAX) && !cotoveloFlash)
                flashJoint(DragTarget.COTOVELO);
            state = state.comCotovelo(angle);
        } else {
            return;
        }

        if (onStateChange != null) onStateChange.accept(state);

        // Mock serial durante drag
        String jointName = target.name().substring(0, 1) + target.name().substring(1).toLowerCase();
        System.out.println("MOCK SERIAL: " + jointName + ":" + String.format("%.0f", currentAngle(target)));
    }

    /** Dispara o flash vermelho na junta por 500ms. */
    private void flashJoint(DragTarget target) {
        setFlash(target, true);
        if (flashTimeline != null) flashTimeline.stop();
        flashTimeline = new Timeline(new KeyFrame(Duration.millis(500), e -> {
            setFlash(target, false);
            draw();
        }));
        flashTimeline.play();
    }

    private void setFlash(DragTarget target, boolean val) {
        if (target == DragTarget.BASE)          baseFlash     = val;
        else if (target == DragTarget.OMBRO)    ombroFlash    = val;
        else if (target == DragTarget.COTOVELO) cotoveloFlash = val;
    }

    private double currentAngle(DragTarget target) {
        if (target == DragTarget.BASE)     return state.getBase();
        if (target == DragTarget.OMBRO)    return state.getOmbro();
        if (target == DragTarget.COTOVELO) return state.getCotovelo();
        return 0;
    }

    /** Cria um ArmState com o ângulo da junta substituído por 'angle'. */
    private ArmState stateWithAngle(DragTarget target, double angle) {
        if (target == DragTarget.BASE)     return state.comBase(angle);
        if (target == DragTarget.OMBRO)    return state.comOmbro(angle);
        if (target == DragTarget.COTOVELO) return state.comCotovelo(angle);
        return state;
    }
}
