import './App.css'
import { useCollections, useTopItems, useZTags } from './store.ts'
import { useEffect } from 'react'
import cn from 'classnames'

function App () {
    const { load, loading, items } = useTopItems()
    const collectionsState = useCollections()
    const zTagsState = useZTags()

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
                    <ul className={'p-2'}>
                        {items?.map(it => {
                            return (<li className={'flex gap-3'}>
                                <strong className={'whitespace-nowrap'}>{it.title}</strong>
                                <i>{it.itemType}</i>
                                <code>{JSON.stringify(it.tags)}</code>
                            </li>)
                        })}
                    </ul>
                </div>
                <div>
                    <h3 className={'py-4 text-6xl'}>zotero collections:</h3>
                    <ul className={'p-2'}>
                        {collectionsState.items?.map(it => {
                            return (<li className={'flex gap-3'}>
                                <code>{JSON.stringify(it)}</code>
                            </li>)
                        })}
                    </ul>
                </div>
            </>
    )
}

export default App
