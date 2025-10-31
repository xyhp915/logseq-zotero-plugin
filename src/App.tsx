import './App.css'
import {
    useCacheZEntitiesEffects,
    useCollections,
    useTopItems,
    useTopItemsGroupedByCollection,
    useZTags,
    type ZoteroItemEntity,
} from './store.ts'
import { Activity, type PropsWithChildren, useEffect, useState } from 'react'
import cn from 'classnames'
import type { Immutable } from '@hookstate/core'

function ItemEntityRow (props: PropsWithChildren<{ item: Immutable<ZoteroItemEntity> }>) {
    const { item } = props
    return (
            <a className={'flex gap-3 underline cursor-pointer active:opacity-60'}
               onClick={() => {
                   // alert(JSON.stringify(item, null, 2))
                   console.log(JSON.stringify(item, null, 2))
               }}
            >
                <strong className={'whitespace-nowrap'}>{item.title}</strong>
                <i>{item.itemType}</i>
                {item.tags?.map(t => {
                    return (<code key={t.tag} className={'badge badge-neutral badge-soft'}>
                        {t.tag}
                    </code>)
                })}
            </a>
    )
}

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
                                {groupedItems[currentCollectionKey].map(it => <ItemEntityRow item={it}/>)}
                            </div>
                    )}
                </div>
            </div>
    )
}

function App () {
    // initialize effects
    useCacheZEntitiesEffects()

    const zTopItemsState = useTopItems()
    const collectionsState = useCollections()
    const zTagsState = useZTags()
    const [groupedCollectionsView, setGroupedCollectionsView] = useState(false)

    useEffect(() => {
        console.log('==>> collections:', collectionsState.items)
    }, [collectionsState.items])

    return (
            <>
                <div className={'flex justify-end'}>
                    <button className={'btn btn-circle'}
                            onClick={() => logseq.hideMainUI()}
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
                        <button className={'btn'}
                                disabled={zTopItemsState.loading}
                                onClick={async () => {
                                    await zTopItemsState.load({})
                                }}>
                            {zTopItemsState.loading ? 'Loading...' : 'load zotero top items'}
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
                        {zTopItemsState.items?.map(it => {
                            return <ItemEntityRow item={it}/>
                        })}
                    </div>
                </div>
            </>
    )
}

export default App
