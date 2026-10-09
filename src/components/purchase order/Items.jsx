import { BUDGET_COLUMNS, MIN_GRID_ROWS, SERVICE_EXTRA_COLUMNS } from '../../config'
import { fmt, isLineFilled, lineTotal } from '../../api/purchaseOrderMapper'

const ITEM_COLUMNS = [
  { label: '#', width: 32 },
  { label: 'Item No.', width: 110 },
  { label: 'Item Description', width: 170 },
  { label: 'Quantity', width: 80 },
  { label: 'Whse', width: 80 },
  { label: 'Unit Price', width: 100 },
  { label: 'Discount %', width: 90 },
  { label: 'Tax Code', width: 70 },
  { label: 'Total (LC)', width: 110 },
  { label: 'Cost Center', width: 92 },
  { label: 'Open Qty', width: 80 },
  { label: 'UoM Code', width: 84 },
  { label: 'Country/Region of Origin', width: 150 },
  { label: 'Branch', width: 90 },
  ...BUDGET_COLUMNS.map((c) => ({ label: c.label, width: c.width })),
]

const SERVICE_COLUMNS = [
  { label: '#', width: 32 },
  { label: 'Description', width: 260 },
  { label: 'G/L Account', width: 130 },
  { label: 'Cost Center', width: 92 },
  { label: 'G/L Account Name', width: 220 },
  { label: 'Tax Code', width: 70 },
  { label: 'Total (LC)', width: 110 },
  ...SERVICE_EXTRA_COLUMNS.map((c) => ({ label: c.label, width: c.width })),
  ...BUDGET_COLUMNS.map((c) => ({ label: c.label, width: c.width })),
]

function Cell({ label, value, onChange, onBlur, readOnly, numeric, list }) {
  return (
    <td className="on">
      <input
        className={`cell${numeric ? ' num' : ''}`}
        aria-label={label}
        value={value}
        readOnly={readOnly}
        onChange={onChange}
        onBlur={onBlur}
        list={list}
      />
    </td>
  )
}

// Item grid. Only editable in add mode; in find/view mode it is read-only.
function PurchaseOrderItems({ mode, docType, lines, warehouses = [], onLineChange, onItemLookup, onAccountLookup }) {
  const adding = mode === 'add'
  const editing = mode === 'edit'
  const editable = adding || editing
  const service = docType === 'service'
  const columns = service ? SERVICE_COLUMNS : ITEM_COLUMNS
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0)
  const rowCount = Math.max(MIN_GRID_ROWS, lines.length)

  return (
    <div className="grid-wrap">
      <datalist id="po-warehouses">
        {warehouses.map((w) => (
          <option key={w.code} value={w.code}>
            {w.name}
          </option>
        ))}
      </datalist>
      <table className="po-grid" style={{ width: tableWidth }}>
        <colgroup>
          {columns.map((c) => (
            <col key={c.label} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.label} title={c.label}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, i) => {
            const line = lines[i]
            if (!line) {
              return (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.label} />
                  ))}
                </tr>
              )
            }
            const change = (field) => (e) => onLineChange(i, field, e.target.value)
            const ro = !editable
            const locked = editing && line.lineNum !== undefined // saved lines keep their item / account
            const blank = !isLineFilled(line, docType)
            if (service) {
              return (
                <tr key={i}>
                  <td className="on idx">{i + 1}</td>
                  <Cell label="Description" value={line.description} readOnly={ro} onChange={change('description')} />
                  <Cell
                    label="G/L Account"
                    value={line.accountCode}
                    readOnly={ro || locked}
                    onChange={change('accountCode')}
                    onBlur={editable && !locked ? (e) => onAccountLookup(i, e.target.value) : undefined}
                  />
                  <Cell label="Cost Center" value={line.costCenter} readOnly={ro} onChange={change('costCenter')} />
                  <Cell label="G/L Account Name" readOnly value={line.accountName} />
                  <Cell label="Tax Code" value={line.taxCode} readOnly={ro} onChange={change('taxCode')} />
                  <Cell
                    label="Total (LC)"
                    numeric
                    readOnly={ro}
                    value={editable ? line.amount : blank ? '' : fmt(lineTotal(line, docType))}
                    onChange={change('amount')}
                  />
                  {SERVICE_EXTRA_COLUMNS.map((c) => (
                    <Cell key={c.key} label={c.label} value={line[c.key]} readOnly={ro} onChange={change(c.key)} />
                  ))}
                  {BUDGET_COLUMNS.map((c) => (
                    <Cell key={c.key} label={c.label} value={line[c.key]} readOnly={ro} onChange={change(c.key)} />
                  ))}
                </tr>
              )
            }
            return (
              <tr key={i}>
                <td className="on idx">{i + 1}</td>
                <Cell
                  label="Item No."
                  value={line.itemCode}
                  readOnly={ro || locked}
                  onChange={change('itemCode')}
                  onBlur={editable && !locked ? (e) => onItemLookup(i, e.target.value) : undefined}
                />
                <Cell label="Item Description" value={line.description} readOnly={ro} onChange={change('description')} />
                <Cell label="Quantity" numeric value={line.quantity} readOnly={ro} onChange={change('quantity')} />
                <Cell label="Whse" list="po-warehouses" value={line.warehouse} readOnly={ro} onChange={change('warehouse')} />
                <Cell label="Unit Price" numeric value={line.unitPrice} readOnly={ro} onChange={change('unitPrice')} />
                <Cell label="Discount %" numeric value={line.discount} readOnly={ro} onChange={change('discount')} />
                <Cell label="Tax Code" value={line.taxCode} readOnly={ro} onChange={change('taxCode')} />
                <Cell label="Total (LC)" numeric readOnly value={blank ? '' : fmt(lineTotal(line, docType))} />
                <Cell label="Cost Center" value={line.costCenter} readOnly={ro} onChange={change('costCenter')} />
                <Cell label="Open Qty" numeric readOnly value={line.openQty} />
                <Cell label="UoM Code" value={line.uomCode} readOnly={ro} onChange={change('uomCode')} />
                <Cell label="Country/Region of Origin" value={line.country} readOnly={ro} onChange={change('country')} />
                <Cell label="Branch" readOnly value={line.branch} />
                {BUDGET_COLUMNS.map((c) => (
                  <Cell key={c.key} label={c.label} value={line[c.key]} readOnly={ro} onChange={change(c.key)} />
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default PurchaseOrderItems
