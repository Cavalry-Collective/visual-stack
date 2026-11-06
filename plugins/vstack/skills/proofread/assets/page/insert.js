await (async () => {
  const copyText = __COPY__
  const promptText = __PROMPT__
  const expectedDigest = __COPY_SHA256__

  const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
  const sha256 = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('')

  // The comparison stays inside the page, because a browser tool can redact long hex strings from its output.
  if (await sha256(copyText) !== expectedDigest) return { verified: false, reason: 'The copy changed on its way to the page.' }

  const composer = [...document.querySelectorAll('[contenteditable="true"]')].find(element => element.offsetParent !== null)
  if (!composer) return { verified: false, reason: 'Message box not found.' }
  if (composer.innerText.trim().length > 0) return { verified: false, reason: 'Message box is not empty.' }

  const paste = text => {
    composer.focus()
    const data = new DataTransfer()
    data.setData('text/plain', text)
    composer.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }
  const attachmentButtons = () => [...document.querySelectorAll('[aria-label*="Remove"]')].filter(button => /attachment|file/i.test(button.getAttribute('aria-label')))

  // innerText adds line breaks around auto-linked URLs, so read what the editor holds.
  const serialise = node => {
    if (node.nodeType === Node.TEXT_NODE) return node.data
    if (node.nodeName === 'BR') return node.classList.contains('ProseMirror-trailingBreak') ? '' : '\n'
    return [...node.childNodes].map(serialise).join('')
  }
  const composerText = () => [...composer.children].map(serialise).join('\n')

  const inlineText = `${promptText}\n\n${copyText}`
  paste(inlineText)
  await sleep(1500)

  if (attachmentButtons().length === 0) {
    return { verified: composerText() === inlineText, route: 'inline', expectedLength: inlineText.length, actualLength: composerText().length }
  }

  // ChatGPT made the paste an attachment, which would hold the prompt too. Send the prompt as the message and the copy alone as the attachment.
  attachmentButtons().forEach(button => button.click())
  await sleep(800)
  paste(promptText)
  await sleep(600)
  paste(copyText)
  await sleep(3000)

  const attachments = attachmentButtons().length

  // The copy alone can fall under the attachment limit even when the prompt and copy together did not.
  if (attachments === 0) {
    return { verified: composerText() === promptText + copyText, route: 'inline-after-prompt', expectedLength: promptText.length + copyText.length, actualLength: composerText().length }
  }
  return { verified: composerText() === promptText && attachments === 1, route: 'attachment', attachments, promptExact: composerText() === promptText, copyLength: copyText.length }
})()
