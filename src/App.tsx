import './App.css'
import {
  useAppState,
  useCacheZEntitiesEffects,
  useCollections,
  useTopItems,
  useTopItemsGroupedByCollection,
  useZTags,
  type ZoteroItemEntity,
} from './store.ts'
import { Activity, type PropsWithChildren, useEffect, useState } from 'react'
import cn from 'classnames'
import type { ImmutableArray } from '@hookstate/core'
import { LucideFileUp, LucideRefreshCcwDot } from 'lucide-react'
import { pushItemToLogseq, pushItemTypesToLogseqTag } from './handlers.ts'
import { closeMainDialog } from './common.ts'

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
                <EntityItemsTableContainer items={groupedItems[currentCollectionKey]}/>
              </div>
          )}
        </div>
      </div>
  )
}

function EntityItemsTableContainer (
    props: {
      items: ImmutableArray<ZoteroItemEntity>
    },
) {
  return (
      <table className="table table-xs border collapse">
        <thead className={'bg-gray-100'}>
        <tr>
          <th>#</th>
          <th>Title</th>
          <th>Type</th>
          <th>Attachments</th>
          <th>Note</th>
          <th>Tags</th>
          <th>More</th>
        </tr>
        </thead>
        <tbody>
        {props.items?.map(it => {
          return (
              <tr key={it.key} className={'even:bg-gray-50'}>
                <td>{it.key}</td>
                <td>
                  <strong>
                    {it.title}
                  </strong>
                </td>
                <td>[[{it.itemType}]]</td>
                <td>{JSON.stringify(it.attachments)}</td>
                <td>{it.note}</td>
                <td>{it.tags?.[0]?.tag}</td>
                <td>
                  <button className={'btn btn-xs btn-ghost'}
                          onClick={async () => {
                            await pushItemToLogseq(it)
                          }}
                  >
                    <LucideFileUp size={14}/>
                  </button>
                </td>
              </tr>
          )
        })}
        </tbody>
      </table>
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

function App () {
  // initialize effects
  useCacheZEntitiesEffects()

  const appState = useAppState()
  const zTopItemsState = useTopItems()
  const collectionsState = useCollections()
  const zTagsState = useZTags()
  const [groupedCollectionsView, setGroupedCollectionsView] = useState(false)

  useEffect(() => {
    console.log('==>> collections:', collectionsState.items)
  }, [collectionsState.items])

  if (!appState.isVisible.get()) {
    return <></>
  }

  return (
      <AppContainer>
        <div className={'flex justify-between'}>
          <button className={'btn'}
                  onClick={async () => {
                    await pushItemTypesToLogseqTag()
                  }}
          >
            Push Item Types to Logseq
          </button>
          <button className={'btn btn-circle'}
                  onClick={() => closeMainDialog()}
          >
            X
          </button>
        </div>
        <div>
          <div className={'flex gap-8 items-center'}>
            <h3 className={'py-4 text-6xl'}>
              zotero Tags:
            </h3>
            <button className={'btn'}
                    disabled={zTagsState.loading}
                    onClick={async () => {
                      await zTagsState.refresh({})
                    }}>
              {zTagsState.loading ? 'Loading...' : 'load zotero tags'}
            </button>
          </div>
          <div className={'p-2 flex gap-3 flex-wrap'}>
            {zTagsState.items?.map(it => {
              return (
                  <code className={'badge badge-neutral badge-soft'}>
                    {it.tag}
                  </code>)
            })}
          </div>
        </div>

        <div>
          <div className={'flex gap-4 items-center'}>
            <h3 className={'py-4 text-6xl'}>zotero collections:</h3>
            <button className={'btn mt-4'}
                    disabled={collectionsState.loading}
                    onClick={async () => {
                      await collectionsState.refresh({})
                    }}>
              {collectionsState.loading ? 'Loading...' : 'load zotero collections'}
            </button>
            <label className="label pt-5">
              <input type="checkbox"
                     onChange={e => setGroupedCollectionsView(e.target.checked)}
                     defaultChecked={false}
                     className="toggle toggle-warning"/>
              Toggle grouped view
            </label>
          </div>
          <Activity mode={groupedCollectionsView ? 'hidden' : 'visible'}>
            <ul className={'p-2'}>
              {collectionsState.items?.map(it => {
                return (<li className={'flex gap-3'}>
                  <code>{JSON.stringify(it)}</code>
                </li>)
              })}
            </ul>
          </Activity>
          <Activity mode={groupedCollectionsView ? 'visible' : 'hidden'}>
            <GroupedItemsTabsContainer/>
          </Activity>
        </div>

        <div>
          <div className={'flex gap-8 items-center'}>
            <h3 className={'py-4 text-6xl'}>
              zotero items:
            </h3>
            <button className={cn('btn btn-sm mt-4')}
                    disabled={zTopItemsState.loading}
                    onClick={async () => {
                      await zTopItemsState.refresh({})
                    }}>
              <LucideRefreshCcwDot
                  size={16}
                  className={zTopItemsState.loading ? 'animate-spin' : ''}/>
            </button>
            {/*<button className={cn('btn btn-link mt-3', zTopItemsState.loading && 'loading')}*/}
            {/*        onClick={async () => {*/}
            {/*            await zTopItemsState.load({*/}
            {/*                itemType: 'book',*/}
            {/*            })*/}
            {/*        }}*/}
            {/*>*/}
            {/*    load more*/}
            {/*</button>*/}
          </div>
          <div className={'p-2'}>
            <EntityItemsTableContainer items={zTopItemsState.items}/>
          </div>
        </div>
      </AppContainer>
  )
}

export default App
