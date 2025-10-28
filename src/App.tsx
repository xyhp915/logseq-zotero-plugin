import './App.css'
import { useCollections, useTopItems } from './store.ts'
import { useEffect } from 'react'

function App () {
    const { load, loading, items } = useTopItems()
    const collectionsState = useCollections()

    useEffect(() => {
        console.log('==>> collections:', collectionsState.items)
    }, [collectionsState.items])

    return (
            <>
                <p>
                    <button disabled={loading}
                            onClick={async () => {
                                await load()
                                await collectionsState.load({})
                            }}>
                        {loading ? 'Loading...' : 'load zotero top items & collections'}
                    </button>
                </p>
                <p>
                    <h3 className={'py-4 text-6xl'}>zotero items:</h3>
                    <ul className={'p-2'}>
                        {items?.map(it => {
                            return (<li className={'flex gap-3'}>
                                <strong>{it.title}</strong>
                                <i>{it.itemType}</i>
                                <code>{JSON.stringify(it.tags)}</code>
                            </li>)
                        })}
                    </ul>
                </p>

                <p>
                    <h3 className={'py-4 text-6xl'}>zotero collections:</h3>
                    <ul className={'p-2'}>
                        {collectionsState.items?.map(it => {
                            return (<li className={'flex gap-3'}>
                                <code>{JSON.stringify(it)}</code>
                            </li>)
                        })}
                    </ul>
                </p>
            </>
    )
}

export default App
