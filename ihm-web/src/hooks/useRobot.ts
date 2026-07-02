import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../lib/api';
import {
  DEFAULT_ANGLES,
  DEFAULT_CALIBRATION,
  type Angles,
  type AxisId,
  type CalibrationProfile,
  type RobotState,
  type UsbPortInfo
} from '../lib/types';

const INITIAL_STATE: RobotState = {
  connected: false,
  connecting: false,
  ports: [],
  angles: DEFAULT_ANGLES,
  calibration: DEFAULT_CALIBRATION,
  emergencyStopped: false,
  lastMessage: 'Carregando'
};

type SocketMessage =
  | { type: 'state'; data: RobotState }
  | { type: 'telemetry'; data: string };

export function useRobot() {
  const [state, setState] = useState<RobotState>(INITIAL_STATE);
  const [ports, setPorts] = useState<UsbPortInfo[]>([]);
  const [telemetry, setTelemetry] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const retryTimer = useRef<number>();

  const applyState = useCallback((next: RobotState) => {
    setState(next);
    setPorts(next.ports);
  }, []);

  const run = useCallback(
    async <T,>(task: () => Promise<T>): Promise<T | undefined> => {
      try {
        setError(undefined);
        return await task();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Erro desconhecido');
        return undefined;
      }
    },
    []
  );

  const refreshState = useCallback(async () => {
    const next = await run(api.getState);
    if (next) applyState(next);
  }, [applyState, run]);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let closed = false;

    const open = () => {
      socket = new WebSocket(api.robotSocketUrl());

      socket.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as SocketMessage;
        if (message.type === 'state') applyState(message.data);
        if (message.type === 'telemetry') {
          setTelemetry((items) => [message.data, ...items].slice(0, 24));
        }
      };

      socket.onclose = () => {
        if (!closed) retryTimer.current = window.setTimeout(open, 1200);
      };
    };

    open();

    return () => {
      closed = true;
      window.clearTimeout(retryTimer.current);
      socket?.close();
    };
  }, [applyState]);

  const commands = useMemo(
    () => ({
      scanPorts: async () => {
        const next = await run(api.scanPorts);
        if (next) setPorts(next);
        return next;
      },
      connect: async (path?: string) => {
        const next = await run(() => api.connectArduino(path));
        if (next) applyState(next);
        return next;
      },
      disconnect: async () => {
        const next = await run(api.disconnectArduino);
        if (next) applyState(next);
        return next;
      },
      moveAngles: async (angles: Partial<Angles>, durationMs?: number) => {
        const next = await run(() => api.moveAngles(angles, durationMs));
        if (next) applyState(next);
        return next;
      },
      home: async () => {
        const next = await run(api.homeArm);
        if (next) applyState(next);
        return next;
      },
      stop: async () => {
        const next = await run(api.stopArm);
        if (next) applyState(next);
        return next;
      },
      detach: async (axis?: AxisId) => {
        const next = await run(() => api.detachServos(axis));
        if (next) applyState(next);
        return next;
      },
      saveCalibration: async (profile: CalibrationProfile) => {
        const next = await run(() => api.saveCalibration(profile));
        if (next) await refreshState();
        return next;
      },
      markLimit: async (axis: AxisId, side: 'min' | 'max', angle: number) => {
        const next = await run(() => api.markCalibrationLimit(axis, side, angle));
        if (next) await refreshState();
        return next;
      }
    }),
    [applyState, refreshState, run]
  );

  return {
    state,
    ports,
    telemetry,
    error,
    ...commands
  };
}
