import './App.css'
import {
  useAppState,
  useCacheZEntitiesEffects,
  useCollections,
  useTopItems,
  useTopItemsGroupedByCollection,
  type ZoteroItemEntity,
} from './store.ts'
import { type PropsWithChildren, useEffect, useState } from 'react'
import cn from 'classnames'
import { type Immutable, type ImmutableArray, useHookstate } from '@hookstate/core'
import {
  LucideDownload, LucideExternalLink,
  LucideFileUp, LucideLink2, LucideLoader, LucideLoader2,
  LucideRefreshCcwDot,
  LucideSettings,
  LucideSettings2,
  LucideUpload
} from 'lucide-react'
import { openItemInLogseq, pushItemToLogseq, pushItemTypesToLogseqTag, startFullPushToLogseq } from './handlers.ts'
import { closeMainDialog, delay, id2UUID } from './common.ts'

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
                  `Item "${item.title}" pushed to Logseq page.`, 'success'
                )
                await delay()
              } catch (e) {
                await logseq.UI.showMsg(
                  `Error pushing item "${item.title}" to Logseq: ${e}`, 'error'
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
    items: ImmutableArray<ZoteroItemEntity>
  },
) {
  return (
    <table className="table table-xs border collapse">
      <thead className={'bg-gray-100'}>
      <tr>
        <th>Key</th>
        <th>Title</th>
        <th>Type</th>
        <th>Collections</th>
        <th>Attachments</th>
        <th>Note</th>
        <th>More</th>
      </tr>
      </thead>
      <tbody>
      {props.items?.map(it => {
        return (
          <tr key={it.key} className={'even:bg-gray-50'}>
            <td>{it.key}</td>
            <td>
              <a onClick={() => {
                alert(JSON.stringify(it, null, 2))
              }}>
                <strong>
                  {it.title}
                </strong>
              </a>
            </td>
            <td>[[{it.itemType}]]</td>
            <td>
              <CollectionsLabels itemCollectionKeys={it.collections}/>
            </td>
            <td>{JSON.stringify(it.attachments)}</td>
            <td>{it.note}</td>
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

function App() {
  // initialize effects
  useCacheZEntitiesEffects()

  const appState = useAppState()
  const zTopItemsState = useTopItems()
  const collectionsState = useCollections()
  // const zTagsState = useZTags()
  // const [groupedCollectionsView, setGroupedCollectionsView] = useState(false)

  useEffect(() => {
    console.log('>> collections:', collectionsState.items)
  }, [collectionsState.items])

  if (!appState.isVisible.get()) {
    return <></>
  }

  const isSyncingRemote = collectionsState.loading || zTopItemsState.loading

  return (
    <AppContainer>
      <div className={'flex justify-between'}>
        <div className={'flex gap-3'}>
          <button className={'btn btn-sm'}>
            <LucideSettings2 size={18}/> Settings
          </button>
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
            Sync remote Zotero Data
          </button>
          <span className={'label text-sm'}>
            {isSyncingRemote ? 'Syncing...' : ` ${zTopItemsState.items.length} items loaded.`}
          </span>
        </div>

        <div className={'flex gap-3'}>
          {zTopItemsState.items.length > 0 && (
            <button className={'btn btn-sm btn-outline btn-success'}
                    onClick={async () => {
                      await startFullPushToLogseq()
                    }}
                    disabled={appState.isPushing.get()}
            >
              {appState.isPushing.get() ? (
                <LucideLoader2 size={18} className={'animate-spin'}/>) : (
                <LucideUpload size={18}/>)}
              Push all to Logseq
            </button>
          )}
          <button className={'btn btn-circle btn-sm btn-outline'}
                  onClick={() => closeMainDialog()}
          >
            X
          </button>
        </div>
      </div>

      <div>
        {/*<div className={'flex gap-8 items-center'}>*/}
        {/*  <h3 className={'py-4 text-6xl'}>*/}
        {/*    zotero Tags:*/}
        {/*  </h3>*/}
        {/*  <button className={'btn'}*/}
        {/*          disabled={zTagsState.loading}*/}
        {/*          onClick={async () => {*/}
        {/*            await zTagsState.refresh({})*/}
        {/*          }}>*/}
        {/*    {zTagsState.loading ? 'Loading...' : 'load zotero tags'}*/}
        {/*  </button>*/}
        {/*</div>*/}
        {/*<div className={'p-2 flex gap-3 flex-wrap'}>*/}
        {/*  {zTagsState.items?.map(it => {*/}
        {/*    return (*/}
        {/*        <code className={'badge badge-neutral badge-soft'}>*/}
        {/*          {it.tag}*/}
        {/*        </code>)*/}
        {/*  })}*/}
        {/*</div>*/}
      </div>

      {/*<div>*/}
      {/*  <div className={'flex gap-4 items-center'}>*/}
      {/*    <h3 className={'py-4 text-6xl'}>zotero collections:</h3>*/}
      {/*    <button className={'btn mt-4'}*/}
      {/*            disabled={collectionsState.loading}*/}
      {/*            onClick={async () => {*/}
      {/*              await collectionsState.refresh({})*/}
      {/*            }}>*/}
      {/*      {collectionsState.loading ? 'Loading...' : 'load zotero collections'}*/}
      {/*    </button>*/}
      {/*    <label className="label pt-5">*/}
      {/*      <input type="checkbox"*/}
      {/*             onChange={e => setGroupedCollectionsView(e.target.checked)}*/}
      {/*             defaultChecked={false}*/}
      {/*             className="toggle toggle-warning"/>*/}
      {/*      Toggle grouped view*/}
      {/*    </label>*/}
      {/*  </div>*/}
      {/*  <Activity mode={groupedCollectionsView ? 'hidden' : 'visible'}>*/}
      {/*    <ul className={'p-2'}>*/}
      {/*      {collectionsState.items?.map(it => {*/}
      {/*        return (<li className={'flex gap-3'}>*/}
      {/*          <code>{JSON.stringify(it)}</code>*/}
      {/*        </li>)*/}
      {/*      })}*/}
      {/*    </ul>*/}
      {/*  </Activity>*/}
      {/*  <Activity mode={groupedCollectionsView ? 'visible' : 'hidden'}>*/}
      {/*    <GroupedItemsTabsContainer/>*/}
      {/*  </Activity>*/}
      {/*</div>*/}

      <div>
        <div className={'flex gap-8 items-center'}>
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
        <div className={'py-4'}>
          <EntityItemsTableContainer items={zTopItemsState.items}/>
        </div>
      </div>
    </AppContainer>
  )
}

export default App
