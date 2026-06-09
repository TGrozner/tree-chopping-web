import { expect, test } from '@playwright/test'
import { inflateSync } from 'node:zlib'
import { clearSavedRun, waitForGame } from './helpers'

type PngStats = {
  contrast: number
  samples: number
}

const paeth = (left: number, up: number, upperLeft: number): number => {
  const p = left + up - upperLeft
  const pa = Math.abs(p - left)
  const pb = Math.abs(p - up)
  const pc = Math.abs(p - upperLeft)
  if (pa <= pb && pa <= pc) return left
  return pb <= pc ? up : upperLeft
}

const pngStats = (png: Buffer): PngStats => {
  if (png.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png')
  let offset = 8
  let width = 0
  let height = 0
  let colorType = 0
  const idat: Buffer[] = []
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (type === 'IHDR') {
      width = png.readUInt32BE(dataStart)
      height = png.readUInt32BE(dataStart + 4)
      const bitDepth = png[dataStart + 8]
      colorType = png[dataStart + 9]
      if (bitDepth !== 8 || ![2, 6].includes(colorType)) throw new Error(`unsupported png ${bitDepth}/${colorType}`)
    }
    if (type === 'IDAT') idat.push(png.subarray(dataStart, dataEnd))
    if (type === 'IEND') break
    offset = dataEnd + 4
  }

  const channels = colorType === 6 ? 4 : 3
  const stride = width * channels
  const inflated = inflateSync(Buffer.concat(idat))
  const previous = Buffer.alloc(stride)
  const current = Buffer.alloc(stride)
  let input = 0
  let min = 255
  let max = 0
  let samples = 0

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[input]
    input += 1
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[input + x]
      const left = x >= channels ? current[x - channels] : 0
      const up = previous[x]
      const upperLeft = x >= channels ? previous[x - channels] : 0
      const value =
        filter === 0
          ? raw
          : filter === 1
            ? (raw + left) & 255
            : filter === 2
              ? (raw + up) & 255
              : filter === 3
                ? (raw + Math.floor((left + up) / 2)) & 255
                : (raw + paeth(left, up, upperLeft)) & 255
      current[x] = value
    }
    input += stride
    for (let x = 0; x < width; x += 9) {
      const index = x * channels
      const luminance = Math.round((current[index] + current[index + 1] + current[index + 2]) / 3)
      min = Math.min(min, luminance)
      max = Math.max(max, luminance)
      samples += 1
    }
    previous.set(current)
  }

  return { contrast: max - min, samples }
}

const setupCleave = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.evaluate(() => {
    const api = (window as any).__TREE_CHOPPING_TEST__
    const state = api.getState()
    const frontA = state.trees.find((tree: any) => tree.id === 'starter-sapling-000')
    const frontB = state.trees.find((tree: any) => tree.id === 'starter-sapling-001')
    const side = state.trees.find((tree: any) => tree.id === 'starter-sapling-002')
    if (!frontA || !frontB || !side) throw new Error('missing cleave trees')
    state.trees = [frontA, frontB, side]
    state.player.position = { x: 0, z: 0 }
    state.player.facing = { x: 1, z: 0 }
    state.player.cameraYaw = 0
    frontA.position = { x: 2.35, z: 0.28 }
    frontB.position = { x: 2.55, z: -0.32 }
    side.position = { x: 0.4, z: 3.5 }
    api.step(1 / 60)
  })
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getState().currentSwingTargetIds.length === 2)
  await page.evaluate(() => {
    const api = (window as any).__TREE_CHOPPING_TEST__
    api.queueChop()
    api.step(0.5)
  })
  await page.waitForFunction(() => (window as any).__TREE_CHOPPING_TEST__.getState().feedback.some((event: any) => event.kind === 'cleave'))
}

for (const viewport of [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`cleave visual smoke ${viewport.name}`, async ({ page }) => {
    await clearSavedRun(page)
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/')
    await waitForGame(page)
    await setupCleave(page)

    const state = await page.evaluate(() => (window as any).__TREE_CHOPPING_TEST__.getState())
    expect(state.currentSwingTargetIds).toEqual(['starter-sapling-000', 'starter-sapling-001'])
    expect(state.message).toBe('Cleave hit 2 targets.')

    const screenshot = await page.screenshot({ fullPage: true })
    const stats = pngStats(screenshot)
    expect(screenshot.length).toBeGreaterThan(viewport.name === 'desktop' ? 80_000 : 45_000)
    expect(stats.samples).toBeGreaterThan(10_000)
    expect(stats.contrast).toBeGreaterThan(120)
  })
}
