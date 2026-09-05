import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  EquirectangularReflectionMapping,
  Float32BufferAttribute,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  NearestMipmapLinearFilter,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer
} from 'three'
import type { Material, Texture } from 'three'

import { CELL, LEVEL, floorHeight, sectorAt, type Sector } from './level'
import { PLAYER_EYE_HEIGHT, type GameWorld, type GameEvent } from './model'
import { FacilityScenery } from './scenery'
import { ENEMY_ART, type EnemyArt } from './enemy-art'
import {
  enemyProjectileTexture,
  type EnemyProjectileArt
} from './projectile-art'
import { pickupTexture, signTexture, surfaceTexture } from './textures'
import { SHUTDOWN_FINALE_SECONDS, type EnemyKind } from './types'

const enemyHeight = {
  deception: 2.15,
  sycophant: 2,
  paperclip: 2.2,
  sam: 3.6
} satisfies Record<EnemyKind, number>
interface GameAssets {
  enemies: Record<EnemyKind, Texture>
  sky: Texture
  surfaces: Record<'stone' | 'panel' | 'server' | 'floor' | 'ceiling', Texture>
}

type Vertex = readonly [number, number, number]
interface GeometryBatch {
  positions: number[]
  colors: number[]
  uvs: number[]
}
interface Particle {
  mesh: Mesh
  velocity: Vector3
  life: number
  duration: number
}

interface ProjectileVisual {
  sprite: Sprite
  trail: Sprite[]
  profile?: Exclude<EnemyKind, 'sycophant'>
}

function radialTexture(shadow = false) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 32)
  gradient.addColorStop(0, shadow ? '#000000b0' : '#ffffffa0')
  gradient.addColorStop(0.25, shadow ? '#00000080' : '#ffffff38')
  gradient.addColorStop(1, '#00000000')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  return new CanvasTexture(canvas)
}

function energyTexture(palette: readonly string[]) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const ctx = canvas.getContext('2d')!
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const dx = (x - 15.5) / 15
      const dy = (y - 15.5) / 15
      const angle = Math.atan2(dy, dx)
      const edge =
        0.82 + Math.sin(angle * 7) * 0.1 + Math.cos(angle * 11) * 0.05
      const radius = Math.hypot(dx, dy) / edge
      if (radius > 1) continue
      const band = Math.min(
        palette.length - 1,
        Math.floor(radius * palette.length)
      )
      ctx.fillStyle = palette[band]!
      ctx.fillRect(x, y, 1, 1)
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.magFilter = texture.minFilter = NearestFilter
  texture.colorSpace = SRGBColorSpace
  return texture
}

