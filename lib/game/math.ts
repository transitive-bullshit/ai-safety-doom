import type { Point } from './types'

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)

export const direction = (angle: number) => ({
  x: -Math.sin(angle),
  z: -Math.cos(angle)
})

export type Point3 = Point & { y: number }

/** Surface normal at a box contact, including floor and ceiling slab faces. */
export function boxNormal(
  point: Point3,
  box: {
    minX: number
    maxX: number
    minY: number
    maxY: number
    minZ: number
    maxZ: number
  }
): Point3 {
  const faces = [
    { distance: Math.abs(point.x - box.minX), normal: { x: -1, y: 0, z: 0 } },
    { distance: Math.abs(point.x - box.maxX), normal: { x: 1, y: 0, z: 0 } },
    { distance: Math.abs(point.y - box.minY), normal: { x: 0, y: -1, z: 0 } },
    { distance: Math.abs(point.y - box.maxY), normal: { x: 0, y: 1, z: 0 } },
    { distance: Math.abs(point.z - box.minZ), normal: { x: 0, y: 0, z: -1 } },
    { distance: Math.abs(point.z - box.maxZ), normal: { x: 0, y: 0, z: 1 } }
  ]
  return faces.reduce((nearest, face) =>
    face.distance < nearest.distance ? face : nearest
  ).normal
}

export function cylinderNormal(
  point: Point3,
  center: Point3,
  height: number
): Point3 {
  if (Math.abs(point.y - center.y) < 1e-5) return { x: 0, y: -1, z: 0 }
  if (Math.abs(point.y - center.y - height) < 1e-5) return { x: 0, y: 1, z: 0 }
  const length = Math.hypot(point.x - center.x, point.z - center.z)
  return length > 1e-8
    ? {
        x: (point.x - center.x) / length,
        y: 0,
        z: (point.z - center.z) / length
      }
    : { x: 0, y: 1, z: 0 }
}

/** Exact response and displacement for constant input over a frame. */
export function integrateVelocity(
  velocity: number,
  target: number,
  response: number,
  dt: number
) {
  const decay = Math.exp(-response * dt)
  return {
    velocity: target + (velocity - target) * decay,
    displacement: target * dt + ((velocity - target) * (1 - decay)) / response
  }
}

/** Ray parameter at first contact with a vertical actor cylinder. */
export function rayCylinder(
  origin: Point3,
  ray: Point3,
  center: Point3,
  radius: number,
  height: number
) {
  const x = origin.x - center.x
  const z = origin.z - center.z
  const a = ray.x * ray.x + ray.z * ray.z
  const b = x * ray.x + z * ray.z
  const c = x * x + z * z - radius * radius
  let near = 0
  let far = Infinity
  if (a < 1e-12) {
    if (c > 0) return Infinity
  } else {
    const discriminant = b * b - a * c
    if (discriminant < 0) return Infinity
    const root = Math.sqrt(discriminant)
    near = Math.max(near, (-b - root) / a)
    far = (-b + root) / a
  }
  if (Math.abs(ray.y) < 1e-12) {
    if (origin.y < center.y || origin.y > center.y + height) return Infinity
  } else {
    const first = (center.y - origin.y) / ray.y
    const second = (center.y + height - origin.y) / ray.y
    near = Math.max(near, Math.min(first, second))
    far = Math.min(far, Math.max(first, second))
  }
  return far >= near ? near : Infinity
}

export function rayBox3(
  origin: Point3,
  ray: Point3,
  box: {
    minX: number
    maxX: number
    minY: number
    maxY: number
    minZ: number
    maxZ: number
  }
) {
  let near = 0
  let far = Infinity
  for (const [position, delta, low, high] of [
    [origin.x, ray.x, box.minX, box.maxX],
    [origin.y, ray.y, box.minY, box.maxY],
    [origin.z, ray.z, box.minZ, box.maxZ]
  ]) {
    if (Math.abs(delta!) < 1e-12) {
      if (position! < low! || position! > high!) return Infinity
    } else {
      const a = (low! - position!) / delta!
      const b = (high! - position!) / delta!
      near = Math.max(near, Math.min(a, b))
      far = Math.min(far, Math.max(a, b))
      if (near > far) return Infinity
    }
  }
  return far >= near ? near : Infinity
}

/** First intersection along a normalized ray; a containing circle starts at zero. */
export function rayCircle(
  origin: Point,
  ray: Point,
  center: Point,
  radius: number
) {
  const x = center.x - origin.x
  const z = center.z - origin.z
  const projection = x * ray.x + z * ray.z
  const perpendicularSquared = x * x + z * z - projection * projection
  if (perpendicularSquared > radius * radius) return Infinity
  const halfChord = Math.sqrt(
    Math.max(0, radius * radius - perpendicularSquared)
  )
  if (projection + halfChord < 0) return Infinity
  return Math.max(0, projection - halfChord)
}

/** Exact slab intersection avoids stepping over thin obstructions. */
export function rayBox(
  origin: Point,
  ray: Point,
  box: { minX: number; maxX: number; minZ: number; maxZ: number }
) {
  let near = -Infinity
  let far = Infinity
  for (const [position, delta, low, high] of [
    [origin.x, ray.x, box.minX, box.maxX],
    [origin.z, ray.z, box.minZ, box.maxZ]
  ]) {
    if (Math.abs(delta!) < 1e-9) {
      if (position! < low! || position! > high!) return Infinity
      continue
    }
    const a = (low! - position!) / delta!
    const b = (high! - position!) / delta!
    near = Math.max(near, Math.min(a, b))
    far = Math.min(far, Math.max(a, b))
    if (near > far) return Infinity
  }
  return far < 0 ? Infinity : Math.max(0, near)
}
