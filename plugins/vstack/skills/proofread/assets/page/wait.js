await (async () => {
  // A browser tool can time out a long-running script, so each call polls briefly and the agent calls again.
  const POLL_LIMIT_MILLISECONDS = 35000
  const POLL_INTERVAL_MILLISECONDS = 2000
  const QUIET_POLLS_REQUIRED = 3

  const buttons = () => [...document.querySelectorAll('button')]
  const generating = () => buttons().some(button => /stop/i.test(`${button.getAttribute('aria-label') || ''} ${button.getAttribute('data-testid') || ''}`))
  // "Copy message" belongs to the sent message, so only "Copy" can mean a reply.
  const copyButtonPresent = () => buttons().some(button => /^copy$/i.test(button.getAttribute('aria-label') || ''))

  // The Copy button can appear before the reply has any text, so the page must also stop changing.
  const deadline = Date.now() + POLL_LIMIT_MILLISECONDS
  let quietPolls = 0
  let previousText = null
  while (Date.now() < deadline && quietPolls < QUIET_POLLS_REQUIRED) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MILLISECONDS))
    const currentText = document.body.innerText
    quietPolls = !generating() && copyButtonPresent() && currentText === previousText ? quietPolls + 1 : 0
    previousText = currentText
  }
  return { done: quietPolls >= QUIET_POLLS_REQUIRED, generating: generating(), copyButtonPresent: copyButtonPresent() }
})()
