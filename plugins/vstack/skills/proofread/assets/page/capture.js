await (async () => {
  const CAPTURE_LIMIT_MILLISECONDS = 3000
  const clipboard = navigator.clipboard
  const originalWriteText = clipboard.writeText
  const originalWrite = clipboard.write
  let captured = null

  // Keep the Copy button's text in the page, so the user's clipboard is not overwritten.
  clipboard.writeText = async text => { captured = text }
  clipboard.write = async items => {
    for (const item of items) {
      if (item.types.includes('text/plain')) captured = await (await item.getType('text/plain')).text()
    }
  }

  try {
    const copyButtons = [...document.querySelectorAll('button')].filter(button => /^copy$/i.test(button.getAttribute('aria-label') || ''))
    if (copyButtons.length === 0) return 'CAPTURE FAILED: no Copy button found.'
    copyButtons[copyButtons.length - 1].click()
    const deadline = Date.now() + CAPTURE_LIMIT_MILLISECONDS
    while (captured === null && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100))
  } finally {
    clipboard.writeText = originalWriteText
    clipboard.write = originalWrite
  }

  return captured && captured.trim() ? captured : 'CAPTURE FAILED: the Copy button produced no text.'
})()
