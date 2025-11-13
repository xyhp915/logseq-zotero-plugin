import './App.css'
import {
  useAppState,
  useCacheZEntitiesEffects,
  useCollections,
  usePaginatedTopItems,
  useTopItems,
  useTopItemsGroupedByCollection,
  type ZoteroItemEntity,
} from './store.ts'
import { type PropsWithChildren, useEffect, useRef, useState } from 'react'
import cn from 'classnames'
import { type Immutable, type ImmutableArray, type State, useHookstate } from '@hookstate/core'
import {
  LucideDownload,
  LucideExternalLink,
  LucideList,
  LucideLoader2,
  LucideMinus,
  LucideSettings2,
  LucideUpload,
  LucideX,
} from 'lucide-react'
import { openItemInLogseq, pushItemToLogseq, startFullPushToLogseq } from './handlers.ts'
import { closeMainDialog, delay, getItemTitle } from './common.ts'

function GroupedItemsTabsContainer() {
  const { groupedItems, groupedCollections } = useTopItemsGroupedByCollection()
  const [currentCollectionKey, setCurrentCollectionKey] = useState<string | null>(null)

  return (
    <div>
      <ul className={'flex gap-2 flex-row'}>
        {Object.keys(groupedItems).map(collKey => {
          const collection = groupedCollections[collKey]
          return (
            <li key={collKey} className={'flex-1'}>
              <button className={cn('btn w-full',
                currentCollectionKey === collKey && 'btn-active')}
                      onClick={() => setCurrentCollectionKey(collKey)}
              >
                <strong>
                  {collection?.name || collKey}
                  ({groupedItems[collKey].length})
                </strong>
              </button>
            </li>
          )
        })}
      </ul>
      <div className={'p-2 py-6'}>
        {currentCollectionKey && groupedItems[currentCollectionKey] && (
          <div>
            <EntityItemsTableContainer items={groupedItems[currentCollectionKey]}/>
          </div>
        )}
      </div>
    </div>
  )
}

function CollectionsLabels(props: { itemCollectionKeys: string[] }) {
  const { itemCollectionKeys } = props
  const collectionsState = useCollections()
  const itemCollections = collectionsState.items?.filter(coll => itemCollectionKeys.includes(coll.key))

  return (
    <div className={'flex gap-2 flex-wrap'}>
      {itemCollections?.map(coll => {
        return (
          <code key={coll.key} className={'badge badge-soft badge-xs'}>
            {coll.name}
          </code>
        )
      })}
    </div>
  )
}

function PushItemButton({ item }: { item: Immutable<ZoteroItemEntity> }) {
  const pushingState = useHookstate(false)

  return (
    <button className={'btn btn-xs btn-ghost px-1'}
            disabled={pushingState.get()}
            onClick={async () => {
              try {
                pushingState.set(true)
                await pushItemToLogseq(item)
                await logseq.UI.showMsg(
                  `Item "${item.title}" pushed to Logseq page.`, 'success',
                )
                await delay()
              } catch (e) {
                await logseq.UI.showMsg(
                  `Error pushing item "${item.title}" to Logseq: ${e}`, 'error',
                )
                console.error(e)
              } finally {
                pushingState.set(false)
              }
            }}
    >
      <LucideUpload size={14}/>
    </button>
  )
}

