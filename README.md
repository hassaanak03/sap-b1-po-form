# Purchase Order form (SAP Business One)

React + Vite form that looks like the SAP Business One **Purchase Order** window and reads/writes
real documents through the **Service Layer**.

## Run it

```bash
npm install
npm run dev
```

### No SAP credentials yet? Use demo mode

`npm run dev` starts in **demo mode** by default: a fake Service Layer runs inside the browser
(`src/api/mockServiceLayer.js`), so the login accepts any company / user / password and the whole form
works. Sample data: vendors `V10000`, `V10001` (and `C20000`, a customer, to see the "not a vendor" error),
items `ITEM001`-`ITEM003`, and one saved purchase order. Orders you add are kept in the browser's
localStorage. Tax is made up (code `P1` = 10%). An orange "Demo data" tag in the status bar shows when
demo mode is on.

### Switching to the real Service Layer

```bash
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
```

In `.env` set `VITE_USE_MOCK=false` and `SL_TARGET=https://your-server:50000`, then restart `npm run dev`
(Vite only reads `.env` at startup). Log in with your real Company DB, user name and password.

Why a proxy? Service Layer does not send CORS headers and usually uses a self-signed certificate.
In development, Vite forwards `/b1s/...` to `SL_TARGET`, so the browser only talks to Vite.
For production put the built `dist/` behind a reverse proxy (nginx, IIS...) that forwards `/b1s` the same way.

## How the screen works

| Mode | How you get there | What the buttons do |
| ---- | ----------------- | ------------------- |
| Find (yellow fields) | Start screen, `Data > Find`, Cancel | **Find** loads the newest PO matching what you typed (empty form = newest PO) |
| Add | `Data > Add` | **Add** creates the PO (`POST /PurchaseOrders`), **Add Draft & New** saves a draft (`POST /Drafts`) |
| View | After Find / Add | **OK** or **Cancel** returns to Find |

## Where things are

- `src/api/serviceLayer.js` - every HTTP call (login, PurchaseOrders, Drafts, BusinessPartners, Items, lookups)
- `src/api/purchaseOrderMapper.js` - form state <-> Service Layer JSON, validation, Find filter
- `src/hooks/usePurchaseOrder.js` - form state and actions
- `src/config.js` - default tax code, freight expense code
- `src/components/purchase order/` - Header, Tabs, Items (grid), Footer, Actions
