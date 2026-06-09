import { expect, type Page } from '@playwright/test'

export const saveKey = 'tree-chopping-web:save:v1'

export const clearSavedRun = async (page: Page): Promise<void> => {
  await page.addInitScript((key) => window.localStorage.removeItem(key), saveKey)
}

export const waitForGame = async (page: Page): Promise<void> => {
  await expect(page.getByLabel('Tree Chopping Web game canvas')).toBeVisible()
  await page.waitForFunction(() => Boolean((window as any).__TREE_CHOPPING_TEST__))
  await page.waitForFunction(() => Boolean((window as any).__TREE_CHOPPING_CAMERA__))
}
