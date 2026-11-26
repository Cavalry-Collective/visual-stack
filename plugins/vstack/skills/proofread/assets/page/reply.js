await (async () => {
  // A browser tool can time out a long-running script, so each call works briefly and the agent calls again.
  const CALL_LIMIT_MILLISECONDS = 35000
  const POLL_INTERVAL_MILLISECONDS = 2000
  const QUIET_POLLS_REQUIRED = 3
  const CAPTURE_LIMIT_MILLISECONDS = 3000

  const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
  const buttons = () => [...document.querySelectorAll('button')]
  const enabledSendButton = () => buttons().find(button => button.offsetParent !== null && /^send/i.test(button.getAttribute('aria-label') || '') && !button.disabled)
  const generating = () => buttons().some(button => /stop/i.test(`${button.getAttribute('aria-label') || ''} ${button.getAttribute('data-testid') || ''}`))
  // "Copy message" belongs to the sent message, so only "Copy" can mean a reply.
  const copyButtons = () => buttons().filter(button => /^copy$/i.test(button.getAttribute('aria-label') || ''))
  const deadline = Date.now() + CALL_LIMIT_MILLISECONDS

  // The flag lives in the page, so a later call does not send twice. A new chat reloads the page and clears it.
  if (!window.__proofreadSent) {
    // Send stays disabled while an attachment uploads.
    while (!enabledSendButton() && Date.now() < deadline) await sleep(250)
    const send = enabledSendButton()
    if (!send) return { sent: false, done: false, reason: 'No enabled Send button found.' }
    send.click()
    window.__proofreadSent = true
    delete window.__proofreadReply
  }

  // The Copy button can appear before the reply has any text, so the page must also stop changing.
  let quietPolls = 0
  let previousText = null
  while (Date.now() < deadline && quietPolls < QUIET_POLLS_REQUIRED) {
    await sleep(POLL_INTERVAL_MILLISECONDS)
    const currentText = document.body.innerText
    quietPolls = !generating() && copyButtons().length > 0 && currentText === previousText ? quietPolls + 1 : 0
    previousText = currentText
  }
  if (quietPolls < QUIET_POLLS_REQUIRED) return { sent: true, done: false, generating: generating() }

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
    copyButtons().at(-1).click()
    const captureDeadline = Date.now() + CAPTURE_LIMIT_MILLISECONDS
    while (captured === null && Date.now() < captureDeadline) await sleep(100)
  } finally {
    clipboard.writeText = originalWriteText
    clipboard.write = originalWrite
  }
  if (!captured || !captured.trim()) return { sent: true, done: true, captured: false, reason: 'The Copy button produced no text.' }

  // A browser tool can cut a long result short, so the reply stays in the page and is read back in slices.
  window.__proofreadReply = captured
  return { sent: true, done: true, captured: true, length: captured.length }
})()
