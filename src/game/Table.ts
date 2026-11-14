import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import {
  ArenaOrientation,
  EDGE_WARNING_DISTANCE,
  FLOOR_Y,
  TABLE_DEPTH,
  TABLE_HALF_D,
  TABLE_HALF_W,
  TABLE_THICKNESS,
  TABLE_WIDTH,
} from '../utils/Constants';
import { createClassroomFloorTexture, createDeskSurfaceMaps } from './DeskTextures';
import { EdgeDangerLevel } from './GameState';

const SHADOW_PLANE_W = TABLE_WIDTH + 4.5;
const SHADOW_PLANE_D = TABLE_DEPTH + 4.0;

export class TableEnvironment {
  public readonly group = new THREE.Group();
  private readonly deskGroup = new THREE.Group();
  private readonly wallGroup = new THREE.Group();
  private orientation: ArenaOrientation = 'horizontal';
  private readonly disposables: Array<{ dispose: () => void }> = [];
  private readonly edgeStrips: {
    left: THREE.MeshBasicMaterial;
    right: THREE.MeshBasicMaterial;
    top: THREE.MeshBasicMaterial;
    bottom: THREE.MeshBasicMaterial;
  };
  private readonly _warnColor = new THREE.Color(0xf59e0b);
  private readonly _dangerColor = new THREE.Color(0xef4444);

  constructor(maxAnisotropy: number) {
    this.group.add(this.deskGroup);
    this.group.add(this.wallGroup);
    this.buildDesk(maxAnisotropy);
    this.edgeStrips = this.buildEdgeWarningStrips();
    this.buildClassroomBackdrop(maxAnisotropy);
  }

  public setOrientation(orientation: ArenaOrientation): void {
    if (this.orientation === orientation) return;
    this.orientation = orientation;
    // Rotate entire desk assembly +90° around Y so its 19.5 long axis runs vertically (Z)
    // and Player 1's half maps cleanly to +Z (bottom), Player 2's to -Z (top).
    this.deskGroup.rotation.y = orientation === 'vertical' ? Math.PI * 0.5 : 0;
    // Slide back wall back by 3.8u when vertical so the chalkboard clears the -9.75 table edge.
    this.wallGroup.position.z = orientation === 'vertical' ? -3.8 : 0;
  }

