import './App.css'
import {
  setZoteroUserSettings,
  useAppState,
  useCacheZEntitiesEffects,
  useCollections, useFilteredTopItems,
  usePaginatedTopItems,
  useTopItems,
  useTopItemsGroupedByCollection, validateZoteroCredentials,
  type ZoteroItemEntity,
} from './store.ts'
import { type PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react'
import cn from 'classnames'
import { type Immutable, type ImmutableArray, type State, useHookstate } from '@hookstate/core'
import {
  LucideDownload,
  LucideExternalLink, LucideFilter, LucideInfo,
  LucideList, LucideLoader,
  LucideLoader2,
  LucideMinus, LucideSearch,
  LucideSettings2,
  LucideUpload,
  LucideX,
} from 'lucide-react'
import { openItemInLogseq, pushItemToLogseq, startFullPushToLogseq } from './handlers.ts'
import { closeMainDialog, delay, getItemTitle, id2UUID } from './common.ts'

function GroupedItemsTabsContainer () {
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
                <TopEntityItemsTableContainer items={groupedItems[currentCollectionKey]}/>
              </div>
          )}
        </div>
      </div>
  )
}

function CollectionsLabels (props: { itemCollectionKeys: string[] }) {
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

function PushItemButton ({ item }: { item: Immutable<ZoteroItemEntity> }) {
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
        {pushingState.get() ? (
            <LucideLoader size={12} className={'animate-spin'}/>) : <LucideUpload size={14}/>}
      </button>
  )
}

