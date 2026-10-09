// A fake Service Layer that runs inside the browser, for working without SAP credentials.
//
// It answers the same URLs and returns the same JSON shapes as the real Service Layer for
// everything this app uses, and keeps purchase orders in localStorage so they survive a
// page reload. Vendors, items, tax rates etc. below are made-up sample data.
// Turn it off with VITE_USE_MOCK=false in .env (see README).

import { ServiceLayerError } from './errors'

// ---- sample master data ----------------------------------------------------

const VENDORS = [
  {
    CardCode: 'V10000',
    CardName: 'Tech Supplies Ltd',
    CardType: 'cSupplier',
    ContactPerson: 'Bilal Ahmed',
    ContactEmployees: [
      { InternalCode: 1, Name: 'Bilal Ahmed' },
      { InternalCode: 2, Name: 'Sana Malik' },
    ],
  },
  {
    CardCode: 'V10001',
    CardName: 'Office World',
    CardType: 'cSupplier',
    ContactPerson: 'Hamza Raza',
    ContactEmployees: [{ InternalCode: 1, Name: 'Hamza Raza' }],
  },
  // a customer, so you can see the "is not a vendor" error
  { CardCode: 'C20000', CardName: 'Walk-in Customer', CardType: 'cCustomer', ContactEmployees: [] },
]

const ITEMS = [
  { ItemCode: 'ITEM001', ItemName: 'Laptop', DefaultWarehouse: 'WH01' },
  { ItemCode: 'ITEM002', ItemName: 'Mouse', DefaultWarehouse: 'WH01' },
  { ItemCode: 'ITEM003', ItemName: 'Keyboard', DefaultWarehouse: 'WH02' },
]

const SERIES = [
  { Series: 5, Name: 'Primary' },
  { Series: 7, Name: 'Imports' },
]
const DEFAULT_SERIES = 5

const BRANCHES = [
  { BPLID: 1, BPLName: 'Main Branch' },
  { BPLID: 2, BPLName: 'Lahore Branch' },
]
const SALES_PERSONS = [
  { SalesEmployeeCode: -1, SalesEmployeeName: '-No Sales Employee-' },
  { SalesEmployeeCode: 1, SalesEmployeeName: 'Ali Khan' },
  { SalesEmployeeCode: 2, SalesEmployeeName: 'Ayesha Noor' },
]
const EMPLOYEES = [
  { EmployeeID: 1, FirstName: 'Sara', LastName: 'Ahmed' },
  { EmployeeID: 2, FirstName: 'Usman', LastName: 'Tariq' },
]

const TAX_RATES = { P1: 0.1 } // made-up: tax code P1 = 10%

// ---- tiny persistent store -------------------------------------------------

const STORAGE_KEY = 'mock-sl-store'
let store = null

function seed() {
  const s = { nextDocEntry: 1, nextDocNum: { 5: 1001, 7: 5001 }, orders: [], drafts: [] }
  s.orders.push(
    buildDocument(
      {
        CardCode: 'V10000',
        Series: 5,
        DocDate: '2026-09-18',
        DocDueDate: '2026-09-25',
        TaxDate: '2026-09-18',
        NumAtCard: 'REF-001',
        ContactPersonCode: 1,
        Comments: 'Sample purchase order',
        DocumentLines: [
          { ItemCode: 'ITEM001', Quantity: 5, UnitPrice: 90000, VatGroup: 'P1' },
          { ItemCode: 'ITEM002', Quantity: 10, UnitPrice: 2000, VatGroup: 'P1' },
        ],
      },
      s,
    ),
  )
  // A second order for the same vendor, so Find can demonstrate multiple matches.
  s.orders.push(
    buildDocument(
      {
        CardCode: 'V10000',
        Series: 5,
        DocDate: '2026-09-10',
        DocDueDate: '2026-09-17',
        TaxDate: '2026-09-10',
        NumAtCard: 'REF-002',
        ContactPersonCode: 2,
        Comments: 'Second sample order for the same vendor',
        DocumentLines: [{ ItemCode: 'ITEM003', Quantity: 3, UnitPrice: 4500, VatGroup: 'P1' }],
      },
      s,
    ),
  )
  return s
}

function db() {
  if (store) return store
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) store = JSON.parse(raw)
  } catch {
    store = null
  }
  store ??= seed()
  return store
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // storage unavailable: data simply lives until the page is reloaded
  }
}

// ---- helpers ---------------------------------------------------------------

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100
const unquote = (s) => s.replace(/''/g, "'")

const fail = (status, message, code = -1) => {
  throw new ServiceLayerError(message, { status, code })
}

const notFound = () => fail(404, 'No matching records found (ODBC -2028)', -2028)

// ---- building a document the way SAP would ---------------------------------

