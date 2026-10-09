// Company-specific defaults. Change these to match your SAP Business One setup.

// Tax code (VatGroup) pre-filled on new item lines.
export const DEFAULT_TAX_CODE = 'P1'

// Code of the "Freight" additional expense in Administration > Setup > Purchasing > Freight.
// Only used when a freight amount is entered.
export const FREIGHT_EXPENSE_CODE = 1

// Number of grid rows drawn even when there are fewer lines (SAP-style empty grid).
export const MIN_GRID_ROWS = 10

// Extra user-defined fields shown on SERVICE lines.
//   key   = field name in the form state
//   udf   = field name in the Service Layer (U_ + the UDF's alias)
// To add a column later, add one line here.
export const SERVICE_EXTRA_COLUMNS = [
  { key: 'subJob', label: 'Sub Job', udf: 'U_subjob', width: 110 },
  { key: 'detailDescription', label: 'Detail Description', udf: 'U_DetailDescription', width: 200 },
  { key: 'purchaseCategory', label: 'Purchase Category', udf: 'U_Category', width: 130 },
  { key: 'projectName', label: 'Project Name', udf: 'U_PrjName', width: 140 },
]

// Project budget fields on every line (item and service).
//   key   = field name in the form state
//   field = field name in the Service Layer
//   numeric: true sends a number; remove it if that UDF is a text field in SAP
export const BUDGET_COLUMNS = [
  { key: 'project', label: 'Project', field: 'ProjectCode', width: 90 },
  { key: 'budgetEntry', label: 'Budget Entry', field: 'U_PBDEntry', width: 100, numeric: true },
  { key: 'budgetLine', label: 'Budget Line', field: 'U_PBDLine', width: 90, numeric: true },
]