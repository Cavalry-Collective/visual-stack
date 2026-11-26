await (async () => {
  const savedText = __REPLY__
  const savedDigest = __REPLY_SHA256__

  const sha256 = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('')

  const storedText = window.__proofreadReply
  if (typeof storedText !== 'string') return { verified: false, reason: 'No reply is stored in this page.' }

  // The comparison stays inside the page, because a browser tool can redact long hex strings from its output.
  if (storedText === savedText && await sha256(storedText) === savedDigest) return { verified: true, length: storedText.length }
  let firstDifference = 0
  while (firstDifference < storedText.length && storedText[firstDifference] === savedText[firstDifference]) firstDifference++
  return { verified: false, storedLength: storedText.length, savedLength: savedText.length, firstDifference }
})()
