import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PenModel } from '../game/Pen';
import { PEN_SPECS, PenTypeId } from '../utils/Constants';

interface PenPreviewViewerProps {
  penType: PenTypeId;
  /** When true the model is desaturated / dimmed to signal a locked pen. */
  locked?: boolean;
  className?: string;
}

interface ViewerInternals {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  tilt: THREE.Group;
  pen: PenModel;
  envRT: THREE.WebGLRenderTarget;
}

/**
 * Standalone hero viewer for the pen selector. It renders the *exact same* `PenModel` the
 * match uses, so what you preview is literally the object that will appear on the desk.
 *
 * Interaction: drag (mouse or one finger) rotates a full 360°, wheel / pinch zooms, and the
 * model auto-rotates while idle.
 */
export const PenPreviewViewer: React.FC<PenPreviewViewerProps> = ({ penType, locked, className }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const internalsRef = useRef<ViewerInternals | null>(null);
  const penTypeRef = useRef(penType);
  const lockedRef = useRef(!!locked);

  penTypeRef.current = penType;
  lockedRef.current = !!locked;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 320;
    const height = mount.clientHeight || 320;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();

    // Same studio environment as the arena so materials preview identically.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmrem.dispose();

    scene.add(new THREE.HemisphereLight(0xdfefff, 0x8d6e53, 0.9));
    const key = new THREE.DirectionalLight(0xfff1d6, 2.1);
    key.position.set(4, 7, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ec5ff, 1.1);
    rim.position.set(-5, 3, -4);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 60);

    const root = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.rotation.set(0.14, 0, 0.42);
    root.add(tilt);
    scene.add(root);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const pen = new PenModel('player', maxAnisotropy, penTypeRef.current);
    tilt.add(pen.group);

    const internals: ViewerInternals = { renderer, scene, camera, root, tilt, pen, envRT };
    internalsRef.current = internals;

    // --- Camera framing & zoom ---------------------------------------------------------
    let zoom = 1;
    let baseDistance = 5;
    const lookAt = new THREE.Vector3(0, 0, 0);

    const refit = () => {
      const spec = PEN_SPECS[penTypeRef.current];
      const radius = spec.length * 0.6;
      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const distV = radius / Math.tan(vFov * 0.5);
      const hFov = 2 * Math.atan(Math.tan(vFov * 0.5) * camera.aspect);
      const distH = radius / Math.tan(hFov * 0.5);
      baseDistance = Math.max(distV, distH) * 1.12;
      applyCamera();
    };

    const applyCamera = () => {
      const d = THREE.MathUtils.clamp(baseDistance * zoom, 2.2, 22);
      camera.position.set(0, d * 0.26, d * 0.96);
      camera.lookAt(lookAt);
    };

    const resize = () => {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      refit();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom = THREE.MathUtils.clamp(zoom * (e.deltaY > 0 ? 1.08 : 0.92), 0.55, 1.75);
      applyCamera();
    };
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // --- Rotation & pinch --------------------------------------------------------------
    let yaw = 0.5;
    let pitch = 0.14;
    let dragging = false;
    let idleTimer = 0;
    const pointers = new Map<number, { x: number; y: number }>();
    let lastPinchDistance = 0;

    const onPointerDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        dragging = true;
        idleTimer = 0;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        lastPinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      }
      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size >= 2) {
        const pts = [...pointers.values()];
        if (pts.length >= 2) {
          const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          if (lastPinchDistance > 0) {
            zoom = THREE.MathUtils.clamp(zoom * (lastPinchDistance / dist), 0.55, 1.75);
            applyCamera();
          }
          lastPinchDistance = dist;
        }
        return;
      }

      if (!dragging) return;
      idleTimer = 0;
      yaw += (e.clientX - prev.x) * 0.011;
      pitch = THREE.MathUtils.clamp(pitch + (e.clientY - prev.y) * 0.006, -0.7, 0.7);
      tilt.rotation.x = pitch;
      root.rotation.y = yaw;
    };

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) dragging = false;
      if (pointers.size < 2) lastPinchDistance = 0;
      try {
        if (renderer.domElement.hasPointerCapture(e.pointerId)) {
          renderer.domElement.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
    };

    const el = renderer.domElement;
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);

    refit();
    root.rotation.y = yaw;

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    let frameId = 0;
    let lastTime = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (!dragging) {
        idleTimer += dt;
        if (idleTimer > 0.9) {
          yaw += dt * 0.6;
          root.rotation.y = yaw;
        }
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      pen.dispose();
      envRT.dispose();
      renderer.dispose();
      if (el.parentElement === mount) {
        mount.removeChild(el);
      }
      internalsRef.current = null;
    };
    // Viewer is created once; penType swaps are handled in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap the live model whenever the browsed pen changes.
  useEffect(() => {
    const internals = internalsRef.current;
    if (!internals) return;
    internals.pen.setPenType(penType);
    const spec = PEN_SPECS[penType];
    const radius = spec.length * 0.6;
    const vFov = THREE.MathUtils.degToRad(internals.camera.fov);
    const distV = radius / Math.tan(vFov * 0.5);
    const hFov = 2 * Math.atan(Math.tan(vFov * 0.5) * internals.camera.aspect);
    const distH = radius / Math.tan(hFov * 0.5);
    const d = Math.max(distV, distH) * 1.12;
    internals.camera.position.set(0, d * 0.26, d * 0.96);
    internals.camera.lookAt(new THREE.Vector3(0, 0, 0));
  }, [penType]);

  return (
    <div
      ref={mountRef}
      className={`relative h-full w-full transition-all duration-300 ${
        locked ? 'opacity-45 saturate-0' : 'opacity-100'
      } ${className ?? ''}`}
      aria-hidden="true"
    />
  );
};
