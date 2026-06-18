package br.ifba.braco.model;

/**
 * Estado imutável das quatro articulações do braço MeArm.
 * Todos os ângulos em graus.
 */
public final class ArmState {

    // Limites das articulações
    public static final double BASE_MIN      = 0;
    public static final double BASE_MAX      = 180;
    public static final double OMBRO_MIN     = 30;
    public static final double OMBRO_MAX     = 150;
    public static final double COTOVELO_MIN  = 0;
    public static final double COTOVELO_MAX  = 135;
    public static final double GARRA_MIN     = 0;
    public static final double GARRA_MAX     = 90;

    private final double base;
    private final double ombro;
    private final double cotovelo;
    private final double garra;

    /** Cria estado com a pose "L invertido" inicial. */
    public static ArmState inicial() {
        return new ArmState(90, 90, 0, 0);
    }

    public ArmState(double base, double ombro, double cotovelo, double garra) {
        this.base      = clamp(base,      BASE_MIN,     BASE_MAX);
        this.ombro     = clamp(ombro,     OMBRO_MIN,    OMBRO_MAX);
        this.cotovelo  = clamp(cotovelo,  COTOVELO_MIN, COTOVELO_MAX);
        this.garra     = clamp(garra,     GARRA_MIN,    GARRA_MAX);
    }

    public double getBase()     { return base; }
    public double getOmbro()    { return ombro; }
    public double getCotovelo() { return cotovelo; }
    public double getGarra()    { return garra; }

    /** Retorna cópia com novo valor de base. */
    public ArmState comBase(double novaBase) {
        return new ArmState(novaBase, ombro, cotovelo, garra);
    }

    /** Retorna cópia com novo valor de ombro. */
    public ArmState comOmbro(double novoOmbro) {
        return new ArmState(base, novoOmbro, cotovelo, garra);
    }

    /** Retorna cópia com novo valor de cotovelo. */
    public ArmState comCotovelo(double novoCotovelo) {
        return new ArmState(base, ombro, novoCotovelo, garra);
    }

    /** Retorna cópia com novo valor de garra. */
    public ArmState comGarra(double novaGarra) {
        return new ArmState(base, ombro, cotovelo, novaGarra);
    }

    /** Verifica se o valor de base está no limite. */
    public boolean baseNoLimite(double val) {
        return val <= BASE_MIN || val >= BASE_MAX;
    }

    public boolean ombroNoLimite(double val) {
        return val <= OMBRO_MIN || val >= OMBRO_MAX;
    }

    public boolean cotoveloNoLimite(double val) {
        return val <= COTOVELO_MIN || val >= COTOVELO_MAX;
    }

    public boolean garraNoLimite(double val) {
        return val <= GARRA_MIN || val >= GARRA_MAX;
    }

    private static double clamp(double val, double min, double max) {
        return Math.max(min, Math.min(max, val));
    }

    @Override
    public String toString() {
        return String.format("ArmState[base=%.1f, ombro=%.1f, cotovelo=%.1f, garra=%.1f]",
                base, ombro, cotovelo, garra);
    }
}
