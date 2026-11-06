await (async () => {
  const SEND_LIMIT_MILLISECONDS = 30000
  const enabledSendButton = () => [...document.querySelectorAll('button')].find(button => button.offsetParent !== null && /^send/i.test(button.getAttribute('aria-label') || '') && !button.disabled)

  // Send stays disabled while an attachment uploads.
  const deadline = Date.now() + SEND_LIMIT_MILLISECONDS
  while (!enabledSendButton() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 250))

  const send = enabledSendButton()
  if (!send) return { sent: false, reason: 'No enabled Send button found.' }
  send.click()
  return { sent: true }
})()
