# Purchase Order Form for SAP Business One

A web form that looks and behaves like the **Purchase Order** window in SAP Business One. It reads and writes real documents through the SAP **Service Layer** (REST / OData), so purchase orders can be searched, created, drafted and updated from the browser.

Built with **React 19** and **Vite**.

## Features

- **Find** purchase orders by vendor code, document number, vendor name, vendor reference, series, branch, buyer, owner, status, item/service type and the three dates. Several matches open a pick list, a single match opens directly.
- **Add** a purchase order (`POST /PurchaseOrders`) or save it as a draft with **Add Draft & New** (`POST /Drafts`).
- **Edit and Update** an open purchase order (`PATCH /PurchaseOrders(DocEntry)`).
- **Item and Service** documents, each with its own grid:
  - Item lines: item code, description, quantity, warehouse, unit price, discount, tax code, cost center, UoM, country of origin.
  - Service lines: description, G/L account (account name is looked up), cost center, tax code, total, plus configurable extra columns.
- **Project budget fields**: Budget Amount on the header, and Project, Budget Entry and Budget Line on every line.
- Lookups straight from SAP: vendor and contact persons, items (with default warehouse), G/L accounts, document series with the next number, branches, buyers, owners, warehouses.
- Checks before anything is sent to SAP (see [Validation](#validation)).
- SAP-style details: yellow Find fields, status bar messages, menu bar, `t` / `y` in a date field enters today's date.
- **Demo mode**: a fake Service Layer inside the browser, so the form can be tried without SAP credentials.

## Getting started

Requirements: a current LTS version of [Node.js](https://nodejs.org/).

```bash
npm install
npm run dev
```

Open the address Vite prints (normally `http://localhost:5173`).

### Demo mode (no SAP needed)

With no `.env` file, `npm run dev` starts in **demo mode**. Login accepts any company, user and password.

- Sample data: vendors `V10000` and `V10001`, a customer `C20000` (to see the "not a vendor" error), items `ITEM001` to `ITEM003`, and a few saved purchase orders.
- Orders you add are kept in the browser's `localStorage`.
- Tax is made up (`P1` = 10%).
- An orange **Demo data** tag in the status bar shows when demo mode is on.
- Demo mode covers **item** purchase orders. Service orders, Edit/Update and the budget fields need a real Service Layer.

### Using a real Service Layer

1. Copy the example environment file:

   ```bash
   cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
   ```

2. Edit `.env`:

   ```
   VITE_USE_MOCK=false
   SL_TARGET=https://your-server:50000
   ```

3. Restart `npm run dev` (Vite only reads `.env` at startup).
4. Log in with your **Company DB**, user name and password.

> **Never commit `.env`.** It holds your server address. Make sure `.env` is listed in `.gitignore`.

**Why a proxy?** The Service Layer does not send CORS headers and usually uses a self-signed certificate. In development, Vite forwards every `/b1s/...` request to `SL_TARGET`, so the browser only talks to Vite.

### Production build

```bash
npm run build      # output goes to dist/
npm run preview    # test the build locally
```

Serve `dist/` behind a reverse proxy (nginx, IIS, ...) that forwards `/b1s` to the Service Layer in the same way, over HTTPS.

### Scripts

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |

## How the screen works

| Mode | How you get there | What the buttons do |
| ---- | ----------------- | ------------------- |
| **Find** (yellow fields) | Start screen, `Data > Find`, Cancel | **Find** searches with the fields you filled in |
| **Add** | `Data > Add` | **Add** creates the PO, **Add Draft & New** saves a draft and clears the form |
| **View** | After Find or Add | **OK** returns to Find, **Edit** unlocks an open PO |
| **Edit** | **Edit** in View mode | **Update** saves the changes, **Cancel** discards them |

### Find

- **Vendor code** and **document number** match by prefix (typing `12` also finds `120` to `129`, `1200` and so on).
- **Vendor name** matches any part of the name. Everything else (series, vendor reference, branch, buyer, owner, dates, status, type) is an exact match.
- Fields are combined with AND. An empty form lists every purchase order.
- One match opens the document, several matches open a pick list.

### Add

1. Choose **Item** or **Service** in *Item/Service Type* (changing it clears the lines).
2. Enter the vendor code. Leaving the field loads the vendor name and its contact persons.
3. Fill in the branch, delivery date, buyer, owner and the lines. Leaving an item code or G/L account field looks it up.
4. Click **Add** (real document) or **Add Draft & New** (draft).

### Edit and Update

Only **open** purchase orders can be edited.

- Can change: contact person, vendor reference, delivery date, document date, budget amount, buyer, owner, remarks, and on lines everything except the item code or G/L account of a saved line. New lines can be added at the bottom.
- Locked: vendor, series and number, status, currency, branch, posting date, discount, freight, rounding, item/service type.
- Not supported yet: deleting a line.

### Validation

Checked in the browser, before anything is sent to SAP:

- Vendor code and delivery date are required.
- A branch is required when the company has branches.
- At least one filled line. Items need a quantity above 0, services need a valid G/L account and a total above 0.
- A line's warehouse must belong to the document's branch. An item's default warehouse is only filled in when it fits the branch.
- The contact person must be active. Only active buyers, owners and branches are offered when adding.

## Configuration

Company-specific settings live in `src/config.js`. **Review these before using the project on another SAP company.**

| Setting | Meaning |
| ------- | ------- |
| `DEFAULT_TAX_CODE` | Tax code (`VatGroup`) pre-filled on new lines |
| `FREIGHT_EXPENSE_CODE` | Code of the "Freight" additional expense, used when a freight amount is entered |
| `MIN_GRID_ROWS` | Number of grid rows drawn even when there are fewer lines |
| `SERVICE_EXTRA_COLUMNS` | Extra user-defined fields shown on **service** lines |
| `BUDGET_COLUMNS` | Project budget fields shown on **every** line (`ProjectCode`, `U_PBDEntry`, `U_PBDLine`) |

The header field `U_BudgetAmount` and the user-defined fields in `SERVICE_EXTRA_COLUMNS` and `BUDGET_COLUMNS` exist in the SAP company this form was built for. If your company does not have them, remove them from `config.js` (and `U_BudgetAmount` from the mapper and `Header.jsx`), or SAP will reject the document.

To add another column, add one line to the matching list in `config.js`:

```js
{ key: 'subJob', label: 'Sub Job', udf: 'U_subjob', width: 110 }
```

`key` is the name in the form state, `udf` / `field` is the name in the Service Layer, and `numeric: true` sends the value as a number.

## Project structure

```
src/
  api/
    serviceLayer.js          every HTTP call (login, PurchaseOrders, Drafts, lookups ...)
    purchaseOrderMapper.js   form state <-> Service Layer JSON, validation, Find filter
    mockServiceLayer.js      the fake Service Layer used in demo mode
    errors.js                error type for Service Layer failures
  hooks/
    usePurchaseOrder.js      form state and all actions (find, add, edit, update, lookups)
  components/
    pages/PurchaseOrder.jsx  the page, ties the pieces together
    purchase-order/          Header, Tabs, Items (grid), Footer, Actions, modals
    layout/                  MenuBar, StatusBar
    LoginDialog.jsx
  config.js                  company-specific settings
```

How the pieces connect: the **page** draws the form, the **hook** holds the purchase order and decides what happens on each click, the **mapper** translates between the form and what SAP understands, and **serviceLayer.js** sends the requests.

## Troubleshooting

SAP's own error messages are shown in the status bar.

| Message | What it means |
| ------- | ------------- |
| No purchase order matches the search criteria | Nothing matches. In demo mode only the sample data exists. |
| Inactive sales employee [OPOR.SlpCode] | The buyer, or the vendor's default sales employee, is inactive. Pick an active buyer. |
| Specify an active branch [OPOR.BPLId] | No branch chosen, or the branch is disabled. |
| Warehouse is not assigned to the same branch as the document | Choose a warehouse that belongs to the selected branch. |
| Add the active contact person [OPOR.CntctCode] | The saved contact person is inactive. Choose an active one. |
| Please Enter Budget Amount | A company rule requires the Budget Amount field. |
| Invalid query option: key value is not matched with its type | A request used a text value where SAP expects a number (for example a document key). |

## Limitations

- Only the **Contents** tab works. Logistics, Accounting, Electronic Documents and Attachments are placeholders.
- **Copy From**, **Copy To** and **Summary Type** are shown but disabled.
- Lines cannot be deleted when updating a purchase order.
- Demo mode does not support service orders or updating.