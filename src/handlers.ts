import { appState, pushingLogger, zCollectionsState, type ZoteroItemEntity, zTopItemsState } from './store.ts'
import type { Immutable, ImmutableArray } from '@hookstate/core'
import { delay, id2UUID } from './common.ts'

let itemTypesData: Array<any> = []
let itemTypesMapping: Record<string, Array<{ field: string }>> = {}

async function resolveItemTypesData() {
  if (itemTypesData.length > 0) {
    return
  }

  const { default: { itemTypes } } = await import('./assets/z_item_types.json')
  itemTypesData = itemTypes

  for (const itemType of itemTypesData) {
    itemTypesMapping[itemType.itemType] = itemType.fields
  }
}

export async function pushItemTypesToLogseqTag() {
  await resolveItemTypesData()

  // 1. create root tag "Zotero"
  const zRootTagName = 'Zotero'
  const zRootTagUUID = id2UUID('zotero_' + zRootTagName)
  let zRootTag = await logseq.Editor.getPage(zRootTagUUID)

  if (!zRootTag) {
    // @ts-ignore
    zRootTag = await logseq.Editor.createTag(zRootTagName, { uuid: zRootTagUUID })
    await logseq.Editor.upsertProperty('key', { type: 'default' })
    await logseq.Editor.upsertProperty('ztags', { type: 'node', cardinality: 'many' })
    await logseq.Editor.addTagProperty(zRootTag?.uuid!, 'key')
    await logseq.Editor.addTagProperty(zRootTag?.uuid!, 'ztags')
  }

  const pickedItemTypes = ['book', 'journalArticle', 'attachment', 'webpage', 'conferencePaper', 'thesis',
    'report', 'document', 'magazineArticle', 'newspaperArticle', 'videoRecording', 'bookSection', 'note', 'case',
    'collections'
  ]

  // 2. create tags for each item type and their fields
  for (const itemType of itemTypesData) {
    let tagName = itemType.itemType
    if (!tagName || !pickedItemTypes.includes(tagName)) continue
    let tag = await logseq.Editor.getTag(tagName)
    pushingLogger.log(`Processing item type tag: ${tagName} - Found: ${!!tag}`)
    const forceExtendsRootTag = async (tagUUID: string) => {
      await logseq.Editor.upsertBlockProperty(tagUUID, ':logseq.property.class/extends', [zRootTag?.id])
    }

    if (tag) {
      await forceExtendsRootTag(tag.uuid)
      continue
    }

    tag = await logseq.Editor.createTag(tagName)
    await forceExtendsRootTag(tag?.uuid!)
    pushingLogger.log(`Created tag for item type: ${tagName} - UUID: ${tag!.uuid}`)

    for (const field of itemType.fields) {
      const fieldName = field.field
      try {
        const fieldProperty = await logseq.Editor.upsertProperty(fieldName, { type: 'default' })
        await logseq.Editor.addTagProperty(tag?.uuid!, fieldName)
        await logseq.Editor.upsertBlockProperty(fieldProperty.uuid, ':logseq.property/hide-empty-value', true)
      } catch (e) {
        pushingLogger.error(`Error adding property ${fieldName} to tag ${tagName}`)
        console.error(e)
      }
    }

    await delay()
  }
}

export async function pushCollectionsToLogseqPage() {
  const collectionItems = zCollectionsState.get()

  for (const collection of collectionItems) {
    const pageUUID = id2UUID('zotero_' + collection.key)
    console.log('>> key & uuid:', collection.key, pageUUID)
    let page = await logseq.Editor.getPage(pageUUID)
    if (!page) {
      page = await logseq.Editor.createPage(
        `${collection.name}`, {},
        {
          customUUID: pageUUID,
          redirect: false
        } as any
      )
      console.log('>> Created new Collection page in Logseq:', page)
    }

    // upsert collection properties
    await logseq.Editor.upsertBlockProperty(page!.uuid, 'key', collection.key || '')

    // add collection tag
    const collectionsTag = await logseq.Editor.getTag('collections')
    await logseq.Editor.addBlockTag(page?.uuid!, collectionsTag?.uuid!)
  }
}

