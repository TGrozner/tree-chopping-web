import { expect, test, type Page } from '@playwright/test'
import { clearSavedRun, saveKey, waitForGame as waitForGameApi } from './helpers'

type Vec2 = { x: number; z: number }
type Box = { x: number; y: number; width: number; height: number }
type CameraOffset = Vec2 & { fov: number }

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z)

const intersects = (a: Box, b: Box): boolean => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

const waitForGame = async (page: Page): Promise<void> => {
  await clearSavedRun(page)
  await page.goto('./')
  await waitForGameApi(page)
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getSnapshot().currentTargetId === 'starter-sapling-000')
}

const cameraOffset = async (page: Page): Promise<CameraOffset> =>
  page.evaluate(() => {
    const state = (window as any).__TREE_CHOPPING_TEST__.getState()
    const camera = (window as any).__TREE_CHOPPING_CAMERA__
    return {
      x: camera.position.x - state.player.position.x,
      z: camera.position.z - state.player.position.z,
      fov: camera.fov,
    }
  })

test('keyboard controls move toward the visible first target and mouse click swings', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await waitForGame(page)
  await expect(page.locator('.crosshair')).toHaveCount(0)

  const before = await page.evaluate(() => {
    const state = (window as any).__TREE_CHOPPING_TEST__.getState()
    const tree = state.trees.find((candidate: any) => candidate.id === 'starter-sapling-000')
    return { player: state.player.position, tree: tree.position }
  })
  const beforeDistance = distance(before.player, before.tree)

  await page.keyboard.down('w')
  await page.waitForFunction((targetDistance) => {
    const state = (window as any).__TREE_CHOPPING_TEST__.getState()
    const tree = state.trees.find((candidate: any) => candidate.id === 'starter-sapling-000')
    return Math.hypot(state.player.position.x - tree.position.x, state.player.position.z - tree.position.z) < targetDistance
  }, beforeDistance - 0.4)
  await page.keyboard.up('w')

  const afterMove = await page.evaluate(() => (window as any).__TREE_CHOPPING_TEST__.getSnapshot())
  expect(afterMove.currentTargetId).toBe('starter-sapling-000')

  await page.mouse.click(640, 410)
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getState().stats.hits >= 1)
  await page.keyboard.down('Space')
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getState().stats.hits >= 3)
  await page.keyboard.up('Space')
  const afterSwing = await page.evaluate(() => (window as any).__TREE_CHOPPING_TEST__.getState())
  expect(afterSwing.stats.hits).toBeGreaterThanOrEqual(3)
  expect(consoleErrors).toEqual([])
})

test('camera keeps a stable play heading while strafing and reversing', async ({ page }) => {
  await waitForGame(page)

  const initial = await cameraOffset(page)
  expect(initial.x).toBeLessThan(-8)
  expect(Math.abs(initial.z)).toBeLessThan(0.3)

  await page.keyboard.down('d')
  await page.waitForTimeout(650)
  await page.keyboard.up('d')

  const afterRight = await cameraOffset(page)
  expect(afterRight.x).toBeLessThan(-7)
  expect(Math.abs(afterRight.z)).toBeLessThan(2)

  await page.keyboard.down('s')
  await page.waitForTimeout(650)
  await page.keyboard.up('s')

  const afterBack = await cameraOffset(page)
  expect(afterBack.x).toBeLessThan(-7)
  expect(Math.abs(afterBack.z)).toBeLessThan(2)
})

test('mouse look turns the third-person movement heading', async ({ page }) => {
  await waitForGame(page)
  const canvas = page.getByLabel('Tree Chopping Web game canvas')

  const before = await page.evaluate(() => {
    const state = (window as any).__TREE_CHOPPING_TEST__.getState()
    return { position: { ...state.player.position }, yaw: state.player.cameraYaw }
  })
  expect(before.yaw).toBeCloseTo(0, 2)

  await canvas.dispatchEvent('mousedown', { button: 2, buttons: 2, bubbles: true })
  await canvas.dispatchEvent('mousemove', { movementX: 360, buttons: 2, bubbles: true })
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getState().player.cameraYaw > 1)
  await canvas.dispatchEvent('mouseup', { button: 2, buttons: 0, bubbles: true })

  await page.keyboard.down('w')
  await page.waitForFunction((start) => {
    const state = (window as any).__TREE_CHOPPING_TEST__.getState()
    return state.player.position.z - start.z > 0.5
  }, before.position)
  await page.keyboard.up('w')

  const after = await page.evaluate(() => {
    const state = (window as any).__TREE_CHOPPING_TEST__.getState()
    return { position: { ...state.player.position }, yaw: state.player.cameraYaw }
  })
  expect(after.yaw).toBeGreaterThan(1)
  expect(after.position.z - before.position.z).toBeGreaterThan(0.5)
})