function EntityItemsTableContainer(
  props: {
    items: ImmutableArray<ZoteroItemEntity>,
    onCheckedItemsChange?: (checkedItemsState: State<any>, checkedItemsCount: number) => void
  },
) {
  const checkedItemsState = useHookstate<{ [key: string]: boolean }>({})
  const checkedInputRef = useRef<HTMLInputElement>(null)
  const checkedChangedState = useHookstate(0)

  useEffect(() => {
    const allKeysChecked = props.items?.every(it => checkedItemsState[it.key].get())
    const someKeysChecked = props.items?.some(it => checkedItemsState[it.key].get())

    if (checkedInputRef.current) {
      checkedInputRef.current.indeterminate = !allKeysChecked && someKeysChecked
      checkedInputRef.current.checked = allKeysChecked || false
    }

    if (props.onCheckedItemsChange) {
      const checkedItemsCount = Object.values(checkedItemsState.get() || {}).filter(v => v).length
      props.onCheckedItemsChange(checkedItemsState, checkedItemsCount)
    }
  }, [checkedChangedState.get()])

  return (
    <table className="table table-xs border collapse">
      <thead className={'bg-base-200'}>
      <tr>
        <th className={'w-[16px] pr-0'}>
          <label>
            <input className={'checkbox checkbox-sm'}
                   type="checkbox"
                   ref={checkedInputRef}
                   defaultChecked={false}
                   onChange={e => {
                     const checked = e.target.checked
                     const newCheckedState: { [key: string]: boolean } = {}
                     props.items?.forEach(it => {
                       newCheckedState[it.key] = checked
                     })
                     checkedItemsState.set(newCheckedState)
                     checkedChangedState.set(p => p + 1)
                   }}
            />
          </label>
        </th>
        <th>Title</th>
        <th>Type</th>
        <th>Collections</th>
        <th>dateModified</th>
        <th>More</th>
      </tr>
      </thead>
      <tbody>
      {props.items?.map(it => {
        return (
          <tr key={it.key} className={'even:bg-base-200'}>
            <td>
              <label className={'flex items-center'}>
                <input className={'checkbox checkbox-sm'} type="checkbox"
                       checked={checkedItemsState[it.key].get() || false}
                       onChange={e => {
                         checkedItemsState[it.key].set(e.target.checked)
                         checkedChangedState.set(p => p + 1)
                       }}
                />
              </label>
            </td>
            <td>
              <a href={'#'}
                 className={'block'}
                 onClick={(e) => {
                   console.log(JSON.stringify(it, null, 2))
                   // selected row
                   const target = e.currentTarget
                   const rowInput = target.closest('tr')?.querySelector('input[type="checkbox"]') as HTMLInputElement
                   rowInput?.click()
                 }}>
                <strong>
                  {getItemTitle(it)}
                </strong>
              </a>
            </td>
            <td>[[{it.itemType}]]</td>
            <td>
              <CollectionsLabels itemCollectionKeys={it.collections}/>
            </td>
            <td>{it.dateModified}</td>
            {/*<td>{it.tags?.[0]?.tag}</td>*/}
            <td className={'flex'}>
              <PushItemButton item={it}/>
              <button className={'btn btn-xs btn-ghost px-1'}
                      title={'Open page in Logseq'}
                      onClick={async () => {
                        try {
                          await openItemInLogseq(it)
                          closeMainDialog()
                        } catch (e) {
                          console.error('Error opening item in Logseq:', e)
                        }
                      }}
              >
                <LucideExternalLink size={14}/>
              </button>
            </td>
          </tr>
        )
      })}
      </tbody>
    </table>
  )
}

