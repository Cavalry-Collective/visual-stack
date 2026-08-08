import { After, AfterAll, Before } from '@cucumber/cucumber'
import { chromium } from 'playwright'

/* One Chromium for the whole run; each @browser scenario gets its own page.
   HEADED=1 opens a visible browser, slowed enough to watch — for debugging a
   scenario or seeing the workspace being driven. */
let browser = null

Before({ tags: '@browser' }, async function () {
  browser ??= await chromium.launch(
    process.env.HEADED ? { headless: false, slowMo: 400 } : {},
  )
  this.browserPage = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
})

After({ tags: '@browser' }, async function () {
  await this.browserPage?.close()
})

AfterAll(async function () {
  await browser?.close()
  browser = null
})
