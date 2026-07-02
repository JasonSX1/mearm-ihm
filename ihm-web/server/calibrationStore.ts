import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  type AxisId,
  type CalibrationProfile,
  cloneDefaultCalibration,
  normalizeCalibration
} from './defaults.js';

const dataDir = path.join(process.cwd(), '.me-arm-data');
const calibrationPath = path.join(dataDir, 'calibration.json');

export async function loadCalibration(): Promise<CalibrationProfile> {
  try {
    const raw = await readFile(calibrationPath, 'utf8');
    return normalizeCalibration(JSON.parse(raw) as CalibrationProfile);
  } catch {
    const fallback = cloneDefaultCalibration();
    fallback.updatedAt = new Date().toISOString();
    return fallback;
  }
}

export async function saveCalibration(profile: CalibrationProfile): Promise<CalibrationProfile> {
  const normalized = normalizeCalibration({
    ...profile,
    updatedAt: new Date().toISOString()
  });

  await mkdir(dataDir, { recursive: true });
  await writeFile(calibrationPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

export async function markCalibrationLimit(
  profile: CalibrationProfile,
  axis: AxisId,
  side: 'min' | 'max',
  angle: number
): Promise<CalibrationProfile> {
  const next = normalizeCalibration(profile);
  next.axes[axis][side] = angle;
  next.axes[axis].home = Math.round((next.axes[axis].min + next.axes[axis].max) / 2);
  return saveCalibration(next);
}

export function getCalibrationPath(): string {
  return calibrationPath;
}
