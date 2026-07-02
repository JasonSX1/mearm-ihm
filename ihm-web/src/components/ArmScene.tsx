import { Grid, Html, OrbitControls } from '@react-three/drei';
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { AXIS_IDS, clampAxis, type Angles, type AxisId, type CalibrationProfile } from '../lib/types';

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */

type ArmSceneProps = {
  angles: Angles;
  calibration: CalibrationProfile;
  selectedAxis: AxisId;
  onSelectAxis: (axis: AxisId) => void;
  onChangeAxis: (axis: AxisId, angle: number) => void;
};

type ArmModelProps = ArmSceneProps & {
  onHandleHoverChange: (axis: AxisId, active: boolean) => void;
  onHandleDragChange: (axis: AxisId, active: boolean) => void;
  editMode: boolean;
  labelPositions: Record<AxisId, [number, number, number]>;
  onLabelPositionChange: (axis: AxisId, pos: [number, number, number]) => void;
};

/* ═══════════════════════════════════════════════════════════════════
   MATERIALS
   ═══════════════════════════════════════════════════════════════════ */

const gray = new THREE.MeshStandardMaterial({ color: '#8a8e91', roughness: 0.52, metalness: 0.22 });
const darkGray = new THREE.MeshStandardMaterial({ color: '#4a4d50', roughness: 0.6, metalness: 0.18 });
const servoMat = new THREE.MeshStandardMaterial({ color: '#1a1d20', roughness: 0.78 });
const accent = new THREE.MeshStandardMaterial({ color: '#22b8a0', roughness: 0.38, emissive: '#06332e' });
const selectedMat = new THREE.MeshStandardMaterial({ color: '#e15a3f', roughness: 0.36, emissive: '#421108' });
const pcbMat = new THREE.MeshStandardMaterial({ color: '#1a6b3a', roughness: 0.7 });
const wireMat = new THREE.MeshStandardMaterial({ color: '#cc4422', roughness: 0.6 });

function radians(v: number) { return THREE.MathUtils.degToRad(v); }
function relAngle(axis: AxisId, a: Angles, c: CalibrationProfile) { return a[axis] - c.axes[axis].home; }

/* ═══════════════════════════════════════════════════════════════════
   PRIMITIVES
   ═══════════════════════════════════════════════════════════════════ */

function ServoBlock({ position = [0, 0, 0] as [number, number, number] }) {
  return (
    <group position={position}>
      <mesh material={servoMat} castShadow receiveShadow><boxGeometry args={[0.44, 0.26, 0.34]} /></mesh>
      <mesh material={darkGray} position={[0, 0.02, 0.2]} castShadow><cylinderGeometry args={[0.07, 0.07, 0.06, 20]} /></mesh>
      <mesh material={servoMat} position={[0, -0.08, 0]} castShadow><boxGeometry args={[0.56, 0.04, 0.34]} /></mesh>
    </group>
  );
}