function AppContainer(
  props: PropsWithChildren<any>,
) {
  // setup shortcuts, global styles, etc.
  useEffect(() => {
    // close UI on ESC
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMainDialog()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (<div className="app-container">
      {props.children}
    </div>
  )
}

function SettingsTabContainer() {
  return (
    <div>
      <h2 className={'text-lg font-bold mb-4'}>Settings</h2>
      <p>Settings content goes here.</p>
    </div>
  )
}

function App() {
  // initialize effects
  useCacheZEntitiesEffects()

  const appState = useAppState()
  const zTopItemsState = useTopItems()
  const collectionsState = useCollections()
  // const zTagsState = useZTags()
  // const [groupedCollectionsView, setGroupedCollectionsView] = useState(false)
  const checkedItemsCountState = useHookstate(0)
  const checkedItemsStateRef = useRef<State<any, any>>(null)
  const currentTabState = useHookstate<'all-items' | 'settings'>('all-items')
  const paginatedTopItems = usePaginatedTopItems({ limit: 20 })

  useEffect(() => {
    const isPushing = appState.isPushing.get()
    const pushingProgressMsg = appState.pushingProgressMsg.get()

    if (isPushing) {
      logseq.UI.showMsg(pushingProgressMsg, 'success',
        { key: 'z-pushing-progress-msg', timeout: 0 },
      )
    } else {
      logseq.UI.closeMsg('z-pushing-progress-msg')
    }

    if (!!appState.pushingError.get()) {
      logseq.UI.showMsg(`${appState.pushingError.get()}`, 'error')
      appState.pushingError.set('')
    }
  }, [
    appState.isPushing.get(),
    appState.pushingError,
    appState.pushingProgressMsg.get()])

  if (!appState.isVisible.get()) {
    return <></>
  }

  const isSyncingRemote = collectionsState.loading || zTopItemsState.loading

  return (
    <AppContainer>
      <div className={'flex justify-between'}>
        <div className={'flex gap-3'}>
          <div role="tablist" className="tabs tabs-lift">
            <a role="tab" className={cn('tab', currentTabState.get() === 'all-items' && 'tab-active')}
               onClick={() => currentTabState.set('all-items')}
            >
              <LucideList size={18}/>
              <span className={'pl-1.5'}>
                  All Zotero top items ({zTopItemsState.items.length})
                </span>
            </a>
            <a role="tab" className={cn('tab', currentTabState.get() === 'settings' && 'tab-active')}
               onClick={() => currentTabState.set('settings')}
            >
              <LucideSettings2 size={18}/>
              <span className={'pl-1.5'}>
                  Settings
                </span>
            </a>
          </div>
        </div>

        <div className={'flex gap-4 items-center'}>
            <span className={'label text-sm'}>
                {isSyncingRemote ? 'Syncing...' : ` ${zTopItemsState.items.length} top items loaded.`}
            </span>
          <button className={'btn btn-sm'}
                  onClick={async () => {
                    await collectionsState.refresh({})
                    await zTopItemsState.refresh({})
                  }}
                  disabled={isSyncingRemote}
          >
            {isSyncingRemote ? (
              <LucideLoader2 size={18} className={'animate-spin'}/>
            ) : (
              <LucideDownload size={18}/>
            )}
            Pull remote Zotero top items
          </button>

          {zTopItemsState.items.length > 0 && (
            <button
              className={cn('btn btn-sm btn-outline',
                checkedItemsCountState.get() ? 'btn-dash btn-warning' : 'btn-success')}
              onClick={async () => {
                if (checkedItemsCountState.get()) {
                  // push selected items
                  const checkedItems = zTopItemsState.items.filter(it => {
                    return checkedItemsStateRef.current?.get()?.[it.key]
                  })

                  await startFullPushToLogseq({ items: checkedItems })
                } else {
                  // push all items
                  await startFullPushToLogseq()
                }
              }}
              disabled={appState.isPushing.get()}
            >
              {appState.isPushing.get() ? (
                <LucideLoader2 size={18} className={'animate-spin'}/>) : (
                <LucideUpload size={18}/>)}
              {checkedItemsCountState.get()
                ? `Push selected items (${checkedItemsCountState.get()}) to Logseq`
                : 'Push all items to Logseq'}
            </button>
          )}
          <button className={cn('btn btn-circle btn-xs btn-outline',
            checkedItemsCountState.get() ? 'btn-warning btn-dash' : '')}
                  onClick={() => {
                    if (checkedItemsCountState.get() > 0) {
                      checkedItemsStateRef.current?.set({})
                      checkedItemsCountState.set(0)
                    } else {
                      closeMainDialog()
                    }
                  }}
          >
            {checkedItemsCountState.get() ?
              <LucideMinus size={14}/> :
              <LucideX size={14}/>}
          </button>
        </div>
      </div>

      <div className={'py-4 min-h-[300px]'}>
        {currentTabState.get() === 'settings' ? (
          <SettingsTabContainer/>) : (
          <>
            <div className={'table-container'}>
              <EntityItemsTableContainer
                items={paginatedTopItems.paginatedItems}
                onCheckedItemsChange={(checkedItemsState1, checkedItemsCount) => {
                  checkedItemsCountState.set(checkedItemsCount)
                  checkedItemsStateRef.current = checkedItemsState1
                }}
              />
            </div>
            {paginatedTopItems.paginatedLabelNums.length > 1 && (
              <div className={'flex justify-center pt-4 -mb-4'}>
                <div className="join">
                  <button className="join-item btn btn-xs"
                          disabled={paginatedTopItems.currentPage === 0}
                          onClick={() => {
                            paginatedTopItems.goToPage(paginatedTopItems.currentPage - 1)
                          }}
                  >Prev
                  </button>
                  {paginatedTopItems.paginatedLabelNums.map((label, index) => {
                    if (label === '...') {
                      return (
                        <button key={index} className="join-item btn btn-xs"
                                onClick={() => {
                                  paginatedTopItems.goToPage(Math.floor(paginatedTopItems.totalPages / 2))
                                }}
                        >...</button>
                      )
                    } else {
                      const pageNum = Number(label) - 1
                      return (
                        <button key={index}
                                className={cn('join-item btn btn-xs',
                                  paginatedTopItems.currentPage === pageNum && 'btn-success')}
                                onClick={() => {
                                  paginatedTopItems.goToPage(pageNum)
                                }}
                        >
                          {label}
                        </button>
                      )
                    }
                  })}
                  <button className="join-item btn btn-xs"
                          disabled={paginatedTopItems.currentPage === paginatedTopItems.totalPages - 1}
                          onClick={() => {
                            paginatedTopItems.goToPage(paginatedTopItems.currentPage + 1)
                          }}
                  >Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppContainer>
  )
}

export default App
