import { expect, test, type Page } from '@playwright/test'

const pressSwing = async (page: Page, expectedHits: number): Promise<void> => {
  await page.keyboard.press('Space')
  await page.waitForFunction(
    (hits) => (window as any).__TREE_CHOPPING_TEST__.getState().stats.hits >= hits,
    expectedHits,
  )
}

const movePlayerToFallenTrunk = async (page: Page): Promise<string> =>
  page.evaluate(() => {
    const api = (window as any).__TREE_CHOPPING_TEST__
    const state = api.getState()
    const tree = state.trees.find((candidate: any) => candidate.status === 'fallen' && !candidate.splitDone)
    if (!tree) throw new Error('missing fallen trunk')
    const center = {
      x: tree.position.x + tree.fallDirection.x * 4.8 * tree.scale * 0.45,
      z: tree.position.z + tree.fallDirection.z * 4.8 * tree.scale * 0.45,
    }
    const side = { x: -tree.fallDirection.z, z: tree.fallDirection.x }
    const player = { x: center.x - side.x * 1.1, z: center.z - side.z * 1.1 }
    api.movePlayerTo(player.x, player.z)
    api.face(center.x - player.x, center.z - player.z)
    api.step(1 / 60)
    return tree.id
  })

const movePlayerToStation = async (page: Page, stationId: string): Promise<void> => {
  await page.evaluate((targetStationId) => {
    const api = (window as any).__TREE_CHOPPING_TEST__
    const state = api.getState()
    const station = state.stations.find((candidate: any) => candidate.id === targetStationId)
    if (!station) throw new Error(`missing station ${targetStationId}`)
    api.movePlayerTo(station.position.x, station.position.z)
    api.step(1 / 60)
  }, stationId)
}

const collectFirstWoodItem = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const api = (window as any).__TREE_CHOPPING_TEST__
    const state = api.getState()
    const item = state.woodItems.find((candidate: any) => !candidate.collected)
    if (!item) throw new Error('missing wood item')
    api.movePlayerTo(item.position.x, item.position.z)
    api.step(0.25)
  })
}

test('core loop: swing, fallen tree, backpack, depot, and hub return', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/')
  await expect(page.getByLabel('Tree Chopping Web game canvas')).toBeVisible()

  await page.waitForFunction(() => Boolean((window as any).__TREE_CHOPPING_TEST__))
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getSnapshot().currentTargetId === 'starter-sapling-000')

  await pressSwing(page, 1)
  await pressSwing(page, 2)
  await pressSwing(page, 3)
  await page.waitForFunction(() => {
    const snapshot = (window as any).__TREE_CHOPPING_TEST__.getSnapshot()
    return snapshot.fallenTrees >= 1 && snapshot.fallenTrunks >= 1
  })

  const trunkId = await movePlayerToFallenTrunk(page)
  await page.waitForFunction((targetTrunkId) => (window as any).__TREE_CHOPPING_TEST__.getSnapshot().currentTargetId === targetTrunkId, trunkId)
  await pressSwing(page, 4)
  await pressSwing(page, 5)
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getSnapshot().woodItems >= 1)
  await collectFirstWoodItem(page)
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getSnapshot().backpackTotal >= 1)

  await movePlayerToStation(page, 'station-depot')
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getSnapshot().activeStationId === 'station-depot')
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getSnapshot().stockpile.wood >= 1)

  await page.keyboard.press('KeyR')
  await page.waitForFunction(() => {
    const snapshot = (window as any).__TREE_CHOPPING_TEST__.getSnapshot()
    return Math.abs(snapshot.player.x + 8.4) < 0.2 && Math.abs(snapshot.player.z) < 0.2
  })

  const finalSnapshot = await page.evaluate(() => (window as any).__TREE_CHOPPING_TEST__.getSnapshot())
  expect(finalSnapshot.stockpile.wood).toBeGreaterThanOrEqual(1)
  expect(finalSnapshot.backpackTotal).toBe(0)
  expect(consoleErrors).toEqual([])
})
