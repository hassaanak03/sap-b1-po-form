// Thin client for the SAP Business One Service Layer.
//
// The browser only ever talks to the same-origin path /b1s/v1. In development the
// Vite dev server proxies that path to the real Service Layer (see vite.config.js),
// which avoids CORS problems and self-signed certificate errors.

import { ServiceLayerError } from './errors'
import { mockRequest } from './mockServiceLayer'

export { ServiceLayerError }

const BASE = '/b1s/v1'

// Demo mode: answer from a fake in-browser Service Layer instead of calling SAP.
// On by default while developing (npm run dev); set VITE_USE_MOCK=false in .env to use the
// real Service Layer. A production build only uses the demo when VITE_USE_MOCK=true.
const flag = import.meta.env.VITE_USE_MOCK
export const USE_MOCK = flag === undefined || flag === '' ? import.meta.env.DEV : flag === 'true'

let onSessionExpired = () => { }
export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn
}

async function request(path, { method = 'GET', body, headers } = {}) {
  if (USE_MOCK) {
    try {
      return await mockRequest(path, { method, body })
    } catch (err) {
      if (err.status === 401) onSessionExpired()
      throw err
    }
  }

  let res
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'include', // sends the B1SESSION cookie set by /Login
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ServiceLayerError(
      'Cannot reach the Service Layer. Check SL_TARGET in .env and that the server is running.',
    )
  }

  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    const message = data?.error?.message?.value ?? (text.slice(0, 200) || res.statusText)
    if (res.status === 401) onSessionExpired()
    throw new ServiceLayerError(message, { status: res.status, code: data?.error?.code })
  }
  return data
}

// ---- helpers ---------------------------------------------------------------

// Key literal for entity URLs, e.g. BusinessPartners('V10000')
const key = (value) => `'${encodeURIComponent(String(value).replace(/'/g, "''"))}'`

const qs = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')

// Service Layer returns 20 rows per page by default; 0 means "no paging".
const ALL_ROWS = { Prefer: 'odata.maxpagesize=0' }

const rowsOf = (result) =>
  result.status !== 'fulfilled'
    ? []
    : Array.isArray(result.value)
      ? result.value
      : (result.value?.value ?? [])

// ---- session ---------------------------------------------------------------

export const login = ({ companyDb, userName, password }) =>
  request('/Login', {
    method: 'POST',
    body: { CompanyDB: companyDb, UserName: userName, Password: password },
  })

export const logout = () => request('/Logout', { method: 'POST' }).catch(() => { })

// Cheap read used to find out whether the B1SESSION cookie is still valid.
export async function isSessionValid() {
  try {
    await request('/Currencies?' + qs({ $top: 1, $select: 'Code' }))
    return true
  } catch {
    return false
  }
}

// ---- purchase orders -------------------------------------------------------

// Returns every purchase order matching an OData $filter (or every PO, newest first,
// when the filter is empty), newest first, capped at `limit` rows.

export async function findPurchaseOrders(filter) {
  const data = await request(
    '/PurchaseOrders?' +
    qs({
      $filter: filter,
      $orderby: 'DocEntry desc',
      $select:
        'DocEntry,DocNum,Series,CardCode,CardName,DocDate,DocDueDate,DocumentStatus,Cancelled,DocTotal',
    }),
    { headers: ALL_ROWS },
  )
  return data?.value ?? []
}

// Fetches one purchase order in full, by its DocEntry (the key SAP itself assigns,
// not the human-facing DocNum).
export const getPurchaseOrder = (docEntry) => request(`/PurchaseOrders(${docEntry})`)

export const createPurchaseOrder = (payload) =>
  request('/PurchaseOrders', { method: 'POST', body: payload })

export const createDraft = (payload) =>
  request('/Drafts', { method: 'POST', body: { ...payload, DocObjectCode: 'oPurchaseOrders' } })

// SAP answers a successful PATCH with an empty body, so the caller reloads the document.
export const updatePurchaseOrder = (docEntry, payload) =>
  request(`/PurchaseOrders(${docEntry})`, { method: 'PATCH', body: payload })

// ---- master data lookups ---------------------------------------------------

export const getVendor = (code) =>
  request(
    `/BusinessPartners(${key(code)})?` +
    qs({ $select: 'CardCode,CardName,CardType,ContactPerson,ContactEmployees' }),
  )

// Returns active vendors whose code starts with the given text, sorted by code.

export const getItem = (code) =>
  request(`/Items(${key(code)})?` + qs({ $select: 'ItemCode,ItemName,DefaultWarehouse' }))

// Finds a G/L account by the code the user types. Charts with account segmentation show a
// formatted code on screen but SAP wants its internal key (Code) on the document line,
// so both are tried. If FormatCode isn't available, it falls back to the internal code only.
export async function findAccount(text) {
  const safe = text.replace(/'/g, "''")
  const first = (data) => data?.value?.[0] ?? null
  try {
    return first(
      await request(
        '/ChartOfAccounts?' +
        qs({
          $filter: `FormatCode eq '${safe}' or Code eq '${safe}'`,
          $select: 'Code,FormatCode,Name,ActiveAccount',
        }),
      ),
    )
  } catch {
    return first(
      await request(
        '/ChartOfAccounts?' +
        qs({ $filter: `Code eq '${safe}'`, $select: 'Code,Name,ActiveAccount' }),
      ),
    )
  }
}

// Dropdown data. Each list fails independently, so e.g. a company without
// multiple branches still gets the other lists.
export async function loadLookups() {
  const [series, branches, buyers, owners, warehouses] = await Promise.allSettled([
    request('/SeriesService_GetDocumentSeries', {
      method: 'POST',
      body: { DocumentTypeParams: { Document: '22' } }, // 22 = Purchase Order
    }),
    request('/BusinessPlaces?' + qs({ $select: 'BPLID,BPLName,Disabled' }), { headers: ALL_ROWS }),
    request('/SalesPersons?' + qs({ $select: 'SalesEmployeeCode,SalesEmployeeName,Active' }), {
      headers: ALL_ROWS,
    }),
    request('/EmployeesInfo?' + qs({ $select: 'EmployeeID,FirstName,LastName,Active' }), {
      headers: ALL_ROWS,
    }),
    request(
      '/Warehouses?' + qs({ $select: 'WarehouseCode,WarehouseName,BusinessPlaceID,Inactive' }),
      { headers: ALL_ROWS },
    ),
  ])

  const failed = [
    ['document series', series],
    ['buyers', buyers],
    ['owners', owners],
  ]
    .filter(([, r]) => r.status === 'rejected')
    .map(([name]) => name)

  return {
    series: rowsOf(series).map((s) => ({ value: s.Series, label: s.Name, next: s.NextNumber })),
    branches: rowsOf(branches).map((b) => ({
      value: b.BPLID,
      label: b.BPLName,
      active: b.Disabled !== 'tYES',
    })),
    buyers: rowsOf(buyers).map((s) => ({
      value: s.SalesEmployeeCode,
      label: s.SalesEmployeeName,
      active: s.Active !== 'tNO',
    })),
    owners: rowsOf(owners).map((e) => ({
      value: e.EmployeeID,
      label: [e.FirstName, e.LastName].filter(Boolean).join(' '),
      active: e.Active !== 'tNO',
    })),
    warehouses: rowsOf(warehouses).map((w) => ({
      code: w.WarehouseCode,
      name: w.WarehouseName,
      branch: w.BusinessPlaceID, // null when the warehouse isn't tied to a branch
      active: w.Inactive !== 'tYES',
    })),
  }
}
