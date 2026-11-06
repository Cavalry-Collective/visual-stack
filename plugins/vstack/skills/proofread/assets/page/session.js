await (async () => {
  const session = await fetch('/api/auth/session', { credentials: 'include' }).then(response => (response.ok ? response.json() : {})).catch(() => ({}))
  const composer = [...document.querySelectorAll('[contenteditable="true"]')].find(element => element.offsetParent !== null)
  return {
    signedIn: !!session.user,
    temporaryChat: new URLSearchParams(location.search).get('temporary-chat') === 'true' && /temporary chat/i.test(document.body.innerText),
    composerFound: !!composer,
    composerEmpty: composer ? composer.innerText.trim().length === 0 : null,
    readyState: document.readyState,
  }
})()
