import { useState } from 'react'

const TABS = ['Contents', 'Logistics', 'Accounting', 'Electronic Documents', 'Attachments']

// Tab strip + panel. The Contents tab shows its children (the item grid); the other
// tabs are placeholders until they are built.
function PurchaseOrderTabs({ mode, docType, onDocTypeChange, children }) {
  const [activeTab, setActiveTab] = useState('Contents')

  return (
    <section className="po-tabs">
      <div className="tab-buttons" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="tab-panel" role="tabpanel">
        {activeTab === 'Contents' ? (
          <>
            <div className="panel-row">
              <label className="inline-field">
                Item/Service Type
                <select
                  className="fld"
                  disabled={mode === 'view' || mode === 'edit'}
                  value={docType}
                  onChange={(e) => onDocTypeChange(e.target.value)}
                >
                  {mode === 'find' && <option value="">Any</option>}
                  <option value="item">Item</option>
                  <option value="service">Service</option>
                </select>
              </label>
              <label className="inline-field">
                Summary Type
                <select className="fld" disabled defaultValue="none">
                  <option value="none">No Summary</option>
                </select>
              </label>
            </div>
            {children}
          </>
        ) : (
          <p className="placeholder">The {activeTab} tab has not been built yet.</p>
        )}
      </div>
    </section>
  )
}

export default PurchaseOrderTabs