  private createChalkboardTexture(maxAnisotropy: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#254236';
    ctx.fillRect(0, 0, 1024, 512);

    // Subtle chalk dust smudge
    const rad = ctx.createRadialGradient(512, 256, 40, 512, 256, 460);
    rad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    rad.addColorStop(1, 'rgba(0, 0, 0, 0.16)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, 1024, 512);

    // Clean geometric chalk diagrams (physics trajectories & angles)
    ctx.strokeStyle = 'rgba(241, 245, 249, 0.34)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(240, 260, 75, 0, Math.PI * 1.4);
    ctx.stroke();

    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(420, 340);
    ctx.quadraticCurveTo(590, 120, 810, 290);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = 'bold 42px sans-serif';
    ctx.fillStyle = 'rgba(248, 250, 252, 0.42)';
    ctx.textAlign = 'center';
    ctx.fillText('F = m · a', 720, 175);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = maxAnisotropy;
    this.disposables.push(texture);
    return texture;
  }

  /**
   * Builds a beveled, rounded-corner wooden tabletop split into:
   * - `topDeckGeo`: flat playing surface strictly at Y = 0 plus the upper beveled lip (tangent-mapped for normalMap)
   * - `edgeUndersideGeo`: vertical laminated edge banding, lower bevel & unfinished underside board
   */
  private createBeveledTabletopGeometries(): {
    topDeckGeo: THREE.BufferGeometry;
    edgeUndersideGeo: THREE.BufferGeometry;
  } {
    const bevel = 0.04;
    const cornerR = 0.14;
    const innerHalfW = TABLE_HALF_W - bevel;
    const innerHalfD = TABLE_HALF_D - bevel;
    const r = Math.max(0.02, cornerR - bevel);

    const shape = new THREE.Shape();
    shape.moveTo(-innerHalfW + r, -innerHalfD);
    shape.lineTo(innerHalfW - r, -innerHalfD);
    shape.quadraticCurveTo(innerHalfW, -innerHalfD, innerHalfW, -innerHalfD + r);
    shape.lineTo(innerHalfW, innerHalfD - r);
    shape.quadraticCurveTo(innerHalfW, innerHalfD, innerHalfW - r, innerHalfD);
    shape.lineTo(-innerHalfW + r, innerHalfD);
    shape.quadraticCurveTo(-innerHalfW, innerHalfD, -innerHalfW, innerHalfD - r);
    shape.lineTo(-innerHalfW, -innerHalfD + r);
    shape.quadraticCurveTo(-innerHalfW, -innerHalfD, -innerHalfW + r, -innerHalfD);

    const raw = new THREE.ExtrudeGeometry(shape, {
      depth: TABLE_THICKNESS - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 4,
    });
    raw.rotateX(-Math.PI * 0.5);
    raw.computeBoundingBox();
    const box = raw.boundingBox!;
    const cx = (box.min.x + box.max.x) * 0.5;
    const cz = (box.min.z + box.max.z) * 0.5;
    // Align top playing face strictly to Y = 0
    raw.translate(-cx, -box.max.y, -cz);
    raw.computeVertexNormals();

    const posAttr = raw.getAttribute('position') as THREE.BufferAttribute;
    const normAttr = raw.getAttribute('normal') as THREE.BufferAttribute;

    const topPos: number[] = [];
    const topNorm: number[] = [];
    const topUv: number[] = [];

    const edgePos: number[] = [];
    const edgeNorm: number[] = [];
    const edgeUv: number[] = [];

    const ax = new THREE.Vector3();
    const bx = new THREE.Vector3();
    const cxv = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const faceN = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i += 3) {
      ax.fromBufferAttribute(posAttr, i);
      bx.fromBufferAttribute(posAttr, i + 1);
      cxv.fromBufferAttribute(posAttr, i + 2);
      ab.subVectors(bx, ax);
      ac.subVectors(cxv, ax);
      faceN.crossVectors(ab, ac).normalize();

      if (faceN.y > 0.35) {
        for (let k = 0; k < 3; k++) {
          const idx = i + k;
          const vx = posAttr.getX(idx);
          const vy = posAttr.getY(idx);
          const vz = posAttr.getZ(idx);
          topPos.push(vx, vy, vz);
          topNorm.push(normAttr.getX(idx), normAttr.getY(idx), normAttr.getZ(idx));
          topUv.push((vx + TABLE_HALF_W) / TABLE_WIDTH, 1 - (vz + TABLE_HALF_D) / TABLE_DEPTH);
        }
      } else {
        const isBottom = faceN.y <= -0.7;
        for (let k = 0; k < 3; k++) {
          const idx = i + k;
          const vx = posAttr.getX(idx);
          const vy = posAttr.getY(idx);
          const vz = posAttr.getZ(idx);
          edgePos.push(vx, vy, vz);
          edgeNorm.push(normAttr.getX(idx), normAttr.getY(idx), normAttr.getZ(idx));
          if (isBottom) {
            edgeUv.push(
              (vx + TABLE_HALF_W) / TABLE_WIDTH,
              0.02 + 0.45 * ((vz + TABLE_HALF_D) / TABLE_DEPTH)
            );
          } else {
            const along =
              Math.abs(faceN.z) >= Math.abs(faceN.x)
                ? (vx + TABLE_HALF_W) / 4.2
                : (vz + TABLE_HALF_D) / 4.2;
            const heightFrac = Math.max(0, Math.min(1, (vy + TABLE_THICKNESS) / TABLE_THICKNESS));
            edgeUv.push(along, 0.53 + 0.45 * heightFrac);
          }
        }
      }
    }

    raw.dispose();

    const topRaw = new THREE.BufferGeometry();
    topRaw.setAttribute('position', new THREE.Float32BufferAttribute(topPos, 3));
    topRaw.setAttribute('normal', new THREE.Float32BufferAttribute(topNorm, 3));
    topRaw.setAttribute('uv', new THREE.Float32BufferAttribute(topUv, 2));
    const topDeckGeo = BufferGeometryUtils.mergeVertices(topRaw, 1e-4);
    topRaw.dispose();
    topDeckGeo.computeTangents();

    const edgeRaw = new THREE.BufferGeometry();
    edgeRaw.setAttribute('position', new THREE.Float32BufferAttribute(edgePos, 3));
    edgeRaw.setAttribute('normal', new THREE.Float32BufferAttribute(edgeNorm, 3));
    edgeRaw.setAttribute('uv', new THREE.Float32BufferAttribute(edgeUv, 2));
    const edgeUndersideGeo = BufferGeometryUtils.mergeVertices(edgeRaw, 1e-4);
    edgeRaw.dispose();

    return { topDeckGeo, edgeUndersideGeo };
  }