export async function pushItemToLogseq(
  item: Immutable<ZoteroItemEntity>,
  _isChildItem: boolean = false
) {
  console.log('>> Pushing item to Logseq:', item)
  await resolveItemTypesData()
  const pageUUID = id2UUID(item.key)
  const pageTitle = item.title || 'Untitled'
  let page = await logseq.Editor.getPage(pageUUID)

  if (!page) {
    page = await logseq.Editor.createPage(
      `${pageTitle}`, {},
      {
        customUUID: pageUUID,
        redirect: false
      } as any
    )
    console.log('>> Created new Z page in Logseq:', page)
  }

  // add tag with item type
  const itemTag = await logseq.Editor.getTag(item.itemType)

  if (!itemTag) {
    throw new Error('Logseq tag not found for item type: ' + item.itemType)
  }

  await logseq.Editor.addBlockTag(page!.uuid, itemTag.uuid)

  const fields = itemTypesMapping[item.itemType] || []

  // upsert common block properties value
  const reservedFields = ['key', 'title', 'note']
  await logseq.Editor.upsertBlockProperty(page!.uuid, 'key', item.key || '')
  await logseq.Editor.upsertBlockProperty(page!.uuid, 'title', item.title || '')
  if (!!item.collections) {
    // upsert collections as ztags property
    const collectionsIDs = await Promise.all(item.collections.map(async (colKey) => {
      const pageUUID = id2UUID('zotero_' + colKey)
      const colPage = await logseq.Editor.getPage(pageUUID)
      if (colPage) {
        return colPage.id
      } else {
        pushingLogger.error(`Collection page not found in Logseq for collection key: ${colKey}`)
        return null
      }
    }))

    await logseq.Editor.upsertBlockProperty(page!.uuid, 'ztags', collectionsIDs)
  }

  // upsert all item fields as block properties
  for (const field of fields) {
    const fieldName = field.field
    if (reservedFields.includes(fieldName)) continue
    const fieldValue = (item as any)[fieldName] || ''
    try {
      await logseq.Editor.upsertBlockProperty(page!.uuid, fieldName, fieldValue || '')
    } catch (e) {
      console.error(`Error upserting block property ${fieldName} for item ${item.title || 'Untitled'}:`, e)
    }
  }

  // upsert related blocks (notes, attachments, relations, etc.)
  const notesBlockUUID = id2UUID('zotero_note_' + item.key)
  let notesBlock = await logseq.Editor.getBlock(notesBlockUUID)
  const note = item.note?.trim()

  if (!!note) {
    if (!notesBlock) {
      notesBlock = await logseq.Editor.prependBlockInPage(page!.uuid, note,
        // @ts-ignore
        { customUUID: notesBlockUUID, })
    } else {
      await logseq.Editor.updateBlock(notesBlock.uuid, note)
    }
  }

  // upsert children attachments as sub-blocks
  if (!!item.children) {
    const attachmentTag = await logseq.Editor.getTag('attachment')
    const attachmentsBlockUUID = id2UUID('zotero_attachments_' + item.key)
    let attachmentsBlock = await logseq.Editor.getBlock(attachmentsBlockUUID)

    if (!attachmentsBlock) {
      attachmentsBlock = await logseq.Editor.appendBlockInPage(page!.uuid, `[[${attachmentTag?.uuid || 'Attachments:'}]]`,
        // @ts-ignore
        { customUUID: attachmentsBlockUUID, })
    }

    for (const childItem of item.children) {
      const attachmentPageUUID = await pushItemToLogseq(childItem, true)
      const attachmentChildUUID = id2UUID('zotero_child_' + childItem.key)
      let attachmentChildBlock = await logseq.Editor.getBlock(attachmentChildUUID)
      let blockContent = `[[${attachmentPageUUID}]] `
      blockContent += childItem.url ? childItem.url :
        `[${childItem.filename}](zotero://select/library/items/${childItem.key})`

      if (!attachmentChildBlock) {
        attachmentChildBlock = await logseq.Editor.insertBlock(
          attachmentsBlock!.uuid, blockContent,
          // @ts-ignore
          { customUUID: attachmentChildUUID, }
        )
      } else {
        await logseq.Editor.updateBlock(attachmentChildBlock.uuid, blockContent)
      }
    }
  }

  return pageUUID
}

export async function openItemInLogseq(
  item: Immutable<ZoteroItemEntity>
) {
  const pageUUID = id2UUID(item.key)
  const page = await logseq.Editor.getPage(pageUUID)

  if (page) {
    logseq.App.pushState('page', { name: page.name, uuid: page.uuid })
  } else {
    await logseq.UI.showMsg(`Logseq page not found for item: ${item.title || 'Untitled'}`, 'error')
    throw new Error('Logseq page not found for item: ' + (item.title || 'Untitled'))
  }
}

export async function startFullPushToLogseq(
  opts?: { items: ImmutableArray<ZoteroItemEntity> }) {
  if (appState.isPushing.get()) return

  try {
    appState.isPushing.set(true)

    if (!opts?.items) {
      appState.pullingOrPushingProgressMsg.set(`Pushing item types to Logseq tags...`)
      await pushItemTypesToLogseqTag()
      appState.pullingOrPushingProgressMsg.set(`Pushing collections to Logseq pages...`)
      await pushCollectionsToLogseqPage()
    }

    appState.pullingOrPushingProgressMsg.set(`Pushing items to Logseq pages...`)
    const items = opts?.items || zTopItemsState.get()
    let count = 0
    let successCount = 0

    for (const item of items) {
      count++
      appState.pullingOrPushingProgressMsg.set(`Pushing items to Logseq pages (${count}/${items.length}) - ${item.title} ...`)
      pushingLogger.log(`Pushing item ${count}/${items.length}: ${item.title || 'Untitled'}`)
      try {
        await pushItemToLogseq(item)
        successCount++
      } catch (e) {
        const errMsg = `Error pushing item ${item.title || 'Untitled'} to Logseq: ${e}`
        appState.pullingOrPushingErrorMsg.set(errMsg)
        pushingLogger.error(errMsg)
        console.error(e)
      }
      await delay(500) // slight delay to avoid blocking
    }

    appState.pullingOrPushingProgressMsg.set(`Push to Logseq completed. Pushed ${successCount} items.`)
    pushingLogger.log('Full push to Logseq completed.')
    await delay(1000)
  } catch (e) {
    appState.pullingOrPushingErrorMsg.set(String(e))
    console.error('Error starting full push to Logseq:', e)
  } finally {
    appState.isPushing.set(false)
    appState.pullingOrPushingProgressMsg.set('')
  }
}