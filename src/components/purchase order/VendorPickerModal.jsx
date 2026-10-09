// Shown after typing a partial vendor code matches more than one vendor, so the user
// can pick the exact one before the purchase-order search runs.
function VendorPickerModal({ vendors, onSelect, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Select a vendor"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span>{vendors.length} vendors match — select one</span>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-table-wrap">
          <table className="modal-table">
            <thead>
              <tr>
                <th>Vendor Code</th>
                <th>Vendor Name</th>
                <th>POs</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.CardCode} tabIndex={0} onClick={() => onSelect(v)}>
                  <td>{v.CardCode}</td>
                  <td>{v.CardName}</td>
                  <td className="num">{v.poCount ?? '-'}</td>
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

export default VendorPickerModal