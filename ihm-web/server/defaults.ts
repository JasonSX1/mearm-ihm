export const AXIS_IDS = ['base', 'shoulder', 'elbow', 'gripper'] as const;

export type AxisId = (typeof AXIS_IDS)[number];

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

export type FirmwareInfo = {
  name: string;
  version: string;
  board?: string;
};

export type RobotState = {
  connected: boolean;
  connecting: boolean;
  port?: string;
  firmware?: FirmwareInfo;
  ports: UsbPortInfo[];
  angles: Record<AxisId, number>;
  calibration: CalibrationProfile;
  emergencyStopped: boolean;
  lastMessage?: string;
  lastTelemetryAt?: string;
};

export const DEFAULT_CALIBRATION: CalibrationProfile = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  axes: {
    base: {
      id: 'base',
      label: 'Base',
      pin: 11,
      min: 0,
      max: 130,
      home: 90,
      inverted: false,
      trim: 0
    },
    shoulder: {
      id: 'shoulder',
      label: 'Ombro',
      pin: 10,
      min: 0,
      max: 150,
      home: 90,
      inverted: false,
      trim: 0
    },
    elbow: {
      id: 'elbow',
      label: 'Cotovelo',
      pin: 9,
      min: 0,
      max: 130,
      home: 90,
      inverted: false,
      trim: 0
    },
    gripper: {
      id: 'gripper',
      label: 'Garra',
      pin: 6,
      min: 0,
      max: 180,
      home: 90,
      inverted: false,
      trim: 0
    }
  }
};

export function cloneDefaultCalibration(): CalibrationProfile {
  return JSON.parse(JSON.stringify(DEFAULT_CALIBRATION)) as CalibrationProfile;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampServoAngle(value: number): number {
  return Math.round(clamp(value, 0, 180));
}

export function clampToAxis(axis: AxisId, value: number, profile: CalibrationProfile): number {
  const calibration = profile.axes[axis];
  const low = Math.min(calibration.min, calibration.max);
  const high = Math.max(calibration.min, calibration.max);
  return clampServoAngle(clamp(value, low, high));
}

export function defaultAngles(profile: CalibrationProfile): Record<AxisId, number> {
  return AXIS_IDS.reduce(
    (angles, axis) => {
      angles[axis] = clampToAxis(axis, profile.axes[axis].home, profile);
      return angles;
    },
    {} as Record<AxisId, number>
  );
}

export function normalizeCalibration(profile: CalibrationProfile): CalibrationProfile {
  const next = cloneDefaultCalibration();

  for (const axis of AXIS_IDS) {
    const incoming = profile.axes?.[axis];
    if (!incoming) continue;

    next.axes[axis] = {
      ...next.axes[axis],
      ...incoming,
      id: axis,
      pin: Math.round(clamp(Number(incoming.pin), 2, 13)),
      min: clampServoAngle(Number(incoming.min)),
      max: clampServoAngle(Number(incoming.max)),
      home: clampServoAngle(Number(incoming.home)),
      inverted: Boolean(incoming.inverted),
      trim: Math.round(clamp(Number(incoming.trim ?? 0), -45, 45))
    };

    if (Math.abs(next.axes[axis].max - next.axes[axis].min) < 2) {
      next.axes[axis].min = DEFAULT_CALIBRATION.axes[axis].min;
      next.axes[axis].max = DEFAULT_CALIBRATION.axes[axis].max;
      next.axes[axis].home = DEFAULT_CALIBRATION.axes[axis].home;
    }
  }

  next.updatedAt = profile.updatedAt || new Date().toISOString();
  return next;
}
