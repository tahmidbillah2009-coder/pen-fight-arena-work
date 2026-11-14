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
import { EdgeDangerLevel } from './GameState';

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

  private createWoodTexture(maxAnisotropy: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Warm honey-oak school desk base
    const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
    grad.addColorStop(0, '#c9935b');
    grad.addColorStop(0.5, '#bf874e');
    grad.addColorStop(1, '#b67d46');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle plank joints & natural wood grain streaks
    for (let i = 0; i < 420; i++) {
      const y = (i / 420) * 1024 + (Math.random() - 0.5) * 3;
      const alpha = 0.03 + Math.random() * 0.07;
      ctx.strokeStyle = i % 2 === 0 ? `rgba(92, 52, 22, ${alpha})` : `rgba(235, 198, 148, ${alpha * 0.8})`;
      ctx.lineWidth = 1 + Math.random() * 2.8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      const wave = (Math.random() - 0.5) * 14;
      ctx.bezierCurveTo(340, y + wave, 680, y - wave, 1024, y + (Math.random() - 0.5) * 6);
      ctx.stroke();
    }

    // Subtle school desk carved border line & center arena line for visual depth
    ctx.strokeStyle = 'rgba(72, 39, 16, 0.24)';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, 976, 976);

    ctx.strokeStyle = 'rgba(255, 245, 228, 0.16)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.moveTo(512, 36);
    ctx.lineTo(512, 988);
    ctx.stroke();
    ctx.setLineDash([]);

    // Small ruler ticks along front edge
    ctx.fillStyle = 'rgba(65, 34, 14, 0.35)';
    for (let x = 64; x <= 960; x += 28) {
      const tall = (x - 64) % 140 === 0 ? 18 : 10;
      ctx.fillRect(x, 986 - tall, 2, tall);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = maxAnisotropy;
    this.disposables.push(texture);
    return texture;
  }

  private createFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#d7cab7';
    ctx.fillRect(0, 0, 512, 512);

    const tileSize = 128;
    for (let gx = 0; gx < 4; gx++) {
      for (let gy = 0; gy < 4; gy++) {
        const shade = (gx + gy) % 2 === 0 ? '#d9ccb9' : '#cfc1ad';
        ctx.fillStyle = shade;
        ctx.fillRect(gx * tileSize + 2, gy * tileSize + 2, tileSize - 4, tileSize - 4);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(9, 9);
    texture.anisotropy = maxAnisotropy;
    this.disposables.push(texture);
    return texture;
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

  private createContactShadowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 124);
    grad.addColorStop(0, 'rgba(25, 16, 10, 0.55)');
    grad.addColorStop(0.65, 'rgba(25, 16, 10, 0.2)');
    grad.addColorStop(1, 'rgba(25, 16, 10, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const tex = new THREE.CanvasTexture(canvas);
    this.disposables.push(tex);
    return tex;
  }

  private buildDesk(maxAnisotropy: number): void {
    const woodTex = this.createWoodTexture(maxAnisotropy);

    // 1. Primary wooden tabletop (top face sits strictly at Y = 0)
    const topGeo = new THREE.BoxGeometry(TABLE_WIDTH, TABLE_THICKNESS, TABLE_DEPTH);
    const topMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      roughness: 0.62,
      metalness: 0.04,
    });
    const tabletop = new THREE.Mesh(topGeo, topMat);
    tabletop.position.set(0, -TABLE_THICKNESS * 0.5, 0);
    tabletop.receiveShadow = true;
    tabletop.castShadow = true;
    this.deskGroup.add(tabletop);
    this.disposables.push(topGeo, topMat);

    // 2. Dark walnut edge trim molding slightly inset below the top surface
    const trimGeo = new THREE.BoxGeometry(TABLE_WIDTH + 0.12, 0.14, TABLE_DEPTH + 0.12);
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x5d3a21,
      roughness: 0.5,
      metalness: 0.08,
    });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(0, -TABLE_THICKNESS + 0.09, 0);
    trim.receiveShadow = true;
    trim.castShadow = true;
    this.deskGroup.add(trim);
    this.disposables.push(trimGeo, trimMat);

    // 3. Merged steel apron & 4 tubular legs (1 single draw call instead of 5)
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.36,
      metalness: 0.72,
    });
    const steelGeometries: THREE.BufferGeometry[] = [];
    const apronGeo = new THREE.BoxGeometry(TABLE_WIDTH - 1.2, 0.52, TABLE_DEPTH - 1.1);
    apronGeo.translate(0, -TABLE_THICKNESS - 0.25, 0);
    steelGeometries.push(apronGeo);

    // 4. Four tubular steel desk legs & glides
    const legHeight = Math.abs(FLOOR_Y) - TABLE_THICKNESS;
    const glideMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.88,
      metalness: 0.05,
    });
    const glideGeometries: THREE.BufferGeometry[] = [];

    const legOffsetX = TABLE_HALF_W - 0.95;
    const legOffsetZ = TABLE_HALF_D - 0.85;
    const legCoords: Array<[number, number]> = [
      [-legOffsetX, -legOffsetZ],
      [legOffsetX, -legOffsetZ],
      [-legOffsetX, legOffsetZ],
      [legOffsetX, legOffsetZ],
    ];

    for (const [lx, lz] of legCoords) {
      const legGeo = new THREE.CylinderGeometry(0.24, 0.18, legHeight, 14);
      legGeo.translate(lx, -TABLE_THICKNESS - legHeight * 0.5, lz);
      steelGeometries.push(legGeo);

      const glideGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.16, 14);
      glideGeo.translate(lx, FLOOR_Y + 0.08, lz);
      glideGeometries.push(glideGeo);
    }

    const mergedSteelGeo = BufferGeometryUtils.mergeGeometries(steelGeometries, false) ?? apronGeo;
    for (const g of steelGeometries) {
      if (g !== mergedSteelGeo) g.dispose();
    }
    const steelMesh = new THREE.Mesh(mergedSteelGeo, steelMat);
    steelMesh.receiveShadow = true;
    this.deskGroup.add(steelMesh);
    this.disposables.push(mergedSteelGeo, steelMat);

    const mergedGlideGeo = BufferGeometryUtils.mergeGeometries(glideGeometries, false) ?? glideGeometries[0];
    for (const g of glideGeometries) {
      if (g !== mergedGlideGeo) g.dispose();
    }
    const glideMesh = new THREE.Mesh(mergedGlideGeo, glideMat);
    this.deskGroup.add(glideMesh);
    this.disposables.push(mergedGlideGeo, glideMat);

    // 5. Soft contact shadow beneath the desk on the classroom floor
    const shadowTex = this.createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(TABLE_WIDTH + 4.5, TABLE_DEPTH + 4.0);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    const deskFloorShadow = new THREE.Mesh(shadowGeo, shadowMat);
    deskFloorShadow.rotation.x = -Math.PI * 0.5;
    deskFloorShadow.position.set(0, FLOOR_Y + 0.02, 0);
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
    const floorTex = this.createFloorTexture(maxAnisotropy);
    const floorGeo = new THREE.PlaneGeometry(90, 90);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.82,
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

    // Merged classroom wood trims (baseboard + chalkboard frame)
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x8b6240,
      roughness: 0.68,
      metalness: 0.04,
    });
    const baseboardGeo = new THREE.BoxGeometry(64, 0.8, 0.9);
    baseboardGeo.translate(0, FLOOR_Y + 0.4, -13.45);

    const frameGeo = new THREE.BoxGeometry(15.1, 6.8, 0.12);
    frameGeo.translate(-1.5, FLOOR_Y + 8.8, -13.08);

    const mergedTrimGeo = BufferGeometryUtils.mergeGeometries([baseboardGeo, frameGeo], false) ?? baseboardGeo;
    baseboardGeo.dispose();
    frameGeo.dispose();
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
