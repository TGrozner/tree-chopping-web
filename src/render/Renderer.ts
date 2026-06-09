import * as THREE from 'three'
import { terrainHeightAt } from '../game/terrain'
import { AXE_NAMES, TUNABLES } from '../game/tunables'
import type { FeedbackEvent, GameState, Log, Station, Tree, Vec2, WoodItem } from '../game/types'

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
const cutBandGeometry = new THREE.TorusGeometry(0.31, 0.018, 5, 18)

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
  private readonly cameraForward = new THREE.Vector3(1, 0, 0)
  private readonly player = new THREE.Group()
  private readonly trees = new Map<string, THREE.Group>()
  private readonly logs = new Map<string, THREE.Mesh>()
  private readonly woodItems = new Map<string, THREE.Mesh>()
  private readonly stations = new Map<string, THREE.Group>()
  private readonly feedback = new Map<number, THREE.Sprite>()
  private readonly effects = new Map<number, THREE.Group>()
  private readonly targetRing: THREE.Mesh
  private readonly secondaryTargetRings: THREE.Mesh[] = []
  private readonly stationRing: THREE.Mesh
  private readonly fallGuide: THREE.ArrowHelper
  private readonly axePivot: THREE.Group
  private readonly axeHandle: THREE.Mesh
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

    const furMaterial = new THREE.MeshLambertMaterial({ color: '#8f552a' })
    const darkFurMaterial = new THREE.MeshLambertMaterial({ color: '#5a351c' })
    const bellyMaterial = new THREE.MeshLambertMaterial({ color: '#c58a52' })
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.76, 7, 14), furMaterial)
    body.castShadow = true
    body.position.y = 0.62
    body.scale.set(1.05, 1, 0.86)

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), bellyMaterial)
    belly.position.set(0, 0.62, 0.31)
    belly.scale.set(0.82, 1.05, 0.38)

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), furMaterial)
    head.castShadow = true
    head.position.set(0, 1.34, 0.2)
    head.scale.set(1, 0.92, 1.05)
    const muzzle = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.24, 4, 8), bellyMaterial)
    muzzle.position.set(0, 1.27, 0.52)
    muzzle.rotation.x = Math.PI * 0.5
    muzzle.scale.set(1.25, 0.72, 0.85)
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 6), new THREE.MeshLambertMaterial({ color: '#24140d' }))
    nose.position.set(0, 1.31, 0.69)
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#120b08' })
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMaterial)
    leftEye.position.set(-0.14, 1.43, 0.51)
    const rightEye = leftEye.clone()
    rightEye.position.x = 0.14
    const toothMaterial = new THREE.MeshLambertMaterial({ color: '#fff2d4' })
    const leftTooth = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.16, 0.035), toothMaterial)
    leftTooth.position.set(-0.045, 1.16, 0.66)
    const rightTooth = leftTooth.clone()
    rightTooth.position.x = 0.045
    const leftEar = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), darkFurMaterial)
    leftEar.position.set(-0.24, 1.55, 0.05)
    leftEar.scale.set(0.8, 1, 0.58)
    const rightEar = leftEar.clone()
    rightEar.position.x = 0.24

    const armGeometry = new THREE.CapsuleGeometry(0.08, 0.52, 5, 8)
    const leftArm = new THREE.Mesh(armGeometry, darkFurMaterial)
    leftArm.position.set(-0.42, 0.82, 0.22)
    leftArm.rotation.z = 0.32
    leftArm.rotation.x = 0.12
    const rightArm = new THREE.Mesh(armGeometry, darkFurMaterial)
    rightArm.position.set(0.5, 0.88, 0.38)
    rightArm.rotation.z = -0.72
    rightArm.rotation.x = -0.18
    const leftFoot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), darkFurMaterial)
    leftFoot.position.set(-0.22, 0.12, 0.28)
    leftFoot.scale.set(1.25, 0.42, 1.7)
    const rightFoot = leftFoot.clone()
    rightFoot.position.x = 0.22
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.13, 0.92), new THREE.MeshLambertMaterial({ color: '#4a2d19' }))
    tail.castShadow = true
    tail.position.set(0, 0.3, -0.64)
    tail.rotation.x = -0.42
    tail.rotation.z = 0.12

    this.axePivot = new THREE.Group()
    this.axePivot.position.set(0.82, 0.95, 0.58)
    this.axePivot.rotation.z = -0.58
    this.axePivot.rotation.x = -0.18
    this.axePivot.rotation.y = -0.2
    this.axeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.058, 1.32, 8), new THREE.MeshLambertMaterial({ color: '#6f4524' }))
    this.axeHandle.castShadow = true
    this.axeHandle.position.set(0, 0.46, 0)
    this.axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.28, 0.17), new THREE.MeshLambertMaterial({ color: '#d7e0df' }))
    this.axeHead.castShadow = true
    this.axeHead.position.set(0.2, 1.1, 0)
    this.axeHead.rotation.z = 0.1
    const axeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.56, 0.24), new THREE.MeshLambertMaterial({ color: '#ffffff' }))
    axeBlade.castShadow = true
    axeBlade.position.set(0.58, 1.08, 0)
    this.axePivot.add(this.axeHandle, this.axeHead, axeBlade)

    this.player.add(
      body,
      belly,
      head,
      muzzle,
      nose,
      leftEye,
      rightEye,
      leftTooth,
      rightTooth,
      leftEar,
      rightEar,
      leftArm,
      rightArm,
      leftFoot,
      rightFoot,
      tail,
      this.axePivot,
    )
    this.scene.add(this.player)

    this.targetRing = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.04, 6, 48),
      new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.95 }),
    )
    this.targetRing.rotation.x = Math.PI * 0.5
    this.targetRing.visible = false
    this.scene.add(this.targetRing)

    for (let index = 1; index < TUNABLES.swingMaxHits; index += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.028, 6, 48),
        new THREE.MeshBasicMaterial({ color: '#ffe8a3', transparent: true, opacity: 0.42, depthTest: false }),
      )
      ring.rotation.x = Math.PI * 0.5
      ring.visible = false
      ring.renderOrder = 7
      this.secondaryTargetRings.push(ring)
      this.scene.add(ring)
    }

    this.fallGuide = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 3.4, '#ffd166', 0.72, 0.34)
    this.fallGuide.renderOrder = 8
    this.fallGuide.traverse((object) => {
      const guide = object as THREE.Object3D & { material?: THREE.Material | THREE.Material[] }
      const materials = Array.isArray(guide.material) ? guide.material : guide.material ? [guide.material] : []
      for (const material of materials) {
        material.depthTest = false
        material.depthWrite = false
        material.transparent = true
        material.opacity = 0.88
      }
    })
    this.fallGuide.visible = false
    this.scene.add(this.fallGuide)

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
      const disposable = object as THREE.Object3D & {
        geometry?: THREE.BufferGeometry
        material?: THREE.Material | THREE.Material[]
      }
      if (!disposable.geometry && !disposable.material && object.type !== 'Sprite') return
      disposable.geometry?.dispose()
      const materialValue = disposable.material
      const materials = Array.isArray(materialValue) ? materialValue : materialValue ? [materialValue] : []
      for (const material of materials) {
        const mapped = material as THREE.Material & { map?: THREE.Texture }
        mapped.map?.dispose()
        material.dispose()
      }
    })
    stationGeometry.dispose()
    stationPostGeometry.dispose()
    cutBandGeometry.dispose()
    delete (window as Window & { __TREE_CHOPPING_CAMERA__?: unknown }).__TREE_CHOPPING_CAMERA__
    this.renderer.dispose()
  }

  render(state: GameState): void {
    this.resize()
    this.syncStations(state.stations, state.activeStationId)
    this.syncPlayer(state)
    this.syncTrees(state)
    this.syncLogs(state.logs)
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

    const phase = state.swing.phase
    const windupProgress = phase === 'windup' ? Math.min(1, state.swing.elapsed / TUNABLES.swingWindup) : 0
    const recoveryProgress = phase === 'recovery' ? Math.min(1, state.swing.elapsed / TUNABLES.swingRecovery) : 0
    const swingPose = phase === 'windup' ? -windupProgress : phase === 'recovery' ? -1 + recoveryProgress * 1.22 : 0
    const raised = Math.max(0, -swingPose)
    this.axePivot.position.set(0.82, 0.95 + raised * 0.24, 0.58 + raised * 0.12)
    this.axePivot.rotation.z = -0.58 + swingPose * 1.48
    this.axePivot.rotation.x = -0.18 + swingPose * 0.42
    this.axePivot.rotation.y = -0.2 + raised * 0.2
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
        const pad = new THREE.Mesh(
          stationGeometry,
          new THREE.MeshLambertMaterial({ color: station.accent, transparent: true, opacity: 0.7 }),
        )
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
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.34, 7), new THREE.MeshLambertMaterial({ color: trunkColor(tree) }))
    stump.position.y = 0.17
    stump.castShadow = true
    stump.visible = false
    stump.name = 'stump'
    const cutBands = [0, 1, 2].map((index) => {
      const band = new THREE.Mesh(
        cutBandGeometry,
        new THREE.MeshLambertMaterial({ color: index % 2 === 0 ? '#2f1a0d' : '#f0d28f', transparent: true, opacity: 0.92 }),
      )
      band.name = `cut-band-${index}`
      band.position.y = 0.72 + index * 0.22
      band.rotation.x = Math.PI * 0.5
      band.scale.set(1, 0.42, 1)
      band.visible = false
      return band
    })
    if (tree.kind === 'mythic') {
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 8, 6),
        new THREE.MeshBasicMaterial({ color: '#d3fbff', transparent: true, opacity: 0.72 }),
      )
      glow.position.y = trunkHeight + 1.8
      group.add(glow)
    }
    group.add(trunk, crown, stump, ...cutBands)
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
      const visibleCutBands = Math.ceil(tree.cutProgress * 3)
      for (const child of group.children) {
        if (!child.name.startsWith('cut-band-')) continue
        const index = Number(child.name.slice('cut-band-'.length))
        child.visible = !tree.splitDone && tree.status === 'standing' && index < visibleCutBands
      }
      if (stump) stump.visible = false
      if (tree.splitDone) {
        group.visible = false
        continue
      }
      if (tree.status === 'standing') {
        const shakeLife = tree.shakeTimer / TUNABLES.treeShakeDuration
        if (shakeLife > 0) {
          const axis = new THREE.Vector3(tree.shakeDirection.z, 0, -tree.shakeDirection.x).normalize()
          const wobble =
            Math.sin((1 - shakeLife) * TUNABLES.treeShakeFrequency) * shakeLife * TUNABLES.treeShakeMaxAngle * (1 + tree.cutProgress * 0.45)
          group.quaternion.setFromAxisAngle(axis, wobble)
          group.scale.setScalar(tree.scale * highlight * (1 + shakeLife * 0.025))
        } else {
          group.quaternion.identity()
        }
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

  private syncLogs(logs: Log[]): void {
    const liveLogs = logs.filter((log) => log.status === 'landed' && !log.splitDone)
    const liveIds = new Set(liveLogs.map((log) => log.id))
    for (const [id, mesh] of this.logs) {
      if (liveIds.has(id)) continue
      this.scene.remove(mesh)
      this.logs.delete(id)
    }

    for (const log of liveLogs) {
      let mesh = this.logs.get(log.id)
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.34, 0.4, 1, 10),
          new THREE.MeshLambertMaterial({ color: woodColor(log.woodType), flatShading: true }),
        )
        mesh.castShadow = true
        mesh.receiveShadow = true
        this.scene.add(mesh)
        this.logs.set(log.id, mesh)
      }
      const length = TUNABLES.treeHeight * log.scale * 0.48
      mesh.scale.set(log.scale * 0.62, length, log.scale * 0.62)
      mesh.position.copy(toThree(log.position, 0.36))
      const direction = new THREE.Vector3(log.direction.x, 0, log.direction.z).normalize()
      const align = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
      const roll = new THREE.Quaternion().setFromAxisAngle(direction, log.rollAngle)
      mesh.quaternion.copy(roll.multiply(align))
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
    for (const [id, group] of this.effects) {
      if (ids.has(id)) continue
      this.scene.remove(group)
      this.effects.delete(id)
    }
    for (const event of events) {
      let sprite = this.feedback.get(event.id)
      if (!sprite) {
        const color =
          event.kind === 'blocked'
            ? '#ff9d7a'
            : event.kind === 'cleave' || event.kind === 'upgrade' || event.kind === 'deposit'
              ? '#ffd166'
              : '#fff7df'
        sprite = createTextSprite(event.label, color, 'rgba(17,25,13,0.48)')
        sprite.scale.set(2.2, 0.82, 1)
        this.scene.add(sprite)
        this.feedback.set(event.id, sprite)
      }
      const t = event.age / TUNABLES.feedbackLifetime
      sprite.position.copy(toThree(event.position, 1.7 + t * 1.8))
      sprite.material.opacity = Math.max(0, 1 - t)
      this.syncEffect(event, t)
    }
  }

  private syncEffect(event: FeedbackEvent, t: number): void {
    if (!['hit', 'cleave', 'impact', 'fall', 'split'].includes(event.kind)) return
    let group = this.effects.get(event.id)
    if (!group) {
      group = this.createEffect(event)
      this.scene.add(group)
      this.effects.set(event.id, group)
    }
    group.position.copy(toThree(event.position, event.kind === 'impact' || event.kind === 'fall' ? 0.16 : 0.85))
    const fade = Math.max(0, 1 - t)
    for (const child of group.children) {
      const mesh = child as THREE.Mesh
      const velocity = mesh.userData.velocity as THREE.Vector3 | undefined
      if (velocity) mesh.position.copy(velocity.clone().multiplyScalar(event.age))
      mesh.rotation.x += (mesh.userData.spinX as number | undefined) ?? 0
      mesh.rotation.y += (mesh.userData.spinY as number | undefined) ?? 0
      const material = mesh.material as THREE.Material & { opacity?: number; transparent?: boolean }
      material.transparent = true
      material.opacity = fade * ((mesh.userData.baseOpacity as number | undefined) ?? 1)
      const baseScale = (mesh.userData.baseScale as number | undefined) ?? 1
      mesh.scale.setScalar(baseScale * (event.kind === 'impact' || event.kind === 'fall' ? 0.55 + t * 1.7 : 1 - t * 0.25))
    }
  }

  private createEffect(event: FeedbackEvent): THREE.Group {
    const group = new THREE.Group()
    const isDust = event.kind === 'impact' || event.kind === 'fall'
    const isSplit = event.kind === 'split'
    const isCleave = event.kind === 'cleave'
    const count = isDust ? 12 : isSplit ? 16 : isCleave ? 14 : 8
    if (isDust) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.75, 0.035, 6, 36),
        new THREE.MeshBasicMaterial({ color: '#bba16a', transparent: true, opacity: 0.46 }),
      )
      ring.rotation.x = Math.PI * 0.5
      ring.userData.baseOpacity = 0.46
      ring.userData.baseScale = 0.55
      group.add(ring)
    }
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2
      const speed = isDust ? 1.2 + (index % 4) * 0.25 : isSplit || isCleave ? 2.2 + (index % 5) * 0.25 : 1.7 + (index % 4) * 0.2
      const vertical = isDust ? 0.08 + (index % 3) * 0.035 : isCleave ? 0.32 + (index % 4) * 0.06 : 0.45 + (index % 4) * 0.08
      const mesh = new THREE.Mesh(
        isDust ? new THREE.DodecahedronGeometry(0.08 + (index % 3) * 0.02, 0) : new THREE.BoxGeometry(0.14, 0.08, 0.08),
        new THREE.MeshLambertMaterial({
          color: isDust ? '#b79a61' : isCleave ? '#ffd166' : index % 3 === 0 ? '#d2a15d' : '#8b5d32',
          transparent: true,
        }),
      )
      mesh.userData.velocity = new THREE.Vector3(Math.cos(angle) * speed, vertical, Math.sin(angle) * speed)
      mesh.userData.spinX = 0.05 + (index % 4) * 0.018
      mesh.userData.spinY = 0.04 + (index % 5) * 0.014
      mesh.userData.baseOpacity = isDust ? 0.58 : 0.92
      mesh.userData.baseScale = isDust ? 1.1 : isSplit ? 1.15 : isCleave ? 1.05 : 1
      group.add(mesh)
    }
    return group
  }

  private syncTargetRing(state: GameState): void {
    const targetTree = state.trees.find((tree) => tree.id === state.currentTargetId)
    const targetLog = state.logs.find((log) => log.id === state.currentTargetId && log.status === 'landed' && !log.splitDone)
    this.fallGuide.visible = false
    for (const ring of this.secondaryTargetRings) ring.visible = false
    if (targetTree) {
      this.targetRing.visible = true
      this.targetRing.scale.setScalar(
        targetTree.status === 'fallen' ? 0.82 : targetTree.scale * (targetTree.kind === 'sapling' ? 0.78 : 1.05),
      )
      const targetPosition =
        targetTree.status === 'fallen'
          ? {
              x: targetTree.position.x + targetTree.fallDirection.x * TUNABLES.treeHeight * targetTree.scale * 0.45,
              z: targetTree.position.z + targetTree.fallDirection.z * TUNABLES.treeHeight * targetTree.scale * 0.45,
            }
          : targetTree.position
      this.targetRing.position.copy(toThree(targetPosition, 0.08))
      if (targetTree.status === 'standing') {
        const fallDirection = new THREE.Vector3(
          targetTree.position.x - state.player.position.x,
          0,
          targetTree.position.z - state.player.position.z,
        ).normalize()
        if (fallDirection.lengthSq() > 0.001) {
          this.fallGuide.visible = true
          this.fallGuide.position.copy(toThree(targetTree.position, 0.62))
          this.fallGuide.setDirection(fallDirection)
          this.fallGuide.setLength(TUNABLES.treeHeight * targetTree.scale * 0.72, 0.72, 0.34)
        }
      }
    } else if (targetLog) {
      this.targetRing.visible = true
      this.targetRing.scale.setScalar(Math.max(0.52, targetLog.scale * 0.78))
      this.targetRing.position.copy(toThree(targetLog.position, 0.08))
    } else {
      this.targetRing.visible = false
    }

    const secondaryIds = state.currentSwingTargetIds.filter((id) => id !== state.currentTargetId).slice(0, this.secondaryTargetRings.length)
    for (const [index, id] of secondaryIds.entries()) {
      const ring = this.secondaryTargetRings[index]
      const tree = state.trees.find((candidate) => candidate.id === id)
      const log = state.logs.find((candidate) => candidate.id === id && candidate.status === 'landed' && !candidate.splitDone)
      const targetPosition =
        tree?.status === 'fallen'
          ? {
              x: tree.position.x + tree.fallDirection.x * TUNABLES.treeHeight * tree.scale * 0.45,
              z: tree.position.z + tree.fallDirection.z * TUNABLES.treeHeight * tree.scale * 0.45,
            }
          : (tree?.position ?? log?.position)
      if (!targetPosition) continue
      ring.visible = true
      ring.scale.setScalar(tree ? (tree.status === 'fallen' ? 0.7 : tree.scale * 0.68) : Math.max(0.44, (log?.scale ?? 1) * 0.66))
      ring.position.copy(toThree(targetPosition, 0.1))
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
    const desiredForward = new THREE.Vector3(Math.cos(state.player.cameraYaw), 0, Math.sin(state.player.cameraYaw)).normalize()
    if (this.camera.position.lengthSq() < 0.001) this.cameraForward.copy(desiredForward)
    else this.cameraForward.lerp(desiredForward, 0.18).normalize()

    const distance = isPortrait ? 10.5 : 9.4
    const elevation = isPortrait ? 8.4 : 7.3
    const lookAhead = isPortrait ? 3.1 : 3.8
    const desiredPosition = new THREE.Vector3(
      target.x - this.cameraForward.x * distance,
      target.y + elevation,
      target.z - this.cameraForward.z * distance,
    )
    const desiredLookAt = new THREE.Vector3(
      target.x + this.cameraForward.x * lookAhead,
      target.y + 1.12,
      target.z + this.cameraForward.z * lookAhead,
    )
    const targetFov = isPortrait ? 66 : 61
    if (this.camera.position.lengthSq() < 0.001) this.camera.position.copy(desiredPosition)
    else this.camera.position.lerp(desiredPosition, 0.22)
    if (this.cameraLookAt.lengthSq() < 0.001) this.cameraLookAt.copy(desiredLookAt)
    else this.cameraLookAt.lerp(desiredLookAt, 0.28)
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov += (targetFov - this.camera.fov) * 0.12
      this.camera.updateProjectionMatrix()
    }
    this.camera.lookAt(this.cameraLookAt)
    ;(
      window as Window & {
        __TREE_CHOPPING_CAMERA__?: {
          position: { x: number; y: number; z: number }
          lookAt: { x: number; y: number; z: number }
          fov: number
        }
      }
    ).__TREE_CHOPPING_CAMERA__ = {
      position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      lookAt: { x: this.cameraLookAt.x, y: this.cameraLookAt.y, z: this.cameraLookAt.z },
      fov: this.camera.fov,
    }
  }
}
