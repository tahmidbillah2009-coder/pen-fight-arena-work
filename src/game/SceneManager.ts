import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GraphicsQuality } from './GameState';
import { QualityProfile } from './QualityController';
import { profileDevice } from './DeviceProfile';

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

/**
 * Profiles the device once, up front, so AUTO quality starts from a sensible tier and never
 * climbs above what the hardware can realistically hold.
 */
export function detectRecommendedQuality(): GraphicsQuality {
  if (typeof window === 'undefined') return 'MEDIUM';
  if (detectSoftwareWebGL()) return 'LOW';
  return profileDevice().initialTier;
}

export interface RenderStats {
  calls: number;
  triangles: number;
  programs: number;
}

/** Shadow-map resolution per shadow tier. */
const SHADOW_MAP_SIZE: Record<'LOW' | 'HIGH' | 'ULTRA', number> = {
  LOW: 512,
  HIGH: 1024,
  ULTRA: 2048,
};

export class SceneManager {
  public readonly scene: THREE.Scene;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly isSoftwareGl: boolean;
  public readonly maxAnisotropy: number;

  private readonly keyLight: THREE.DirectionalLight;
  private readonly envRT: THREE.WebGLRenderTarget;
  private readonly container: HTMLElement;
  private contextLostHandler: (e: Event) => void;
  private contextRestoredHandler: () => void;
  public onContextLostChange?: (lost: boolean) => void;

  /** Current canvas size, kept so a pixel-ratio change can be applied without a resize call. */
  private viewWidth: number;
  private viewHeight: number;
  /** Device pixel ratio cap derived from the resolved quality tier. */
  private pixelRatioCap = 2;
  private resolutionScale = 1;

  constructor(container: HTMLElement) {
    this.container = container;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.scene = new THREE.Scene();
    const bgColor = new THREE.Color(0xe6dccb);
    this.scene.background = bgColor;
    // Calibrated gentle fog so tabletop remains crystal clear even at portrait camera distances
    this.scene.fog = new THREE.FogExp2(0xe6dccb, 0.0042);

    const rect = container.getBoundingClientRect();
    this.viewWidth = Math.max(Math.round(rect.width) || container.clientWidth || window.innerWidth, 1);
    this.viewHeight = Math.max(Math.round(rect.height) || container.clientHeight || window.innerHeight, 1);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(this.viewWidth, this.viewHeight, false);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    // Studio RoomEnvironment for crisp metallic & clearcoat reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Balanced 3-point classroom lighting rig
    const hemi = new THREE.HemisphereLight(0xdfefff, 0x8d6e53, 0.85);
    this.scene.add(hemi);

    this.keyLight = new THREE.DirectionalLight(0xfff1d6, 2.05);
    this.keyLight.position.set(10, 16, 8);
    this.keyLight.target.position.set(0, 0, 0);
    this.scene.add(this.keyLight.target);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.width = 1024;
    this.keyLight.shadow.mapSize.height = 1024;
    this.keyLight.shadow.camera.near = 10;
    this.keyLight.shadow.camera.far = 34;
    this.keyLight.shadow.camera.left = -8.8;
    this.keyLight.shadow.camera.right = 8.8;
    this.keyLight.shadow.camera.top = 7.2;
    this.keyLight.shadow.camera.bottom = -7.2;
    // Calibrated shadow bias & normalBias: prevents shadow acne and self-shadowing without detaching shadows
    this.keyLight.shadow.bias = -0.0001;
    this.keyLight.shadow.normalBias = 0.002;
    this.scene.add(this.keyLight);

    const rimLight = new THREE.DirectionalLight(0xcbe2ff, 0.65);
    rimLight.position.set(-10, 8, -10);
    this.scene.add(rimLight);

    const dom = this.renderer.domElement;
    dom.style.display = 'block';
    dom.style.width = '100%';
    dom.style.height = '100%';
    dom.style.margin = '0';
    dom.style.padding = '0';
    dom.style.border = 'none';
    dom.style.outline = 'none';
    dom.style.touchAction = 'none';
    this.container.appendChild(dom);

    this.contextLostHandler = (e: Event) => {
      e.preventDefault();
      this.onContextLostChange?.(true);
    };
    this.contextRestoredHandler = () => {
      this.onContextLostChange?.(false);
    };
    dom.addEventListener('webglcontextlost', this.contextLostHandler);
    dom.addEventListener('webglcontextrestored', this.contextRestoredHandler);
  }

