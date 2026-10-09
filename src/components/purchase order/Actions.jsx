// Bottom button row. The first button is the default action for the current mode:
// Find (find mode), Add (add mode) or OK (a loaded document).
function PurchaseOrderActions({ mode, busy, canEdit, onFind, onAdd, onAddDraft, onEdit, onUpdate, onCancel }) {
  const primary = {
    find: { label: 'Find', onClick: onFind },
    add: { label: 'Add', onClick: onAdd },
    view: { label: 'OK', onClick: onCancel },
    edit: { label: 'Update', onClick: onUpdate },
  }[mode]

  return (
    <section className="po-actions">
      <div className="btn-row">
        <button type="button" className="btn primary" disabled={busy} onClick={primary.onClick}>
          {primary.label}
        </button>
        {mode === 'view' ? (
          <button type="button" className="btn" disabled={busy || !canEdit} onClick={onEdit}>
            Edit
          </button>
        ) : (
          <button type="button" className="btn" disabled={busy || mode !== 'add'} onClick={onAddDraft}>
            Add Draft &amp; New
          </button>
        )}
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div className="btn-row">
        <button type="button" className="btn" disabled>
          Copy From
        </button>
        <button type="button" className="btn" disabled>
          Copy To
        </button>
      </div>
    </section>
  )
}

export default PurchaseOrderActions