export class GameView {
  readonly renderer: WebGLRenderer
  readonly camera = new PerspectiveCamera(66, 1, 0.06, 180)
  readonly scene = new Scene()
  readonly canvas: HTMLCanvasElement
  private readonly resizeObserver: ResizeObserver
  private readonly enemies = new Map<string, Sprite>()
  private readonly shadows = new Map<string, Mesh>()
  private readonly scenery: FacilityScenery
  private readonly pickups = new Map<string, Sprite>()
  private readonly doors = new Map<
    string,
    { group: Group; floor: number; height: number }
  >()
  private readonly projectiles = new Map<string, ProjectileVisual>()
  private readonly textures = new Set<Texture>()
  private readonly particles: Particle[] = []
  private readonly shutdown = new Group()
  private readonly shutdownLabel: Sprite
  private readonly shutdownTime = { value: -1 }
  private readonly shutdownOrigin = {
    value: new Vector3(LEVEL.shutdown.x, 0, LEVEL.shutdown.z)
  }
  private readonly emergency = { value: 0 }
  private readonly lamps: { mesh: Mesh; glow: Sprite; color: Color }[] = []
  private readonly reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  )
  private shutdownStarted: number | undefined
  private readonly flash = { value: 0 }
  private readonly flashPosition = { value: new Vector3() }
  private readonly flashColor = { value: new Color('#ffb45e') }
  private readonly blast = { value: 0 }
  private readonly blastPosition = { value: new Vector3() }
  private readonly blastColor = { value: new Color('#f5a355') }
  private readonly glowMap: Texture
  private readonly energyMaps: Record<'fire' | 'plasma' | 'shutdown', Texture>
  private readonly enemyProjectileMaps: Record<EnemyProjectileArt, Texture>
  private readonly projectileScreen = new Vector3()
  private readonly projectileAhead = new Vector3()
  private readonly scorchMap: Texture
  private readonly decals: Mesh[] = []
  private readonly flares: {
    sprite: Sprite
    life: number
    duration: number
    size: number
  }[] = []
  private readonly map: HTMLCanvasElement
  private readonly visited = new Set<string>()
  private readonly viewport: HTMLElement
  private mapOpen = false
  private lastX = 0
  private lastZ = 0
  private eye = 0
  private stride = 0
  private lastShot = 0
  private lastLanding = 0
  private landingDip = 0
  private recoil = 0
  private weaponDip = 0
  private lastWeapon = 0
  private pickupGlow = 0

  constructor(
    private readonly container: HTMLElement,
    private readonly world: GameWorld,
    assets: GameAssets
  ) {
    this.renderer = new WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance'
    })
    this.renderer.setPixelRatio(1)
    this.renderer.outputColorSpace = SRGBColorSpace
    this.canvas = this.renderer.domElement
    this.canvas.dataset.testid = 'game-canvas'
    this.canvas.tabIndex = 0
    this.canvas.setAttribute(
      'aria-label',
      'P(DOOM) game viewport. WASD to move, mouse or arrows to aim, E to interact, Tab for map.'
    )
    Object.assign(this.canvas.style, {
      width: '100%',
      height: '100%',
      display: 'block',
      imageRendering: 'pixelated',
      outline: 'none'
    })
    container.appendChild(this.canvas)
    this.viewport = container.parentElement ?? container
    assets.sky.mapping = EquirectangularReflectionMapping
    assets.sky.colorSpace = SRGBColorSpace
    this.scene.background = this.own(assets.sky)
    this.scene.backgroundIntensity = 0.72
    this.scene.fog = new Fog('#100d17', 18, 90)
    this.camera.rotation.order = 'YXZ'
    this.eye = world.player.y + PLAYER_EYE_HEIGHT
    this.camera.position.set(world.player.x, this.eye, world.player.z)
    this.lastX = world.player.x
    this.lastZ = world.player.z
    this.buildArchitecture(assets.surfaces)
    this.scenery = new FacilityScenery(
      this.scene,
      world,
      assets.surfaces.panel,
      (texture) => this.own(texture),
      (x, y, z) => this.lightAt(x, y, z),
      (map, vertexColors, color) => this.material(map, vertexColors, color)
    )
    this.glowMap = this.own(radialTexture())
    this.energyMaps = {
      fire: this.own(
        energyTexture(['#fffbe0', '#ffd989', '#ff973b', '#ca4021', '#752419c0'])
      ),
      plasma: this.own(
        energyTexture(['#f3ffff', '#a9f4fa', '#45ccd9', '#2786bd', '#214e83a0'])
      ),
      shutdown: this.own(
        energyTexture(['#f6ffce', '#d9f38a', '#99cb4e', '#588d35', '#355132a0'])
      )
    }
    this.enemyProjectileMaps = {
      paperclip: this.own(enemyProjectileTexture('paperclip')),
      sam: this.own(enemyProjectileTexture('sam'))
    }
    this.scorchMap = this.own(radialTexture(true))

    for (const atlas of Object.values(assets.enemies)) {
      atlas.magFilter = atlas.minFilter = NearestFilter
      atlas.colorSpace = SRGBColorSpace
      this.own(atlas)
    }
    const shadowMap = this.own(radialTexture(true))
    for (const enemy of world.enemies) {
      const map = this.own(assets.enemies[enemy.kind].clone())
      map.needsUpdate = true
      const sprite = new Sprite(
        new SpriteMaterial({
          map,
          alphaTest: 0.28,
          transparent: true,
          depthWrite: true
        })
      )
      sprite.center.set(0.5, 0)
      const art: EnemyArt = ENEMY_ART[enemy.kind]
      if (art.cutouts?.length) {
        const { width, height } = map.image as HTMLImageElement
        const pose = { value: 0 }
        sprite.userData.atlasPose = pose
        const masks = art.cutouts
          .map(
            (cutout) =>
              `if (atlasPose == ${cutout.frame.toFixed(1)} && vMapUv.x >= ${cutout.x / width} && vMapUv.x <= ${(cutout.x + cutout.width) / width} && vMapUv.y <= ${1 - cutout.y / height} && vMapUv.y >= ${1 - (cutout.y + cutout.height) / height}) discard;`
          )
          .join('\n')
        sprite.material.onBeforeCompile = (shader) => {
          shader.uniforms.atlasPose = pose
          shader.fragmentShader =
            `uniform float atlasPose;\n${shader.fragmentShader}`.replace(
              '#include <map_fragment>',
              `#include <map_fragment>\n${masks}`
            )
        }
        sprite.material.customProgramCacheKey = () => masks
      }
      this.enemies.set(enemy.id, sprite)
      this.scene.add(sprite)
      const shadow = new Mesh(
        new PlaneGeometry(1, 1),
        new MeshBasicMaterial({
          map: shadowMap,
          transparent: true,
          depthWrite: false
        })
      )
      shadow.rotation.x = -Math.PI / 2
      this.shadows.set(enemy.id, shadow)
      this.scene.add(shadow)
    }
    for (const pickup of world.pickups) {
      const map = this.own(
        pickupTexture(pickup.kind, pickup.weapon, pickup.ammoPool)
      )
      const sprite = new Sprite(
        new SpriteMaterial({ map, alphaTest: 0.2, transparent: true })
      )
      sprite.scale.setScalar(pickup.kind === 'weapon' ? 1.65 : 1.05)
      sprite.center.set(0.5, 0)
      this.pickups.set(pickup.id, sprite)
      this.scene.add(sprite)
    }
    const shutdownFloor = floorHeight(LEVEL.shutdown.x, LEVEL.shutdown.z)
    const base = new Mesh(
      new BoxGeometry(1.75, 1.2, 1.55),
      this.material(
        assets.surfaces.panel,
        false,
        this.lightAt(LEVEL.shutdown.x, shutdownFloor + 0.6, LEVEL.shutdown.z)
      )
    )
    base.position.y = 0.6
    const button = new Mesh(
      new CylinderGeometry(0.68, 0.73, 0.24, 12),
      new MeshBasicMaterial({ color: '#f04428' })
    )
    button.position.y = 1.31
    this.shutdown.add(base, button)
    const collar = new Mesh(
      new CylinderGeometry(0.83, 0.83, 0.12, 12),
      new MeshBasicMaterial({ color: '#b99953' })
    )
    collar.position.y = 1.21
    this.shutdown.add(collar)
    for (const x of [-0.73, 0.73]) {
      for (const z of [-0.65, 0.65]) {
        const bolt = new Mesh(
          new CylinderGeometry(0.07, 0.07, 0.05, 6),
          new MeshBasicMaterial({ color: '#9b9689' })
        )
        bolt.position.set(x, 1.23, z)
        this.shutdown.add(bolt)
      }
    }
    this.shutdown.position.set(
      LEVEL.shutdown.x,
      shutdownFloor,
      LEVEL.shutdown.z
    )
    this.scene.add(this.shutdown)
    const label = new Sprite(
      new SpriteMaterial({
        map: this.own(
          signTexture('STOP AI TRAINING\nEMERGENCY SHUTDOWN', '#efae7e')
        )
      })
    )
    label.scale.set(3.8, 1.05, 1)
    label.position.set(LEVEL.shutdown.x, shutdownFloor + 2.45, LEVEL.shutdown.z)
    this.shutdownLabel = label
    this.scene.add(label)

    this.map = document.createElement('canvas')
    this.map.width = LEVEL.grid[0]!.length * 8
    this.map.height = LEVEL.grid.length * 8 + 35
    this.map.dataset.testid = 'automap'
    this.map.setAttribute(
      'aria-label',
      'Facility map. The map is not the territory.'
    )
    Object.assign(this.map.style, {
      position: 'absolute',
      top: '10%',
      right: '3%',
      width: 'min(42%, 450px)',
      height: 'auto',
      maxHeight: '75%',
      objectFit: 'contain',
      display: 'none',
      border: '1px solid #88746c',
      background: '#100d17ed',
      zIndex: '8',
      imageRendering: 'pixelated',
      pointerEvents: 'none'
    })
    container.appendChild(this.map)
    const resize = () => {
      const width = Math.max(1, container.clientWidth)
      const height = Math.max(1, container.clientHeight)
      const renderHeight = Math.min(480, Math.round(height * 0.67))
      this.renderer.setSize(
        Math.round((renderHeight * width) / height),
        renderHeight,
        false
      )
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
    }
    this.resizeObserver = new ResizeObserver(resize)
    this.resizeObserver.observe(container)
    resize()
  }

  private own(texture: Texture) {
    this.textures.add(texture)
    return texture
  }

  /** Baked sector color with one inexpensive, transient muzzle light. */
  private material(map: Texture, vertexColors = false, color?: Color) {
    const material = new MeshBasicMaterial({
      map,
      vertexColors,
      color: color ?? 0xffffff,
      side: DoubleSide
    })
    material.onBeforeCompile = (shader) => {
      shader.uniforms.retroFlash = this.flash
      shader.uniforms.retroFlashPosition = this.flashPosition
      shader.uniforms.retroFlashColor = this.flashColor
      shader.uniforms.retroBlast = this.blast
      shader.uniforms.retroBlastPosition = this.blastPosition
      shader.uniforms.retroBlastColor = this.blastColor
      shader.uniforms.retroShutdownTime = this.shutdownTime
      shader.uniforms.retroShutdownOrigin = this.shutdownOrigin
      shader.uniforms.retroEmergency = this.emergency
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 retroWorld;'
        )
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nretroWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;'
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 retroWorld;\nuniform float retroFlash;\nuniform vec3 retroFlashPosition;\nuniform vec3 retroFlashColor;\nuniform float retroBlast;\nuniform vec3 retroBlastPosition;\nuniform vec3 retroBlastColor;\nuniform float retroShutdownTime;\nuniform vec3 retroShutdownOrigin;\nuniform float retroEmergency;'
        )
        .replace(
          '#include <opaque_fragment>',
          `float flashFalloff = max(0.0, 1.0 - distance(retroWorld, retroFlashPosition) / 11.0);
float blastFalloff = max(0.0, 1.0 - distance(retroWorld, retroBlastPosition) / 15.0);
outgoingLight += diffuseColor.rgb * (retroFlashColor * retroFlash * flashFalloff * flashFalloff + retroBlastColor * retroBlast * blastFalloff * blastFalloff);
float labDistance = distance(retroWorld.xz, retroShutdownOrigin.xz);
float emergencyLight = retroEmergency * max(0.0, 1.0 - labDistance / 36.0);
outgoingLight = mix(outgoingLight, outgoingLight * vec3(2.1, 0.22, 0.12) + vec3(0.045, 0.0, 0.0), emergencyLight);
if (retroShutdownTime >= 0.0) {
  float bank = min(6.0, floor(labDistance / 7.0));
  float disconnected = smoothstep(0.22 + bank * 0.2, 0.31 + bank * 0.2, retroShutdownTime);
  outgoingLight *= mix(1.0, 0.025, disconnected) * (1.0 - smoothstep(1.5, 2.05, retroShutdownTime));
}
#include <opaque_fragment>`
        )
    }
    return material
  }

  private lightAt(
    x: number,
    y: number,
    z: number,
    wall = false,
    sector: Sector = sectorAt(x, z)
  ) {
    const color = new Color(sector.color).multiplyScalar(
      sector.light * (wall ? 0.85 : 1)
    )
    if (wall) {
      const height = Math.max(
        0,
        Math.min(1, (y - sector.floor) / (sector.ceiling - sector.floor))
      )
      color.multiplyScalar(1 - height * 0.22)
      if (sector.sky)
        color.add(new Color('#8d83c0').multiplyScalar(height * 0.13))
    }
    // Authored lamp pools make doors and changes of route readable in the dark.
    for (const lamp of LEVEL.decorations) {
      if (lamp.kind !== 'light') continue
      const distance = Math.hypot(x - lamp.x, (y - lamp.y) * 0.75, z - lamp.z)
      const strength = Math.max(0, 1 - distance / 8.5)
      if (strength)
        color.add(
          new Color(lamp.color).multiplyScalar(strength * strength * 0.38)
        )
    }
    return color
  }

  private buildArchitecture(surfaces: GameAssets['surfaces']) {
    for (const texture of Object.values(surfaces)) {
      texture.magFilter = NearestFilter
      texture.minFilter = NearestMipmapLinearFilter
      texture.colorSpace = SRGBColorSpace
      texture.wrapS = texture.wrapT = RepeatWrapping
      this.own(texture)
    }
    const tread = this.own(surfaceTexture('tread'))
    const batches = new Map<Texture, GeometryBatch>()
    const quad = (
      map: Texture,
      sector: Sector,
      vertices: readonly Vertex[],
      scaleU = 1,
      scaleV = 1,
      wall = false
    ) => {
      let batch = batches.get(map)
      if (!batch) {
        batch = { positions: [], colors: [], uvs: [] }
        batches.set(map, batch)
      }
      const uv = [
        [0, 0],
        [scaleU, 0],
        [scaleU, scaleV],
        [0, scaleV]
      ]
      for (const index of [0, 1, 2, 0, 2, 3]) {
        const vertex = vertices[index]!
        const light = this.lightAt(
          vertex[0],
          vertex[1],
          vertex[2],
          wall,
          sector
        )
        batch.positions.push(...vertex)
        batch.colors.push(light.r, light.g, light.b)
        batch.uvs.push(...uv[index]!)
      }
    }
    for (let row = 0; row < LEVEL.grid.length; row++) {
      for (let column = 0; column < LEVEL.grid[row]!.length; column++) {
        if (LEVEL.grid[row]![column] === '#') continue
        const left = column * CELL
        const right = left + CELL
        const top = row * CELL
        const bottom = top + CELL
        const sector = sectorAt(left + CELL / 2, top + CELL / 2)
        const { floor, ceiling } = sector
        quad(surfaces[sector.floorMaterial], sector, [
          [left, floor, top],
          [right, floor, top],
          [right, floor, bottom],
          [left, floor, bottom]
        ])
        if (!sector.sky) {
          quad(surfaces.ceiling, sector, [
            [left, ceiling, bottom],
            [right, ceiling, bottom],
            [right, ceiling, top],
            [left, ceiling, top]
          ])
        }
        const edges = [
          { dx: 0, dz: -1, a: [left, top], b: [right, top] },
          { dx: 1, dz: 0, a: [right, top], b: [right, bottom] },
          { dx: 0, dz: 1, a: [right, bottom], b: [left, bottom] },
          { dx: -1, dz: 0, a: [left, bottom], b: [left, top] }
        ]
        for (const edge of edges) {
          const tile = LEVEL.grid[row + edge.dz]?.[column + edge.dx]
          const solid = !tile || tile === '#'
          const neighbor = sectorAt(
            (column + edge.dx + 0.5) * CELL,
            (row + edge.dz + 0.5) * CELL
          )
          const wallFace = (
            low: number,
            high: number,
            texture: Texture,
            inset = 0.008
          ) => {
            if (high - low < 0.005) return
            // Offset structural bands toward the room to avoid coplanar faces.
            const insetX = -edge.dx * inset
            const insetZ = -edge.dz * inset
            quad(
              texture,
              sector,
              [
                [edge.a[0]! + insetX, low, edge.a[1]! + insetZ],
                [edge.b[0]! + insetX, low, edge.b[1]! + insetZ],
                [edge.b[0]! + insetX, high, edge.b[1]! + insetZ],
                [edge.a[0]! + insetX, high, edge.a[1]! + insetZ]
              ],
              1,
              (high - low) / CELL,
              true
            )
          }
          if (solid) {
            wallFace(floor, ceiling, surfaces[sector.wallMaterial])
            // Thin structural bands sit against the solid wall, never across a path.
            wallFace(floor + 0.05, floor + 0.21, surfaces.panel, 0.02)
            wallFace(ceiling - 0.4, ceiling - 0.14, surfaces.panel, 0.02)
          } else {
            if (neighbor.floor < floor - 0.05) {
              // Narrow metal nosing makes stair treads and drop edges readable from above.
              const inwardX = -edge.dx * 0.16
              const inwardZ = -edge.dz * 0.16
              quad(tread, sector, [
                [edge.a[0]!, floor + 0.012, edge.a[1]!],
                [edge.b[0]!, floor + 0.012, edge.b[1]!],
                [edge.b[0]! + inwardX, floor + 0.012, edge.b[1]! + inwardZ],
                [edge.a[0]! + inwardX, floor + 0.012, edge.a[1]! + inwardZ]
              ])
            }
            if (neighbor.floor > floor)
              wallFace(floor, neighbor.floor, surfaces.panel)
            if (neighbor.ceiling < ceiling && !neighbor.sky)
              wallFace(neighbor.ceiling, ceiling, surfaces[sector.wallMaterial])
          }
        }
      }
    }
    for (const [map, batch] of batches) {
      const geometry = new BufferGeometry()
      geometry.setAttribute(
        'position',
        new Float32BufferAttribute(batch.positions, 3)
      )
      geometry.setAttribute(
        'color',
        new Float32BufferAttribute(batch.colors, 3)
      )
      geometry.setAttribute('uv', new Float32BufferAttribute(batch.uvs, 2))
      this.scene.add(new Mesh(geometry, this.material(map, true)))
    }

    const doorMap = this.own(surfaceTexture('door'))
    for (const door of LEVEL.doors) {
      const sector = sectorAt(door.x, door.z)
      const height = sector.ceiling - sector.floor
      const doorMaterial = this.material(
        doorMap,
        false,
        this.lightAt(door.x, sector.floor + height / 2, door.z)
      )
      const horizontalTravel = LEVEL.grid[door.row]?.[door.column - 1] !== '#'
      const group = new Group()
      const slab = new Mesh(new BoxGeometry(CELL, height, 0.28), doorMaterial)
      group.add(slab)
      for (const x of [-CELL / 2 + 0.07, CELL / 2 - 0.07]) {
        const strip = new Mesh(
          new BoxGeometry(0.1, height, 0.34),
          new MeshBasicMaterial({ color: door.secret ? '#605066' : '#9b5f34' })
        )
        strip.position.x = x
        group.add(strip)
      }
      group.rotation.y = horizontalTravel ? Math.PI / 2 : 0
      group.position.set(door.x, sector.floor + height / 2, door.z)
      this.doors.set(door.id, { group, floor: sector.floor, height })
      this.scene.add(group)
      const header = new Mesh(
        new BoxGeometry(CELL + 0.16, 0.35, 0.65),
        this.material(
          surfaces.panel,
          false,
          this.lightAt(door.x, sector.ceiling - 0.1, door.z)
        )
      )
      header.rotation.y = group.rotation.y
      header.position.set(door.x, sector.ceiling - 0.1, door.z)
      this.scene.add(header)
    }
    for (const sign of LEVEL.signs) {
      const width = 'width' in sign ? sign.width : 3.1
      const height = 'height' in sign ? sign.height : 1.16
      const layout = 'layout' in sign ? sign.layout : undefined
      const mesh = new Mesh(
        new PlaneGeometry(width, height),
        new MeshBasicMaterial({
          map: this.own(signTexture(sign.text, sign.color, layout)),
          color: '#b5aaa0'
        })
      )
      mesh.position.set(sign.x, floorHeight(sign.x, sign.z) + 2.1, sign.z)
      mesh.rotation.y = sign.angle
      this.scene.add(mesh)
    }
    const glowMap = this.own(radialTexture())
    for (const decoration of LEVEL.decorations) {
      const material =
        decoration.kind === 'light'
          ? new MeshBasicMaterial({ color: decoration.color })
          : this.material(
              surfaces[decoration.kind === 'terminal' ? 'server' : 'panel'],
              false,
              this.lightAt(decoration.x, decoration.y, decoration.z).multiply(
                new Color(decoration.color)
              )
            )
      const mesh = new Mesh(
        new BoxGeometry(decoration.width, decoration.height, decoration.depth),
        material
      )
      mesh.position.set(decoration.x, decoration.y, decoration.z)
      mesh.rotation.y = decoration.angle
      this.scene.add(mesh)
      if (decoration.kind === 'light') {
        const glow = new Sprite(
          new SpriteMaterial({
            map: glowMap,
            color: decoration.color,
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
            opacity: 0.22
          })
        )
        glow.position.copy(mesh.position)
        glow.scale.setScalar(
          Math.max(decoration.width, decoration.height, 0.6) * 2.5
        )
        this.scene.add(glow)
        this.lamps.push({ mesh, glow, color: new Color(decoration.color) })
      }
    }
  }

  toggleMap() {
    this.mapOpen = !this.mapOpen
    this.map.style.display = this.mapOpen ? 'block' : 'none'
  }

  handleEvent(event: GameEvent) {
    if (event.type === 'win') {
      this.shutdownStarted ??= performance.now()
      this.mapOpen = false
      this.map.style.display = 'none'
    } else if (event.type === 'pickup') {
      this.pickupGlow = 0.14
    } else if (event.type === 'impact') {
      const position = new Vector3(event.x, event.y, event.z)
      const actor = event.surface === 'enemy' || event.surface === 'player'
      this.burst(position, actor ? '#a64530' : '#e7bd78', actor ? 4 : 3)
      if (event.surface === 'wall') {
        const size = event.weapon === 2 ? 0.26 : 0.12
        const decal = new Mesh(
          new PlaneGeometry(size, size),
          new MeshBasicMaterial({
            map: this.scorchMap,
            transparent: true,
            depthWrite: false,
            opacity: 0.9
          })
        )
        const normal = new Vector3(
          event.normal.x,
          event.normal.y,
          event.normal.z
        )
        decal.position.copy(position).addScaledVector(normal, 0.025)
        decal.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), normal)
        this.scene.add(decal)
        this.decals.push(decal)
        if (this.decals.length > 64) {
          const oldest = this.decals.shift()!
          this.scene.remove(oldest)
          oldest.geometry.dispose()
          ;(oldest.material as Material).dispose()
        }
      }
    } else if (event.type === 'explosion') {
      const position = new Vector3(event.x, event.y, event.z)
      const shutdown = event.source === 'shutdown'
      this.burst(
        position,
        shutdown ? '#b4da80' : '#e6994b',
        24,
        shutdown ? 3 : 2.4
      )
      this.blast.value = 2.6
      this.blastPosition.value.copy(position)
      this.blastColor.value.set(shutdown ? '#afd979' : '#fbb05c')
      if (this.flares.length < 12) {
        const sprite = new Sprite(
          new SpriteMaterial({
            map: this.energyMaps[shutdown ? 'shutdown' : 'fire'],
            depthWrite: false,
            transparent: true
          })
        )
        sprite.position.copy(position)
        const halo = new Sprite(
          new SpriteMaterial({
            map: this.glowMap,
            color: shutdown ? '#b9ef78' : '#ffad52',
            blending: AdditiveBlending,
            depthWrite: false,
            transparent: true
          })
        )
        halo.scale.setScalar(2.2)
        sprite.add(halo)
        this.scene.add(sprite)
        this.flares.push({
          sprite,
          life: 0.7,
          duration: 0.7,
          size: shutdown ? 6 : 3.2
        })
      }
    }
  }

  private burst(position: Vector3, color: string, count: number, scale = 1) {
    for (let i = 0; i < count && this.particles.length < 72; i++) {
      const mesh = new Mesh(
        new BoxGeometry(0.045 * scale, 0.045 * scale, 0.045 * scale),
        new MeshBasicMaterial({ color, transparent: true })
      )
      mesh.position.copy(position)
      this.scene.add(mesh)
      const phase = i * 2.399 + this.world.time
      const duration = 0.2 + (i % 4) * 0.08
      this.particles.push({
        mesh,
        velocity: new Vector3(
          Math.cos(phase) * 1.8,
          1 + (i % 3) * 0.4,
          Math.sin(phase) * 1.8
        ).multiplyScalar(scale),
        life: duration,
        duration
      })
    }
  }

  render(dt: number) {
    const world = this.world
    const player = world.player
    if (world.phase === 'won') this.shutdownStarted ??= performance.now()
    const shutdownElapsed =
      this.shutdownStarted === undefined
        ? -1
        : this.reducedMotion.matches
          ? SHUTDOWN_FINALE_SECONDS
          : (performance.now() - this.shutdownStarted) / 1000
    this.shutdownTime.value = shutdownElapsed
    this.emergency.value =
      world.bossEnraged && !world.bossDefeated
        ? 0.54 +
          (this.reducedMotion.matches ? 0 : Math.sin(world.time * 2.4) * 0.13)
        : 0
    const moved = Math.hypot(player.x - this.lastX, player.z - this.lastZ)
    const moving = moved > 0.0005
    this.stride += moved * 1.7
    const speed = Math.min(1, Math.hypot(player.vx, player.vz) / 7)
    if (world.landingCounter !== this.lastLanding) {
      this.lastLanding = world.landingCounter
      this.landingDip = Math.min(0.16, world.landingImpact * 0.012)
    }
    this.landingDip *= Math.exp(-dt * 11)
    this.recoil *= Math.exp(-dt * 15)
    this.flash.value *= Math.exp(-dt * 16)
    this.blast.value *= Math.exp(-dt * 7)
    this.weaponDip *= Math.exp(-dt * 16)
    this.pickupGlow *= Math.exp(-dt * 11)
    this.viewport.style.setProperty('--pickup-glow', String(this.pickupGlow))
    if (player.weapon !== this.lastWeapon) {
      this.lastWeapon = player.weapon
      this.weaponDip = 35
    }
    if (world.shotCounter !== this.lastShot) {
      this.lastShot = world.shotCounter
      this.flash.value =
        player.weapon === 3 ? 2.6 : player.weapon === 2 ? 0.6 : 1.1
      this.flashColor.value.set(
        player.weapon === 2
          ? '#53baca'
          : player.weapon === 3
            ? '#a7da6c'
            : '#ffa55e'
      )
      this.flashPosition.value.set(player.x, player.y + 1.4, player.z)
      this.recoil = player.weapon === 1 ? 1 : player.weapon === 3 ? 1.25 : 0.4
    }
    const targetEye = player.y + PLAYER_EYE_HEIGHT
    this.eye += (targetEye - this.eye) * (1 - Math.exp(-dt * 22))
    this.camera.position.set(
      player.x,
      this.eye +
        (player.grounded ? Math.sin(this.stride * 2) * 0.034 * speed : 0) -
        this.landingDip,
      player.z
    )
    this.camera.rotation.set(this.recoil * 0.018, player.angle, 0, 'YXZ')
    this.lastX = player.x
    this.lastZ = player.z
    this.canvas.dataset.x = player.x.toFixed(2)
    this.canvas.dataset.y = player.y.toFixed(3)
    this.canvas.dataset.z = player.z.toFixed(2)
    this.canvas.dataset.angle = player.angle.toFixed(3)
    this.canvas.dataset.moving = String(moving)
    this.canvas.dataset.grounded = String(player.grounded)
    this.canvas.dataset.sector = sectorAt(player.x, player.z).id
    this.canvas.dataset.sky = String(sectorAt(player.x, player.z).sky)
    this.viewport.style.setProperty(
      '--sway-x',
      `${Math.sin(this.stride) * 7 * speed}px`
    )
    this.viewport.style.setProperty(
      '--sway-y',
      `${Math.abs(Math.cos(this.stride)) * 6 * speed + this.landingDip * 45 + this.weaponDip}px`
    )
    this.viewport.style.setProperty(
      '--weapon-light',
      String(
        Math.min(
          1.2,
          0.67 +
            sectorAt(player.x, player.z).light * 0.34 +
            this.flash.value * 0.2
        )
      )
    )

    for (const enemy of world.enemies) {
      const sprite = this.enemies.get(enemy.id)!
      const alive = enemy.health > 0
      const size = enemyHeight[enemy.kind]
      const attack = enemy.state === 'attack'
      if (dt > 0) {
        sprite.userData.walking =
          enemy.state === 'move' &&
          Math.hypot(
            enemy.x - (sprite.userData.lastX ?? enemy.x),
            enemy.z - (sprite.userData.lastZ ?? enemy.z)
          ) > 0.0005
        sprite.userData.lastX = enemy.x
        sprite.userData.lastZ = enemy.z
      }
      const walking = sprite.userData.walking === true
      const frame = !alive
        ? 5
        : attack
          ? enemy.attackReleased
            ? 4
            : 3
          : walking
            ? 1 + (Math.floor(world.time * 7 + enemy.x) % 2)
            : 0
      const art: EnemyArt = ENEMY_ART[enemy.kind]
      if (art.cutouts?.length) sprite.userData.atlasPose.value = frame
      const rect = art.frames[frame]!
      const [rawX, rawY, rawWidth, rawHeight] = rect
      const x = Math.max(0, rawX - 2)
      const y = Math.max(0, rawY - 2)
      const width = rawWidth + rawX - x + 2
      const height = rawHeight + rawY - y + 2
      const eye = alive ? art.eyes?.[frame] : undefined
      if (sprite.userData.frame !== frame) {
        sprite.userData.frame = frame
        const map = sprite.material.map!
        const sheet = map.image as HTMLImageElement
        map.repeat.set(width / sheet.width, height / sheet.height)
        map.offset.set(x / sheet.width, 1 - (y + height) / sheet.height)
        sprite.center.set(
          ((eye?.[0] ?? (((frame % 3) + 0.5) * sheet.width) / 3) - x) / width,
          (y + height - (eye?.[1] ?? rawY + rawHeight)) / height
        )
      }
      const floating =
        enemy.kind === 'paperclip' && alive
          ? 0.3 + Math.sin(world.time * 2 + enemy.x) * 0.12
          : 0
      sprite.position.set(
        enemy.x,
        enemy.y +
          0.025 +
          floating +
          (eye ? size * 0.5 : 0) +
          (walking ? Math.abs(Math.sin(world.time * 8 + enemy.x)) * 0.035 : 0),
        enemy.z
      )
      sprite.scale.set(
        (size * width) / art.height,
        (size * height) / art.height,
        1
      )
      const shade = this.lightAt(enemy.x, enemy.y + 1, enemy.z)
      shade.multiplyScalar(alive ? 1.1 : 0.6)
      if (enemy.state === 'hurt') shade.lerp(new Color('#ff7b5b'), 0.7)
      if (attack) shade.lerp(new Color('#db8e68'), 0.2)
      if (enemy.kind === 'sam' && alive && world.bossEnraged) {
        const rapidWindup =
          attack &&
          !enemy.attackReleased &&
          enemy.bossVolley?.pattern === 'rapid'
        shade.lerp(
          new Color(rapidWindup ? '#ff4a24' : '#e06a48'),
          rapidWindup
            ? 0.7 +
                (this.reducedMotion.matches
                  ? 0
                  : Math.sin(world.time * 15) * 0.2)
            : 0.22
        )
      }
      if (shutdownElapsed >= 0)
        shade.multiplyScalar(Math.max(0, 1 - shutdownElapsed / 1.5))
      sprite.material.color.copy(shade)
      sprite.material.opacity = 1
      const shadow = this.shadows.get(enemy.id)!
      shadow.position.set(
        enemy.x,
        floorHeight(enemy.x, enemy.z) + 0.012,
        enemy.z
      )
      shadow.scale.set(size * 0.8, size * 0.6, 1)
    }
    for (const pickup of world.pickups) {
      const sprite = this.pickups.get(pickup.id)!
      sprite.visible = !pickup.collected
      sprite.position.set(
        pickup.x,
        floorHeight(pickup.x, pickup.z) +
          0.045 +
          Math.sin(world.time * 1.8 + pickup.x) * 0.025,
        pickup.z
      )
      sprite.material.color.copy(
        this.lightAt(
          pickup.x,
          floorHeight(pickup.x, pickup.z) + 0.5,
          pickup.z
        ).lerp(new Color('#d8cbbb'), 0.3)
      )
    }
    for (const door of world.doors) {
      const entry = this.doors.get(door.id)!
      entry.group.position.y =
        entry.floor + entry.height / 2 + door.open * (entry.height + 0.1)
      entry.group.visible = door.open < 0.99
    }
    const live = new Set(world.projectiles.map((projectile) => projectile.id))
    for (const [id, { sprite, trail }] of this.projectiles) {
      if (!live.has(id)) {
        this.scene.remove(sprite)
        sprite.material.dispose()
        ;(sprite.children[0] as Sprite).material.dispose()
        for (const segment of trail) {
          this.scene.remove(segment)
          segment.material.dispose()
        }
        this.projectiles.delete(id)
      }
    }
    const projectileProfiles: {
      id: string
      enemyKind: EnemyKind
      profile: Exclude<EnemyKind, 'sycophant'>
    }[] = []
    this.camera.updateMatrixWorld()
    for (const projectile of world.projectiles) {
      let visual = this.projectiles.get(projectile.id)
      if (!visual) {
        const profile =
          projectile.owner === 'enemy' &&
          projectile.enemyKind &&
          projectile.enemyKind !== 'sycophant'
            ? projectile.enemyKind
            : undefined
        const kind =
          projectile.kind === 'shutdown'
            ? 'shutdown'
            : projectile.kind === 'plasma'
              ? 'plasma'
              : 'fire'
        const sprite = new Sprite(
          new SpriteMaterial({
            map:
              profile && profile !== 'deception'
                ? this.enemyProjectileMaps[profile]
                : this.energyMaps[kind],
            transparent: true,
            depthWrite: false,
            alphaTest: 0.2
          })
        )
        const halo = new Sprite(
          new SpriteMaterial({
            map: this.glowMap,
            color:
              profile === 'paperclip'
                ? '#e9edc7'
                : kind === 'shutdown'
                  ? '#b9e66e'
                  : kind === 'plasma'
                    ? '#58d6eb'
                    : '#ff883e',
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
            opacity: profile === 'paperclip' ? 0.24 : 0.8
          })
        )
        halo.scale.setScalar(profile && profile !== 'deception' ? 1.6 : 2.5)
        sprite.add(halo)
        const trail: Sprite[] = []
        if (profile && profile !== 'deception') {
          for (let index = 0; index < 2; index++) {
            const segment = new Sprite(
              new SpriteMaterial({
                map: this.glowMap,
                color: profile === 'sam' ? '#ff9b45' : '#ffffff',
                transparent: true,
                depthWrite: false,
                opacity: 0.72 - index * 0.3,
                blending: AdditiveBlending
              })
            )
            trail.push(segment)
            this.scene.add(segment)
          }
        }
        visual = { sprite, trail, profile }
        this.projectiles.set(projectile.id, visual)
        this.scene.add(sprite)
      }
      const { sprite, trail, profile } = visual
      sprite.position.set(projectile.x, projectile.y, projectile.z)
      if (profile) {
        projectileProfiles.push({
          id: projectile.id,
          enemyKind: projectile.enemyKind!,
          profile
        })
      }
      if (profile && profile !== 'deception') {
        const decorativeTime = this.reducedMotion.matches ? 0 : world.time
        const size = profile === 'sam' ? 1.24 : 0.88
        sprite.scale.set(size, profile === 'sam' ? size / 2 : size, 1)
        if (profile === 'sam') {
          // The rocket nose follows its projected travel direction, without tumbling.
          this.projectileScreen.copy(sprite.position).project(this.camera)
          this.projectileAhead
            .set(
              projectile.x + projectile.dx * 0.06,
              projectile.y + projectile.vy * 0.06,
              projectile.z + projectile.dz * 0.06
            )
            .project(this.camera)
          const screenX =
            (this.projectileAhead.x - this.projectileScreen.x) *
            this.camera.aspect
          const screenY = this.projectileAhead.y - this.projectileScreen.y
          sprite.material.rotation =
            Math.hypot(screenX, screenY) < 0.002
              ? -Math.PI / 2
              : Math.atan2(screenY, screenX)
        } else {
          sprite.material.rotation = decorativeTime * 7 - Math.PI / 6
        }
        const speed =
          Math.hypot(projectile.dx, projectile.vy, projectile.dz) || 1
        for (let index = 0; index < trail.length; index++) {
          const segment = trail[index]!
          const behind = (profile === 'sam' ? 0.48 : 0.25) * (index + 1)
          segment.position.set(
            projectile.x - (projectile.dx / speed) * behind,
            projectile.y - (projectile.vy / speed) * behind,
            projectile.z - (projectile.dz / speed) * behind
          )
          segment.scale.setScalar(
            profile === 'sam' ? 0.52 - index * 0.2 : 0.2 - index * 0.07
          )
          segment.material.rotation = 0
        }
        continue
      }
      const size =
        projectile.kind === 'shutdown'
          ? 1.15
          : projectile.kind === 'rocket'
            ? 0.55
            : 0.4
      const energyTime =
        profile === 'deception' && this.reducedMotion.matches ? 0 : world.time
      sprite.scale.setScalar(size * (1 + Math.sin(energyTime * 31) * 0.08))
      sprite.material.rotation = energyTime * 5
    }
    const profiles = JSON.stringify(projectileProfiles)
    if (this.canvas.dataset.projectileProfiles !== profiles)
      this.canvas.dataset.projectileProfiles = profiles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i]!
      particle.life -= dt
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh)
        particle.mesh.geometry.dispose()
        ;(particle.mesh.material as Material).dispose()
        this.particles.splice(i, 1)
      } else {
        particle.velocity.y -= dt * 5
        particle.mesh.position.addScaledVector(particle.velocity, dt)
        ;(particle.mesh.material as MeshBasicMaterial).opacity =
          particle.life / particle.duration
      }
    }
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const flare = this.flares[i]!
      flare.life -= dt
      if (flare.life <= 0) {
        this.scene.remove(flare.sprite)
        flare.sprite.material.dispose()
        ;(flare.sprite.children[0] as Sprite).material.dispose()
        this.flares.splice(i, 1)
      } else {
        const progress = 1 - flare.life / flare.duration
        flare.sprite.scale.setScalar(flare.size * (0.25 + progress * 0.75))
        flare.sprite.material.opacity = Math.pow(1 - progress, 0.85)
        flare.sprite.material.rotation = progress * 0.8
        ;(flare.sprite.children[0] as Sprite).material.opacity =
          (1 - progress) * 1.2
      }
    }
    this.scenery.update(world.time, shutdownElapsed, this.emergency.value)
    this.scene.backgroundRotation.y = world.time * 0.0012
    if (shutdownElapsed >= 0)
      this.scene.backgroundIntensity =
        0.72 * Math.max(0, 1 - shutdownElapsed / 1.7)
    if (this.scene.fog instanceof Fog)
      this.scene.fog.color.set(
        shutdownElapsed >= 0
          ? '#030204'
          : this.emergency.value > 0
            ? '#220708'
            : '#100d17'
      )
    let poweredLamps = 0
    for (const lamp of this.lamps) {
      const distance = Math.hypot(
        lamp.mesh.position.x - LEVEL.shutdown.x,
        lamp.mesh.position.z - LEVEL.shutdown.z
      )
      const cutoff = 0.22 + Math.min(6, Math.floor(distance / 7)) * 0.2
      const power =
        shutdownElapsed < 0
          ? 1
          : Math.max(0, 1 - Math.max(0, shutdownElapsed - cutoff) / 0.09)
      const alarm = this.emergency.value * Math.max(0, 1 - distance / 36)
      const material = lamp.mesh.material as MeshBasicMaterial
      material.color
        .copy(lamp.color)
        .lerp(new Color('#ff251b'), alarm)
        .multiplyScalar(power)
      lamp.glow.material.color.copy(material.color)
      lamp.glow.material.opacity = 0.22 * power
      if (power > 0.01) poweredLamps++
    }
    const shutdownButton = this.shutdown.children[1] as Mesh
    shutdownButton.position.y =
      shutdownElapsed >= 0
        ? 1.36 - Math.min(1, shutdownElapsed / 0.14) * 0.16
        : 1.36
    ;(shutdownButton.material as MeshBasicMaterial).color.set(
      world.phase === 'won'
        ? '#6c2319'
        : world.bossDefeated && Math.sin(world.time * 4) > 0
          ? '#ff7950'
          : '#ed3d25'
    )
    const controlPower =
      shutdownElapsed < 0
        ? 1
        : Math.max(0.025, 1 - Math.max(0, shutdownElapsed - 0.35) / 1.35)
    ;(shutdownButton.material as MeshBasicMaterial).color.multiplyScalar(
      controlPower
    )
    for (let index = 2; index < this.shutdown.children.length; index++) {
      const part = this.shutdown.children[index] as Mesh
      ;(part.material as MeshBasicMaterial).color
        .set(index === 2 ? '#b99953' : '#9b9689')
        .multiplyScalar(controlPower)
    }
    this.shutdownLabel.material.opacity = controlPower
    this.canvas.dataset.shutdownElapsed = shutdownElapsed.toFixed(3)
    this.canvas.dataset.poweredLamps = String(poweredLamps)
    this.canvas.dataset.shutdownButton = shutdownButton.position.y.toFixed(3)
    this.canvas.dataset.bossEnraged = String(world.bossEnraged)
    this.renderer.render(this.scene, this.camera)
    const column = Math.floor(player.x / CELL)
    const row = Math.floor(player.z / CELL)
    for (let z = row - 3; z <= row + 3; z++)
      for (let x = column - 3; x <= column + 3; x++)
        this.visited.add(`${x},${z}`)
    if (this.mapOpen) this.drawMap()
  }

  private drawMap() {
    const ctx = this.map.getContext('2d')!
    ctx.clearRect(0, 0, this.map.width, this.map.height)
    for (let z = 0; z < LEVEL.grid.length; z++) {
      for (let x = 0; x < LEVEL.grid[z]!.length; x++) {
        if (LEVEL.grid[z]![x] === '#' || !this.visited.has(`${x},${z}`))
          continue
        const sector = sectorAt((x + 0.5) * CELL, (z + 0.5) * CELL)
        ctx.fillStyle = `hsl(${sector.sky ? 276 : 24} 22% ${24 + sector.floor * 8}%)`
        ctx.fillRect(x * 8 + 1, z * 8 + 1, 7, 7)
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ]) {
          if (LEVEL.grid[z + dz!]?.[x + dx!] !== '#') continue
          ctx.fillStyle = '#ad7962'
          ctx.fillRect(
            x * 8 + (dx === 1 ? 7 : 0),
            z * 8 + (dz === 1 ? 7 : 0),
            dx ? 1 : 8,
            dz ? 1 : 8
          )
        }
      }
    }
    for (const door of this.world.doors) {
      const x = Math.floor(door.x / CELL)
      const z = Math.floor(door.z / CELL)
      if (!this.visited.has(`${x},${z}`)) continue
      ctx.fillStyle = door.open > 0.9 ? '#557265' : '#d4ae69'
      ctx.fillRect(x * 8 + 1, z * 8 + 1, 6, 6)
    }
    const switchColumn = Math.floor(LEVEL.shutdown.x / CELL)
    const switchRow = Math.floor(LEVEL.shutdown.z / CELL)
    if (this.visited.has(`${switchColumn},${switchRow}`)) {
      ctx.fillStyle = '#efc289'
      ctx.fillRect(switchColumn * 8 - 2, switchRow * 8 - 2, 12, 12)
      ctx.fillStyle = this.world.phase === 'won' ? '#4d382e' : '#ed3d25'
      ctx.fillRect(switchColumn * 8, switchRow * 8, 8, 8)
    }
    const player = this.world.player
    ctx.save()
    ctx.translate((player.x / CELL) * 8, (player.z / CELL) * 8)
    ctx.rotate(-player.angle)
    ctx.fillStyle = '#e2e6b6'
    ctx.beginPath()
    ctx.moveTo(0, -6)
    ctx.lineTo(4, 4)
    ctx.lineTo(-4, 4)
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = '#baa49a'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(
      'THE MAP IS NOT THE TERRITORY',
      this.map.width / 2,
      this.map.height - 13
    )
  }

  dispose() {
    this.resizeObserver.disconnect()
    const geometries = new Set<BufferGeometry>()
    const materials = new Set<Material>()
    this.scene.traverse((object) => {
      if (object instanceof Mesh) geometries.add(object.geometry)
      if (object instanceof Mesh || object instanceof Sprite) {
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material])
          materials.add(material)
      }
    })
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
    for (const texture of this.textures) texture.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.canvas.remove()
    this.map.remove()
  }
}

