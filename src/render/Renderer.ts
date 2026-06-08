import * as THREE from 'three'
import { TUNABLES } from '../game/tunables'
import { getTreeTip } from '../game/systems'
import type { FeedbackEvent, GameState, Log, Tree, Vec2, WoodChunk } from '../game/types'

const toThree = (v: Vec2, y = 0): THREE.Vector3 => new THREE.Vector3(v.x, y, v.z)

export class Renderer {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120)
  private readonly player = new THREE.Group()
  private readonly trees = new Map<string, THREE.Group>()
  private readonly logs = new Map<string, THREE.Mesh>()
  private readonly chunks = new Map<string, THREE.Mesh>()
  private readonly feedback = new Map<number, THREE.Mesh>()

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.setClearColor('#b8d8ff')
    this.scene.background = new THREE.Color('#b8d8ff')
    this.scene.fog = new THREE.Fog('#b8d8ff', 34, 82)

    const hemi = new THREE.HemisphereLight('#ffffff', '#6d8a55', 1.8)
    this.scene.add(hemi)
    const sun = new THREE.DirectionalLight('#ffffff', 1.6)
    sun.position.set(8, 18, 10)
    this.scene.add(sun)

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(TUNABLES.worldHalfSize * 2.2, 0.25, TUNABLES.worldHalfSize * 2.2),
      new THREE.MeshLambertMaterial({ color: '#7fb069' }),
    )
    ground.position.y = -0.16
    this.scene.add(ground)

    const grid = new THREE.GridHelper(TUNABLES.worldHalfSize * 2, 22, '#6f935d', '#8fbd75')
    grid.position.y = 0.01
    this.scene.add(grid)

    this.player.add(
      new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.75, 4, 8), new THREE.MeshLambertMaterial({ color: '#8a5a2b' })),
    )
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.36), new THREE.MeshLambertMaterial({ color: '#4a2f1a' }))
    nose.position.set(0, 0.28, 0.52)
    this.player.add(nose)
    this.scene.add(this.player)
  }

  dispose(): void {
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) material.dispose()
    })
    this.renderer.dispose()
  }

  render(state: GameState): void {
    this.resize()
    this.syncPlayer(state)
    this.syncTrees(state)
    this.syncLogs(state.logs)
    this.syncChunks(state.chunks)
    this.syncFeedback(state.feedback)
    this.updateCamera(state)
    this.renderer.render(this.scene, this.camera)
  }

  private resize(): void {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (width <= 0 || height <= 0) return
    if (this.canvas.width !== Math.floor(width * this.renderer.getPixelRatio()) || this.canvas.height !== Math.floor(height * this.renderer.getPixelRatio())) {
      this.renderer.setSize(width, height, false)
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
    }
  }

  private syncPlayer(state: GameState): void {
    this.player.position.copy(toThree(state.player.position, 0.65))
    this.player.rotation.y = Math.atan2(state.player.facing.x, state.player.facing.z)
  }

  private createTree(tree: Tree): THREE.Group {
    const group = new THREE.Group()
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, TUNABLES.treeHeight, 8), new THREE.MeshLambertMaterial({ color: '#7a4f28' }))
    trunk.position.y = TUNABLES.treeHeight * 0.5
    trunk.name = 'trunk'
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.25, 2.6, 8), new THREE.MeshLambertMaterial({ color: '#246b38' }))
    crown.position.y = TUNABLES.treeHeight + 0.65
    crown.name = 'crown'
    group.add(trunk, crown)
    group.position.copy(toThree(tree.position, 0))
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
      group.position.copy(toThree(tree.position, 0))
      group.rotation.set(0, Math.atan2(tree.fallDirection.x, tree.fallDirection.z), 0)
      if (tree.status === 'standing') {
        group.rotation.x = 0
        group.scale.setScalar(tree.id === state.currentTargetId ? 1.08 : 1)
      } else {
        const eased = 1 - Math.pow(1 - tree.fallProgress, 3)
        group.rotation.x = eased * Math.PI * 0.5
        group.scale.setScalar(1)
      }
    }
  }

  private createAndRememberTree(tree: Tree): THREE.Group {
    const group = this.createTree(tree)
    this.trees.set(tree.id, group)
    return group
  }

  private syncLogs(logs: Log[]): void {
    const active = logs.filter((log) => log.status === 'whole')
    const activeIds = new Set(active.map((log) => log.id))
    for (const [id, mesh] of this.logs) {
      if (activeIds.has(id)) continue
      this.scene.remove(mesh)
      this.logs.delete(id)
    }
    for (const log of active) {
      let mesh = this.logs.get(log.id)
      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 3.6, 8), new THREE.MeshLambertMaterial({ color: '#8b5a2b' }))
        mesh.rotation.z = Math.PI * 0.5
        this.scene.add(mesh)
        this.logs.set(log.id, mesh)
      }
      mesh.position.copy(toThree(log.position, 0.28))
      mesh.rotation.y = Math.atan2(log.direction.x, log.direction.z)
    }
  }

  private syncChunks(chunks: WoodChunk[]): void {
    const active = chunks.filter((chunk) => !chunk.collected)
    const activeIds = new Set(active.map((chunk) => chunk.id))
    for (const [id, mesh] of this.chunks) {
      if (activeIds.has(id)) continue
      this.scene.remove(mesh)
      this.chunks.delete(id)
    }
    for (const chunk of active) {
      let mesh = this.chunks.get(chunk.id)
      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.28, 0.32), new THREE.MeshLambertMaterial({ color: '#c78946' }))
        this.scene.add(mesh)
        this.chunks.set(chunk.id, mesh)
      }
      mesh.position.copy(toThree(chunk.position, 0.2))
      mesh.rotation.y += 0.025
    }
  }

  private syncFeedback(events: FeedbackEvent[]): void {
    const ids = new Set(events.map((event) => event.id))
    for (const [id, mesh] of this.feedback) {
      if (ids.has(id)) continue
      this.scene.remove(mesh)
      this.feedback.delete(id)
    }
    for (const event of events) {
      let mesh = this.feedback.get(event.id)
      if (!mesh) {
        const color = event.kind === 'upgrade' ? '#ffd166' : event.kind === 'impact' ? '#ffffff' : '#f4a261'
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78 }))
        this.scene.add(mesh)
        this.feedback.set(event.id, mesh)
      }
      const t = event.age / TUNABLES.feedbackLifetime
      mesh.position.copy(toThree(event.position, 0.6 + t * 1.2))
      mesh.scale.setScalar(1 + t * 2.8)
      const material = mesh.material as THREE.MeshBasicMaterial
      material.opacity = 0.78 * (1 - t)
    }
  }

  private updateCamera(state: GameState): void {
    const target = toThree(state.player.position, 0)
    this.camera.position.set(target.x + 9, 12, target.z + 11)
    this.camera.lookAt(target.x, 0.8, target.z)
  }
}
