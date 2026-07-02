export const AXIS_IDS = ['base', 'shoulder', 'elbow', 'gripper'] as const;

export type AxisId = (typeof AXIS_IDS)[number];

export type Angles = Record<AxisId, number>;

export type AxisCalibration = {
  id: AxisId;
  label: string;
  pin: number;
  min: number;
  max: number;
  home: number;
  inverted: boolean;
  trim: number;
};

export type CalibrationProfile = {
  version: 1;
  updatedAt: string;
  axes: Record<AxisId, AxisCalibration>;
};

export type UsbPortInfo = {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
  pnpId?: string;
  locationId?: string;
  score: number;
  likelyArduino: boolean;
};

export type RobotState = {
  connected: boolean;
  connecting: boolean;
  port?: string;
  firmware?: {
    name: string;
    version: string;
    board?: string;
  };
  ports: UsbPortInfo[];
  angles: Angles;
  calibration: CalibrationProfile;
  emergencyStopped: boolean;
  lastMessage?: string;
  lastTelemetryAt?: string;
};

export const DEFAULT_CALIBRATION: CalibrationProfile = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  axes: {
    base: { id: 'base', label: 'Base', pin: 11, min: 0, max: 130, home: 90, inverted: false, trim: 0 },
    shoulder: { id: 'shoulder', label: 'Ombro', pin: 10, min: 0, max: 150, home: 90, inverted: false, trim: 0 },
    elbow: { id: 'elbow', label: 'Cotovelo', pin: 9, min: 0, max: 130, home: 90, inverted: false, trim: 0 },
    gripper: { id: 'gripper', label: 'Garra', pin: 6, min: 0, max: 180, home: 90, inverted: false, trim: 0 }
  }
};

export const DEFAULT_ANGLES = Object.fromEntries(
  AXIS_IDS.map((axis) => [axis, DEFAULT_CALIBRATION.axes[axis].home])
) as Angles;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function axisRange(axis: AxisId, calibration: CalibrationProfile): { min: number; max: number } {
  const item = calibration.axes[axis];
  if (Math.abs(item.max - item.min) < 2) {
    const fallback = DEFAULT_CALIBRATION.axes[axis];
    return {
      min: Math.min(fallback.min, fallback.max),
      max: Math.max(fallback.min, fallback.max)
    };
  }

  return {
    min: Math.min(item.min, item.max),
    max: Math.max(item.min, item.max)
  };
}

export function clampAxis(axis: AxisId, value: number, calibration: CalibrationProfile): number {
  const range = axisRange(axis, calibration);
  return Math.round(clamp(value, range.min, range.max));
}

export function gripperIsOpen(angle: number, calibration: CalibrationProfile): boolean {
  const range = axisRange('gripper', calibration);
  return angle >= (range.min + range.max) / 2;
}

export function gripperToggleAngle(angle: number, calibration: CalibrationProfile): number {
  const range = axisRange('gripper', calibration);
  return gripperIsOpen(angle, calibration) ? range.min : range.max;
}
