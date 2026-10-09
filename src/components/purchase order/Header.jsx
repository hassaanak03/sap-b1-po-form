import { CURRENCY_LABELS, STATUS_OPTIONS, todayISO } from '../../api/purchaseOrderMapper'

const str = (v) => (v == null ? '' : String(v))

function Options({ items, blank }) {
  return (
    <>
      <option value="">{blank}</option>
      {items.map((o) => (
        <option key={o.value} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </>
  )
}

function PurchaseOrderHeader({ mode, po, lookups, contacts, onChange, onVendorLookup }) {
  const find = mode === 'find'
  const add = mode === 'add'
  const editable = find || add
  const edit = mode === 'edit'
  const canType = editable || edit
  const set = (name) => (e) => onChange(name, e.target.value)

  // SAP shortcut: typing t (or y) in a date field enters today's date
  const dateKeys = (name, allowed) => (e) => {
    if (!allowed || e.key.length !== 1 || !'ty'.includes(e.key.toLowerCase())) return
    e.preventDefault()
    onChange(name, todayISO())
  }

  // In add mode SAP shows the number the document is going to get
  const nextNumber = lookups.series.find((s) => String(s.value) === po.series)?.next
  const shownNumber = add ? str(nextNumber) : po.docNum

  // a loaded document may use a currency that is not one of the three generic choices
  const currencies = CURRENCY_LABELS.includes(po.currency)
    ? CURRENCY_LABELS
    : [...CURRENCY_LABELS, po.currency]

  return (
    <section className="po-header">
      <div className="hdr-col hdr-left">
        <label htmlFor="po-vendor">Vendor</label>
        <input
          id="po-vendor"
          className={`fld${add ? ' req' : ''}`}
          value={po.vendorCode}
          readOnly={!editable}
          onChange={set('vendorCode')}
          onBlur={add ? (e) => onVendorLookup(e.target.value) : undefined}
          onKeyDown={add ? (e) => e.key === 'Enter' && e.currentTarget.blur() : undefined}
        />

        <label htmlFor="po-name">Name</label>
        <input
          id="po-name"
          className="fld"
          value={po.vendorName}
          readOnly={!find}
          onChange={set('vendorName')}
        />

        <label htmlFor="po-contact">Contact Person</label>
        <select
          id="po-contact"
          className="fld"
          value={po.contactPerson}
          disabled={!(add || edit)}
          onChange={set('contactPerson')}
        >
          <Options
            items={contacts
              .filter((c) => c.Active !== 'tNO' || String(c.InternalCode) === po.contactPerson)
              .map((c) => ({ value: c.InternalCode, label: c.Name }))}
            blank=""
          />
        </select>

        <label htmlFor="po-ref">Vendor Ref. No.</label>
        <input
          id="po-ref"
          className="fld"
          value={po.vendorRef}
          readOnly={!canType}
          onChange={set('vendorRef')}
        />

        <select
          aria-label="Currency"
          className="fld currency"
          value={po.currency}
          disabled={!add}
          onChange={set('currency')}
        >
          {currencies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <div className="hdr-spacer" />

        <label htmlFor="po-branch">Branch</label>
        <select
          id="po-branch"
          className="fld"
          value={po.branch}
          disabled={!editable}
          onChange={set('branch')}
        >
          <Options
            items={lookups.branches.filter((b) => !add || b.active || String(b.value) === po.branch)}
            blank=""
          />
        </select>
      </div>

      <div className="hdr-col hdr-right">
        <label htmlFor="po-series">No.</label>
        <div className="no-row">
          <select
            id="po-series"
            className="fld"
            value={po.series}
            disabled={!editable}
            onChange={set('series')}
          >
            <Options items={lookups.series} blank={find ? 'Any' : 'Default'} />
          </select>
          <input
            aria-label="Document number"
            className="fld"
            inputMode="numeric"
            value={shownNumber}
            readOnly={!find}
            onChange={(e) => onChange('docNum', e.target.value.replace(/\D/g, ''))}
          />
          <span>-</span>
          <input aria-label="Sub-number" className="fld" value="0" readOnly />
        </div>

        <label htmlFor="po-status">Status</label>
        <select
          id="po-status"
          className="fld"
          value={po.status}
          disabled={!find}
          onChange={set('status')}
        >
          <Options items={STATUS_OPTIONS} blank="" />
        </select>

        <label htmlFor="po-posting">Posting Date</label>
        <input
          id="po-posting"
          type="date"
          className="fld"
          value={po.postingDate}
          readOnly={!editable}
          onChange={set('postingDate')}
          onKeyDown={dateKeys('postingDate', editable)}
        />

        <label htmlFor="po-delivery">Delivery Date</label>
        <input
          id="po-delivery"
          type="date"
          className={`fld${add ? ' req' : ''}`}
          value={po.deliveryDate}
          readOnly={!editable}
          onChange={set('deliveryDate')}
          onKeyDown={dateKeys('deliveryDate', editable)}
        />

        <label htmlFor="po-docdate">Document Date</label>
        <input
          id="po-docdate"
          type="date"
          className="fld"
          value={po.documentDate}
          readOnly={!editable}
          onChange={set('documentDate')}
          onKeyDown={dateKeys('documentDate', editable)}
        />

        <label htmlFor="po-budget">Budget Amount</label>
        <input
          id="po-budget"
          className="fld"
          inputMode="decimal"
          value={po.budgetAmount}
          readOnly={!(add || edit)}
          onChange={(e) => onChange('budgetAmount', e.target.value.replace(/[^\d.]/g, ''))}
        />

        <div className="hdr-spacer" />

        <label htmlFor="po-branchreg">Branch Reg. No.</label>
        <input id="po-branchreg" className="fld" value={po.branchRegNo} readOnly />
      </div>
    </section>
  )
}

export default PurchaseOrderHeader