function validateBody(body) {
  const vendor = VENDORS.find((v) => v.CardCode === body.CardCode)
  if (!vendor || vendor.CardType !== 'cSupplier') {
    fail(400, `Business partner ${body.CardCode ?? ''} is not a valid vendor`, -5002)
  }
  if (!body.DocDueDate) fail(400, 'Enter a due date (DocDueDate)', -5002)
  if (body.Series !== undefined && !SERIES.some((s) => s.Series === body.Series)) {
    fail(400, `Series ${body.Series} does not exist`, -5002)
  }
  const lines = body.DocumentLines ?? []
  if (lines.length === 0) fail(400, 'The document has no lines', -5002)
  lines.forEach((l, i) => {
    const item = ITEMS.find((x) => x.ItemCode === l.ItemCode)
    if (!item) fail(400, `Item ${l.ItemCode} does not exist (line ${i + 1})`, -5002)
    if (!(l.Quantity > 0)) fail(400, `Enter a quantity greater than 0 (line ${i + 1})`, -5002)
    if (!l.WarehouseCode && !item.DefaultWarehouse) {
      fail(400, `Warehouse is missing (line ${i + 1})`, -5002)
    }
  })
}

// Also assigns DocEntry / DocNum from the store's counters.
function buildDocument(body, s) {
  validateBody(body)
  const vendor = VENDORS.find((v) => v.CardCode === body.CardCode)
  const series = body.Series ?? DEFAULT_SERIES
  const branch = BRANCHES.find((b) => b.BPLID === body.BPL_IDAssignedToInvoice)

  const lines = body.DocumentLines.map((l, i) => {
    const item = ITEMS.find((x) => x.ItemCode === l.ItemCode)
    const discount = l.DiscountPercent ?? 0
    const unitPrice = l.UnitPrice ?? 0
    return {
      LineNum: i,
      ItemCode: l.ItemCode,
      ItemDescription: l.ItemDescription ?? item.ItemName,
      Quantity: l.Quantity,
      WarehouseCode: l.WarehouseCode ?? item.DefaultWarehouse,
      UnitPrice: unitPrice,
      DiscountPercent: discount,
      VatGroup: l.VatGroup ?? '',
      LineTotal: round2(l.Quantity * unitPrice * (1 - discount / 100)),
      CostingCode: l.CostingCode ?? '',
      RemainingOpenQuantity: l.Quantity,
      UoMCode: l.UoMCode ?? '',
      CountryOrg: l.CountryOrg ?? '',
      BPLName: branch?.BPLName ?? '',
    }
  })

  const discountPercent = body.DiscountPercent ?? 0
  const subtotal = lines.reduce((sum, l) => sum + l.LineTotal, 0)
  const totalDiscount = round2((subtotal * discountPercent) / 100)
  const freight = (body.DocumentAdditionalExpenses ?? []).reduce((sum, e) => sum + (e.LineTotal ?? 0), 0)
  const vatSum = round2(
    lines.reduce((sum, l) => sum + l.LineTotal * (TAX_RATES[l.VatGroup] ?? 0), 0) *
    (1 - discountPercent / 100),
  )
  let total = round2(subtotal - totalDiscount + freight + vatSum)
  let roundingDiff = 0
  if (body.Rounding === 'tYES') {
    roundingDiff = round2(Math.round(total) - total)
    total = Math.round(total)
  }

  const docNum = s.nextDocNum[series]
  s.nextDocNum[series] = docNum + 1

  return {
    DocEntry: s.nextDocEntry++,
    DocNum: docNum,
    Series: series,
    CardCode: vendor.CardCode,
    CardName: vendor.CardName,
    ContactPersonCode: body.ContactPersonCode ?? null,
    NumAtCard: body.NumAtCard ?? '',
    DocCurrency: body.DocCurrency ?? 'PKR',
    BPL_IDAssignedToInvoice: body.BPL_IDAssignedToInvoice ?? null,
    DocDate: body.DocDate,
    DocDueDate: body.DocDueDate,
    TaxDate: body.TaxDate ?? body.DocDate,
    DocumentStatus: 'bost_Open',
    Cancelled: 'tNO',
    SalesPersonCode: body.SalesPersonCode ?? -1,
    DocumentsOwner: body.DocumentsOwner ?? null,
    Comments: body.Comments ?? '',
    DiscountPercent: discountPercent,
    TotalDiscount: totalDiscount,
    Rounding: body.Rounding ?? 'tNO',
    RoundingDiffAmount: roundingDiff,
    DocumentAdditionalExpenses: body.DocumentAdditionalExpenses ?? [],
    VatSum: vatSum,
    DocTotal: total,
    DocumentLines: lines,
  }
}

