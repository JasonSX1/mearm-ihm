import { useCallback, useEffect, useRef, useState } from 'react';
import { ArmScene } from './components/ArmScene';
import { useRobot } from './hooks/useRobot';
import {
  AXIS_IDS,
  clampAxis,
  axisRange,
  type Angles,
  type AxisId
} from './lib/types';

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function ts() {
  const d = new Date();
  return `[${d.toTimeString().slice(0, 8)}]`;
}

type HistoryEntry = { angles: Angles; label: string };

/* ═══════════════════════════════════════════════════════════════
   APP
   ═══════════════════════════════════════════════════════════════ */

export function App() {
  const {
    state, ports, error,
    scanPorts, connect, disconnect, moveAngles, home, stop
  } = useRobot();

  /* ── state ── */
  const [selectedPort, setSelectedPort] = useState('');
  const [selectedAxis, setSelectedAxis] = useState<AxisId>('base');
  const [draftAngles, setDraftAngles] = useState<Angles>(state.angles);

  // Undo / Redo (RF004)
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);

  // Log (RF005)
  const [logLines, setLogLines] = useState<string[]>([`${ts()} Sistema iniciado`]);
  const [logInput, setLogInput] = useState('');
  const logRef = useRef<HTMLTextAreaElement>(null);

  // Record / Play (RF006)
  type TimedFrame = { angles: Angles; t: number };
  const [recording, setRecording] = useState(false);
  const [recordedFrames, setRecordedFrames] = useState<TimedFrame[]>([]);
  const [sequences, setSequences] = useState<{ name: string; frames: TimedFrame[] }[]>([]);
  const [playing, setPlaying] = useState(false);
  const playTimer = useRef<number>();
  const recStart = useRef(0);

  // Connection dialog
  const [showConnDialog, setShowConnDialog] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSaveSeq, setShowSaveSeq] = useState(false);
  const [showPlaySeq, setShowPlaySeq] = useState(false);
  const [seqName, setSeqName] = useState('');

  const sendTimer = useRef<number>();

  /* ── sync ── */
  useEffect(() => { void scanPorts(); }, [scanPorts]);
  useEffect(() => { setDraftAngles(state.angles); }, [state.angles]);
  useEffect(() => {
    if (!selectedPort && ports.length > 0) {
      const likely = ports.find(p => p.likelyArduino) || ports[0];
      setSelectedPort(likely.path);
    }
  }, [ports, selectedPort]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  const addLog = useCallback((msg: string) => {
    setLogLines(prev => [...prev, `${ts()} ${msg}`]);
  }, []);

  /* ── move with history ── */
  const scheduleSend = useCallback(
    (next: Angles) => {
      window.clearTimeout(sendTimer.current);
      sendTimer.current = window.setTimeout(() => { void moveAngles(next); }, 120);
    }, [moveAngles]
  );

  const pushHistory = useCallback((label: string, prevAngles: Angles) => {
    setUndoStack(prev => [...prev, { angles: { ...prevAngles }, label }]);
    setRedoStack([]);
  }, []);

  const updateAxis = useCallback(
    (axis: AxisId, value: number) => {
      setDraftAngles(current => {
        const clamped = clampAxis(axis, value, state.calibration);
        const next = { ...current, [axis]: clamped };
        scheduleSend(next);
        if (recording) {
          const t = Date.now() - recStart.current;
          setRecordedFrames(prev => {
            // Só grava se passou pelo menos 150ms desde o último frame
            if (prev.length > 0 && t - prev[prev.length - 1].t < 150) return prev;
            return [...prev, { angles: next, t }];
          });
        }
        return next;
      });
    }, [scheduleSend, state.calibration, recording]
  );

  const commitMove = useCallback((axis: AxisId, prevAngle: number, newAngle: number) => {
    if (prevAngle === newAngle) return;
    const axLabel = state.calibration.axes[axis].label;
    const label = `${axLabel}: ${prevAngle}° → ${newAngle}°`;
    addLog(label);
    pushHistory(label, { ...draftAngles, [axis]: prevAngle });
  }, [addLog, pushHistory, draftAngles, state.calibration]);

  /* ── Undo / Redo (RF004) ── */
  const doUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const entry = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, { angles: { ...draftAngles }, label: entry.label }]);
    setDraftAngles(entry.angles);
    scheduleSend(entry.angles);
    addLog(`Desfazer: ${entry.label}`);
  }, [undoStack, draftAngles, scheduleSend, addLog]);

  const doRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const entry = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, { angles: { ...draftAngles }, label: entry.label }]);
    setDraftAngles(entry.angles);
    scheduleSend(entry.angles);
    addLog(`Refazer: ${entry.label}`);
  }, [redoStack, draftAngles, scheduleSend, addLog]);

  /* ── Gripper (RF003) ── */
  const gripperRange = axisRange('gripper', state.calibration);
  const gripperOpen = draftAngles.gripper <= gripperRange.min;
  const gripperClosed = draftAngles.gripper >= gripperRange.max;

  const openGripper = () => {
    if (gripperOpen) return;
    const prev = draftAngles.gripper;
    updateAxis('gripper', gripperRange.min);
    commitMove('gripper', prev, gripperRange.min);
  };
  const closeGripper = () => {
    if (gripperClosed) return;
    const prev = draftAngles.gripper;
    updateAxis('gripper', gripperRange.max);
    commitMove('gripper', prev, gripperRange.max);
  };

  /* ── Record / Play (RF006) ── */
  const startRecording = () => {
    setRecording(true);
    recStart.current = Date.now();
    setRecordedFrames([{ angles: { ...draftAngles }, t: 0 }]);
    addLog('Gravação iniciada');
  };

  const stopRecording = () => {
    setRecording(false);
    if (recordedFrames.length > 1) {
      setShowSaveSeq(true);
      setSeqName(`Sequência ${sequences.length + 1}`);
    } else {
      addLog('Gravação cancelada (sem movimentos)');
    }
  };

  const saveSequence = () => {
    setSequences(prev => [...prev, { name: seqName, frames: [...recordedFrames] }]);
    addLog(`Sequência "${seqName}" salva (${recordedFrames.length} frames)`);
    setShowSaveSeq(false);
    setRecordedFrames([]);
  };

  const playSequence = (idx: number) => {
    const seq = sequences[idx];
    if (!seq || playing || seq.frames.length === 0) return;
    setPlaying(true);
    setShowPlaySeq(false);
    addLog(`Reproduzindo "${seq.name}"`);

    const frames = seq.frames;
    let i = 0;

    const playNext = () => {
      if (i >= frames.length) {
        setPlaying(false);
        addLog('Reprodução concluída');
        return;
      }
      // Aplica o frame atual
      setDraftAngles(frames[i].angles);
      void moveAngles(frames[i].angles);

      const curr = i;
      i++;

      if (i >= frames.length) {
        // Último frame — espera um pouco e finaliza
        playTimer.current = window.setTimeout(() => {
          setPlaying(false);
          addLog('Reprodução concluída');
        }, 300);
        return;
      }

      // Calcula o delay real entre este frame e o próximo
      const delay = Math.max(30, frames[i].t - frames[curr].t);
      playTimer.current = window.setTimeout(playNext, delay);
    };

    // Primeiro: volta à posição inicial e espera o braço chegar
    setDraftAngles(frames[0].angles);
    void moveAngles(frames[0].angles);
    addLog('Retornando à posição inicial...');
    i = 1;
    playTimer.current = window.setTimeout(() => {
      if (i < frames.length) {
        addLog('Executando sequência');
        playNext();
      } else {
        setPlaying(false);
        addLog('Reprodução concluída');
      }
    }, 1500);
  };

  const stopPlayback = () => {
    window.clearTimeout(playTimer.current);
    setPlaying(false);
    addLog('Reprodução interrompida');
  };

  /* ── Log commands (RF005/G006) ── */
  const handleLogKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !logInput.trim()) return;
    const cmd = logInput.trim().toLowerCase();
    addLog(`> ${logInput.trim()}`);

    // Parse: "base 90", "ombro 45", "garra 0", "home", etc.
    const axisMap: Record<string, AxisId> = {
      base: 'base', ombro: 'shoulder', cotovelo: 'elbow', garra: 'gripper'
    };
    const parts = cmd.split(/\s+/);
    if (parts[0] === 'home') {
      for (const a of AXIS_IDS) updateAxis(a, state.calibration.axes[a].home);
      addLog('Home executado');
    } else if (parts[0] in axisMap && parts[1]) {
      const axis = axisMap[parts[0]];
      const val = parseInt(parts[1], 10);
      if (!isNaN(val)) {
        const prev = draftAngles[axis];
        updateAxis(axis, val);
        commitMove(axis, prev, clampAxis(axis, val, state.calibration));
      }
    } else {
      addLog('Comando não reconhecido. Use: base/ombro/cotovelo/garra ÂNGULO ou home');
    }
    setLogInput('');
  };

  // Suggestions (G006)
  const suggestions = ['base ', 'ombro ', 'cotovelo ', 'garra ', 'home'];
  const filteredSuggestions = logInput.length > 0
    ? suggestions.filter(s => s.startsWith(logInput.toLowerCase()))
    : [];

  /* ── Connection handler ── */
  const handleConnect = async () => {
    try {
      await connect(selectedPort);
      addLog(`Conectado em ${selectedPort || 'auto'}`);
      setShowConnDialog(false);
    } catch {
      addLog('Falha na conexão USB');
    }
  };

  const barDisabled = playing;

  /* ── RENDER ── */
  return (
    <div className="ihm-shell">
      {/* ── Header compacto ── */}
      <header className="ihm-header">
        <h1>IHM — Braço Robótico MeArm</h1>
        <div className="ihm-header-right">
          <span className={state.connected ? 'conn-pill online' : 'conn-pill'}>
            {state.connected ? `● ${state.port}` : '○ Desconectado'}
          </span>
          <button className="ihm-btn ihm-btn-sm" onClick={() => setShowConnDialog(true)}>
            {state.connected ? 'Desconectar' : 'Conectar'}
          </button>
        </div>
      </header>

      {/* ── Área do braço 3D (~80%) ── */}
      <main className="ihm-scene">
        <ArmScene
          angles={draftAngles}
          calibration={state.calibration}
          selectedAxis={selectedAxis}
          onSelectAxis={setSelectedAxis}
          onChangeAxis={(axis, value) => {
            const prev = draftAngles[axis];
            updateAxis(axis, value);
            // commitMove will be called on pointer up via the scene
          }}
        />

        {/* Ângulo atual overlay */}
        <div className="angle-overlay">
          {state.calibration.axes[selectedAxis].label}: {draftAngles[selectedAxis]}°
        </div>
      </main>

      {/* ── Barra inferior (~20%) — G007 ── */}
      <footer className="ihm-bar">
        {/* Undo (RF004) */}
        <button
          className="ihm-btn bar-btn"
          disabled={barDisabled || undoStack.length === 0}
          onClick={doUndo}
          title="Desfazer (Undo)"
        >
          ←
        </button>

        {/* Redo (RF004) */}
        <button
          className="ihm-btn bar-btn"
          disabled={barDisabled || redoStack.length === 0}
          onClick={doRedo}
          title="Refazer (Redo)"
        >
          →
        </button>

        {/* Log (RF005) — centralizado, maior largura */}
        <div className="bar-log">
          <textarea
            ref={logRef}
            className="log-area"
            readOnly
            value={logLines.join('\n')}
            onContextMenu={(e) => {
              e.preventDefault();
              setShowClearConfirm(true);
            }}
          />
          <div className="log-input-wrap">
            <input
              className="log-input"
              type="text"
              placeholder="Digite um comando (ex: base 90, home)..."
              value={logInput}
              onChange={e => setLogInput(e.target.value)}
              onKeyDown={handleLogKey}
              disabled={barDisabled}
            />
            {filteredSuggestions.length > 0 && (
              <div className="log-suggestions">
                {filteredSuggestions.map(s => (
                  <button key={s} onClick={() => setLogInput(s)}>{s.trim()}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* REC (RF006) */}
        {playing ? (
          <button className="ihm-btn bar-btn rec-stop" onClick={stopPlayback}>
            ■ Parar
          </button>
        ) : recording ? (
          <button className="ihm-btn bar-btn rec-active" onClick={stopRecording}>
            ● Parar
          </button>
        ) : (
          <button className="ihm-btn bar-btn rec-btn" disabled={barDisabled} onClick={startRecording}>
            ● REC
          </button>
        )}

        {/* Play button */}
        {!recording && !playing && sequences.length > 0 && (
          <button className="ihm-btn bar-btn" disabled={barDisabled} onClick={() => setShowPlaySeq(true)} title="Reproduzir">
            ▶
          </button>
        )}

        {/* Abrir Garra (RF003) */}
        <button
          className="ihm-btn bar-btn gripper-btn"
          disabled={barDisabled || gripperOpen}
          onClick={openGripper}
        >
          Abrir Garra
        </button>

        {/* Fechar Garra (RF003) */}
        <button
          className="ihm-btn bar-btn gripper-btn"
          disabled={barDisabled || gripperClosed}
          onClick={closeGripper}
        >
          Fechar Garra
        </button>
      </footer>

      {/* ══════ DIALOGS ══════ */}

      {/* Connection dialog */}
      {showConnDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h2>{state.connected ? 'Desconectar' : 'Conectar ao Arduino'}</h2>
            {state.connected ? (
              <p>Deseja desconectar de {state.port}?</p>
            ) : (
              <>
                <label>Porta USB:</label>
                <select value={selectedPort} onChange={e => setSelectedPort(e.target.value)}>
                  <option value="">Detectar automaticamente</option>
                  {ports.map(p => <option key={p.path} value={p.path}>{p.path}{p.likelyArduino ? ' — Arduino' : ''}</option>)}
                </select>
                <button className="ihm-btn" onClick={() => void scanPorts()} style={{ marginTop: 8 }}>Detectar portas</button>
              </>
            )}
            <div className="dialog-actions">
              <button className="ihm-btn dialog-cancel" onClick={() => setShowConnDialog(false)}>Cancelar</button>
              <button className="ihm-btn dialog-confirm" onClick={() => {
                if (state.connected) { void disconnect(); addLog('Desconectado'); setShowConnDialog(false); }
                else void handleConnect();
              }}>
                {state.connected ? 'Desconectar' : 'Conectar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear log confirm (RF005 — G001/G003/G004) */}
      {showClearConfirm && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h2>Limpar Log</h2>
            <p>Deseja limpar todo o log e as pilhas de undo/redo?</p>
            <div className="dialog-actions">
              <button className="ihm-btn dialog-cancel" onClick={() => setShowClearConfirm(false)}>Cancelar</button>
              <button className="ihm-btn dialog-confirm" onClick={() => {
                setLogLines([`${ts()} Log limpo`]);
                setUndoStack([]);
                setRedoStack([]);
                setShowClearConfirm(false);
              }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Save sequence dialog (RF006 — G001/G003/G004) */}
      {showSaveSeq && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h2>Salvar Sequência</h2>
            <label>Nome da sequência:</label>
            <input type="text" value={seqName} onChange={e => setSeqName(e.target.value)} autoFocus />
            <div className="dialog-actions">
              <button className="ihm-btn dialog-cancel" onClick={() => { setShowSaveSeq(false); setRecordedFrames([]); }}>Cancelar</button>
              <button className="ihm-btn dialog-confirm" onClick={saveSequence} disabled={!seqName.trim()}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Play sequence dialog (RF006) */}
      {showPlaySeq && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h2>Reproduzir Sequência</h2>
            {sequences.length === 0 ? (
              <p>Nenhuma sequência gravada.</p>
            ) : (
              <div className="seq-list">
                {sequences.map((seq, i) => (
                  <button key={i} className="ihm-btn seq-item" onClick={() => playSequence(i)}>
                    ▶ {seq.name} ({seq.frames.length} frames)
                  </button>
                ))}
              </div>
            )}
            <div className="dialog-actions">
              <button className="ihm-btn dialog-cancel" onClick={() => setShowPlaySeq(false)}>Voltar</button>
            </div>
          </div>
        </div>
      )}

      {/* USB error popup */}
      {error && !state.connected && !showConnDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h2>Erro de Conexão</h2>
            <p>{error}</p>
            <div className="dialog-actions">
              <button className="ihm-btn dialog-cancel" onClick={() => setShowConnDialog(false)}>Fechar</button>
              <button className="ihm-btn dialog-confirm" onClick={() => { setShowConnDialog(true); }}>Reconectar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
