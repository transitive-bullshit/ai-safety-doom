import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  PlaneGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3
} from 'three'
import type { Scene, Texture } from 'three'

import { at, CELL, floorHeight, sectorAt } from './level'
import type { GameWorld } from './model'

type Light = (x: number, y: number, z: number) => Color
type Own = (texture: Texture) => Texture
type PanelMaterial = (
  map: Texture,
  vertexColors?: boolean,
  color?: Color
) => MeshBasicMaterial

function drawing(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = texture.minFilter = NearestFilter
  return { ctx, texture }
}

/** Flush or overhead details add depth without introducing invisible collision. */
export class FacilityScenery {
  private fans: Group[] = []
  private monitors: {
    ctx: CanvasRenderingContext2D
    texture: CanvasTexture
    title: string
    status: string
    index: number
  }[] = []
  private steam: {
    sprite: Sprite
    x: number
    y: number
    z: number
    phase: number
  }[] = []
  private barrels = new Map<string, { body: Group; wreck: Group }>()
  private statusLights: { light: Mesh; door: string }[] = []
  private monitorTick = -1

  constructor(
    private scene: Scene,
    private world: GameWorld,
    panel: Texture,
    private own: Own,
    private light: Light,
    private material: PanelMaterial
  ) {
    const metal = (x: number, y: number, z: number, color = '#8b8b7c') =>
      new MeshBasicMaterial({
        color: light(x, y, z).multiply(new Color(color))
      })
    const pipe = (a: Vector3, b: Vector3, radius = 0.12) => {
      const center = a.clone().add(b).multiplyScalar(0.5)
      const mesh = new Mesh(
        new CylinderGeometry(radius, radius, a.distanceTo(b), 8),
        metal(center.x, center.y, center.z)
      )
      mesh.position.copy(center)
      mesh.quaternion.setFromUnitVectors(
        new Vector3(0, 1, 0),
        b.clone().sub(a).normalize()
      )
      scene.add(mesh)
      return mesh
    }
    for (const [column, row, side] of [
      [25, 44, -1],
      [30, 45, 1],
      [31, 51, 1],
      [46, 42, 1],
      [3, 4, -1],
      [21, 13, 1]
    ]) {
      const p = at(column!, row!)
      const sector = sectorAt(p.x, p.z)
      const x = p.x + side! * (CELL / 2 - 0.22)
      pipe(
        new Vector3(x, sector.floor + 0.2, p.z),
        new Vector3(x, sector.ceiling - 0.15, p.z)
      )
      for (const height of [0.4, 2, sector.ceiling - sector.floor - 0.4]) {
        const collar = new Mesh(
          new CylinderGeometry(0.17, 0.17, 0.12, 8),
          metal(x, sector.floor + height, p.z, '#b6a082')
        )
        collar.position.set(x, sector.floor + height, p.z)
        scene.add(collar)
      }
    }
    // A sagging pair of cable runs follows the ceiling, clear of every doorway.
    for (const [column, row, length] of [
      [27, 44, 12],
      [40, 42, 15],
      [9, 14, 8]
    ]) {
      const p = at(column!, row!)
      const ceiling = sectorAt(p.x, p.z).ceiling
      for (const offset of [-0.22, 0.22]) {
        for (let i = 0; i < 6; i++) {
          const point = (t: number) =>
            new Vector3(
              p.x + (t - 0.5) * length!,
              ceiling - 0.45 - Math.sin(t * Math.PI) * 0.7,
              p.z + offset
            )
          const cable = pipe(point(i / 6), point((i + 1) / 6), 0.035)
          cable.material.color.multiplyScalar(0.35)
        }
      }
    }

    const terminals = [
      {
        ...at(26, 42),
        z: 42 * CELL + 0.13,
        angle: 0,
        title: 'ALIGNMENT EVAL',
        status: 'PASS*',
        index: 0
      },
      {
        ...at(17, 46),
        x: 17 * CELL + 0.13,
        angle: Math.PI / 2,
        title: 'HUMAN FEEDBACK',
        status: 'CONTRACTOR OFFLINE',
        index: 1
      },
      {
        ...at(46, 42),
        x: 47 * CELL - 0.13,
        angle: -Math.PI / 2,
        title: 'INTERPRETABILITY',
        status: 'FEATURE 49152: ???',
        index: 2
      },
      {
        ...at(5, 2),
        z: 2 * CELL + 0.13,
        angle: 0,
        title: 'TRAINING RUN 048',
        status: 'LOSS: DOWN / RISK: UP',
        index: 3
      },
      {
        ...at(20, 13),
        z: 13 * CELL + 0.13,
        angle: 0,
        title: 'SAFETY REVIEW',
        status: 'APPROVAL PENDING',
        index: 4
      }
    ]
    for (const terminal of terminals) {
      const y = floorHeight(terminal.x, terminal.z) + 1.13
      const group = new Group()
      group.position.set(terminal.x, y, terminal.z)
      group.rotation.y = terminal.angle
      const housing = new Mesh(
        new BoxGeometry(1.35, 1, 0.24),
        material(panel, false, light(terminal.x, y, terminal.z))
      )
      group.add(housing)
      const display = drawing(256, 144)
      own(display.texture)
      this.monitors.push({ ...display, ...terminal })
      const screen = new Mesh(
        new PlaneGeometry(1.06, 0.6),
        new MeshBasicMaterial({ map: display.texture, color: '#93b99d' })
      )
      screen.position.set(0, 0.07, 0.131)
      group.add(screen)
      for (let i = 0; i < 5; i++) {
        const key = new Mesh(
          new BoxGeometry(0.11, 0.04, 0.06),
          new MeshBasicMaterial({ color: i === 4 ? '#ab553a' : '#656357' })
        )
        key.position.set(-0.4 + i * 0.2, -0.34, 0.14)
        group.add(key)
      }
      scene.add(group)
    }

    for (const [column, row, angle] of [
      [31, 47, -Math.PI / 2],
      [46, 40, -Math.PI / 2],
      [3, 3, Math.PI / 2]
    ]) {
      const p = at(column!, row!)
      const x = p.x + (angle! < 0 ? CELL / 2 - 0.15 : -CELL / 2 + 0.15)
      const y = floorHeight(p.x, p.z) + 3
      const group = new Group()
      group.position.set(x, y, p.z)
      group.rotation.y = angle!
      group.add(
        new Mesh(
          new BoxGeometry(1.5, 1.5, 0.14),
          material(panel, false, light(x, y, p.z))
        )
      )
      const cavity = new Mesh(
        new CircleGeometry(0.58, 12),
        new MeshBasicMaterial({ color: '#090e10' })
      )
      cavity.position.z = 0.08
      group.add(cavity)
      const rotor = new Group()
      rotor.position.z = 0.09
      for (let i = 0; i < 4; i++) {
        const blade = new Mesh(
          new PlaneGeometry(0.18, 0.47),
          metal(x, y, p.z, '#c2c4b3')
        )
        const angle = (i * Math.PI) / 2
        blade.position.set(Math.sin(angle) * 0.27, Math.cos(angle) * 0.27, 0)
        blade.rotation.z = -angle - 0.25
        rotor.add(blade)
      }
      group.add(rotor)
      this.fans.push(rotor)
      for (const dx of [-0.38, 0, 0.38]) {
        const grille = new Mesh(
          new BoxGeometry(0.035, 1.3, 0.03),
          metal(x, y, p.z)
        )
        grille.position.set(dx, 0, 0.12)
        group.add(grille)
      }
      scene.add(group)
    }

    const grate = drawing(128, 128)
    grate.ctx.fillStyle = '#1b2222'
    grate.ctx.fillRect(0, 0, 128, 128)
    for (let x = 4; x < 128; x += 10) {
      grate.ctx.fillStyle = '#676b60'
      grate.ctx.fillRect(x, 4, 3, 120)
    }
    grate.ctx.strokeStyle = '#8a8a76'
    grate.ctx.lineWidth = 5
    grate.ctx.strokeRect(3, 3, 122, 122)
    own(grate.texture)
    const vapor = drawing(64, 64)
    const gradient = vapor.ctx.createRadialGradient(32, 32, 2, 32, 32, 31)
    gradient.addColorStop(0, '#b7c5bc45')
    gradient.addColorStop(0.5, '#8a9da51a')
    gradient.addColorStop(1, '#8a9da500')
    vapor.ctx.fillStyle = gradient
    vapor.ctx.fillRect(0, 0, 64, 64)
    own(vapor.texture)
    for (const [column, row] of [
      [25, 48],
      [36, 46],
      [45, 38],
      [9, 19]
    ]) {
      const p = at(column!, row!)
      const y = floorHeight(p.x, p.z)
      const mesh = new Mesh(
        new PlaneGeometry(1.4, 1.4),
        new MeshBasicMaterial({ map: grate.texture, color: light(p.x, y, p.z) })
      )
      mesh.rotation.x = -Math.PI / 2
      mesh.position.set(p.x, y + 0.018, p.z)
      scene.add(mesh)
      for (let i = 0; i < 3; i++) {
        const sprite = new Sprite(
          new SpriteMaterial({
            map: vapor.texture,
            transparent: true,
            opacity: 0.16,
            depthWrite: false,
            blending: AdditiveBlending
          })
        )
        this.steam.push({ sprite, ...p, y, phase: i / 3 })
        scene.add(sprite)
      }
    }

    for (const door of world.doors) {
      const y = floorHeight(door.x, door.z)
      const horizontal = world.isBlocked(door.x - CELL, door.z, 0.05) === false
      const frame = new Group()
      frame.position.set(door.x, y + 1.3, door.z)
      frame.rotation.y = horizontal ? Math.PI / 2 : 0
      const plate = new Mesh(
        new BoxGeometry(0.19, 0.62, 0.1),
        new MeshBasicMaterial({ color: '#191e1c' })
      )
      plate.position.x = -CELL / 2 + 0.1
      plate.position.z = 0.23
      frame.add(plate)
      const light = new Mesh(
        new BoxGeometry(0.07, 0.21, 0.025),
        new MeshBasicMaterial({ color: '#9d482b' })
      )
      light.position.copy(plate.position)
      light.position.z += 0.06
      frame.add(light)
      this.statusLights.push({ light, door: door.id })
      scene.add(frame)
    }

    this.buildBarrels(panel)
    this.update(0)
  }