  private buildDesk(maxAnisotropy: number): void {
    // Leg anchor coordinates (slight outward classroom stance from mounting corners down to rubber feet)
    const legTopOffsetX = TABLE_HALF_W - 0.95;
    const legTopOffsetZ = TABLE_HALF_D - 0.85;
    const legFootOffsetX = legTopOffsetX + 0.22;
    const legFootOffsetZ = legTopOffsetZ + 0.16;

    const legSpecs: Array<{ tx: number; tz: number; fx: number; fz: number }> = [
      { tx: -legTopOffsetX, tz: -legTopOffsetZ, fx: -legFootOffsetX, fz: -legFootOffsetZ },
      { tx: legTopOffsetX, tz: -legTopOffsetZ, fx: legFootOffsetX, fz: -legFootOffsetZ },
      { tx: -legTopOffsetX, tz: legTopOffsetZ, fx: -legFootOffsetX, fz: legFootOffsetZ },
      { tx: legTopOffsetX, tz: legTopOffsetZ, fx: legFootOffsetX, fz: legFootOffsetZ },
    ];

    const legFootNormalizedPositions = legSpecs.map(({ fx, fz }) => ({
      nx: (fx + SHADOW_PLANE_W * 0.5) / SHADOW_PLANE_W,
      nz: (fz + SHADOW_PLANE_D * 0.5) / SHADOW_PLANE_D,
    }));

    const maps = createDeskSurfaceMaps(maxAnisotropy, legFootNormalizedPositions);
    this.disposables.push(
      maps.albedo,
      maps.roughness,
      maps.normal,
      maps.edgeUnderside,
      maps.contactShadow
    );

    // 1. Beveled wooden tabletop slab (playing surface sits strictly at Y = 0)
    const { topDeckGeo, edgeUndersideGeo } = this.createBeveledTabletopGeometries();

    const topMat = new THREE.MeshStandardMaterial({
      map: maps.albedo,
      roughnessMap: maps.roughness,
      roughness: 1.0,
      normalMap: maps.normal,
      normalScale: new THREE.Vector2(0.28, 0.28),
      metalness: 0.02,
      envMapIntensity: 0.48,
    });
    const tabletop = new THREE.Mesh(topDeckGeo, topMat);
    tabletop.receiveShadow = true;
    tabletop.castShadow = true;
    this.deskGroup.add(tabletop);
    this.disposables.push(topDeckGeo, topMat);

    // 2. Worn laminated hardwood edge banding & raw underside wood board
    const edgeMat = new THREE.MeshStandardMaterial({
      map: maps.edgeUnderside,
      roughness: 0.66,
      metalness: 0.03,
      envMapIntensity: 0.35,
    });
    const edgeMesh = new THREE.Mesh(edgeUndersideGeo, edgeMat);
    edgeMesh.receiveShadow = true;
    edgeMesh.castShadow = true;
    this.deskGroup.add(edgeMesh);
    this.disposables.push(edgeUndersideGeo, edgeMat);

    // 3. Structural steel underframe: recessed apron rails, cross-ribs, gusset plates, splayed legs & stretchers
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x2f3a47,
      roughness: 0.42,
      metalness: 0.66,
      envMapIntensity: 0.72,
    });
    const steelGeometries: THREE.BufferGeometry[] = [];
    const hardwareGeometries: THREE.BufferGeometry[] = [];
    const glideGeometries: THREE.BufferGeometry[] = [];

    const railY = -TABLE_THICKNESS - 0.15;
    const railSpanX = legTopOffsetX * 2 + 0.18;
    const railSpanZ = legTopOffsetZ * 2 + 0.18;

    // Front & back recessed apron rails
    for (const sz of [-legTopOffsetZ, legTopOffsetZ]) {
      const fbRail = new THREE.BoxGeometry(railSpanX, 0.3, 0.15);
      fbRail.translate(0, railY, sz);
      steelGeometries.push(fbRail);
    }
    // Left & right recessed apron rails
    for (const sx of [-legTopOffsetX, legTopOffsetX]) {
      const lrRail = new THREE.BoxGeometry(0.15, 0.3, railSpanZ);
      lrRail.translate(sx, railY, 0);
      steelGeometries.push(lrRail);
    }
    // Two internal steel under-table stiffening ribs
    for (const rx of [-3.4, 3.4]) {
      const rib = new THREE.BoxGeometry(0.1, 0.2, railSpanZ - 0.2);
      rib.translate(rx, railY + 0.04, 0);
      steelGeometries.push(rib);
    }

    // Splayed tubular steel legs, mounting gusset plates, weld collars, side stretchers, fasteners & rubber glides
    const upVec = new THREE.Vector3(0, 1, 0);
    const legTopY = -TABLE_THICKNESS - 0.04;
    const legBottomY = FLOOR_Y + 0.12;
    const topVec = new THREE.Vector3();
    const botVec = new THREE.Vector3();
    const dirVec = new THREE.Vector3();
    const midVec = new THREE.Vector3();
    const quat = new THREE.Quaternion();

    for (const { tx, tz, fx, fz } of legSpecs) {
      // Corner gusset mounting plate flush under the desk
      const gusset = new THREE.BoxGeometry(0.62, 0.05, 0.62);
      gusset.translate(tx, -TABLE_THICKNESS - 0.025, tz);
      steelGeometries.push(gusset);

      // Weld collar right below corner plate
      const collar = new THREE.CylinderGeometry(0.245, 0.225, 0.16, 14);
      collar.translate(tx, -TABLE_THICKNESS - 0.1, tz);
      steelGeometries.push(collar);

      // Angled tubular steel leg
      topVec.set(tx, legTopY, tz);
      botVec.set(fx, legBottomY, fz);
      dirVec.subVectors(botVec, topVec);
      const legLen = dirVec.length();
      dirVec.normalize();
      quat.setFromUnitVectors(upVec, dirVec);
      midVec.addVectors(topVec, botVec).multiplyScalar(0.5);

      const legGeo = new THREE.CylinderGeometry(0.21, 0.16, legLen, 14);
      legGeo.applyQuaternion(quat);
      legGeo.translate(midVec.x, midVec.y, midVec.z);
      steelGeometries.push(legGeo);

      // Non-slip rubber floor glide resting cleanly at FLOOR_Y
      const glideGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.14, 14);
      glideGeo.translate(fx, FLOOR_Y + 0.07, fz);
      glideGeometries.push(glideGeo);

      // Corner mounting hex bolts under gusset plate
      const sx = Math.sign(tx);
      const sz = Math.sign(tz);
      for (const [bx, bz] of [
        [tx - sx * 0.2, tz - sz * 0.2],
        [tx + sx * 0.18, tz - sz * 0.2],
        [tx - sx * 0.2, tz + sz * 0.18],
      ]) {
        const bolt = new THREE.CylinderGeometry(0.04, 0.04, 0.035, 6);
        bolt.translate(bx, -TABLE_THICKNESS - 0.06, bz);
        hardwareGeometries.push(bolt);
      }
    }

    // Side H-stretcher tie bars connecting front & back legs on left and right sides
    const stretcherY = FLOOR_Y + 1.45;
    const stretcherFrac = (legTopY - stretcherY) / (legTopY - legBottomY);
    const stretcherZ = THREE.MathUtils.lerp(legTopOffsetZ, legFootOffsetZ, stretcherFrac);
    const stretcherX = THREE.MathUtils.lerp(legTopOffsetX, legFootOffsetX, stretcherFrac);
    for (const sx of [-1, 1]) {
      const bar = new THREE.CylinderGeometry(0.08, 0.08, stretcherZ * 2, 10);
      bar.rotateX(Math.PI * 0.5);
      bar.translate(sx * stretcherX, stretcherY, 0);
      steelGeometries.push(bar);
    }

    const mergedSteelGeo = BufferGeometryUtils.mergeGeometries(steelGeometries, false) ?? steelGeometries[0];
    for (const g of steelGeometries) {
      if (g !== mergedSteelGeo) g.dispose();
    }
    const steelMesh = new THREE.Mesh(mergedSteelGeo, steelMat);
    steelMesh.receiveShadow = true;
    steelMesh.castShadow = true;
    this.deskGroup.add(steelMesh);
    this.disposables.push(mergedSteelGeo, steelMat);

    // Merged zinc bolts & hardware
    const hardwareMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.34,
      metalness: 0.85,
    });
    const mergedHardwareGeo =
      BufferGeometryUtils.mergeGeometries(hardwareGeometries, false) ?? hardwareGeometries[0];
    for (const g of hardwareGeometries) {
      if (g !== mergedHardwareGeo) g.dispose();
    }
    const hardwareMesh = new THREE.Mesh(mergedHardwareGeo, hardwareMat);
    this.deskGroup.add(hardwareMesh);
    this.disposables.push(mergedHardwareGeo, hardwareMat);

    // Merged rubber floor glides
    const glideMat = new THREE.MeshStandardMaterial({
      color: 0x1e2530,
      roughness: 0.9,
      metalness: 0.04,
    });
    const mergedGlideGeo = BufferGeometryUtils.mergeGeometries(glideGeometries, false) ?? glideGeometries[0];
    for (const g of glideGeometries) {
      if (g !== mergedGlideGeo) g.dispose();
    }
    const glideMesh = new THREE.Mesh(mergedGlideGeo, glideMat);
    this.deskGroup.add(glideMesh);
    this.disposables.push(mergedGlideGeo, glideMat);

    // 4. Combined soft contact shadow beneath desk & 4 feet on classroom floor
    const shadowGeo = new THREE.PlaneGeometry(SHADOW_PLANE_W, SHADOW_PLANE_D);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: maps.contactShadow,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    const deskFloorShadow = new THREE.Mesh(shadowGeo, shadowMat);
    deskFloorShadow.rotation.x = -Math.PI * 0.5;
    deskFloorShadow.position.set(0, FLOOR_Y + 0.015, 0);
    this.deskGroup.add(deskFloorShadow);
    this.disposables.push(shadowGeo, shadowMat);
  }

  private buildEdgeWarningStrips(): {
    left: THREE.MeshBasicMaterial;
    right: THREE.MeshBasicMaterial;
    top: THREE.MeshBasicMaterial;
    bottom: THREE.MeshBasicMaterial;
  } {
    const stripThick = 0.22;
    const makeMat = () => {
      const m = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      this.disposables.push(m);
      return m;
    };

    const leftMat = makeMat();
    const rightMat = makeMat();
    const topMat = makeMat();
    const bottomMat = makeMat();

    const sideGeo = new THREE.PlaneGeometry(stripThick, TABLE_DEPTH - stripThick * 2);
    sideGeo.rotateX(-Math.PI * 0.5);
    const frontGeo = new THREE.PlaneGeometry(TABLE_WIDTH, stripThick);
    frontGeo.rotateX(-Math.PI * 0.5);
    this.disposables.push(sideGeo, frontGeo);

    const leftMesh = new THREE.Mesh(sideGeo, leftMat);
    leftMesh.position.set(-TABLE_HALF_W + stripThick * 0.5, 0.008, 0);

    const rightMesh = new THREE.Mesh(sideGeo, rightMat);
    rightMesh.position.set(TABLE_HALF_W - stripThick * 0.5, 0.008, 0);

    const topMesh = new THREE.Mesh(frontGeo, topMat);
    topMesh.position.set(0, 0.008, -TABLE_HALF_D + stripThick * 0.5);

    const bottomMesh = new THREE.Mesh(frontGeo, bottomMat);
    bottomMesh.position.set(0, 0.008, TABLE_HALF_D - stripThick * 0.5);

    this.deskGroup.add(leftMesh, rightMesh, topMesh, bottomMesh);
    return { left: leftMat, right: rightMat, top: topMat, bottom: bottomMat };
  }

  private toDeskLocalX(pos: { x: number; z: number }): number {
    return this.orientation === 'vertical' ? -pos.z : pos.x;
  }

  private toDeskLocalZ(pos: { x: number; z: number }): number {
    return this.orientation === 'vertical' ? pos.x : pos.z;
  }

  public updateEdgeWarning(
    playerPos: { x: number; y: number; z: number },
    botPos: { x: number; y: number; z: number },
    playerLevel: EdgeDangerLevel,
    botLevel: EdgeDangerLevel,
    nowMs: number
  ): void {
    const pulse = 0.65 + 0.35 * Math.sin(nowMs * 0.012);

    const px = this.toDeskLocalX(playerPos);
    const pz = this.toDeskLocalZ(playerPos);
    const bx = this.toDeskLocalX(botPos);
    const bz = this.toDeskLocalZ(botPos);

    const pLeft = TABLE_HALF_W + px;
    const pRight = TABLE_HALF_W - px;
    const pTop = TABLE_HALF_D + pz;
    const pBottom = TABLE_HALF_D - pz;

    const bLeft = TABLE_HALF_W + bx;
    const bRight = TABLE_HALF_W - bx;
    const bTop = TABLE_HALF_D + bz;
    const bBottom = TABLE_HALF_D - bz;

    this.applyEdgeStrip(this.edgeStrips.left, pLeft, playerLevel, bLeft, botLevel, pulse);
    this.applyEdgeStrip(this.edgeStrips.right, pRight, playerLevel, bRight, botLevel, pulse);
    this.applyEdgeStrip(this.edgeStrips.top, pTop, playerLevel, bTop, botLevel, pulse);
    this.applyEdgeStrip(this.edgeStrips.bottom, pBottom, playerLevel, bBottom, botLevel, pulse);
  }

  public updateEdgeWarningPens(
    pens: Array<{ pos: { x: number; y: number; z: number }; level: EdgeDangerLevel }>,
    nowMs: number
  ): void {
    if (pens.length === 0) return;
    const pulse = 0.65 + 0.35 * Math.sin(nowMs * 0.012);

    const evalEdge = (mat: THREE.MeshBasicMaterial, getDist: (p: { x: number; y: number; z: number }) => number) => {
      let bestDist = Infinity;
      let bestLevel: EdgeDangerLevel = 'SAFE';
      for (const pen of pens) {
        if (pen.level === 'SAFE') continue;
        const d = getDist(pen.pos);
        if (d < bestDist) {
          bestDist = d;
          bestLevel = pen.level;
        }
      }
      this.applyEdgeStrip(mat, bestDist, bestLevel, Infinity, 'SAFE', pulse);
    };

    evalEdge(this.edgeStrips.left, (p) => TABLE_HALF_W + this.toDeskLocalX(p));
    evalEdge(this.edgeStrips.right, (p) => TABLE_HALF_W - this.toDeskLocalX(p));
    evalEdge(this.edgeStrips.top, (p) => TABLE_HALF_D + this.toDeskLocalZ(p));
    evalEdge(this.edgeStrips.bottom, (p) => TABLE_HALF_D - this.toDeskLocalZ(p));
  }

  /**
   * Tints one edge strip from whichever pen is closest to that edge. Written without closures or
   * temporary objects because it runs for four edges on every single rendered frame.
   */
  private applyEdgeStrip(
    mat: THREE.MeshBasicMaterial,
    playerDist: number,
    playerLevel: EdgeDangerLevel,
    botDist: number,
    botLevel: EdgeDangerLevel,
    pulse: number
  ): void {
    const playerCloser = playerDist <= botDist;
    const dist = playerCloser ? playerDist : botDist;
    const level = playerCloser ? playerLevel : botLevel;

    if (level === 'SAFE' || dist > EDGE_WARNING_DISTANCE) {
      mat.opacity = 0;
      return;
    }
    const norm = Math.max(0, Math.min(1, 1 - dist / EDGE_WARNING_DISTANCE));
    if (level === 'DANGER') {
      mat.color.copy(this._dangerColor);
      mat.opacity = (0.28 + 0.42 * norm) * pulse;
    } else {
      mat.color.copy(this._warnColor);
      mat.opacity = 0.14 + 0.28 * norm;
    }
  }

  private buildClassroomBackdrop(maxAnisotropy: number): void {
    // 1. Classroom floor
    const floorTex = createClassroomFloorTexture(maxAnisotropy);
    this.disposables.push(floorTex);
    const floorGeo = new THREE.PlaneGeometry(90, 90);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.84,
      metalness: 0.02,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI * 0.5;
    floor.position.y = FLOOR_Y;
    floor.receiveShadow = true;
    this.group.add(floor);
    this.disposables.push(floorGeo, floorMat);

    // 2. Back classroom wall (warm cream plaster) & baseboard
    const wallGeo = new THREE.BoxGeometry(64, 24, 0.8);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xefe6d5,
      roughness: 0.9,
      metalness: 0.0,
    });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, FLOOR_Y + 12, -13.5);
    backWall.receiveShadow = true;
    this.wallGroup.add(backWall);
    this.disposables.push(wallGeo, wallMat);

    // 3. Stylized Chalkboard mounted on back wall
    const chalkTex = this.createChalkboardTexture(maxAnisotropy);
    const boardGeo = new THREE.BoxGeometry(14.5, 6.2, 0.16);
    const boardMat = new THREE.MeshStandardMaterial({
      map: chalkTex,
      roughness: 0.85,
      metalness: 0.02,
    });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(-1.5, FLOOR_Y + 8.8, -13.0);
    this.wallGroup.add(board);
    this.disposables.push(boardGeo, boardMat);

    // Merged classroom wood trims (baseboard + chalkboard frame + chalk ledge)
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x8b6240,
      roughness: 0.68,
      metalness: 0.04,
    });
    const baseboardGeo = new THREE.BoxGeometry(64, 0.8, 0.9);
    baseboardGeo.translate(0, FLOOR_Y + 0.4, -13.45);

    const frameGeo = new THREE.BoxGeometry(15.1, 6.8, 0.12);
    frameGeo.translate(-1.5, FLOOR_Y + 8.8, -13.08);

    const chalkTrayGeo = new THREE.BoxGeometry(15.1, 0.16, 0.34);
    chalkTrayGeo.translate(-1.5, FLOOR_Y + 5.5, -12.9);

    const mergedTrimGeo =
      BufferGeometryUtils.mergeGeometries([baseboardGeo, frameGeo, chalkTrayGeo], false) ?? baseboardGeo;
    baseboardGeo.dispose();
    frameGeo.dispose();
    chalkTrayGeo.dispose();
    const mergedTrimMesh = new THREE.Mesh(mergedTrimGeo, trimMat);
    this.wallGroup.add(mergedTrimMesh);
    this.disposables.push(mergedTrimGeo, trimMat);

    // 4. Sunlit Classroom Window Frame on upper right of back wall
    const winFrameMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.5,
      metalness: 0.05,
    });
    const winFrameGeo = new THREE.BoxGeometry(6.8, 7.6, 0.18);
    winFrameGeo.translate(11.5, FLOOR_Y + 9.2, -13.06);

    const mullionVGeo = new THREE.BoxGeometry(0.18, 6.8, 0.22);
    mullionVGeo.translate(11.5, FLOOR_Y + 9.2, -12.92);

    const mullionHGeo = new THREE.BoxGeometry(6.0, 0.18, 0.22);
    mullionHGeo.translate(11.5, FLOOR_Y + 9.2, -12.92);

    const mergedWindowGeo =
      BufferGeometryUtils.mergeGeometries([winFrameGeo, mullionVGeo, mullionHGeo], false) ?? winFrameGeo;
    winFrameGeo.dispose();
    mullionVGeo.dispose();
    mullionHGeo.dispose();
    const winFrame = new THREE.Mesh(mergedWindowGeo, winFrameMat);
    this.wallGroup.add(winFrame);
    this.disposables.push(mergedWindowGeo, winFrameMat);

    const paneGeo = new THREE.PlaneGeometry(6.0, 6.8);
    const paneMat = new THREE.MeshBasicMaterial({
      color: 0xfff6dc,
    });
    const pane = new THREE.Mesh(paneGeo, paneMat);
    pane.position.set(11.5, FLOOR_Y + 9.2, -12.95);
    this.wallGroup.add(pane);
    this.disposables.push(paneGeo, paneMat);
  }

  public dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }
}
