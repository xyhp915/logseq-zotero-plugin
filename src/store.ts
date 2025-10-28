// @ts-ignore
import * as z from 'zotero-api-client'
import { hookstate, useHookstate } from '@hookstate/core'
import { useCallback } from 'react'

function createLocalZoteroAPI() {
  return z.default(import.meta.env.VITE_API_KEY).library('user', import.meta.env.VITE_Z_USER_ID) as any
}

export const localApi = createLocalZoteroAPI()

export type ZoteroItemEntity = {
  key: string,
  title: string,
  itemType: string,
  note: string,
  dateAdded: string,
  dateModified: string,
  tags: Array<string>,
  [key: string]: any
}

export function createZRequestHookState<T = ZoteroItemEntity>(opts: {
  zGetFn: (opts: any) => Promise<any>
}) {
  return () => {
    const loading = useHookstate(false)
    const items = useHookstate<T[]>([])

    const load = useCallback(async (opts1: any) => {
      if (loading.get()) return

      try {
        loading.set(true)
        const r = await opts.zGetFn(opts1)
        items.set(r.getData())
      } finally {
        loading.set(false)
      }
    }, [])

    return {
      load,
      loading: loading.get(),
      items: items.get()
    }
  }
}

export const useCollections = createZRequestHookState({
  zGetFn: async (opts: any) => {
    return localApi.collections().get(opts)
  }
})

export const useTopItems = createZRequestHookState({
  zGetFn: async (opts: any) => {
    opts = { limit: 8 }
    return localApi.items().top().get(opts)
  }
})