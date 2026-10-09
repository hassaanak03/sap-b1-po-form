// Converts between the form's state (plain strings, easy to bind to inputs) and
// the Service Layer's PurchaseOrders JSON, and builds search filters.

import { BUDGET_COLUMNS, DEFAULT_TAX_CODE, FREIGHT_EXPENSE_CODE, SERVICE_EXTRA_COLUMNS } from '../config'

export const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'canceled', label: 'Canceled' },
]

export const CURRENCY_LABELS = ['Local Currency', 'BP Currency', 'System Currency']

export const isLineFilled = (line, docType) =>
  docType === 'service' ? line.accountCode.trim() !== '' : line.itemCode.trim() !== ''

// ---- small helpers ---------------------------------------------------------

const str = (v) => (v == null ? '' : String(v))
const dateOnly = (v) => str(v).slice(0, 10)
const quote = (v) => `'${String(v).replace(/'/g, "''")}'`

// '' / null / NaN -> undefined so the value is left out of the JSON payload
const num = (v) => {
  if (v === '' || v == null) return undefined
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : undefined
}

// UDF values of a service line, only the ones that were filled in
const extraFields = (l) =>
  Object.fromEntries(
    SERVICE_EXTRA_COLUMNS.filter((c) => str(l[c.key]).trim() !== '').map((c) => [
      c.udf,
      str(l[c.key]).trim(),
    ]),
  )

// Filled-in fields of a line, using the Service Layer names from a column config
const lineFields = (l, columns) =>
  Object.fromEntries(
    columns
      .filter((c) => str(l[c.key]).trim() !== '')
      .map((c) => [c.field, c.numeric ? num(l[c.key]) : str(l[c.key]).trim()]),
  )

export const fmt = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function todayISO() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// ---- blank form state ------------------------------------------------------

export const emptyLine = () => ({
  itemCode: '',
  description: '',
  quantity: '',
  warehouse: '',
  unitPrice: '',
  discount: '0',
  taxCode: DEFAULT_TAX_CODE,
  costCenter: '',
  openQty: '',
  uomCode: '',
  country: '',
  branch: '',
  accountCode: '',
  accountKey: '',
  accountName: '',
  amount: '',
  ...Object.fromEntries(SERVICE_EXTRA_COLUMNS.map((c) => [c.key, ''])),
  ...Object.fromEntries(BUDGET_COLUMNS.map((c) => [c.key, ''])),
})

export const emptyPurchaseOrder = () => ({
  docEntry: null,
  docNum: '',
  docType: '',
  series: '',
  vendorCode: '',
  vendorName: '',
  contactPerson: '',
  vendorRef: '',
  currency: 'Local Currency',
  branch: '',
  branchRegNo: '',
  status: '',
  postingDate: '',
  deliveryDate: '',
  documentDate: '',
  budgetAmount: '',
  buyer: '',
  owner: '',
  remarks: '',
  discountPercent: '',
  freight: '',
  rounding: false,
  server: null, // totals calculated by SAP, present once a document has been loaded/saved
  lines: [emptyLine()],
})

// ---- totals ----------------------------------------------------------------

export function lineTotal(line, docType) {
  if (line.lineTotal !== undefined) return line.lineTotal // value calculated by SAP
  if (docType === 'service') return num(line.amount) ?? 0
  const qty = num(line.quantity) ?? 0
  const price = num(line.unitPrice) ?? 0
  const disc = num(line.discount) ?? 0
  return qty * price * (1 - disc / 100)
}

// SAP is the source of truth for loaded documents. For a document that has not been
// saved yet these are estimates (tax is only known to SAP once the document is added).
export function computeTotals(po) {
  const before = po.lines.reduce((sum, l) => sum + lineTotal(l, po.docType), 0)
  if (po.server) return { before, ...po.server }
  const discount = (before * (num(po.discountPercent) ?? 0)) / 100
  const freight = num(po.freight) ?? 0
  return { before, discount, freight, rounding: 0, tax: 0, total: before - discount + freight }
}

// ---- Service Layer -> form -------------------------------------------------