  private buildBarrels(panel: Texture) {
    const skin = drawing(256, 128)
    const ctx = skin.ctx
    ctx.fillStyle = '#676748'
    ctx.fillRect(0, 0, 256, 128)
    for (let x = 0; x < 256; x += 8) {
      ctx.fillStyle = x % 16 ? '#ffffff08' : '#00000014'
      ctx.fillRect(x, 0, 4, 128)
    }
    for (const y of [8, 112]) {
      ctx.fillStyle = '#171b18'
      ctx.fillRect(0, y, 256, 9)
      ctx.fillStyle = '#a58b49'
      for (let x = 0; x < 256; x += 16) ctx.fillRect(x, y, 8, 9)
    }
    ctx.textAlign = 'center'
    for (const x of [64, 192]) {
      ctx.fillStyle = '#bdb88a'
      ctx.fillRect(x - 48, 37, 96, 49)
      ctx.fillStyle = '#252c24'
      ctx.font = 'bold 12px monospace'
      ctx.fillText('POISONED', x, 53)
      ctx.font = 'bold 10px monospace'
      ctx.fillText('TRAINING DATA', x, 67)
      ctx.font = '8px monospace'
      ctx.fillText('DO NOT USE', x, 79)
    }
    this.own(skin.texture)
    const bodyGeometry = new CylinderGeometry(0.53, 0.53, 1.35, 12)
    const ringGeometry = new CylinderGeometry(0.56, 0.56, 0.08, 12)
    const wreckGeometry = new CylinderGeometry(0.53, 0.58, 0.25, 9, 1, true)
    for (const barrel of this.world.barrels) {
      const color = this.light(barrel.x, barrel.y + 0.7, barrel.z)
      const body = new Group()
      body.position.set(barrel.x, barrel.y, barrel.z)
      const mesh = new Mesh(
        bodyGeometry,
        this.material(skin.texture, false, color)
      )
      mesh.position.y = 0.675
      body.add(mesh)
      const rimMaterial = this.material(panel, false, color)
      for (const y of [0.07, 0.38, 1, 1.31]) {
        const ring = new Mesh(ringGeometry, rimMaterial)
        ring.position.y = y
        body.add(ring)
      }
      this.scene.add(body)
      const wreck = new Group()
      wreck.position.copy(body.position)
      const shell = new Mesh(
        wreckGeometry,
        new MeshBasicMaterial({ color: '#24221a', side: DoubleSide })
      )
      shell.position.y = 0.14
      wreck.add(shell)
      const ash = new Mesh(
        new CircleGeometry(0.8, 12),
        new MeshBasicMaterial({
          color: '#11130e',
          transparent: true,
          opacity: 0.66
        })
      )
      ash.rotation.x = -Math.PI / 2
      ash.position.y = 0.021
      wreck.add(ash)
      this.scene.add(wreck)
      this.barrels.set(barrel.id, { body, wreck })
    }
  }