function TopEntityItemsTableContainer (
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
            <label className={'relative top-1'}>
              <input type="checkbox"
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
          <th className={'pl-0'}>Title</th>
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
                    <input type="checkbox"
                           checked={checkedItemsState[it.key].get() || false}
                           onChange={e => {
                             checkedItemsState[it.key].set(e.target.checked)
                             checkedChangedState.set(p => p + 1)
                           }}
                    />
                  </label>
                </td>
                <td className={'pl-0'}>
                  <a href={'#'}
                     className={'block'}
                     onClick={(e) => {
                       console.log(JSON.stringify(it, null, 2))
                       // selected row
                       const target = e.currentTarget
                       const rowInput = target.closest('tr')?.
                           querySelector('input[type="checkbox"]') as HTMLInputElement
                       rowInput?.click()
                     }}>
                    <strong>
                      {getItemTitle(it)}
                    </strong>
                  </a>
                </td>
                <td>
                  <a className={'text-[13px] cursor-pointer flex gap-1 items-center opacity-80 hover:opacity-100'}
                     onClick={async () => {
                       const typeTag = await logseq.Editor.getTag(it.itemType)
                       if (typeTag) {
                         logseq.App.pushState('page', { name: typeTag.uuid })
                         closeMainDialog()
                       } else {
                         await logseq.UI.showMsg(`Logseq tag not found for item type: ${it.itemType}`, 'error')
                       }
                     }}
                  >
                    {it.itemType}
                    <LucideExternalLink size={12} className={'hover-visible'}/>
                  </a>
                </td>
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

function TopEntityItemsFilteredContainer (
    { filteredQueryState }: {
      filteredQueryState: State<{
        q: string,
        filterItemTypes: Array<string>,
        filterCollections: Array<string>
      }, {}>
    },
) {
  const qInputRef = useRef<HTMLInputElement>(null)
  const topItems = useTopItems()
  const collectionsState = useCollections()
  const itemTypes = useMemo(() => {
    const typesSet = new Set<string>()
    topItems.items.forEach(it => {
      if (it.itemType) {
        typesSet.add(it.itemType)
      }
    })
    return Array.from(typesSet).sort()
  }, [topItems.items?.length])

  useEffect(() => {
    // clear input text when esc
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (qInputRef.current!.value !== '') {
          qInputRef.current!.value = ''
          filteredQueryState.q.set('')
        } else {
          closeMainDialog()
        }
      }
    }

    const onKeyup = (e: KeyboardEvent) => {
      const value = qInputRef.current!.value
      // clear q when input is empty
      if (e.key === 'Backspace' && value === '') {
        filteredQueryState.q.set('')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyup)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyup)
    }
  }, [])

  return (
      <div className={'flex justify-between pb-3 px-1'}>
        <div>
          {[
            ['item types', filteredQueryState.value.filterItemTypes, itemTypes, filteredQueryState.filterItemTypes],
            [
              'collections', filteredQueryState.value.filterCollections, collectionsState.items.map(it => {
              return it.key
            }), filteredQueryState.filterCollections, collectionsState.items.reduce((acc, it) => {
              acc[it.key] = it.name
              return acc
            }, {} as { [key: string]: any })]].map(([label, selectedItems, items, itState, itemsKeyMap]: any) => {
            return (
                <div className="dropdown">
                  <div tabIndex={0} role="button" className="btn btn-sm m-1">
                    <LucideFilter size={14}/>
                    <span className={'pl-1'}>
              {selectedItems.length > 0
                  ? `Filtered: ${selectedItems.map((it: string) => {
                    return itemsKeyMap ? itemsKeyMap[it] : it
                  }).join(', ')}`
                  : `Filter by ${label}`}
            </span>
                  </div>
                  <ul tabIndex={-1} className="dropdown-content menu bg-base-100 rounded-box z-1 p-2 w-52 shadow-sm">
                    {items.map((type: string) => {
                      const isChecked = selectedItems.includes(type)
                      const labelText = itemsKeyMap ? itemsKeyMap[type] : type
                      return (
                          <li key={type}>
                            <label className="flex items-center gap-2 px-2 py-1">
                              <input type="checkbox"
                                     checked={isChecked}
                                     onChange={e => {
                                       const checked = e.target.checked
                                       const currentTypes = selectedItems
                                       if (checked) {
                                         // add
                                         itState.set([...currentTypes, type])
                                       } else {
                                         // remove
                                         itState.set(
                                             currentTypes.filter((t: any) => t !== type),
                                         )
                                       }
                                     }}
                              />
                              <span>{labelText}</span>
                            </label>
                          </li>
                      )
                    })}
                    {/*  clear all */}
                    <li>
                      <button className="btn btn-sm btn-ghost w-full"
                              onClick={() => {
                                itState.set([])
                              }}
                      >
                        Clear All
                      </button>
                    </li>
                  </ul>
                </div>
            )
          })}

        </div>
        <div>
          <form className={'flex items-center gap-2'}
                onSubmit={(e) => {
                  const formData = new FormData(e.currentTarget)
                  const q = formData.get('q') as string
                  filteredQueryState.q.set(q)
                  e.preventDefault()
                }}
          >
            <input type="text" name={'q'} className={'input input-sm'}
                   placeholder={'Search items...'}
                   ref={qInputRef}
            />
            <button type={'submit'} className={'btn btn-sm'}>
              <LucideSearch size={16}/>
            </button>
          </form>
        </div>
      </div>
  )
}

