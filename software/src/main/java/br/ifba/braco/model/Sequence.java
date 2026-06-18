package br.ifba.braco.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Sequência gravada de snapshots de ângulos do braço.
 * Cada snapshot é um ArmState capturado em intervalo de 100ms.
 */
public final class Sequence {

    private final String nome;
    private final List<ArmState> snapshots;

    public Sequence(String nome, List<ArmState> snapshots) {
        this.nome      = nome;
        this.snapshots = Collections.unmodifiableList(new ArrayList<>(snapshots));
    }

    public String getNome() {
        return nome;
    }

    public List<ArmState> getSnapshots() {
        return snapshots;
    }

    public int getDuracaoMs() {
        return snapshots.size() * 100;
    }

    @Override
    public String toString() {
        return String.format("%s (%d frames, ~%dms)", nome, snapshots.size(), getDuracaoMs());
    }
}
