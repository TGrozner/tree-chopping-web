import * as THREE from 'three'
import { terrainHeightAt } from '../game/terrain'
import { AXE_NAMES, TUNABLES } from '../game/tunables'
import type { FeedbackEvent, GameState, Station, Tree, Vec2, WoodItem } from '../game/types'

const toThree = (v: Vec2, yOffset = 0): THREE.Vector3 => new THREE.Vector3(v.x, terrainHeightAt(v) + yOffset, v.z)

const woodColor = (type: WoodItem['type']): string => {
  if (type === 'finewood') return '#d7a85a'
  if (type === 'corewood') return '#9a6bc8'
  return '#bf7a36'
}

const trunkColor = (tree: Tree): string => {
  if (tree.woodType === 'corewood') return '#5a4966'
  if (tree.woodType === 'finewood') return '#7b5f3a'
  return tree.kind === 'sapling' ? '#8b5d32' : '#6f4524'
}

const stationGeometry = new THREE.CylinderGeometry(1, 1, 0.12, 32)
const stationPostGeometry = new THREE.CylinderGeometry(0.13, 0.16, 1.4, 8)

const createTextSprite = (text: string, color = '#fff7df', background = 'rgba(17,25,13,0.72)'): THREE.Sprite => {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const context = canvas.getContext('2d')
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = background
    context.strokeStyle = 'rgba(255,255,255,0.22)'
    context.lineWidth = 3
    context.roundRect(8, 14, 240, 68, 10)
    context.fill()
    context.stroke()
    context.fillStyle = color
    context.font = '800 24px Inter, Arial, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, 128, 48)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(4.4, 1.65, 1)
  return sprite
}