function Gripper({ open }: { open: number }) {
  const spread = THREE.MathUtils.mapLinear(open, 0, 1, 0.24, 0.04);
  return (
    <group position={[0.09, 0.40, 0]} rotation={[0, 1.6, 0.010]}>
      <mesh material={servoMat} castShadow receiveShadow><boxGeometry args={[0.28, 0.16, 0.22]} /></mesh>
      <mesh material={darkGray} position={[0, 0.14, 0]} castShadow receiveShadow><boxGeometry args={[0.32, 0.12, 0.24]} /></mesh>
      <mesh material={gray} position={[-spread, 0.34, 0]} rotation={[0, 0, radians(-10)]} castShadow><boxGeometry args={[0.07, 0.34, 0.08]} /></mesh>
      <mesh material={gray} position={[spread, 0.34, 0]} rotation={[0, 0, radians(10)]} castShadow><boxGeometry args={[0.07, 0.34, 0.08]} /></mesh>
      <mesh material={darkGray} position={[-spread - 0.02, 0.5, 0]} castShadow><boxGeometry args={[0.05, 0.12, 0.06]} /></mesh>
      <mesh material={darkGray} position={[spread + 0.02, 0.5, 0]} castShadow><boxGeometry args={[0.05, 0.12, 0.06]} /></mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   JOINT HANDLE — bola 3D de manipulação direta
   ═══════════════════════════════════════════════════════════════════ */

function dragDelta(axis: AxisId, dx: number, dy: number): number {
  if (axis === 'base') return dx * 0.42;
  if (axis === 'gripper') return (-dy + dx * 0.2) * 0.5;
  return (-dy + dx * 0.28) * 0.36;
}

function JointHandle({
  axis, angle, selectedAxis, calibration,
  onSelectAxis, onChangeAxis, onHandleHoverChange, onHandleDragChange,
  position = [0, 0, 0], scale = 1
}: {
  axis: AxisId; angle: number; selectedAxis: AxisId; calibration: CalibrationProfile;
  onSelectAxis: (a: AxisId) => void; onChangeAxis: (a: AxisId, v: number) => void;
  onHandleHoverChange: (a: AxisId, active: boolean) => void;
  onHandleDragChange: (a: AxisId, active: boolean) => void;
  position?: [number, number, number]; scale?: number;
}) {
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ x: 0, y: 0, angle: 0 });

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      onChangeAxis(axis, clampAxis(axis, drag.current.angle + dragDelta(axis, dx, dy), calibration));
    };
    const up = () => { document.body.style.cursor = ''; setDragging(false); onHandleDragChange(axis, false); };
    document.body.style.cursor = 'grabbing';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.cursor = ''; };
  }, [axis, calibration, dragging, onChangeAxis, onHandleDragChange]);

  const isActive = axis === selectedAxis || dragging;
  const mat = isActive ? selectedMat : accent;
  const ringMat = isActive ? selectedMat : darkGray;

  return (
    <group
      position={position}
      scale={scale}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation(); e.nativeEvent.preventDefault();
        e.nativeEvent.stopPropagation(); e.nativeEvent.stopImmediatePropagation();
        onSelectAxis(axis);
        onHandleDragChange(axis, true);
        drag.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, angle };
        setDragging(true);
      }}
      onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation(); document.body.style.cursor = 'grab'; onHandleHoverChange(axis, true);
      }}
      onPointerLeave={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation(); if (!dragging) document.body.style.cursor = ''; onHandleHoverChange(axis, false);
      }}
    >
      <mesh material={mat} castShadow><sphereGeometry args={[0.18, 24, 24]} /></mesh>
      <mesh material={ringMat} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.28, 0.02, 12, 36]} /></mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DOM LABEL — editável via drag no modo edição
   ═══════════════════════════════════════════════════════════════════ */

const LABEL_STORAGE_KEY = 'mearm-label-positions';
const DEFAULT_LABEL_POS: Record<AxisId, [number, number, number]> = {
  base: [1.2, -0.1, 0.8],
  shoulder: [-0.5, 1.0, 0],
  elbow: [0.5, 0.8, 0],
  gripper: [0.8, 0.4, 0]
};

function loadLabelPos(): Record<AxisId, [number, number, number]> {
  try { const s = localStorage.getItem(LABEL_STORAGE_KEY); if (s) return JSON.parse(s); } catch {}
  return { ...DEFAULT_LABEL_POS };
}
function saveLabelPos(p: Record<AxisId, [number, number, number]>) {
  localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(p));
}

