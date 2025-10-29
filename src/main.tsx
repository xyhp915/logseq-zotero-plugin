import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import '@logseq/libs'
import { isInLogseq } from './common.ts'

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
            },
    ).catch(console.error)
} else {
    render()
}