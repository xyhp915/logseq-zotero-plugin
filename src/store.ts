// @ts-ignore
import * as z from 'zotero-api-client'
import { hookstate, type Immutable, type ImmutableArray, type State, useHookstate } from '@hookstate/core'
import { useCallback, useEffect } from 'react'

export type ZoteroItemEntity = {
  key: string,
  title: string,
  itemType: string,
  note: string,
  dateAdded: string,
  dateModified: string,
  tags: Array<any>,
  collections: Array<string>,
  children?: Array<ZoteroItemEntity>,
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
export type UserSettings = {
  apiKey: string,
  userId: string,
  [key: string]: any
}

export const appState = hookstate({
  isVisible: true,
  isPushing: false, // sync to logseq
  isPulling: false, // sync from remote Zotero
  pushingLogs: [''],
  pullingOrPushingErrorMsg: '',
  pullingOrPushingProgressMsg: '',
  userSettings: JSON.parse(localStorage.getItem('zotero_user_settings') || '{}') as UserSettings
})
export const zTopItemsState = hookstate<Array<ZoteroItemEntity>>([])
export const zCollectionsState = hookstate<Array<ZoteroCollectionEntity>>([])
export const zTagsState = hookstate<Array<ZoteroTagEntity>>([])

function createLocalZoteroAPI() {
  const userSettings = appState.userSettings.get() as any
  const apiKey = userSettings.apiKey
  const userId = userSettings.userId
  return z.default(apiKey).library('user', userId) as any
}

export let zLocalApi = createLocalZoteroAPI()

export function validateZoteroCredentials() {
  return zLocalApi.items().top().get({ limit: 1 })
}

export function setZoteroUserSettings(settings: any) {
  const cachedSettings = localStorage.getItem('zotero_user_settings')
  const mergedSettings = { ...JSON.parse(cachedSettings || '{}'), ...settings }
  localStorage.setItem('zotero_user_settings', JSON.stringify(mergedSettings))
  appState.userSettings.set(mergedSettings)
  zLocalApi = createLocalZoteroAPI()
}

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
        if (typeof r?.getData === 'function') {
          return r.getData()
        } else {
          return r
        }
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

function createLoggerActions(state: State<Array<string>>) {
  const actions = ['log', 'error', 'clear'] as const
  return actions.reduce((acc, action) => {
    acc[action] = (...args: any) => {
      const msg = args.length === 1 ? args[0] : args.join(' ')
      if (action === 'clear') {
        state.set([])
      } else {
        const isError = action === 'error'
        const prefix = isError ? '[ERROR]' : '[LOG]'
        const timestamp = new Date().toLocaleTimeString()
        state.merge([`${timestamp} ${prefix} ${String(msg)}`])
        if (isError) console.error(msg)
      }
    }
    return acc
  }, {} as { log: (msg: any) => void, error: (msg: any) => void, clear: () => void })
}

export const pushingLogger = createLoggerActions(appState.pushingLogs)
export const useAppState = () => {
  return useHookstate(appState)
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
    const res = await zLocalApi.items().top().get(opts)
    const items: Array<ZoteroItemEntity> = res.getData()

    if (items?.length) {
      // fetch children notes for each item
      for (const item of items) {
        if (item.itemType === 'note') continue
        appState.pullingOrPushingProgressMsg.set(`Fetching children for item ${item.title || item.key}...`)
        try {
          const res = await zLocalApi.items(item.key).children().get()
          const children = res.getData()
          if (children?.length) {
            item.children = children
          }
        } catch (e) {
          console.error('Error fetching children for item', item.key, e)
        }
      }
    }

    return items
  }
})
export const useZTags = createZRequestHookState({
  itemsState: zTagsState,
  zGetFn: async (opts: any) => {
    return zLocalApi.tags().get(opts)
  }
})

// @ts-ignore
window.__state__ = {
  appState,
  zTopItemsState,
  zCollectionsState,
  zTagsState
}

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

export function useFilteredTopItems() {
  const zTopItemsState1 = useTopItems()
  const filteredQueryState = useHookstate({
    q: '',
    filterItemTypes: [] as Array<string>,
    filterCollections: [] as Array<string>
  })

  // filter items based on types
  let filteredItems = zTopItemsState1.items.filter(item => {
    const filterItemTypes = filteredQueryState.get().filterItemTypes
    if (filterItemTypes.length === 0) return true
    return filterItemTypes.includes(item.itemType)
  })

  // filter items based on collections
  filteredItems = filteredItems.filter(item => {
    const filterCollections = filteredQueryState.get().filterCollections
    if (filterCollections.length === 0) return true
    if (!item.collections || item.collections.length === 0) {
      return filterCollections.includes('uncategorized')
    }
    return item.collections.some((collKey: string) => filterCollections.includes(collKey))
  })

  filteredItems = filteredItems.filter(item => {
    const qText = filteredQueryState.get().q.toLowerCase()
    if (!qText) return true

    const fieldsToSearch = [
      item.title?.toLowerCase() || '',
      item.itemType?.toLowerCase() || '',
      (item.tags || []).map((t: any) => t.tag.toLowerCase()).join(' ')
    ]

    return fieldsToSearch.some(field => field.includes(qText))
  })

  return {
    filteredQueryState,
    filteredItems
  }
}

export function usePaginatedTopItems({
  filteredItems,
  limit
}: { limit: number, filteredItems: ImmutableArray<ZoteroItemEntity> }) {
  const currentPageState = useHookstate(0)
  limit = limit ?? 10
  const totalItems = filteredItems.length
  const totalPages = Math.ceil(totalItems / limit)
  const paginatedItems = filteredItems.slice(
    currentPageState.get() * limit,
    (currentPageState.get() + 1) * limit
  )

  const goToPage = (page: number) => {
    if (page < 0 || page >= totalPages) return
    currentPageState.set(page)
  }

  const reset = () => {
    currentPageState.set(0)
  }

  const paginatedLabelNums: Array<number | string> = []
  for (let i = 0; i < totalPages; i++) {
    paginatedLabelNums.push(i + 1)
  }

  if (paginatedLabelNums.length > limit) {
    const maxHalf = Math.floor(paginatedLabelNums.length / 2)
    const start = Math.min(6, maxHalf)
    const spliceCount = Math.max(maxHalf - 5, 1)
    paginatedLabelNums.splice(start, spliceCount, '...')
  }

  return {
    paginatedItems,
    currentPage: currentPageState.get(),
    totalPages,
    goToPage, reset,
    paginatedLabelNums
  }
}