import { appState, type ZoteroItemEntity } from './store.ts'
import type { Immutable } from '@hookstate/core'
import { id2UUID } from './common.ts'

export async function pushItemTypesToLogseqTag() {
  const { default: { itemTypes } } = await import('./assets/z_item_types.json')
  // 1. create root tag "Zotero"
  const zRootTagName = 'Zotero'
  const zRootTagUUID = id2UUID('lsp_' + zRootTagName)
  let zRootTag = await logseq.Editor.getPage(zRootTagUUID)

  if (!zRootTag) {
    // @ts-ignore
    zRootTag = await logseq.Editor.createTag(zRootTagName, { uuid: zRootTagUUID })
    await logseq.Editor.upsertProperty('key', { type: 'default' })
    await logseq.Editor.addTagProperty(zRootTag?.uuid!, 'key')
  }

  const pickedItemTypes = ['book', 'journalArticle', 'attachment', 'webpage', 'conferencePaper', 'thesis']

  // 2. create tags for each item type and their fields
  for (const itemType of itemTypes) {
    let tagName = itemType.itemType
    if (!tagName || !pickedItemTypes.includes(tagName)) continue
    const fullTagName = `Zotero/${tagName}`
    const tagUUID = id2UUID(fullTagName)
    let tag = await logseq.Editor.getPage(tagUUID)
    console.log('Z:Fetched tag:', tagName, tagUUID, tag)
    if (!tag) {
      // @ts-ignore
      tag = await logseq.Editor.createTag(fullTagName, { uuid: tagUUID })
      console.log('Z:Created tag:', tagName, tagUUID, tag)
    }

    for (const field of itemType.fields) {
      const fieldName = field.field
      await logseq.Editor.upsertProperty(fieldName, { type: 'default' })
      await logseq.Editor.addTagProperty(tag?.uuid!, fieldName)
    }
  }
}

export async function pushCollectionsToLogseqPage() {

}

export async function pushItemToLogseq(
  item: Immutable<ZoteroItemEntity>
) {
  console.log('Pushing item to Logseq:', item)
  const pageUUID = id2UUID(item.key)
  const pageTitle = item.title || 'Untitled'
  let page = await logseq.Editor.getPage(pageUUID)

  console.log('==> Fetched page from Logseq:', page)

  if (!page) {
    page = await logseq.Editor.createPage(
      `${pageTitle}`, {},
      {
        customUUID: pageUUID,
        redirect: false
      } as any
    )
    console.log('==>> Created new Z page in Logseq:', page)
  }

  // add tag with item type
  const itemTypeTagName = `Zotero/${item.itemType}`
  const itemTypeTagUUID = id2UUID(itemTypeTagName)
  console.log('Adding tag to page:', itemTypeTagName)
  await logseq.Editor.addBlockTag(page!.uuid, itemTypeTagUUID)

  // upsert block properties value
  await logseq.Editor.upsertBlockProperty(page!.uuid, 'key', item.key || '')
  await logseq.Editor.upsertBlockProperty(page!.uuid, 'title', item.title || '')
  // upsert related blocks (notes, attachments, relations, etc.)
  const notesBlockUUID = id2UUID('note_' + item.key)
  let notesBlock = await logseq.Editor.getBlock(notesBlockUUID)
  const note = item.note || ''

  if (!notesBlock) {
    notesBlock = await logseq.Editor.prependBlockInPage(page!.uuid, note,
      // @ts-ignore
      { customUUID: notesBlockUUID, })
  } else {
    await logseq.Editor.updateBlock(notesBlock.uuid, note)
  }

  console.log('Created notes block for item:', notesBlock)
  // await logseq.Editor.upsertBlockProperty(page!.uuid, 'note', item.note || '')
}

export async function startFullPushToLogseq() {
  if (appState.isPushing.get()) return

  try {
    appState.isPushing.set(true)

    await pushItemTypesToLogseqTag()
  } catch (e) {
    appState.pushingError.set(String(e))
    console.error('Error starting full push to Logseq:', e)
  } finally {
    appState.isPushing.set(false)
  }
}