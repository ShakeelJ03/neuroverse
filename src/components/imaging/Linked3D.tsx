'use client';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { BrainViewer, BrainViewerHandle, RenderMode } from '@/components/brain/BrainViewer';
import { Panel, Segmented } from '@/components/ui';
import { MESH_TO_STRUCTURE, STRUCTURE_BY_ID } from '@/data/structures';
import type { Pathology } from '@/lib/anatomy/model';
import type { V3 } from '@/lib/anatomy/sdf';

/** Plane colours shared with the slice-pane labels (axial, coronal, sagittal). */
export const PLANE_COLOURS = { axial: '#e0895f', coronal: '#a3b88f', sagittal: '#8da3b5' } as const;

function SlicePlane({ size, position, rotation, color }: { size: [number, number]; position: V3; rotation: V3; color: string }) {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(size[0], size[1])), [size]);
  return (
    <group position={position} rotation={rotation}>
      <mesh renderOrder={20}>
        <planeGeometry args={size} />
        <meshBasicMaterial color={color} transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edges} renderOrder={21}>
        <lineBasicMaterial color={color} transparent opacity={0.9} />
      </lineSegments>
    </group>
  );
}

/**
 * Small 3D brain linked to the scans: the three slice planes move with the crosshair, and
 * clicking a structure moves the crosshair (and every scan) to it.
 */
export function Linked3D({ cross, pathology, onCross, children }: { cross: V3; pathology: Pathology; onCross: (p: V3) => void; children?: React.ReactNode }) {
  const viewer = useRef<BrainViewerHandle>(null);
  const [mode, setMode] = useState<RenderMode>('xray');
  const [tab, setTab] = useState<'3d' | 'info'>('3d');
  const [picked, setPicked] = useState<{ mesh: string; side: string } | null>(null);
  const name = picked ? STRUCTURE_BY_ID[MESH_TO_STRUCTURE[picked.mesh]]?.name : null;

  const extra = (
    <>
      <SlicePlane size={[170, 200]} position={[0, cross[1], -14]} rotation={[-Math.PI / 2, 0, 0]} color={PLANE_COLOURS.axial} />
      <SlicePlane size={[170, 150]} position={[0, 10, cross[2]]} rotation={[0, 0, 0]} color={PLANE_COLOURS.coronal} />
      <SlicePlane size={[200, 150]} position={[cross[0], 10, -14]} rotation={[0, Math.PI / 2, 0]} color={PLANE_COLOURS.sagittal} />
      <mesh position={cross} renderOrder={22}>
        <sphereGeometry args={[2.6, 16, 16]} />
        <meshBasicMaterial color="#edebe6" depthTest={false} />
      </mesh>
    </>
  );

  return (
    <Panel className="relative flex min-h-0 flex-col overflow-hidden">
      <div className="absolute left-2 top-2 z-10 flex items-center gap-1.5">
        <Segmented size="sm" value={tab} onChange={setTab} options={[{ value: '3d', label: '3D link' }, { value: 'info', label: 'Info' }]} />
        {tab === '3d' && <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'xray', label: 'X-ray' }, { value: 'anatomical', label: 'Surface' }]} />}
      </div>
      {tab === '3d' ? (
        <>
          <BrainViewer
            ref={viewer}
            pathology={pathology}
            mode={mode}
            hideSourceBadge
            selected={picked ? [picked.mesh] : []}
            initialView="oblique"
            distanceScale={1.15}
            extra={extra}
            onSelectMesh={(id, e) => {
              if (!id || !e) return setPicked(null);
              const pt: V3 = [e.point.x, e.point.y, -e.point.z];
              const isCortex = id.startsWith('cortex-');
              const c = isCortex || id.startsWith('lesion:') || id.startsWith('edema:') ? pt : viewer.current?.centroid(id, pt[0]) ?? pt;
              setPicked({ mesh: id, side: Math.abs(c[0]) < 4 ? '' : c[0] < 0 ? 'left' : 'right' });
              onCross(c.map((v) => Math.round(v)) as V3);
            }}
          />
          <div className="pointer-events-none absolute bottom-2 left-3 right-3 text-[10.5px] leading-snug text-ink-400">
            {name ? (
              <span className="text-ink-100">Scans moved to: <b className="text-primary-accent">{name}</b>{picked?.side ? ` (${picked.side})` : ''}</span>
            ) : (
              'Click a structure to move all scans to it. The planes follow the crosshair.'
            )}
            <span className="mt-0.5 block">
              <span style={{ color: PLANE_COLOURS.axial }}>■ axial</span>{'  '}
              <span style={{ color: PLANE_COLOURS.coronal }}>■ coronal</span>{'  '}
              <span style={{ color: PLANE_COLOURS.sagittal }}>■ sagittal</span>
            </span>
          </div>
        </>
      ) : (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto pt-10">{children}</div>
      )}
    </Panel>
  );
}
