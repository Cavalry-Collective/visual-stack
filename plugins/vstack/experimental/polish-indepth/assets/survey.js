/*
 * survey.js — list what one page leads to, for the in-depth site map.
 *
 * Evaluate the whole file in the page with the host's browser tools. It is one
 * expression and returns plain JSON, so it works through any tool that runs
 * JavaScript in a tab. It reads the page and clicks nothing: opening a trigger
 * is the agent's decision, because a click can submit, pay or delete.
 *
 *   links     same-origin addresses this page links to, with the region the
 *             link sits in, so navigation and footer links can be told from
 *             links in the content
 *   triggers  controls that open something on this page: a modal, a popup
 *             (menu, popover, dropdown) or a panel that slides in
 *   overlays  dialogs, popups and panels already in the markup, open or not
 */
(() => {
  const here = new URL(location.href)
  const text = el => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  const region = el => {
    const landmark = el.closest('header, nav, footer, aside, main, [role=navigation], [role=banner], [role=contentinfo], [role=complementary], [role=main]')
    if (!landmark) return 'body'
    const role = landmark.getAttribute('role')
    return { navigation: 'nav', banner: 'header', contentinfo: 'footer', complementary: 'aside', main: 'main' }[role] || landmark.tagName.toLowerCase()
  }
  /* A short selector the agent can hand to a click tool. */
  const selector = el => {
    if (el.id) return '#' + CSS.escape(el.id)
    const parts = []
    for (let node = el; node && node.nodeType === 1 && parts.length < 4; node = node.parentElement) {
      if (node.id) { parts.unshift('#' + CSS.escape(node.id)); break }
      const siblings = node.parentElement ? [...node.parentElement.children].filter(other => other.tagName === node.tagName) : []
      parts.unshift(node.tagName.toLowerCase() + (siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(node) + 1})` : ''))
    }
    return parts.join(' > ')
  }
  const kindOf = el => {
    const role = (el.getAttribute('role') || '').toLowerCase()
    const name = (el.className && typeof el.className === 'string' ? el.className : '').toLowerCase()
    if (/drawer|offcanvas|sheet|slide-?over|sidebar|panel/.test(name)) return 'panel'
    if (el.tagName === 'DIALOG' || role === 'dialog' || role === 'alertdialog' || /modal|dialog/.test(name)) return 'modal'
    return 'popup'
  }
  const visible = el => {
    const style = getComputedStyle(el)
    const box = el.getBoundingClientRect()
    return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0
  }

  const links = new Map()
  for (const anchor of document.querySelectorAll('a[href]')) {
    let url
    try { url = new URL(anchor.getAttribute('href'), here) } catch { continue }
    if (url.origin !== here.origin || !/^https?:$/.test(url.protocol)) continue
    if (/\.(pdf|zip|png|jpe?g|gif|svg|webp|mp4|mp3)$/i.test(url.pathname)) continue
    const path = url.pathname + url.search
    if (path === here.pathname + here.search) continue
    if (!links.has(path)) links.set(path, { path, text: text(anchor), region: region(anchor) })
  }

  const overlaySelector = 'dialog, [role=dialog], [role=alertdialog], [role=menu], [role=listbox], [popover], [class*=modal], [class*=drawer], [class*=offcanvas], [class*=popover], [class*=dropdown-menu]'
  const overlays = [...document.querySelectorAll(overlaySelector)]
    .filter(el => !el.parentElement.closest(overlaySelector))
    .map(el => ({ selector: selector(el), kind: kindOf(el), label: text(el.querySelector('h1, h2, h3, [class*=title]') || el).slice(0, 60), open: visible(el) }))

  const triggerSelector = '[aria-haspopup]:not([aria-haspopup=false]), [aria-controls], [aria-expanded], [popovertarget], [data-toggle], [data-bs-toggle], [data-target], [data-bs-target], [commandfor]'
  const triggers = [...document.querySelectorAll(triggerSelector)]
    .filter(el => visible(el) && !el.closest('a[href]:not([href^="#"])'))
    .map(el => {
      const targetId = el.getAttribute('aria-controls') || el.getAttribute('popovertarget') || el.getAttribute('commandfor') ||
        (el.getAttribute('data-bs-target') || el.getAttribute('data-target') || '').replace(/^#/, '')
      const target = targetId ? document.getElementById(targetId) : null
      const popup = (el.getAttribute('aria-haspopup') || '').toLowerCase()
      return {
        selector: selector(el),
        text: text(el),
        region: region(el),
        opens: target ? kindOf(target) : popup === 'dialog' ? 'modal' : 'popup',
        target: target ? selector(target) : null,
        submits: el.matches('button[type=submit], input[type=submit]') || (el.tagName === 'BUTTON' && !el.getAttribute('type') && !!el.closest('form')),
      }
    })

  return { url: here.pathname + here.search, title: document.title, links: [...links.values()], triggers, overlays }
})()