function EditableLabel({
  axis, label, position, editMode, onPositionChange, selectedAxis, onSelectAxis,
  angle, calibration, onChangeAxis, onHandleDragChange
}: {
  axis: AxisId; label: string; position: [number, number, number];
  editMode: boolean; onPositionChange: (a: AxisId, p: [number, number, number]) => void;
  selectedAxis: AxisId; onSelectAxis: (a: AxisId) => void;
  angle: number; calibration: CalibrationProfile;
  onChangeAxis: (a: AxisId, v: number) => void;
  onHandleDragChange: (a: AxisId, active: boolean) => void;
}) {
  // Drag do servo via label
  const axisDrag = useRef({ x: 0, y: 0, angle: 0 });
  const [axisDragging, setAxisDragging] = useState(false);

  const onAxisDragStart = (a: AxisId, ang: number, cx: number, cy: number) => {
    axisDrag.current = { x: cx, y: cy, angle: ang };
    setAxisDragging(true);
    onHandleDragChange(a, true);
  };

  useEffect(() => {
    if (!axisDragging) return;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - axisDrag.current.x;
      const dy = e.clientY - axisDrag.current.y;
      onChangeAxis(axis, clampAxis(axis, axisDrag.current.angle + dragDelta(axis, dx, dy), calibration));
    };
    const onUp = () => { setAxisDragging(false); document.body.style.cursor = ''; onHandleDragChange(axis, false); };
    document.body.style.cursor = 'grabbing';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); document.body.style.cursor = ''; };
  }, [axisDragging, axis, calibration, onChangeAxis, onHandleDragChange]);
  const posRef = useRef(position);
  posRef.current = position;
  const startRef = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => {
      const dx = (e.clientX - startRef.current.x) * 0.01;
      const dy = (e.clientY - startRef.current.y) * -0.01;
      const p = posRef.current;
      startRef.current = { x: e.clientX, y: e.clientY };
      const next: [number, number, number] = [
        Math.round((p[0] + dx) * 10) / 10,
        Math.round((p[1] + dy) * 10) / 10,
        p[2]
      ];
      onPositionChange(axis, next);
    };
    const onUp = () => { setIsDragging(false); document.body.style.cursor = ''; };
    document.body.style.cursor = 'move';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); document.body.style.cursor = ''; };
  }, [isDragging, axis, onPositionChange]);

  const isActive = axis === selectedAxis;

  return (
    <Html position={position} center zIndexRange={[80, 0]} style={{ pointerEvents: 'auto' }}>
      <button
        type="button"
        className={editMode ? 'joint-dom-handle edit-mode' : isActive ? 'joint-dom-handle active' : 'joint-dom-handle'}
        aria-label={label}
        onPointerDown={(e) => {
          e.preventDefault(); e.stopPropagation();
          if (editMode) {
            startRef.current = { x: e.clientX, y: e.clientY };
            setIsDragging(true);
          } else if (axis === 'gripper') {
            // Garra: clique alterna entre aberta (0) e fechada (180)
            onSelectAxis(axis);
            const range = { min: calibration.axes.gripper.min, max: calibration.axes.gripper.max };
            const mid = (range.min + range.max) / 2;
            onChangeAxis(axis, angle >= mid ? range.min : range.max);
          } else {
            // Manipulação do servo via drag no label
            onSelectAxis(axis);
            onAxisDragStart(axis, angle, e.clientX, e.clientY);
          }
        }}
      >
        <span className="joint-dom-dot" />
        <span className="joint-dom-label">{label}</span>
        {editMode && <span className="joint-dom-coords">[{position[0]}, {position[1]}]</span>}
      </button>
    </Html>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ARM MODEL
   ═══════════════════════════════════════════════════════════════════ */

function ArmModel({
  angles, calibration, selectedAxis, onSelectAxis, onChangeAxis,
  onHandleHoverChange, onHandleDragChange, editMode, labelPositions, onLabelPositionChange
}: ArmModelProps) {
  const sRel = relAngle('shoulder', angles, calibration);
  const eRel = relAngle('elbow', angles, calibration);

  const rot = useMemo(() => ({
    base: radians(relAngle('base', angles, calibration)),
    shoulder: radians(10 - sRel * 1.0),
    elbow: radians(-90 + eRel * 0.8 + sRel * 0.5),
    gripperOpen: THREE.MathUtils.clamp(
      (angles.gripper - calibration.axes.gripper.min) /
        Math.max(1, calibration.axes.gripper.max - calibration.axes.gripper.min), 0, 1)
  }), [angles, calibration, sRel, eRel]);

  const hp = { onSelectAxis, onChangeAxis, onHandleHoverChange, onHandleDragChange, calibration };
  const AL = 2.0, FL = 1.6, BW = 0.12, SP = 0.36;

  return (
    <group>
      {/* ── BASE ── */}
      <mesh material={gray} position={[0, 0.04, 0]} receiveShadow castShadow><boxGeometry args={[2.0, 0.08, 1.6]} /></mesh>
      <mesh material={darkGray} position={[0, 0.12, 0]} receiveShadow castShadow><boxGeometry args={[1.5, 0.08, 1.3]} /></mesh>
      <ServoBlock position={[0.35, 0.12, 0]} />
      <mesh material={darkGray} position={[0, 0.20, 0]} castShadow><cylinderGeometry args={[0.18, 0.22, 0.08, 32]} /></mesh>

      {/* Bola base */}
      <JointHandle axis="base" angle={angles.base} selectedAxis={selectedAxis} {...hp} position={[0, 0.26, 0]} scale={1.1} />
      <EditableLabel axis="base" label={calibration.axes.base.label} position={labelPositions.base}
        editMode={editMode} onPositionChange={onLabelPositionChange} selectedAxis={selectedAxis} onSelectAxis={onSelectAxis}
        angle={angles.base} calibration={calibration} onChangeAxis={onChangeAxis} onHandleDragChange={onHandleDragChange} />

      {/* ── TORRE GIRATÓRIA ── */}
      <group rotation={[0, rot.base, 0]} position={[0, 0.24, 0]}>
        <mesh material={gray} position={[0, 0.3, -0.2]} castShadow receiveShadow><boxGeometry args={[0.18, 0.6, 0.1]} /></mesh>
        <mesh material={gray} position={[0, 0.3, 0.2]} castShadow receiveShadow><boxGeometry args={[0.18, 0.6, 0.1]} /></mesh>
        <mesh material={darkGray} position={[0, 0.58, 0]} castShadow receiveShadow><boxGeometry args={[0.22, 0.06, 0.5]} /></mesh>
        <ServoBlock position={[0.2, 0.3, 0]} />

        {/* ── BRAÇO SUPERIOR ── */}
        <group rotation={[0, 0, rot.shoulder]} position={[0, 0.58, 0]}>
          {/* Bola ombro */}
          <JointHandle axis="shoulder" angle={angles.shoulder} selectedAxis={selectedAxis} {...hp} position={[0, 0, 0]} scale={1.0} />
          <EditableLabel axis="shoulder" label={calibration.axes.shoulder.label} position={labelPositions.shoulder}
            editMode={editMode} onPositionChange={onLabelPositionChange} selectedAxis={selectedAxis} onSelectAxis={onSelectAxis}
            angle={angles.shoulder} calibration={calibration} onChangeAxis={onChangeAxis} onHandleDragChange={onHandleDragChange} />

          <mesh material={darkGray} castShadow><boxGeometry args={[0.22, 0.16, SP + 0.16]} /></mesh>

          {/* 4 barras paralelas */}
          <mesh material={gray} position={[BW / 2, AL / 2, -SP / 2]} castShadow receiveShadow><boxGeometry args={[BW, AL, 0.08]} /></mesh>
          <mesh material={gray} position={[BW / 2, AL / 2, SP / 2]} castShadow receiveShadow><boxGeometry args={[BW, AL, 0.08]} /></mesh>
          <mesh material={gray} position={[-BW * 1.2, AL / 2, -SP / 2]} castShadow receiveShadow><boxGeometry args={[BW * 0.8, AL, 0.08]} /></mesh>
          <mesh material={gray} position={[-BW * 1.2, AL / 2, SP / 2]} castShadow receiveShadow><boxGeometry args={[BW * 0.8, AL, 0.08]} /></mesh>

          <ServoBlock position={[0.28, 0.85, 0]} />
          <mesh material={pcbMat} position={[0.06, 1.3, 0.25]} rotation={[0.1, 0, 0]} castShadow><boxGeometry args={[0.28, 0.2, 0.02]} /></mesh>
          <mesh material={wireMat} position={[-0.06, 1.4, 0.22]} castShadow><cylinderGeometry args={[0.012, 0.012, 0.5, 8]} /></mesh>

          <mesh material={darkGray} position={[0, AL, 0]} castShadow receiveShadow><boxGeometry args={[0.22, 0.16, SP + 0.16]} /></mesh>

          {/* ── ANTEBRAÇO ── */}
          <group position={[0, AL, 0]} rotation={[0, 0, rot.elbow]}>
            {/* Bola cotovelo */}
            <JointHandle axis="elbow" angle={angles.elbow} selectedAxis={selectedAxis} {...hp} position={[0, 0, 0]} scale={0.9} />
            <EditableLabel axis="elbow" label={calibration.axes.elbow.label} position={labelPositions.elbow}
              editMode={editMode} onPositionChange={onLabelPositionChange} selectedAxis={selectedAxis} onSelectAxis={onSelectAxis}
              angle={angles.elbow} calibration={calibration} onChangeAxis={onChangeAxis} onHandleDragChange={onHandleDragChange} />

            <mesh material={darkGray} castShadow><boxGeometry args={[0.2, 0.14, SP + 0.12]} /></mesh>

            <mesh material={gray} position={[BW / 2, FL / 2, -SP / 2]} castShadow receiveShadow><boxGeometry args={[BW * 0.9, FL, 0.08]} /></mesh>
            <mesh material={gray} position={[BW / 2, FL / 2, SP / 2]} castShadow receiveShadow><boxGeometry args={[BW * 0.9, FL, 0.08]} /></mesh>
            <mesh material={gray} position={[-BW, FL / 2, -SP / 2]} castShadow receiveShadow><boxGeometry args={[BW * 0.7, FL, 0.08]} /></mesh>
            <mesh material={gray} position={[-BW, FL / 2, SP / 2]} castShadow receiveShadow><boxGeometry args={[BW * 0.7, FL, 0.08]} /></mesh>

            <mesh material={darkGray} position={[0, FL, 0]} castShadow receiveShadow><boxGeometry args={[0.2, 0.12, SP + 0.1]} /></mesh>

            {/* ── GARRA ── */}
            <group position={[0, FL, 0]}>
              <JointHandle axis="gripper" angle={angles.gripper} selectedAxis={selectedAxis} {...hp} position={[0, 0.2, 0]} scale={0.75} />
              <EditableLabel axis="gripper" label={calibration.axes.gripper.label} position={labelPositions.gripper}
                editMode={editMode} onPositionChange={onLabelPositionChange} selectedAxis={selectedAxis} onSelectAxis={onSelectAxis}
                angle={angles.gripper} calibration={calibration} onChangeAxis={onChangeAxis} onHandleDragChange={onHandleDragChange} />
              <Gripper open={rot.gripperOpen} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SCENE
   ═══════════════════════════════════════════════════════════════════ */

export function ArmScene(props: ArmSceneProps) {
  const [hoveredAxis, setHoveredAxis] = useState<AxisId | null>(null);
  const [draggingAxis, setDraggingAxis] = useState<AxisId | null>(null);
  const editMode = false;
  const [labelPositions, setLabelPositions] = useState<Record<AxisId, [number, number, number]>>(loadLabelPos);
  const cameraLocked = Boolean(hoveredAxis || draggingAxis);

  const handleLabelPosChange = useCallback((axis: AxisId, pos: [number, number, number]) => {
    setLabelPositions(prev => {
      const next = { ...prev, [axis]: pos };
      saveLabelPos(next);
      return next;
    });
  }, []);

  return (
    <div className={cameraLocked ? 'scene-shell manipulating' : 'scene-shell'}>
      <Canvas camera={{ position: [6.8, 5.1, 7.4], fov: 40 }} shadows gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <color attach="background" args={['#f2efe6']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[2.5, 5.5, 3.5]} intensity={2.6} castShadow shadow-mapSize={[1024, 1024]} />
        <spotLight position={[-4, 4.6, -3]} angle={0.5} penumbra={0.7} intensity={0.9} />
        <ArmModel
          {...props}
          editMode={editMode}
          labelPositions={labelPositions}
          onLabelPositionChange={handleLabelPosChange}
          onHandleHoverChange={(axis, active) => {
            if (editMode) return;
            setHoveredAxis(cur => active ? axis : cur === axis ? null : cur);
          }}
          onHandleDragChange={(axis, active) => {
            if (editMode) return;
            setDraggingAxis(cur => active ? axis : cur === axis ? null : cur);
          }}
        />
        <Grid args={[8, 8]} position={[0, -0.005, 0]} cellColor="#b6afa3" sectionColor="#7f8a87" fadeDistance={9} fadeStrength={1.2} />
        <OrbitControls
          makeDefault enabled={!cameraLocked && !editMode} enablePan enableDamping dampingFactor={0.08}
          target={[0, 1.35, 0]} minDistance={3.8} maxDistance={16}
        />
      </Canvas>

      <div className="scene-badge">
        {AXIS_IDS.map(axis => (
          <button key={axis} className={props.selectedAxis === axis ? 'axis-chip active' : 'axis-chip'}
            onClick={() => props.onSelectAxis(axis)}>
            {props.calibration.axes[axis].label}
          </button>
        ))}
      </div>

    </div>
  );
}
