import './App.css'
import {
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
                <code>{JSON.stringify(item.tags)}</code>
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
    const { load, loading, items } = useTopItems()
    const collectionsState = useCollections()
    const zTagsState = useZTags()
    const [groupedCollectionsView, setGroupedCollectionsView] = useState(false)

    useEffect(() => {
        console.log('==>> collections:', collectionsState.items)
    }, [collectionsState.items])

    return (
            <>
                <div>
                    <button className={'btn'}
                            disabled={loading}
                            onClick={async () => {
                                await zTagsState.load({})
                                await load({})
                                await collectionsState.load({})
                            }}>
                        {loading ? 'Loading...' : 'load zotero top items & collections'}
                    </button>
                </div>
                <div>
                    <div className={'flex gap-8 items-center'}>
                        <h3 className={'py-4 text-6xl'}>
                            zotero Tags:
                        </h3>
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
                    <div className={'flex gap-8 items-center'}>
                        <h3 className={'py-4 text-6xl'}>
                            zotero items:
                        </h3>
                        <button className={cn('btn btn-link mt-3', loading && 'loading')}
                                onClick={async () => {
                                    await load({
                                        itemType: 'book',
                                    })
                                }}
                        >
                            load more
                        </button>
                    </div>
                    <div className={'p-2'}>
                        {items?.map(it => {
                            return <ItemEntityRow item={it}/>
                        })}
                    </div>
                </div>
                <div>
                    <div className={'flex gap-4 items-center'}>
                        <h3 className={'py-4 text-6xl'}>zotero collections:</h3>
                        <button
                                onClick={() => setGroupedCollectionsView(v => !v)}
                                className={'btn mt-4'}
                        >
                            toggle grouped view
                        </button>
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
            </>
    )
}

export default App
