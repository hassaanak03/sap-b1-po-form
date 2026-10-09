import { fmt } from '../../api/purchaseOrderMapper'

function PurchaseOrderFooter({ mode, po, lookups, totals, onChange }) {
  const find = mode === 'find'
  const add = mode === 'add'
  const edit = mode === 'edit'
  const editable = find || add
  const set = (name) => (e) => onChange(name, e.target.value)

  // find mode is for search criteria, so the money fields stay empty
  const money = (n) => (find ? '' : fmt(n))

  return (
    <section className="po-footer">
      <div className="ft-left">
        <label htmlFor="po-buyer">Buyer</label>
        <select
          id="po-buyer"
          className="fld"
          value={po.buyer}
          disabled={!(editable || edit)}
          onChange={set('buyer')}
        >
          <option value="" />
          {lookups.buyers
            .filter((b) => (!add && !edit) || b.active || String(b.value) === po.buyer)
            .map((b) => (
              <option key={b.value} value={String(b.value)}>
                {b.label}
              </option>
            ))}
        </select>

        <label htmlFor="po-owner">Owner</label>
        <select
          id="po-owner"
          className="fld"
          value={po.owner}
          disabled={!(editable || edit)}
          onChange={set('owner')}
        >
          <option value="" />
          {lookups.owners
            .filter((o) => (!add && !edit) || o.active || String(o.value) === po.owner)
            .map((o) => (
              <option key={o.value} value={String(o.value)}>
                {o.label}
              </option>
            ))}
        </select>

        <label htmlFor="po-remarks">Remarks</label>
        <textarea
          id="po-remarks"
          className="fld"
          maxLength={254}
          value={po.remarks}
          readOnly={!(add || edit)}
          onChange={set('remarks')}
        />
      </div>

      <div className="ft-right">
        <div className="sum-row">
          <label>Total Before Discount</label>
          <input className="fld" readOnly value={money(totals.before)} />
        </div>

        <div className="sum-row">
          <label htmlFor="po-discount">Discount</label>
          <input
            id="po-discount"
            className="fld pct"
            inputMode="decimal"
            value={po.discountPercent}
            readOnly={!add}
            onChange={set('discountPercent')}
          />
          <span className="pct-sign">%</span>
          <input className="fld" aria-label="Discount amount" readOnly value={money(totals.discount)} />
        </div>

        <div className="sum-row">
          <label htmlFor="po-freight">Freight</label>
          <input
            id="po-freight"
            className="fld"
            inputMode="decimal"
            readOnly={!add}
            value={add ? po.freight : money(totals.freight)}
            onChange={set('freight')}
            style={{ textAlign: 'right' }}
          />
        </div>

        <div className="sum-row">
          <label>
            <input
              type="checkbox"
              checked={po.rounding}
              disabled={!add}
              onChange={(e) => onChange('rounding', e.target.checked)}
            />{' '}
            Rounding
          </label>
          <input className="fld" aria-label="Rounding amount" readOnly value={money(totals.rounding)} />
        </div>

        <div className="sum-row">
          <label>Tax</label>
          <input className="fld" readOnly value={money(totals.tax)} />
        </div>

        <div className="sum-row">
          <label>Total Payment Due</label>
          <input className="fld" readOnly value={money(totals.total)} />
        </div>
      </div>
    </section>
  )
}

export default PurchaseOrderFooter
