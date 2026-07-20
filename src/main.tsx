import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@janeapp/burrito-design-system/fonts.css'
import './index.css'
import App from './App.tsx'
import axe from 'axe-core'

if (import.meta.env.DEV) {
  setTimeout(() => {
    axe.run().then(results => {
      if (results.violations.length > 0) {
        console.group('%c axe-core accessibility violations', 'color: red; font-weight: bold')
        results.violations.forEach(v => {
          console.warn(`[${v.impact}] ${v.id}: ${v.description}`)
          v.nodes.forEach(n => console.log('  →', n.html))
        })
        console.groupEnd()
      } else {
        console.log('%c axe-core: no violations found', 'color: green')
      }
    })
  }, 1000)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
