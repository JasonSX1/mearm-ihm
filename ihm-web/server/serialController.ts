import { EventEmitter } from 'node:events';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import {
  AXIS_IDS,
  type AxisId,
  type CalibrationProfile,
  type FirmwareInfo,
  type RobotState,
  type UsbPortInfo,
  clampToAxis,
  defaultAngles
} from './defaults.js';

type SerialPortInfo = Awaited<ReturnType<typeof SerialPort.list>>[number];

const ARDUINO_VENDOR_IDS = new Set(['2341', '2a03', '1a86', '10c4', '0403', '239a']);
const DEFAULT_BAUD_RATE = 9600;

const AXIS_SERIAL_NAME: Record<AxisId, string> = {
  base: 'base',
  shoulder: 'ombro',
  elbow: 'cotovelo',
  gripper: 'garra'
};

const STATUS_PREFIX_TO_AXIS: Record<string, AxisId> = {
  'base:': 'base',
  'ombro:': 'shoulder',
  'cotovelo:': 'elbow',
  'garra:': 'gripper'
};

// Interpolação: máx graus por step, intervalo entre steps
const STEP_DEGREES = 3;
const STEP_INTERVAL_MS = 30;

function scorePort(port: SerialPortInfo): number {
  const haystack = [
    port.path, port.manufacturer, port.vendorId,
    port.productId, port.pnpId, port.serialNumber
  ].filter(Boolean).join(' ').toLowerCase();

  let score = 0;
  if (port.vendorId && ARDUINO_VENDOR_IDS.has(port.vendorId.toLowerCase())) score += 60;
  if (haystack.includes('arduino') || haystack.includes('genuino')) score += 80;
  if (haystack.includes('usbmodem')) score += 45;
  if (haystack.includes('usbserial')) score += 35;
  if (haystack.includes('wch') || haystack.includes('ch340')) score += 30;
  if (haystack.includes('cp210') || haystack.includes('silicon labs')) score += 25;
  if (haystack.includes('ftdi')) score += 20;
  if (port.path.includes('/dev/cu.')) score += 15;
  return score;
}

