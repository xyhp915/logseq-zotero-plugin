// @ts-ignore
import * as z from 'zotero-api-client'
import { hookstate, type Immutable, type State, useHookstate } from '@hookstate/core'
import { useCallback, useEffect } from 'react'

function createLocalZoteroAPI() {
  return z.default(import.meta.env.VITE_API_KEY).library('user', import.meta.env.VITE_Z_USER_ID) as any
}

export const zLocalApi = createLocalZoteroAPI()

export type ZoteroItemEntity = {
  key: string,
  title: string,
  itemType: string,
  note: string,
  dateAdded: string,
  dateModified: string,
  tags: Array<any>,
  [key: string]: any
}
export type ZoteroCollectionEntity = {
  key: string,
  name: string,
  parentCollectionKey: string | null,
  dateAdded: string,
  dateModified: string,
  [key: string]: any
}
export type ZoteroTagEntity = {
  tag: string,
  meta: any
}

const zTopItemsState = hookstate<Array<ZoteroItemEntity>>([])
const zCollectionsState = hookstate<Array<ZoteroCollectionEntity>>([])
const zTagsState = hookstate<Array<ZoteroTagEntity>>([])

function createZRequestHookState<T = any>(opts: {
  itemsState: State<T[], {}>,
  zGetFn: (opts: any) => Promise<any>
}) {
  return () => {
    const loading = useHookstate(false)
    const items = useHookstate<T[]>(opts.itemsState)

    const fetch = useCallback(async (opts1: any) => {
      opts1 = { limit: 50, start: items.get().length, ...opts1 }
      try {
        const r = await opts.zGetFn(opts1)
        return r.getData()
      } catch (e) {
        console.error('Zotero API fetch error:', e)
      }
    }, [])

    const load = useCallback(async (opts1: any) => {
      if (loading.get()) return

      try {
        loading.set(true)
        const data = await fetch(opts1)
        items.merge(data)
        return data?.length
      } finally {
        loading.set(false)
      }
    }, [])

    const reset = useCallback(() => {
      items.set([])
      loading.set(false)
    }, [])

    const refresh = useCallback(async (opts1: any) => {
      reset()
      await load(opts1)
    }, [])

    return {
      fetch, load, reset, refresh,
      loading: loading.get(),
      items: items.get()
    }
  }
}

export const useCollections = createZRequestHookState<ZoteroCollectionEntity>({
  itemsState: zCollectionsState,
  zGetFn: async (opts: any) => {
    return zLocalApi.collections().get(opts)
  }
})
export const useTopItems = createZRequestHookState<ZoteroItemEntity>({
  itemsState: zTopItemsState,
  zGetFn: async (opts: any) => {
    return zLocalApi.items().top().get(opts)
  }
})
export const useZTags = createZRequestHookState({
  itemsState: zTagsState,
  zGetFn: async (opts: any) => {
    return zLocalApi.tags().get(opts)
  }
})

export function useTopItemsGroupedByCollection() {
  const collectionsState = useCollections()
  const topItemsState = useTopItems()

  const groupedCollections: Record<string, ZoteroCollectionEntity> =
    collectionsState.items?.reduce((acc, coll) => {
      acc[coll.key] = coll
      return acc
    }, {} as any)
  const groupedItems: Record<string, Immutable<ZoteroItemEntity>[]> = {}

  for (const collection of collectionsState.items) {
    groupedItems[collection.key] = []
  }

  groupedItems['uncategorized'] = []

  for (const item of topItemsState.items) {
    if (item.collections && item.collections.length > 0) {
      for (const collKey of item.collections) {
        if (groupedItems[collKey]) {
          groupedItems[collKey].push(item)
        }
      }
    } else {
      groupedItems['uncategorized'].push(item)
    }
  }

  return {
    groupedCollections,
    groupedItems
  }
}

export function useCacheZEntitiesEffects() {
  const zTagsState1 = useZTags()
  const zCollectionsState1 = useCollections()
  const zTopItemsState1 = useTopItems()
  const persistData = useCallback((k: string, data: any) => {
    localStorage.setItem(`zotero_cache_${k}`, JSON.stringify(data))
  }, [])
  const restoreData = useCallback((k: string) => {
    const data = localStorage.getItem(`zotero_cache_${k}`)
    return data ? JSON.parse(data) : null
  }, [])

  // restore cached entities on mount
  useEffect(() => {
    const cachedTags = restoreData('tags')
    zTagsState.set(cachedTags ?? [])
    const cachedCollections = restoreData('collections')
    zCollectionsState.set(cachedCollections ?? [])
    const cachedTopItems = restoreData('topItems')
    zTopItemsState.set(cachedTopItems ?? [])
  }, [])

  useEffect(() => {
    persistData('tags', zTagsState1.items)
  }, [zTagsState1.items?.length])

  useEffect(() => {
    persistData('collections', zCollectionsState1.items)
  }, [zCollectionsState1.items?.length])

  useEffect(() => {
    persistData('topItems', zTopItemsState1.items)
  }, [zTopItemsState1.items?.[0]?.key])
}