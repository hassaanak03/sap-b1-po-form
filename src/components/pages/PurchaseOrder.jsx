import PurchaseOrderHeader from "../purchase order/Header";
import PurchaseOrderTabs from "../purchase order/Tabs";
import PurchaseOrderItems from "../purchase order/Items";
import PurchaseOrderFooter from "../purchase order/Footer";
import PurchaseOrderActions from "../purchase order/Actions";
import FindResultsModal from "../purchase order/FindResultsModal";
import MenuBar from "../layout/MenuBar";
import StatusBar from "../layout/StatusBar";
import { usePurchaseOrder } from "../../hooks/usePurchaseOrder";
import { computeTotals, warehousesForBranch } from "../../api/purchaseOrderMapper";

function PurchaseOrder({ session, onLogout }) {
    const form = usePurchaseOrder();
    const totals = computeTotals(form.po);
    const canEdit = form.mode === "view" && form.po.docEntry != null && form.po.status === "open";

    // In find mode, Enter in any field runs the search (like SAP)
    const handleKeyDown = (e) => {
        if (e.key === "Enter" && form.mode === "find" && ["INPUT", "SELECT"].includes(e.target.tagName)) {
            form.find();
        }
    };

    const menus = {
        File: [{ label: "Log out", onClick: onLogout }],
        Data: [
            { label: "Find", onClick: form.reset },
            { label: "Add", onClick: form.startAdd },
        ],
    };

    return (
        <div className={`sap-shell mode-${form.mode}${form.busy ? " busy" : ""}`} onKeyDown={handleKeyDown}>
            <MenuBar menus={menus} />
            <div className="window-title">Purchase Order</div>

            <main className="po-scroll">
                <div className="purchase-order">
                    <PurchaseOrderHeader
                        mode={form.mode}
                        po={form.po}
                        lookups={form.lookups}
                        contacts={form.contacts}
                        onChange={form.setField}
                        onVendorLookup={form.lookupVendor}
                    />
                    <PurchaseOrderTabs
                        mode={form.mode}
                        docType={form.po.docType}
                        onDocTypeChange={form.changeDocType}
                    >
                        <PurchaseOrderItems
                            mode={form.mode}
                            docType={form.po.docType}
                            lines={form.po.lines}
                            warehouses={warehousesForBranch(form.lookups.warehouses, form.po.branch)}
                            onLineChange={form.setLine}
                            onItemLookup={form.lookupItem}
                            onAccountLookup={form.lookupAccount}
                        />
                    </PurchaseOrderTabs>
                    <PurchaseOrderFooter
                        mode={form.mode}
                        po={form.po}
                        lookups={form.lookups}
                        totals={totals}
                        onChange={form.setField}
                    />
                    <PurchaseOrderActions
                        mode={form.mode}
                        busy={form.busy}
                        canEdit={canEdit}
                        onFind={form.find}
                        onAdd={() => form.save()}
                        onAddDraft={() => form.save({ draft: true })}
                        onEdit={form.startEdit}
                        onUpdate={form.update}
                        onCancel={form.mode === "edit" ? form.cancelEdit : form.reset}
                    />
                </div>
            </main>

            <StatusBar message={form.message} session={session} />

            {form.findResults && (
                <FindResultsModal
                    orders={form.findResults}
                    onSelect={form.selectFoundOrder}
                    onClose={form.closeFindResults}
                />
            )}
        </div>
    );
}

export default PurchaseOrder