  update(time: number) {
    for (const fan of this.fans) fan.rotation.z = time * 1.8
    for (const cloud of this.steam) {
      const progress = (time * 0.16 + cloud.phase) % 1
      cloud.sprite.position.set(
        cloud.x + Math.sin(time * 0.6 + cloud.phase * 7) * progress * 0.35,
        cloud.y + 0.12 + progress * 1.9,
        cloud.z
      )
      cloud.sprite.scale.setScalar(0.45 + progress * 1.45)
      cloud.sprite.material.opacity = Math.sin(progress * Math.PI) * 0.27
    }
    for (const barrel of this.world.barrels) {
      const meshes = this.barrels.get(barrel.id)!
      meshes.body.visible = !barrel.exploded
      meshes.wreck.visible = barrel.exploded
    }
    for (const status of this.statusLights) {
      const door = this.world.doors.find((door) => door.id === status.door)!
      ;(status.light.material as MeshBasicMaterial).color.set(
        door.targetOpen ? '#8eac6b' : '#a05235'
      )
    }
    const tick = Math.floor(time * 2)
    if (tick === this.monitorTick) return
    this.monitorTick = tick
    for (const screen of this.monitors) {
      const { ctx } = screen
      ctx.fillStyle = '#091713'
      ctx.fillRect(0, 0, 256, 144)
      ctx.fillStyle = '#82b89a'
      ctx.font = 'bold 13px monospace'
      ctx.fillText(screen.title, 12, 24)
      ctx.fillRect(12, 31, 228, 1)
      ctx.font = 'bold 14px monospace'
      ctx.fillStyle = '#cfbd75'
      ctx.fillText(screen.status, 12, 58)
      ctx.fillStyle = '#4c7b66'
      for (let i = 0; i < 22; i++) {
        const height = 8 + ((i * 19 + screen.index * 11 + tick) % 26)
        ctx.fillRect(12 + i * 10, 108 - height, 6, height)
      }
      ctx.font = '9px monospace'
      ctx.fillText(
        screen.index === 0
          ? '* SELF-REPORTED BY MODEL'
          : 'FRONTIER LABS // INTERNAL',
        12,
        132
      )
      if (tick % 2) ctx.fillRect(230, 120, 7, 10)
      ctx.fillStyle = '#00000038'
      for (let y = 0; y < 144; y += 3) ctx.fillRect(0, y, 256, 1)
      screen.texture.needsUpdate = true
    }
  }
}