export function fromServiceLayer(doc) {
  const status =
    doc.Cancelled === 'tYES' ? 'canceled' : doc.DocumentStatus === 'bost_Close' ? 'closed' : 'open'

  return {
    docEntry: doc.DocEntry ?? null,
    docNum: str(doc.DocNum),
    budgetAmount: str(doc.U_BudgetAmount),
    docType: doc.DocType === 'dDocument_Service' ? 'service' : 'item',
    series: str(doc.Series),
    vendorCode: str(doc.CardCode),
    vendorName: str(doc.CardName),
    contactPerson: str(doc.ContactPersonCode),
    vendorRef: str(doc.NumAtCard),
    currency: str(doc.DocCurrency) || 'Local Currency',
    branch: str(doc.BPL_IDAssignedToInvoice),
    branchRegNo: '',
    status,
    postingDate: dateOnly(doc.DocDate),
    deliveryDate: dateOnly(doc.DocDueDate),
    documentDate: dateOnly(doc.TaxDate),
    buyer: str(doc.SalesPersonCode),
    owner: str(doc.DocumentsOwner),
    remarks: str(doc.Comments),
    discountPercent: str(doc.DiscountPercent),
    freight: '',
    rounding: doc.Rounding === 'tYES',
    server: {
      discount: doc.TotalDiscount ?? 0,
      freight: (doc.DocumentAdditionalExpenses ?? []).reduce((s, e) => s + (e.LineTotal ?? 0), 0),
      rounding: doc.RoundingDiffAmount ?? 0,
      tax: doc.VatSum ?? 0,
      total: doc.DocTotal ?? 0,
    },
    lines: (doc.DocumentLines ?? []).map((l) => ({
      itemCode: str(l.ItemCode),
      accountCode: str(l.AccountCode),
      ...Object.fromEntries(BUDGET_COLUMNS.map((c) => [c.key, str(l[c.field])])),
      accountKey: str(l.AccountCode),
      accountName: '',
      lineNum: l.LineNum,
      amount: l.LineTotal != null ? String(l.LineTotal) : '',
      ...Object.fromEntries(SERVICE_EXTRA_COLUMNS.map((c) => [c.key, str(l[c.udf])])),
      description: str(l.ItemDescription),
      quantity: str(l.Quantity),
      warehouse: str(l.WarehouseCode),
      unitPrice: str(l.UnitPrice ?? l.Price),
      discount: str(l.DiscountPercent),
      taxCode: str(l.VatGroup),
      lineTotal: l.LineTotal ?? 0,
      costCenter: str(l.CostingCode),
      openQty: str(l.RemainingOpenQuantity),
      uomCode: str(l.UoMCode),
      country: str(l.CountryOrg),
      branch: str(l.BPLName),
    })),
  }
}

// ---- form -> Service Layer -------------------------------------------------

const hasItem = (line) => line.itemCode.trim() !== ''
const isCurrencyCode = (c) => c !== '' && !CURRENCY_LABELS.includes(c)

export function toServiceLayer(po) {
  const service = po.docType === 'service'
  const payload = {
    DocType: service ? 'dDocument_Service' : 'dDocument_Items',
    CardCode: po.vendorCode.trim(),
    DocDate: po.postingDate,
    DocDueDate: po.deliveryDate,
    U_BudgetAmount: num(po.budgetAmount),
    TaxDate: po.documentDate || po.postingDate,
    DocumentLines: po.lines
      .filter((l) => isLineFilled(l, po.docType))
      .map((l) =>
        service
          ? {
            LineNum: l.lineNum,
            ItemDescription: l.description || undefined,
            AccountCode: l.accountKey,
            LineTotal: num(l.amount),
            VatGroup: l.taxCode || undefined,
            CostingCode: l.costCenter || undefined,
            ...lineFields(l, BUDGET_COLUMNS),
            ...extraFields(l),
          }
          : {
            LineNum: l.lineNum,
            ItemCode: l.itemCode.trim(),
            ItemDescription: l.description || undefined,
            Quantity: num(l.quantity),
            WarehouseCode: l.warehouse || undefined,
            UnitPrice: num(l.unitPrice),
            DiscountPercent: num(l.discount),
            VatGroup: l.taxCode || undefined,
            CostingCode: l.costCenter || undefined,
            ...lineFields(l, BUDGET_COLUMNS),
            UoMCode: l.uomCode || undefined,
            CountryOrg: l.country || undefined,
          },
      ),
  }

  // Optional header fields: only sent when the user filled them in
  const optional = (name, value) => {
    if (value !== undefined && value !== '') payload[name] = value
  }
  optional('Series', num(po.series))
  optional('NumAtCard', po.vendorRef.trim())
  optional('ContactPersonCode', num(po.contactPerson))
  optional('BPL_IDAssignedToInvoice', num(po.branch))
  optional('SalesPersonCode', num(po.buyer))
  optional('DocumentsOwner', num(po.owner))
  optional('Comments', po.remarks.trim())
  optional('DiscountPercent', num(po.discountPercent))
  if (po.rounding) payload.Rounding = 'tYES'
  if (isCurrencyCode(po.currency)) payload.DocCurrency = po.currency

  const freight = num(po.freight)
  if (freight) {
    payload.DocumentAdditionalExpenses = [{ ExpenseCode: FREIGHT_EXPENSE_CODE, LineTotal: freight }]
  }
  return payload
}