// ---- $filter: the subset of OData the app generates ------------------------
//   Field eq 12 | Field eq 'text' | contains(Field,'text'), joined with "and"

function matchesFilter(doc, filter) {
  if (!filter.trim()) return true
  const atom =
    /(startswith|contains)\((\w+),'((?:[^']|'')*)'\)|(\w+) (eq|ge|le) ('(?:[^']|'')*'|-?\d+(?:\.\d+)?)/g
  const checks = []
  const expr = filter.replace(atom, (_, fn, f1, text, f2, op, raw) => {
    let ok
    if (fn) {
      const hay = String(doc[f1] ?? '').toLowerCase()
      const needle = unquote(text).toLowerCase()
      ok = fn === 'startswith' ? hay.startsWith(needle) : hay.includes(needle)
    } else {
      const want = raw.startsWith("'") ? unquote(raw.slice(1, -1)) : Number(raw)
      const have = doc[f2]
      ok = op === 'eq' ? have === want : op === 'ge' ? have >= want : have <= want
    }
    checks.push(ok)
    return `c[${checks.length - 1}]`
  })
  // only c[n], and/or and parentheses are left at this point
  return new Function('c', `return ${expr.replace(/\band\b/g, '&&').replace(/\bor\b/g, '||')}`)(checks)
}

// ---- request router --------------------------------------------------------

export async function mockRequest(path, { method = 'GET', body } = {}) {
  await delay(150)
  const [pathname, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  const byKey = pathname.match(/^\/(\w+)\('((?:[^']|'')*)'\)$/) // e.g. /Items('ITEM001')
  const byNumKey = pathname.match(/^\/(\w+)\((\d+)\)$/) // e.g. /PurchaseOrders(3)

  if (method === 'POST' && pathname === '/Login') {
    if (!body?.CompanyDB || !body?.UserName || !body?.Password) {
      fail(401, 'Invalid login credentials', -1)
    }
    return { SessionId: 'mock-session', Version: '1000000', SessionTimeout: 30 }
  }
  if (method === 'POST' && pathname === '/Logout') return null

  if (method === 'GET' && pathname === '/Currencies') return { value: [{ Code: 'PKR' }] }

  if (method === 'POST' && pathname === '/SeriesService_GetDocumentSeries') {
    return {
      value: SERIES.map((s) => ({ ...s, NextNumber: db().nextDocNum[s.Series] })),
    }
  }
  if (method === 'GET' && pathname === '/BusinessPlaces') return { value: BRANCHES }
  if (method === 'GET' && pathname === '/SalesPersons') return { value: SALES_PERSONS }
  if (method === 'GET' && pathname === '/EmployeesInfo') return { value: EMPLOYEES }

  if (method === 'GET' && byKey && (byKey[1] === 'BusinessPartners' || byKey[1] === 'Items')) {
    const code = unquote(decodeURIComponent(byKey[2]))
    const rows = byKey[1] === 'Items' ? ITEMS : VENDORS
    const row = rows.find((r) => (r.ItemCode ?? r.CardCode) === code)
    return row ?? notFound()
  }

  if (method === 'GET' && byNumKey && byNumKey[1] === 'PurchaseOrders') {
    const doc = db().orders.find((o) => o.DocEntry === Number(byNumKey[2]))
    return doc ?? notFound()
  }

  if (pathname === '/PurchaseOrders' && method === 'GET') {
    const filter = params.get('$filter') ?? ''
    const top = Number(params.get('$top')) || Infinity
    const rows = db()
      .orders.filter((o) => matchesFilter(o, filter))
      .sort((a, b) => b.DocEntry - a.DocEntry)
      .slice(0, top)

    const select = params.get('$select')?.split(',')
    const pick = (o) => (select ? Object.fromEntries(select.map((k) => [k, o[k]])) : o)
    return { value: rows.map(pick) }
  }

  if (pathname === '/BusinessPartners' && method === 'GET') {
    const filter = params.get('$filter') ?? ''
    const m = filter.match(/startswith\(CardCode,'((?:[^']|'')*)'\)/)
    const prefix = m ? unquote(m[1]) : ''
    const rows = VENDORS.filter((v) => v.CardType === 'cSupplier' && v.CardCode.startsWith(prefix))
    return { value: rows.map(({ CardCode, CardName }) => ({ CardCode, CardName })) }
  }

  if (pathname === '/PurchaseOrders' && method === 'POST') {
    const doc = buildDocument(body ?? {}, db())
    db().orders.push(doc)
    persist()
    return doc
  }

  if (pathname === '/Drafts' && method === 'POST') {
    const draft = buildDocument(body ?? {}, db())
    db().drafts.push(draft)
    persist()
    return draft
  }

  return fail(404, `The demo Service Layer does not implement ${method} ${pathname}`)
}
