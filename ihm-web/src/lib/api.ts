import type { Angles, AxisId, CalibrationProfile, RobotState, UsbPortInfo } from './types';

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new Error(`Resposta vazia do servidor (HTTP ${response.status})`);
  }
  let payload: T & { error?: string };
  try {
    payload = JSON.parse(text) as T & { error?: string };
  } catch {
    throw new Error(`Resposta inválida do servidor: ${text.slice(0, 120)}`);
  }
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

export async function getState(): Promise<RobotState> {
  return parseJson<RobotState>(await fetch('/api/state'));
}

export async function scanPorts(): Promise<UsbPortInfo[]> {
  const result = await parseJson<{ ports: UsbPortInfo[] }>(await fetch('/api/ports'));
  return result.ports;
}

export async function connectArduino(path?: string): Promise<RobotState> {
  return parseJson<RobotState>(
    await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: path || undefined })
    })
  );
}

export async function disconnectArduino(): Promise<RobotState> {
  return parseJson<RobotState>(await fetch('/api/disconnect', { method: 'POST' }));
}

export async function moveAngles(angles: Partial<Angles>, durationMs = 80): Promise<RobotState> {
  return parseJson<RobotState>(
    await fetch('/api/angles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ angles, durationMs })
    })
  );
}

export async function homeArm(): Promise<RobotState> {
  return parseJson<RobotState>(await fetch('/api/home', { method: 'POST' }));
}

export async function stopArm(): Promise<RobotState> {
  return parseJson<RobotState>(await fetch('/api/stop', { method: 'POST' }));
}

export async function detachServos(axis?: AxisId): Promise<RobotState> {
  return parseJson<RobotState>(
    await fetch('/api/detach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ axis })
    })
  );
}

export async function saveCalibration(profile: CalibrationProfile): Promise<CalibrationProfile> {
  return parseJson<CalibrationProfile>(
    await fetch('/api/calibration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    })
  );
}

export async function markCalibrationLimit(axis: AxisId, side: 'min' | 'max', angle: number): Promise<CalibrationProfile> {
  return parseJson<CalibrationProfile>(
    await fetch('/api/calibration/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ axis, side, angle })
    })
  );
}

export function robotSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}
