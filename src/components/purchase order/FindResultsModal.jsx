import { fmt } from '../../api/purchaseOrderMapper'

const STATUS_LABEL = { open: 'Open', closed: 'Closed', canceled: 'Canceled' }

function statusOf(doc) {
  if (doc.Cancelled === 'tYES') return 'canceled'
  return doc.DocumentStatus === 'bost_Close' ? 'closed' : 'open'
}

// Shown after Find matches more than one purchase order, so the user can pick which
// one to open. Closing without choosing (Escape, backdrop click, Cancel) leaves the
// form in Find mode, unchanged.
function FindResultsModal({ orders, onSelect, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Select a purchase order"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span>{orders.length} purchase orders match — select one</span>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-table-wrap">
          <table className="modal-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Vendor</th>
                <th>Posting Date</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.DocEntry} tabIndex={0} onClick={() => onSelect(o.DocEntry)}>
                  <td>{o.DocNum}</td>
                  <td>{o.CardName}</td>
                  <td>{(o.DocDate ?? '').slice(0, 10)}</td>
                  <td>{STATUS_LABEL[statusOf(o)]}</td>
                  <td className="num">{fmt(o.DocTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default FindResultsModal