const createTerrain = (): THREE.Mesh => {
  const size = TUNABLES.worldRadius * 2.2
  const segments = 82
  const vertices: number[] = []
  const indices: number[] = []
  for (let zIndex = 0; zIndex <= segments; zIndex += 1) {
    for (let xIndex = 0; xIndex <= segments; xIndex += 1) {
      const x = -size / 2 + (xIndex / segments) * size
      const z = -size / 2 + (zIndex / segments) * size
      vertices.push(x, terrainHeightAt({ x, z }), z)
    }
  }
  for (let zIndex = 0; zIndex < segments; zIndex += 1) {
    for (let xIndex = 0; xIndex < segments; xIndex += 1) {
      const a = zIndex * (segments + 1) + xIndex
      const b = a + 1
      const c = a + segments + 1
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const material = new THREE.MeshLambertMaterial({ color: '#6f8f48', flatShading: true })
  return new THREE.Mesh(geometry, material)
}

export class Renderer {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 260)
  private readonly cameraLookAt = new THREE.Vector3()
  private readonly player = new THREE.Group()
  private readonly trees = new Map<string, THREE.Group>()
  private readonly woodItems = new Map<string, THREE.Mesh>()
  private readonly stations = new Map<string, THREE.Group>()
  private readonly feedback = new Map<number, THREE.Sprite>()
  private readonly targetRing: THREE.Mesh
  private readonly stationRing: THREE.Mesh
  private readonly axeHead: THREE.Mesh

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.setClearColor('#b9d5f0')
    this.scene.background = new THREE.Color('#b9d5f0')
    this.scene.fog = new THREE.Fog('#b9d5f0', 56, 148)

    const hemi = new THREE.HemisphereLight('#ffffff', '#3f522b', 1.55)
    this.scene.add(hemi)
    const sun = new THREE.DirectionalLight('#fff6dd', 2.15)
    sun.position.set(-28, 44, 18)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    this.scene.add(sun)

    const terrain = createTerrain()
    terrain.receiveShadow = true
    this.scene.add(terrain)

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(TUNABLES.hubRadius, TUNABLES.hubRadius, 0.14, 54),
      new THREE.MeshLambertMaterial({ color: '#8aa55a', transparent: true, opacity: 0.72 }),
    )
    hub.position.copy(toThree({ x: 0, z: 0 }, 0.03))
    this.scene.add(hub)

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.82, 5, 10), new THREE.MeshLambertMaterial({ color: '#9a6331' }))
    body.castShadow = true
    body.position.y = 0.58
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), new THREE.MeshLambertMaterial({ color: '#a8733c' }))
    head.position.set(0, 1.35, 0.18)
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.34), new THREE.MeshLambertMaterial({ color: '#3f2615' }))
    nose.position.set(0, 1.29, 0.52)
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.12, 0.56), new THREE.MeshLambertMaterial({ color: '#5c3920' }))
    tail.position.set(0, 0.35, -0.56)
    tail.rotation.x = -0.35
    const axeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.05, 6), new THREE.MeshLambertMaterial({ color: '#6f4524' }))
    axeHandle.position.set(0.5, 1.0, 0.26)
    axeHandle.rotation.z = -0.64
    this.axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.22), new THREE.MeshLambertMaterial({ color: '#d7e0df' }))
    this.axeHead.position.set(0.72, 1.32, 0.3)
    this.axeHead.rotation.z = -0.22
    this.player.add(body, head, nose, tail, axeHandle, this.axeHead)
    this.scene.add(this.player)

    this.targetRing = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.04, 6, 48),
      new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.95 }),
    )
    this.targetRing.rotation.x = Math.PI * 0.5
    this.targetRing.visible = false
    this.scene.add(this.targetRing)

    this.stationRing = new THREE.Mesh(
      new THREE.TorusGeometry(TUNABLES.stationRange, 0.035, 6, 64),
      new THREE.MeshBasicMaterial({ color: '#fff7df', transparent: true, opacity: 0.38 }),
    )
    this.stationRing.rotation.x = Math.PI * 0.5
    this.stationRing.visible = false
    this.scene.add(this.stationRing)
  }

  dispose(): void {
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh && object.type !== 'Sprite') return
      const maybeMesh = object as THREE.Mesh
      maybeMesh.geometry?.dispose()
      const materialValue = maybeMesh.material as THREE.Material | THREE.Material[] | undefined
      const materials = Array.isArray(materialValue) ? materialValue : materialValue ? [materialValue] : []
      for (const material of materials) {
        const mapped = material as THREE.Material & { map?: THREE.Texture }
        mapped.map?.dispose()
        material.dispose()
      }
    })
    stationGeometry.dispose()
    stationPostGeometry.dispose()
    this.renderer.dispose()
  }

  render(state: GameState): void {
    this.resize()
    this.syncStations(state.stations, state.activeStationId)
    this.syncPlayer(state)
    this.syncTrees(state)
    this.syncWoodItems(state.woodItems)
    this.syncFeedback(state.feedback)
    this.syncTargetRing(state)
    this.updateCamera(state)
    this.renderer.render(this.scene, this.camera)
  }

  private resize(): void {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (width <= 0 || height <= 0) return
    const pixelRatio = this.renderer.getPixelRatio()
    const targetWidth = Math.floor(width * pixelRatio)
    const targetHeight = Math.floor(height * pixelRatio)
    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.renderer.setSize(width, height, false)
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
    }
  }

  private syncPlayer(state: GameState): void {
    this.player.position.copy(toThree(state.player.position, 0.02))
    this.player.rotation.y = Math.atan2(state.player.facing.x, state.player.facing.z)
    const material = this.axeHead.material as THREE.MeshLambertMaterial
    const tierColor = ['#d1b38d', '#c5ccd0', '#cd8954', '#d7e0df', '#f0f6ff', '#f0b44d', '#85f1ff'][state.axeTier] ?? '#d7e0df'
    material.color.set(tierColor)
    this.axeHead.scale.x = state.axeTier >= 5 ? 1.45 : state.axeTier >= 2 ? 1.15 : 1
    this.axeHead.name = AXE_NAMES[state.axeTier]
  }

  private syncStations(stations: Station[], activeStationId: string | null): void {
    const liveIds = new Set(stations.map((station) => station.id))
    for (const [id, group] of this.stations) {
      if (liveIds.has(id)) continue
      this.scene.remove(group)
      this.stations.delete(id)
    }

    for (const station of stations) {
      let group = this.stations.get(station.id)
      if (!group) {
        group = new THREE.Group()
        const pad = new THREE.Mesh(stationGeometry, new THREE.MeshLambertMaterial({ color: station.accent, transparent: true, opacity: 0.7 }))
        pad.scale.set(1.65, 1, 1.65)
        pad.receiveShadow = true
        const post = new THREE.Mesh(stationPostGeometry, new THREE.MeshLambertMaterial({ color: '#332318' }))
        post.position.y = 0.76
        post.castShadow = true
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.24, 0.48), new THREE.MeshLambertMaterial({ color: station.accent }))
        cap.position.y = 1.55
        cap.castShadow = true
        const label = createTextSprite(station.label, '#fff7df', 'rgba(27,32,23,0.78)')
        label.position.y = 2.45
        group.add(pad, post, cap, label)
        this.scene.add(group)
        this.stations.set(station.id, group)
      }
      group.position.copy(toThree(station.position, 0.04))
      group.scale.setScalar(station.id === activeStationId ? 1.08 : 1)
    }
  }

  private createTree(tree: Tree): THREE.Group {
    const group = new THREE.Group()
    const trunkHeight = TUNABLES.treeHeight * 0.58
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.34, trunkHeight, 7),
      new THREE.MeshLambertMaterial({ color: trunkColor(tree) }),
    )
    trunk.position.y = trunkHeight * 0.5
    trunk.castShadow = true
    const canopyGeometry =
      tree.canopy === 'round'
        ? new THREE.DodecahedronGeometry(1.28, 0)
        : tree.canopy === 'wide'
          ? new THREE.SphereGeometry(1.45, 8, 6)
          : new THREE.ConeGeometry(1.18, 2.35, 8)
    const crown = new THREE.Mesh(canopyGeometry, new THREE.MeshLambertMaterial({ color: tree.tint, flatShading: true }))
    crown.position.y = trunkHeight + (tree.canopy === 'cone' ? 1.05 : 0.82)
    crown.castShadow = true
    const stump = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.3, 0.34, 7),
      new THREE.MeshLambertMaterial({ color: trunkColor(tree) }),
    )
    stump.position.y = 0.17
    stump.castShadow = true
    stump.visible = false
    stump.name = 'stump'
    if (tree.kind === 'mythic') {
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), new THREE.MeshBasicMaterial({ color: '#d3fbff', transparent: true, opacity: 0.72 }))
      glow.position.y = trunkHeight + 1.8
      group.add(glow)
    }
    group.add(trunk, crown, stump)
    group.scale.setScalar(tree.scale)
    group.position.copy(toThree(tree.position))
    this.scene.add(group)
    return group
  }

  private syncTrees(state: GameState): void {
    const liveIds = new Set(state.trees.map((tree) => tree.id))
    for (const [id, group] of this.trees) {
      if (liveIds.has(id)) continue
      this.scene.remove(group)
      this.trees.delete(id)
    }

    for (const tree of state.trees) {
      const group = this.trees.get(tree.id) ?? this.createAndRememberTree(tree)
      const highlight = tree.id === state.currentTargetId ? 1.08 : 1
      group.position.copy(toThree(tree.position))
      group.scale.setScalar(tree.scale * highlight)
      const stump = group.getObjectByName('stump')
      for (const child of group.children) {
        if (child.name !== 'stump') child.visible = !tree.splitDone
      }
      if (stump) stump.visible = false
      if (tree.splitDone) {
        group.visible = false
        continue
      }
      if (tree.status === 'standing') {
        group.quaternion.identity()
        group.visible = true
        continue
      }

      const fallAxis = new THREE.Vector3(tree.fallDirection.z, 0, -tree.fallDirection.x).normalize()
      const fallQuaternion = new THREE.Quaternion().setFromAxisAngle(fallAxis, tree.fallAngle)
      const rollAxis = new THREE.Vector3(tree.fallDirection.x, 0, tree.fallDirection.z).normalize()
      const rollQuaternion = new THREE.Quaternion().setFromAxisAngle(rollAxis, tree.status === 'fallen' ? tree.rollAngle : 0)
      group.quaternion.copy(rollQuaternion.multiply(fallQuaternion))
      group.visible = true
    }
  }

  private createAndRememberTree(tree: Tree): THREE.Group {
    const group = this.createTree(tree)
    this.trees.set(tree.id, group)
    return group
  }

  private syncWoodItems(items: WoodItem[]): void {
    const active = items.filter((item) => !item.collected)
    const activeIds = new Set(active.map((item) => item.id))
    for (const [id, mesh] of this.woodItems) {
      if (activeIds.has(id)) continue
      this.scene.remove(mesh)
      this.woodItems.delete(id)
    }
    for (const item of active) {
      let mesh = this.woodItems.get(item.id)
      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.32), new THREE.MeshLambertMaterial({ color: woodColor(item.type) }))
        mesh.castShadow = true
        this.scene.add(mesh)
        this.woodItems.set(item.id, mesh)
      }
      mesh.position.copy(toThree(item.position, 0.28 + Math.sin(item.age * 8) * 0.04))
      mesh.rotation.y += 0.035
      mesh.rotation.x += 0.015
    }
  }

  private syncFeedback(events: FeedbackEvent[]): void {
    const ids = new Set(events.map((event) => event.id))
    for (const [id, sprite] of this.feedback) {
      if (ids.has(id)) continue
      this.scene.remove(sprite)
      this.feedback.delete(id)
    }
    for (const event of events) {
      let sprite = this.feedback.get(event.id)
      if (!sprite) {
        const color = event.kind === 'blocked' ? '#ff9d7a' : event.kind === 'upgrade' || event.kind === 'deposit' ? '#ffd166' : '#fff7df'
        sprite = createTextSprite(event.label, color, 'rgba(17,25,13,0.48)')
        sprite.scale.set(2.2, 0.82, 1)
        this.scene.add(sprite)
        this.feedback.set(event.id, sprite)
      }
      const t = event.age / TUNABLES.feedbackLifetime
      sprite.position.copy(toThree(event.position, 1.7 + t * 1.8))
      sprite.material.opacity = Math.max(0, 1 - t)
    }
  }

  private syncTargetRing(state: GameState): void {
    const targetTree = state.trees.find((tree) => tree.id === state.currentTargetId)
    if (targetTree) {
      this.targetRing.visible = true
      this.targetRing.scale.setScalar(targetTree.status === 'fallen' ? 0.82 : targetTree.scale * (targetTree.kind === 'sapling' ? 0.78 : 1.05))
      const targetPosition =
        targetTree.status === 'fallen'
          ? {
              x: targetTree.position.x + targetTree.fallDirection.x * TUNABLES.treeHeight * targetTree.scale * 0.45,
              z: targetTree.position.z + targetTree.fallDirection.z * TUNABLES.treeHeight * targetTree.scale * 0.45,
            }
          : targetTree.position
      this.targetRing.position.copy(toThree(targetPosition, 0.08))
    } else {
      this.targetRing.visible = false
    }

    const activeStation = state.stations.find((station) => station.id === state.activeStationId)
    if (activeStation) {
      this.stationRing.visible = true
      this.stationRing.position.copy(toThree(activeStation.position, 0.12))
    } else {
      this.stationRing.visible = false
    }
  }

  private updateCamera(state: GameState): void {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    const isPortrait = height > width
    const target = toThree(state.player.position, 1.05)
    const facing = new THREE.Vector3(state.player.facing.x, 0, state.player.facing.z).normalize()
    const distance = isPortrait ? 9.6 : 8.5
    const elevation = isPortrait ? 6.9 : 5.8
    const lookAhead = isPortrait ? 4.1 : 5.1
    const desiredPosition = new THREE.Vector3(
      target.x - facing.x * distance,
      target.y + elevation,
      target.z - facing.z * distance,
    )
    const desiredLookAt = new THREE.Vector3(
      target.x + facing.x * lookAhead,
      target.y + 1.12,
      target.z + facing.z * lookAhead,
    )
    const targetFov = isPortrait ? 69 : 64
    if (this.camera.position.lengthSq() < 0.001) this.camera.position.copy(desiredPosition)
    else this.camera.position.lerp(desiredPosition, 0.22)
    if (this.cameraLookAt.lengthSq() < 0.001) this.cameraLookAt.copy(desiredLookAt)
    else this.cameraLookAt.lerp(desiredLookAt, 0.28)
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov += (targetFov - this.camera.fov) * 0.12
      this.camera.updateProjectionMatrix()
    }
    this.camera.lookAt(this.cameraLookAt)
  }
}