  /**
   * Triggers an on-demand shadow map update pass.
   * On Intel HD 4600 / Medium / Low, shadows are rendered on-demand when pens move
   * or turn starts rather than re-rendering every idle frame.
   */
  public requestShadowUpdate(): void {
    if (this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  /**
   * Applies a fully-resolved quality profile: shadow tier, device pixel ratio and render
   * resolution. Safe to call repeatedly — each individual change is diffed so we never rebuild
   * the shadow map (or move the canvas backing store) when nothing actually changed.
   */
  public applyProfile(profile: QualityProfile): void {
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.keyLight.castShadow = false;
      return;
    }

    const shadowOn = profile.shadow !== 'OFF';
    const isUltra = profile.quality === 'ULTRA';
    const isHigh = profile.quality === 'HIGH';
    const desiredMapSize = shadowOn ? (isUltra ? 2048 : 1024) : 0;

    if (this.renderer.shadowMap.enabled !== shadowOn) {
      this.renderer.shadowMap.enabled = shadowOn;
    }
    this.keyLight.castShadow = shadowOn;
    if (shadowOn && this.keyLight.shadow.mapSize.width !== desiredMapSize) {
      this.keyLight.shadow.mapSize.set(desiredMapSize, desiredMapSize);
      // Force Three.js to allocate a fresh map at the new resolution on the next shadow pass.
      this.keyLight.shadow.map?.dispose();
      this.keyLight.shadow.map = null;
    }

    // Always use PCFSoftShadowMap for clean, soft, artifact-free shadows on all tiers
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    if (isUltra || profile.quality === 'HIGH') {
      this.renderer.shadowMap.autoUpdate = true;
    } else {
      // MEDIUM & LOW: On-demand shadow caching for Intel HD 4600 / integrated GPUs
      this.renderer.shadowMap.autoUpdate = false;
      this.requestShadowUpdate();
    }

    this.pixelRatioCap = isUltra ? 2 : isHigh ? 1.5 : 1.0;
    if (profile.performanceMode) this.pixelRatioCap = Math.min(this.pixelRatioCap, 1.0);
    this.resolutionScale = profile.resolutionScale;
    this.applyPixelRatio();
  }

  /** Recomputed on every profile change and every resize (orientation switches included). */
  private applyPixelRatio(): void {
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const base = Math.min(dpr, this.pixelRatioCap);
    // Never below 50% of the cap — the canvas would visibly soften past that.
    const ratio = Math.max(0.5, Math.min(base * this.resolutionScale, this.pixelRatioCap));
    if (this.renderer.getPixelRatio() !== ratio) {
      this.renderer.setPixelRatio(ratio);
      this.renderer.setSize(this.viewWidth, this.viewHeight, false);
    }
  }

  public precompile(camera: THREE.Camera): void {
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, camera);
    }
  }

  public resize(width: number, height: number): void {
    const w = Math.max(Math.round(width), 1);
    const h = Math.max(Math.round(height), 1);
    if (this.viewWidth === w && this.viewHeight === h) return;
    this.viewWidth = w;
    this.viewHeight = h;
    // Re-apply the pixel ratio first: a rotation can change `devicePixelRatio` and the canvas
    // backing store must be resized with the *current* ratio, not the one captured at startup.
    this.applyPixelRatio();
    this.renderer.setSize(this.viewWidth, this.viewHeight, false);
  }

  public render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }

  /** Current internal render resolution in pixels for diagnostic telemetry. */
  public getRenderResolution(): { width: number; height: number; scale: number; dpr: number } {
    const dpr = this.renderer.getPixelRatio();
    return {
      width: Math.round(this.viewWidth * dpr),
      height: Math.round(this.viewHeight * dpr),
      scale: this.resolutionScale,
      dpr,
    };
  }

  /** Renderer counters for the performance panel (read straight after a render). */
  public getRenderStats(): RenderStats {
    const info = this.renderer.info;
    return {
      calls: info.render.calls,
      triangles: info.render.triangles,
      programs: info.programs?.length ?? 0,
    };
  }

  public dispose(): void {
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLostHandler);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
    this.envRT.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