function AppContainer (
    props: PropsWithChildren<any>,
) {
  // setup shortcuts, global styles, etc.
  useEffect(() => {
    // close UI on ESC
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const activeElement = document.activeElement as HTMLInputElement
        if (activeElement && activeElement.tagName === 'INPUT') {
          return
        }

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

function SettingsTabContainer () {
  const appState = useAppState()
  const userSettings = appState.userSettings.get() as any
  const validatingState = useHookstate(false)

  return (
      <form onSubmit={async (e) => {
        e.preventDefault()

        const formData = new FormData(e.currentTarget)
        const formDataPlain = Object.fromEntries(formData)
        const apiKey = formData.get('z_api_key') as string
        const userId = formData.get('z_user_id') as string
        console.log('Saving settings:', formDataPlain)

        try {
          validatingState.set(true)
          setZoteroUserSettings({ apiKey, userId, ...formDataPlain })
          await validateZoteroCredentials()
          await logseq.UI.showMsg('Zotero user settings saved successfully.', 'success')
        } catch (e: any) {
          let msg = `Error saving Zotero user settings: ${e}`

          if (e?.response) {
            msg = `Failed to validate Zotero credentials. Please check your API Key and User ID. (${e.reason ||
            e.response.statusText})`
          }

          console.error('Error saving Zotero user settings:', e)
          await logseq.UI.showMsg(msg, 'error')
        } finally {
          validatingState.set(false)
        }
      }}>
        <div className={'pt-4 px-2'}>
          <p className={'flex flex-col'}>
            <label htmlFor="z_api_key" className={'font-semibold opacity-90'}>
              Zotero API Key:
            </label>
            <input type="text" id="z_api_key" name={'z_api_key'} className="input input-bordered w-full max-w-xs mt-1"
                   required={true}
                   defaultValue={userSettings?.apiKey || ''}
            />
            <small className={'opacity-60 pt-2'}>
              You can create a new API key from{' '}
              <a href={'https://www.zotero.org/settings/security'} target={'_blank'}
                 className={'px-1 underline text-info'}
              >
                https://www.zotero.org/settings/security
              </a>
            </small>
          </p>
          <p className={'flex flex-col mt-6'}>
            <label htmlFor="z_user_id" className={'font-semibold opacity-90'}>
              Zotero User ID:
            </label>
            <input type="text" id="z_user_id"
                   name={'z_user_id'}
                   className="input input-bordered w-full max-w-xs mt-1"
                   required={true}
                   defaultValue={userSettings?.userId || ''}
            />
            <small className={'opacity-60 pt-2'}>
              How to Find Your Zotero USER ID in SECONDS!
              <a href={'https://www.youtube.com/watch?v=7vDiZ8o_eHk'} target={'_blank'}
                 className={'px-1 underline text-info'}
              >
                https://www.youtube.com/watch?v=7vDiZ8o_eHk
              </a>
            </small>
          </p>
          <p className={'flex flex-col mt-6'}>
            <label htmlFor={'z_data_dir'}
                   className={'font-semibold opacity-90'}>
              Zotero data directory:
            </label>
            <input type="text" id={'z_data_dir'}
                   className="input input-bordered w-full max-w-xs mt-1"
                   placeholder={'/Users/username/Zotero'}
                   name={'z_data_dir'}
                   defaultValue={userSettings?.z_data_dir || ''}
            />
            <small className={'opacity-60 pt-2'}>
              Locating Your Zotero Data.
              <a href="https://www.zotero.org/support/zotero_data"
                 target={'_blank'}
                 className={'px-1 underline text-info'}
              >
                https://www.zotero.org/support/zotero_data
              </a>
            </small>
          </p>
          <p className={'mt-6 text-sm text-gray-600'}>
            <button className={'btn'} type={'submit'}
                    disabled={validatingState.get()}
            >
              {validatingState.get() ? 'Validating...' : 'Save Settings'}
            </button>
          </p>
        </div>
      </form>
  )
}

function App () {
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
  const filteredTopItemsState = useFilteredTopItems()
  const paginatedTopItems = usePaginatedTopItems({
    limit: 20,
    filteredItems: filteredTopItemsState.filteredItems,
  })
  const userSettings = appState.userSettings.get()
  const isInvalidUserSettings = !userSettings?.apiKey || !userSettings?.userId

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
            {!isInvalidUserSettings && (<>
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
                </>
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
          {(isInvalidUserSettings || currentTabState.get() === 'settings') ? (
              <SettingsTabContainer/>) : (
              <>
                <TopEntityItemsFilteredContainer
                    filteredQueryState={filteredTopItemsState.filteredQueryState}/>
                <div className={'table-container'}>
                  <TopEntityItemsTableContainer
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