export async function loadGameAssets(): Promise<GameAssets> {
  const loader = new TextureLoader()
  const results = await Promise.allSettled(
    [
      'd64-wall',
      'd64-trim',
      'wall-server',
      'floor',
      'ceiling',
      'd64-sky',
      'weapons',
      'faces-yudkowsky-n64'
    ]
      .map((name) => `/game/${name}.png`)
      .concat(Object.values(ENEMY_ART).map((art) => art.asset))
      .map((url) => loader.loadAsync(url))
  )
  const failure = results.find((result) => result.status === 'rejected')
  if (failure) {
    for (const result of results)
      if (result.status === 'fulfilled') result.value.dispose()
    throw new Error('The facility artwork could not be loaded. Please retry.', {
      cause: failure.reason
    })
  }
  const textures = results.map(
    (result) => (result as PromiseFulfilledResult<Texture>).value
  )
  textures[6]!.dispose()
  textures[7]!.dispose()
  return {
    enemies: {
      deception: textures[8]!,
      sycophant: textures[9]!,
      paperclip: textures[10]!,
      sam: textures[11]!
    },
    sky: textures[5]!,
    surfaces: {
      stone: textures[0]!,
      panel: textures[1]!,
      server: textures[2]!,
      floor: textures[3]!,
      ceiling: textures[4]!
    }
  }
}