function toUsbPortInfo(port: SerialPortInfo): UsbPortInfo {
  const score = scorePort(port);
  return {
    path: port.path,
    manufacturer: port.manufacturer,
    serialNumber: port.serialNumber,
    vendorId: port.vendorId,
    productId: port.productId,
    pnpId: port.pnpId,
    locationId: port.locationId,
    score,
    likelyArduino: score >= 50
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stepToward(current: number, target: number, maxStep: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxStep) return target;
  return current + (diff > 0 ? maxStep : -maxStep);
}

export class SerialController extends EventEmitter {
  private serial?: SerialPort;
  private parser?: ReadlineParser;
  private state: RobotState;

  // Interpolação suave
  private currentHwAngles: Record<AxisId, number> = { base: 90, shoulder: 90, elbow: 90, gripper: 90 };
  private targetAngles: Record<AxisId, number> = { base: 90, shoulder: 90, elbow: 90, gripper: 90 };
  private interpTimer?: ReturnType<typeof setInterval>;

  constructor(calibration: CalibrationProfile) {
    super();
    this.state = {
      connected: false,
      connecting: false,
      ports: [],
      angles: { base: 90, shoulder: 90, elbow: 90, gripper: 90 },
      calibration,
      emergencyStopped: false,
      lastMessage: 'Aguardando conexão USB'
    };
  }

  getState(): RobotState {
    return {
      ...this.state,
      angles: { ...this.state.angles },
      ports: [...this.state.ports],
      calibration: {
        ...this.state.calibration,
        axes: { ...this.state.calibration.axes }
      }
    };
  }

  async refreshPorts(): Promise<UsbPortInfo[]> {
    const ports = (await SerialPort.list()).map(toUsbPortInfo).sort((a, b) => b.score - a.score);
    this.state.ports = ports;
    this.emitState();
    return ports;
  }

  bestPort(ports = this.state.ports): UsbPortInfo | undefined {
    return [...ports].sort((a, b) => b.score - a.score)[0];
  }

  setCalibration(profile: CalibrationProfile): void {
    this.state.calibration = profile;
    for (const axis of AXIS_IDS) {
      this.state.angles[axis] = clampToAxis(axis, this.state.angles[axis], profile);
    }
    this.emitState();
  }

  async connect(path?: string, baudRate = DEFAULT_BAUD_RATE): Promise<RobotState> {
    if (this.state.connected || this.state.connecting) {
      await this.disconnect();
    }

    const ports = await this.refreshPorts();
    const selectedPath = path || this.bestPort(ports)?.path;
    if (!selectedPath) {
      throw new Error('Nenhuma porta serial USB encontrada');
    }

    this.state.connecting = true;
    this.state.port = selectedPath;
    this.state.firmware = undefined;
    this.state.lastMessage = `Abrindo ${selectedPath}`;
    this.emitState();

    this.serial = new SerialPort({
      path: selectedPath,
      baudRate,
      autoOpen: false
    });

    this.serial.on('error', (error) => {
      this.state.lastMessage = `Erro serial: ${error.message}`;
      this.emitState();
    });

    this.serial.on('close', () => {
      this.stopInterpolation();
      this.state.connected = false;
      this.state.connecting = false;
      this.state.lastMessage = 'Porta serial fechada';
      this.emitState();
    });

    this.parser = this.serial.pipe(new ReadlineParser({ delimiter: '\n' }));
    this.parser.on('data', (line: string | Buffer) => this.handleLine(String(line).trim()));

    await new Promise<void>((resolve, reject) => {
      this.serial?.open((error) => (error ? reject(error) : resolve()));
    });

    // Desativa DTR/RTS para não resetar o Arduino ao conectar
    await new Promise<void>((resolve) => {
      this.serial?.set({ dtr: false, rts: false }, () => resolve());
    });

    this.state.connected = true;
    this.state.connecting = false;
    this.state.emergencyStopped = false;
    this.state.firmware = { name: 'braco-robotico-ifba', version: '1.0.0' } satisfies FirmwareInfo;
    this.state.lastMessage = `Conectado em ${selectedPath} (9600 baud)`;

    // Arduino inicia tudo em 90 por padrão
    for (const axis of AXIS_IDS) {
      this.state.angles[axis] = 90;
      this.currentHwAngles[axis] = 90;
      this.targetAngles[axis] = 90;
    }

    this.emitState();

    // Inicia loop de interpolação
    this.startInterpolation();

    await wait(500);
    await this.writeLine('status', false);

    return this.getState();
  }

  async disconnect(): Promise<void> {
    this.stopInterpolation();
    const serial = this.serial;
    this.parser?.removeAllListeners();
    this.parser = undefined;
    this.serial = undefined;

    if (serial?.isOpen) {
      await new Promise<void>((resolve) => serial.close(() => resolve()));
    }

    this.state.connected = false;
    this.state.connecting = false;
    this.state.port = undefined;
    this.state.lastMessage = 'Desconectado';
    this.emitState();
  }

  async move(angles: Partial<Record<AxisId, number>>, _durationMs = 80): Promise<RobotState> {
    for (const axis of AXIS_IDS) {
      if (typeof angles[axis] === 'number') {
        const clamped = clampToAxis(axis, angles[axis] as number, this.state.calibration);
        this.state.angles[axis] = clamped;
        this.targetAngles[axis] = clamped;
      }
    }

    this.state.emergencyStopped = false;
    this.state.lastMessage = this.state.connected ? 'Movimento enviado' : 'Simulação local';
    this.emitState();
    return this.getState();
  }

  async home(): Promise<RobotState> {
    for (const axis of AXIS_IDS) {
      this.state.angles[axis] = 90;
      this.targetAngles[axis] = 90;
    }
    this.state.emergencyStopped = false;
    this.state.lastMessage = 'Indo para posição home';
    this.emitState();
    return this.getState();
  }

  async stop(reason = 'Parada solicitada'): Promise<RobotState> {
    // Para a interpolação no ângulo atual
    for (const axis of AXIS_IDS) {
      this.targetAngles[axis] = this.currentHwAngles[axis];
      this.state.angles[axis] = this.currentHwAngles[axis];
    }
    this.state.emergencyStopped = true;
    this.state.lastMessage = reason;
    this.emitState();
    return this.getState();
  }

  async detach(_axis?: AxisId): Promise<RobotState> {
    this.state.lastMessage = 'Detach não suportado pelo firmware';
    this.emitState();
    return this.getState();
  }

  // ── Interpolação suave ──────────────────────────────────────────────

  private startInterpolation(): void {
    this.stopInterpolation();
    this.interpTimer = setInterval(() => this.interpolationStep(), STEP_INTERVAL_MS);
  }

  private stopInterpolation(): void {
    if (this.interpTimer) {
      clearInterval(this.interpTimer);
      this.interpTimer = undefined;
    }
  }

  private interpolationStep(): void {
    if (!this.serial?.isOpen) return;

    // Calcula próximo passo para cada eixo
    const changedAxes: AxisId[] = [];
    for (const axis of AXIS_IDS) {
      if (this.currentHwAngles[axis] !== this.targetAngles[axis]) {
        this.currentHwAngles[axis] = stepToward(
          this.currentHwAngles[axis],
          this.targetAngles[axis],
          STEP_DEGREES
        );
        changedAxes.push(axis);
      }
    }

    if (changedAxes.length === 0) return;

    // Envia os eixos que mudaram
    if (changedAxes.length >= 3) {
      const a = this.currentHwAngles;
      void this.writeLine(`todos ${a.base} ${a.shoulder} ${a.elbow} ${a.gripper}`, false);
    } else {
      for (const axis of changedAxes) {
        void this.writeLine(`${AXIS_SERIAL_NAME[axis]} ${this.currentHwAngles[axis]}`, false);
      }
    }
  }

  // ── Serial I/O ──────────────────────────────────────────────────────

  private async writeLine(line: string, requireConnection = true): Promise<void> {
    if (!this.serial?.isOpen) {
      if (requireConnection) throw new Error('Arduino não conectado');
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.serial?.write(`${line}\n`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  private handleLine(line: string): void {
    if (!line) return;

    const lower = line.toLowerCase();
    for (const [prefix, axis] of Object.entries(STATUS_PREFIX_TO_AXIS)) {
      if (lower.startsWith(prefix)) {
        const value = parseInt(lower.slice(prefix.length).trim(), 10);
        if (!isNaN(value)) {
          this.state.angles[axis] = clampToAxis(axis, value, this.state.calibration);
          this.currentHwAngles[axis] = value;
          this.targetAngles[axis] = value;
        }
      }
    }

    this.state.lastMessage = line;
    this.state.lastTelemetryAt = new Date().toISOString();
    this.emit('telemetry', line);
    this.emitState();
  }

  private emitState(): void {
    this.emit('state', this.getState());
  }
}