// Body for PATCH: only what may change once the document exists.
export function toServiceLayerUpdate(po) {
  const payload = toServiceLayer(po)
  for (const key of [
    'CardCode', 'DocType', 'Series', 'BPL_IDAssignedToInvoice', 'DocCurrency',
    'DocDate', 'DiscountPercent', 'Rounding', 'DocumentAdditionalExpenses',
  ]) {
    delete payload[key]
  }
  // always sent, so the user can clear them
  payload.NumAtCard = po.vendorRef.trim()
  payload.Comments = po.remarks.trim()
  return payload
}


// True when the warehouse is known and belongs to a different branch than the document.
export function warehouseProblem(warehouses, code, branch) {
  if (!code || branch === '') return false
  const w = warehouses.find((x) => x.code === code)
  return Boolean(w && w.branch != null && String(w.branch) !== String(branch))
}

// Warehouses suitable for a document of this branch (all active ones until a branch is chosen).
export const warehousesForBranch = (warehouses, branch) =>
  warehouses.filter(
    (w) => w.active && (branch === '' || w.branch == null || String(w.branch) === String(branch)),
  )

// Returns a list of problems; empty means the form can be sent to SAP.
export function validate(po, { branchRequired = false, warehouses = [] } = {}) {
  const problems = []
  if (!po.vendorCode.trim()) problems.push('Enter a vendor code.')
  if (branchRequired && po.branch === '') problems.push('Select a branch.')
  if (!po.deliveryDate) problems.push('Enter a delivery date.')
  else if (po.postingDate && po.deliveryDate < po.postingDate) {
    problems.push('The delivery date cannot be before the posting date.')
  }

  const service = po.docType === 'service'
  const lines = po.lines.filter((l) => isLineFilled(l, po.docType))
  if (lines.length === 0) problems.push(service ? 'Add at least one service line.' : 'Add at least one item line.')
  lines.forEach((l, i) => {
    if (service) {
      if (!l.accountKey) problems.push(`Line ${i + 1}: choose a valid G/L account.`)
      if (!(num(l.amount) > 0)) problems.push(`Line ${i + 1}: enter a total greater than 0.`)
    } else if (!(num(l.quantity) > 0)) {
      problems.push(`Line ${i + 1}: enter a quantity greater than 0.`)
    }
    if (warehouseProblem(warehouses, l.warehouse, po.branch)) {
      problems.push(`Line ${i + 1}: warehouse ${l.warehouse} is not assigned to the selected branch.`)
    }
  })

  if (po.remarks.length > 254) problems.push('Remarks can be at most 254 characters.')
  return problems
}

// ---- Find mode -> OData $filter -------------------------------------------

export function buildFindFilter(po) {
  const f = []

  const vendorCode = po.vendorCode.trim()
  if (vendorCode) f.push(`startswith(CardCode,${quote(vendorCode)})`)

  const docNum = po.docNum.trim()
  if (docNum) f.push(numericPrefixClauses(docNum, 'DocNum')) // prefix match: 12 -> 12, 120-129, ...

  if (po.series !== '') f.push(`Series eq ${Number(po.series)}`)
  if (po.vendorName.trim()) f.push(`contains(CardName,${quote(po.vendorName.trim())})`)
  if (po.vendorRef.trim()) f.push(`NumAtCard eq ${quote(po.vendorRef.trim())}`)
  if (po.branch !== '') f.push(`BPL_IDAssignedToInvoice eq ${Number(po.branch)}`)
  if (po.buyer !== '') f.push(`SalesPersonCode eq ${Number(po.buyer)}`)
  if (po.owner !== '') f.push(`DocumentsOwner eq ${Number(po.owner)}`)
  if (po.postingDate) f.push(`DocDate eq ${quote(po.postingDate)}`)
  if (po.deliveryDate) f.push(`DocDueDate eq ${quote(po.deliveryDate)}`)
  if (po.documentDate) f.push(`TaxDate eq ${quote(po.documentDate)}`)
  if (po.docType) f.push(`DocType eq ${quote(po.docType === 'service' ? 'dDocument_Service' : 'dDocument_Items')}`)

  if (po.status === 'open') f.push("DocumentStatus eq 'bost_Open'", "Cancelled eq 'tNO'")
  if (po.status === 'closed') f.push("DocumentStatus eq 'bost_Close'", "Cancelled eq 'tNO'")
  if (po.status === 'canceled') f.push("Cancelled eq 'tYES'")

  return f.join(' and ')
}


function numericPrefixClauses(prefix, field, maxExtraDigits = 5) {
  const clauses = []
  for (let extra = 0; extra <= maxExtraDigits; extra++) {
    const low = Number(prefix) * 10 ** extra
    const high = low + 10 ** extra - 1
    clauses.push(`(${field} ge ${low} and ${field} le ${high})`)
  }
  return `(${clauses.join(' or ')})`
}
