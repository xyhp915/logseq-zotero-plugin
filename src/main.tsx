import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import '@logseq/libs'
import { isInLogseq } from './common.ts'
import { appState } from './store.ts'

function render () {
  createRoot(document.getElementById('root')!).render(<App/>)
}

if (isInLogseq) {
  logseq.ready().then(async () => {
        render()
        await logseq.UI.showMsg('hello, zotero')

        logseq.provideModel({
          onZoteroIconClick: async () => {
            logseq.showMainUI()
          },
        })

        // debug icon
        logseq.App.registerUIItem('toolbar', {
          key: 'zotero-icon',
          template: `<a class="button" data-on-click="onZoteroIconClick" title="Zotero Extension">
        <i class="ti ti-bookmarks"></i>
      </a>`,
        })

        // shortcut key
        logseq.App.registerCommandPalette({
          key: 'zotero-show-main-ui',
          label: 'Show Zotero Extension Main UI',
          keybinding: { binding: 'z z' },
        }, () => {
          logseq.showMainUI()
        })

        // on main ui show
        logseq.on('ui:visible:changed', ({ visible }: any) => {
          if (visible) {
            appState.isVisible.set(true)
          } else {
            setTimeout(() => {appState.isVisible.set(false)}, 300)
          }
        })
      },
  ).catch(console.error)
} else {
  appState.isVisible.set(true)
  render()
}