test('touch dpad up moves toward the first target and touch chop hits it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await waitForGame(page)
  await expect(page.locator('.crosshair')).toHaveCount(0)

  const targetBox = await page.getByRole('region', { name: /^Target$/ }).boundingBox()
  const moveUpBox = await page.getByRole('button', { name: /^Move up$/ }).boundingBox()
  const chopBox = await page.getByRole('button', { name: /^Chop$/ }).boundingBox()
  expect(targetBox).toBeTruthy()
  expect(moveUpBox).toBeTruthy()
  expect(chopBox).toBeTruthy()
  expect(intersects(targetBox as Box, moveUpBox as Box)).toBe(false)
  expect(intersects(targetBox as Box, chopBox as Box)).toBe(false)

  const before = await page.evaluate(() => {
    const state = (window as any).__TREE_CHOPPING_TEST__.getState()
    const tree = state.trees.find((candidate: any) => candidate.id === 'starter-sapling-000')
    return { player: state.player.position, tree: tree.position }
  })
  const beforeDistance = distance(before.player, before.tree)

  const moveUp = page.getByRole('button', { name: /^Move up$/ })
  await moveUp.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, bubbles: true })
  await page.waitForFunction((targetDistance) => {
    const state = (window as any).__TREE_CHOPPING_TEST__.getState()
    const tree = state.trees.find((candidate: any) => candidate.id === 'starter-sapling-000')
    return Math.hypot(state.player.position.x - tree.position.x, state.player.position.z - tree.position.z) < targetDistance
  }, beforeDistance - 0.4)
  await moveUp.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true, bubbles: true })

  const chop = page.getByRole('button', { name: /^Chop$/ })
  await chop.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, bubbles: true })
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getState().stats.hits >= 2)
  await chop.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true, bubbles: true })

  const afterSwing = await page.evaluate(() => (window as any).__TREE_CHOPPING_TEST__.getState())
  expect(afterSwing.stats.hits).toBeGreaterThanOrEqual(2)
  expect(consoleErrors).toEqual([])
})

test('saved progression survives reload and reset run clears it', async ({ page }) => {
  await page.goto('./')
  await waitForGameApi(page)
  await page.evaluate((key) => window.localStorage.removeItem(key), saveKey)
  await page.evaluate(() => (window as any).__TREE_CHOPPING_TEST__.resetRun())

  await page.evaluate(() => {
    const api = (window as any).__TREE_CHOPPING_TEST__
    const state = api.getState()
    state.stockpile.wood = 18
    state.axeTier = 1
  })
  await page.getByRole('button', { name: /^save$/i }).click()

  await page.reload()
  await waitForGameApi(page)
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getSnapshot().axeTier === 1)
  expect(await page.evaluate(() => (window as any).__TREE_CHOPPING_TEST__.getSnapshot().stockpile.wood)).toBe(18)

  await page.getByRole('button', { name: /^reset run$/i }).click()
  await page.getByRole('button', { name: /^confirm reset$/i }).click()
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getSnapshot().axeTier === 0)
  const snapshot = await page.evaluate(() => (window as any).__TREE_CHOPPING_TEST__.getSnapshot())
  expect(snapshot.stockpile.wood).toBe(0)
  expect(snapshot.currentTargetId).toBe('starter-sapling-000')
})

test('upgrade station buttons buy the selected upgrade explicitly', async ({ page }) => {
  await waitForGame(page)

  await page.evaluate(() => {
    const api = (window as any).__TREE_CHOPPING_TEST__
    const state = api.getState()
    const station = state.stations.find((candidate: any) => candidate.id === 'station-upgrades')
    if (!station) throw new Error('missing upgrades station')
    state.stockpile.wood = 14
    api.movePlayerTo(station.position.x, station.position.z)
    api.step(1 / 60)
  })
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getSnapshot().activeStationId === 'station-upgrades')

  await page.getByRole('button', { name: /^Upgrade speed$/i }).click()
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getState().speedTier === 1)

  const state = await page.evaluate(() => (window as any).__TREE_CHOPPING_TEST__.getState())
  expect(state.selectedUpgrade).toBe('speed')
  expect(state.speedTier).toBe(1)
  expect(state.backpackTier).toBe(0)
  expect(state.stockpile.wood).toBe(0)
})
