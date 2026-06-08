import { expect, test, type Page } from '@playwright/test'

type Vec2 = { x: number; z: number }
type Box = { x: number; y: number; width: number; height: number }

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z)

const intersects = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

const waitForGame = async (page: Page): Promise<void> => {
  await page.goto('/')
  await expect(page.getByLabel('Tree Chopping Web game canvas')).toBeVisible()
  await page.waitForFunction(() => Boolean((window as any).__TREE_CHOPPING_TEST__))
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getSnapshot().currentTargetId === 'starter-sapling-000')
}

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
  await page.waitForFunction(
    (targetDistance) => {
      const state = (window as any).__TREE_CHOPPING_TEST__.getState()
      const tree = state.trees.find((candidate: any) => candidate.id === 'starter-sapling-000')
      return Math.hypot(state.player.position.x - tree.position.x, state.player.position.z - tree.position.z) < targetDistance
    },
    beforeDistance - 0.4,
  )
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
  await page.waitForFunction(
    (targetDistance) => {
      const state = (window as any).__TREE_CHOPPING_TEST__.getState()
      const tree = state.trees.find((candidate: any) => candidate.id === 'starter-sapling-000')
      return Math.hypot(state.player.position.x - tree.position.x, state.player.position.z - tree.position.z) < targetDistance
    },
    beforeDistance - 0.4,
  )
  await moveUp.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true, bubbles: true })

  const chop = page.getByRole('button', { name: /^Chop$/ })
  await chop.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, bubbles: true })
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getState().stats.hits >= 2)
  await chop.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true, bubbles: true })

  const afterSwing = await page.evaluate(() => (window as any).__TREE_CHOPPING_TEST__.getState())
  expect(afterSwing.stats.hits).toBeGreaterThanOrEqual(2)
  expect(consoleErrors).toEqual([])
})
