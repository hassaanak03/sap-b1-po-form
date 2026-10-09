import { useEffect, useState } from 'react'
import * as sl from '../api/serviceLayer'
import {
  buildFindFilter,
  emptyLine,
  emptyPurchaseOrder,
  fromServiceLayer,
  todayISO,
  toServiceLayer,
  validate,
  isLineFilled,
  warehouseProblem,
  toServiceLayerUpdate,
} from '../api/purchaseOrderMapper'

const NO_LOOKUPS = { series: [], branches: [], buyers: [], owners: [], warehouses: [] }

// All form state and Service Layer calls for the Purchase Order screen.
//
// mode: 'find' -> search criteria (like SAP's find mode)
//       'add'  -> entering a new document
//       'view' -> a document loaded from SAP (read-only)
export function usePurchaseOrder() {
  const [mode, setMode] = useState('find')
  const [po, setPo] = useState(emptyPurchaseOrder)
  const [contacts, setContacts] = useState([])
  const [lookups, setLookups] = useState(NO_LOOKUPS)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState({ type: 'info', text: '' })
  // Set to the list of matches while the "pick one" modal is open after Find finds more than one; null when closed.
  const [findResults, setFindResults] = useState(null)

  useEffect(() => {
    let cancelled = false
    sl.loadLookups().then(({ failed, ...result }) => {
      if (cancelled) return
      setLookups(result)
      if (failed.length > 0) {
        setMessage({
          type: 'warning',
          text: `Could not load: ${failed.join(', ')}. Those dropdowns will be empty.`,
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [])
  const notify = (type, text) => setMessage({ type, text })
  const fail = (err) => notify('error', err?.message ?? String(err))

  // ---- editing ----

  const setField = (name, value) => setPo((p) => ({ ...p, [name]: value }))

  const setLine = (index, name, value) =>
    setPo((p) => {
      const lines = p.lines.map((l, i) => {
        if (i !== index) return l
        const next = { ...l, [name]: value }
        // SAP's saved line total is stale once a price field changes
        if (['quantity', 'unitPrice', 'discount', 'amount'].includes(name)) delete next.lineTotal
        // typing a new account invalidates the previous lookup
        if (name === 'accountCode') {
          next.accountKey = ''
          next.accountName = ''
        }
        return next
      })
      // keep one empty row at the bottom, like SAP's grid
      if (isLineFilled(lines[lines.length - 1], p.docType)) lines.push(emptyLine())
      return { ...p, lines }
    })

  // ---- master data lookups (add mode) ----

  async function lookupVendor(code) {
    const c = code.trim()
    if (!c) {
      setPo((p) => ({ ...p, vendorName: '', contactPerson: '' }))
      setContacts([])
      return
    }
    setBusy(true)
    try {
      const bp = await sl.getVendor(c)
      if (bp.CardType !== 'cSupplier') throw new Error(`${bp.CardCode} is not a vendor.`)
      const list = bp.ContactEmployees ?? []
      const main = list.find((x) => x.Name === bp.ContactPerson && x.Active !== 'tNO')
      setContacts(list)
      setPo((p) => ({
        ...p,
        vendorCode: bp.CardCode,
        vendorName: bp.CardName ?? '',
        contactPerson: main ? String(main.InternalCode) : '',
      }))
      notify('info', '')
    } catch (err) {
      setPo((p) => ({ ...p, vendorName: '', contactPerson: '' }))
      setContacts([])
      fail(err.status === 404 ? new Error(`Vendor ${c} was not found.`) : err)
    } finally {
      setBusy(false)
    }
  }

  async function lookupItem(index, code) {
    const c = code.trim()
    if (!c) return
    try {
      const item = await sl.getItem(c)
      const defaultWh = item.DefaultWarehouse || ''
      const skipDefault = warehouseProblem(lookups.warehouses, defaultWh, po.branch)
      setPo((p) => ({
        ...p,
        lines: p.lines.map((l, i) =>
          i === index && l.itemCode.trim() === c
            ? {
              ...l,
              itemCode: item.ItemCode,
              description: l.description || item.ItemName || '',
              warehouse: l.warehouse || (skipDefault ? '' : defaultWh),
            }
            : l,
        ),
      }))
      if (skipDefault) {
        notify('warning', `Default warehouse ${defaultWh} is not assigned to this branch. Choose another warehouse.`)
      } else {
        notify('info', '')
      }
    } catch (err) {
      fail(err.status === 404 ? new Error(`Item ${c} was not found.`) : err)
    }
  }

  async function lookupAccount(index, text) {
    const t = text.trim()
    const patch = (fields) =>
      setPo((p) => ({
        ...p,
        lines: p.lines.map((l, i) =>
          i === index && l.accountCode.trim() === t ? { ...l, ...fields } : l,
        ),
      }))
    if (!t) return patch({ accountKey: '', accountName: '' })
    try {
      const acc = await sl.findAccount(t)
      if (!acc) throw new Error(`G/L account ${t} was not found.`)
      if (acc.ActiveAccount === 'tNO') throw new Error(`G/L account ${t} is not active.`)
      patch({ accountCode: acc.FormatCode || acc.Code, accountKey: acc.Code, accountName: acc.Name ?? '' })
      notify('info', '')
    } catch (err) {
      patch({ accountKey: '', accountName: '' })
      fail(err)
    }
  }

  function changeDocType(value) {
    if (value === po.docType) return
    const hasLines = po.lines.some((l) => isLineFilled(l, po.docType))
    if (mode === 'add' && hasLines && !window.confirm('Changing the type clears the lines you entered. Continue?')) {
      return
    }
    setPo((p) => ({ ...p, docType: value, lines: [emptyLine()] }))
  }

  // Loaded service documents only store SAP's internal account key, so fetch the names.
  async function resolveAccountNames(docLines) {
    const codes = [...new Set(docLines.map((l) => l.AccountCode).filter(Boolean))]
    const found = await Promise.all(codes.map((c) => sl.findAccount(c).catch(() => null)))
    const byKey = Object.fromEntries(found.filter(Boolean).map((a) => [a.Code, a]))
    setPo((p) => ({
      ...p,
      lines: p.lines.map((l) => {
        const a = byKey[l.accountKey]
        return a ? { ...l, accountCode: a.FormatCode || a.Code, accountName: a.Name ?? '' } : l
      }),
    }))
  }

  // ---- mode changes ----

  function reset() {
    setMode('find')
    setPo(emptyPurchaseOrder())
    setContacts([])
    setFindResults(null)
    setVendorResults(null)
    notify('info', '')
  }

  function startAdd() {
    const today = todayISO()
    setMode('add')
    setPo({ ...emptyPurchaseOrder(), status: 'open', postingDate: today, documentDate: today })
    setPo({ ...emptyPurchaseOrder(), docType: 'item', status: 'open', postingDate: today, documentDate: today })
    setContacts([])
    notify('info', 'Enter a vendor code, a delivery date and at least one item line.')
  }

  // ---- reading from SAP ----

  // Loads one purchase order (already fetched in full, or just its DocEntry) into
  // View mode. Shared by "Find found exactly one match" and "user picked one from
  // the results list".
  function openDocument(doc) {
    setPo(fromServiceLayer(doc))
    setMode('view')
    setFindResults(null)
    if (doc.DocType === 'dDocument_Service') resolveAccountNames(doc.DocumentLines ?? [])
    notify('success', `Purchase Order ${doc.DocNum} loaded.`)
    // The document only stores the contact person's code; fetch the names for the dropdown.
    sl.getVendor(doc.CardCode)
      .then((bp) => setContacts(bp.ContactEmployees ?? []))
      .catch(() => setContacts([]))
  }


  async function searchOrders(filter) {
    const matches = await sl.findPurchaseOrders(filter)
    if (matches.length === 0) {
      notify('warning', 'No purchase order matches the search criteria.')
    } else if (matches.length === 1) {
      // the list query only returns header fields, so fetch the full document
      openDocument(await sl.getPurchaseOrder(matches[0].DocEntry))
    } else {
      setFindResults(matches)
    }
  }


  async function find() {
    setBusy(true)
    try {
      await searchOrders(buildFindFilter(po))
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }



  async function selectFoundOrder(docEntry) {
    setBusy(true)
    try {
      openDocument(await sl.getPurchaseOrder(docEntry))
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  const closeFindResults = () => setFindResults(null)

  // ---- writing to SAP ----

  async function save({ draft = false } = {}) {
    const problems = validate(po, {
      branchRequired: lookups.branches.length > 0,
      warehouses: lookups.warehouses,
    })
    const cp = contactProblem()
    if (cp) problems.unshift(cp)
    if (problems.length > 0) {
      notify('error', problems[0])
      return
    }
    setBusy(true)
    try {
      const payload = toServiceLayer(po)
      if (draft) {
        const created = await sl.createDraft(payload)
        startAdd()
        notify('success', `Draft ${created.DocEntry} saved. Ready for the next purchase order.`)
      } else {
        const created = await sl.createPurchaseOrder(payload)
        setPo(fromServiceLayer(created)) // show what SAP actually stored (tax, totals, numbering)
        setMode('view')
        notify('success', `Purchase Order ${created.DocNum} added.`)
      }
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  function startEdit() {
    if (mode !== 'view' || po.status !== 'open' || po.docEntry == null) return
    // one empty row at the bottom so new lines can be added
    setPo((p) => ({ ...p, lines: [...p.lines, emptyLine()] }))
    setMode('edit')
    notify('info', 'Editing. Change what you need, then click Update.')
  }

  async function update() {
    const problems = validate(po, { warehouses: lookups.warehouses })
    const cp = contactProblem()
    if (cp) problems.unshift(cp)
    if (problems.length > 0) {
      notify('error', problems[0])
      return
    }
    setBusy(true)
    try {
      await sl.updatePurchaseOrder(po.docEntry, toServiceLayerUpdate(po))
      const fresh = await sl.getPurchaseOrder(po.docEntry) // what SAP stored now
      openDocument(fresh)
      notify('success', `Purchase Order ${fresh.DocNum} updated.`)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  // SAP refuses a document whose contact person is inactive
  function contactProblem() {
    const c = contacts.find((x) => String(x.InternalCode) === po.contactPerson)
    return c?.Active === 'tNO' ? `Contact person ${c.Name} is inactive. Choose an active contact person.` : null
  }

  // throw away the changes: reload the saved document
  async function cancelEdit() {
    setBusy(true)
    try {
      openDocument(await sl.getPurchaseOrder(po.docEntry))
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  return {
    mode,
    po,
    contacts,
    lookups,
    busy,
    message,
    findResults,
    setField,
    setLine,
    lookupVendor,
    lookupItem,
    lookupAccount,
    changeDocType,
    find,
    selectFoundOrder,
    closeFindResults,
    save,
    startEdit,
    update,
    update,
    startAdd,
    reset,
  }
}
