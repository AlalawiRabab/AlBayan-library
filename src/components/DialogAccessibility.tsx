'use client'

import { useEffect } from 'react'

const focusableSelector = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Adds focus management to older feature dialogs while they migrate to the shared Dialog component. */
export default function DialogAccessibility() {
  useEffect(() => {
    let activePanel: HTMLElement | null = null
    let returnFocus: HTMLElement | null = null
    let previousOverflow = ''

    const syncDialog = () => {
      const overlays = Array.from(document.querySelectorAll<HTMLElement>('.dialog-backdrop'))
      const overlay = [...overlays].reverse().find(item => {
        const panel = item.firstElementChild as HTMLElement | null
        return panel && !panel.hasAttribute('role')
      })

      if (!overlay) {
        if (activePanel && !activePanel.isConnected) {
          document.body.style.overflow = previousOverflow
          returnFocus?.focus()
          activePanel = null
          returnFocus = null
        }
        return
      }

      const panel = overlay.firstElementChild as HTMLElement
      if (panel === activePanel) return
      returnFocus = document.activeElement as HTMLElement | null
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      panel.setAttribute('role', 'dialog')
      panel.setAttribute('aria-modal', 'true')
      panel.setAttribute('tabindex', '-1')
      if (!panel.hasAttribute('aria-label')) {
        const heading = panel.querySelector('h1, h2, h3')?.textContent?.trim()
        panel.setAttribute('aria-label', heading || 'نافذة حوار')
      }
      activePanel = panel
      requestAnimationFrame(() => {
        const first = panel.querySelector<HTMLElement>(focusableSelector)
        ;(first || panel).focus()
      })
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!activePanel?.isConnected) return
      if (event.key === 'Escape') {
        event.preventDefault()
        ;(activePanel.parentElement as HTMLElement | null)?.click()
        return
      }
      if (event.key !== 'Tab') return
      const items = Array.from(activePanel.querySelectorAll<HTMLElement>(focusableSelector))
      if (items.length === 0) {
        event.preventDefault()
        activePanel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const observer = new MutationObserver(syncDialog)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('keydown', handleKeyDown)
    syncDialog()
    return () => {
      observer.disconnect()
      document.removeEventListener('keydown', handleKeyDown)
      if (activePanel) document.body.style.overflow = previousOverflow
    }
  }, [])

  return null
}
