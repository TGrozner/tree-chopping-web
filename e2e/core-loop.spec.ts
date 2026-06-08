import { expect, test } from '@playwright/test'

test('core loop: chop, cascade, split logs, collect wood, upgrade axe', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/')
  await expect(page.getByLabel('Tree Chopping Web game canvas')).toBeVisible()
  await expect(page.getByTestId('debug-overlay')).toBeVisible()

  await page.waitForFunction(() => Boolean((window as any).__TREE_CHOPPING_TEST__))

  await page.evaluate(() => {
    const api = (window as any).__TREE_CHOPPING_TEST__
    api.movePlayerTo(0, 1.2)
    api.face(0, 1)
    api.chop()
    api.chop()
    api.step(1.6)
  })

  const afterFall = await page.evaluate(() => (window as any).__TREE_CHOPPING_TEST__.getSnapshot())
  expect(afterFall.fallenTrees).toBeGreaterThanOrEqual(1)
  expect(afterFall.logs).toBeGreaterThanOrEqual(2)

  await page.evaluate(() => {
    const api = (window as any).__TREE_CHOPPING_TEST__
    const logs = api.getState().logs.filter((log: any) => log.status === 'whole').slice(0, 2)
    for (const log of logs) {
      api.movePlayerTo(log.position.x, log.position.z)
      api.chop()
      api.chop()
      api.step(0.1)
    }
  })

  const finalSnapshot = await page.evaluate(() => (window as any).__TREE_CHOPPING_TEST__.getSnapshot())
  expect(finalSnapshot.wood).toBeGreaterThanOrEqual(6)
  expect(finalSnapshot.axeLevel).toBe(2)
  expect(consoleErrors).toEqual([])
})
