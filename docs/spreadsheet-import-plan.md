# Spreadsheet import plan (for Phase 3)

Field mapping from the existing Google Sheets prototype to the database. The source spreadsheet is never modified.

## Products tab → `products` and `comparable_groups`
| Sheet column | Destination | Notes |
|---|---|---|
| Product ID | `products.external_id` | Kept for traceability (P001…). |
| Product | `products.generic_name` | As is. |
| Category | `products.category` | As is. |
| Brand | `products.brand` | Blank → null. |
| Receipt size description | `receipt_aliases.raw_description` | Creates an alias pointing at the product. Retailer is inferred from the Purchases tab. |
| Barcode | `products.barcode` | |
| Comparable Group | `comparable_groups.name` | One group per distinct value. Base unit must be assigned per group; the importer pre-fills obvious ones (Eggs → each, Peanut Butter → g, Bananas → g) and flags the rest with `missing_comparable_group` details for you to confirm. |
| Comparable Unit + Comparable Quantity | `products.amount_per_item` / `pack_count` | Only imported when the unit is a real measure (`g`, `kg`, `ml`, `L`/`litre`, `each` with a count). Container words (`pack`, `tub`, `punnet`, `bottle`, `each` with quantity 1) import as null and are flagged `missing_pack_count` or `missing_weight_or_volume`. |
| Include in core analysis | `products.include_in_analysis` | |
| Manual review | `products.review_required` + `imported_needs_check` | |
| Notes | `products.notes` | |
| Active | `products.archived_at` | FALSE → archived. |

## Receipts tab → `receipts`
| Sheet column | Destination | Notes |
|---|---|---|
| Receipt ID | `receipts.external_id` | |
| Date | `receipts.transaction_date` | Year is missing except DS001. Importer assumes the year given in the mapping preview (2026) and flags `imported_needs_check`. |
| Shop | `receipts.retailer_id` + `receipts.store_location` | Split on the first " - " or on a known retailer prefix: "Lidl Bray - Boghall Road" → retailer Lidl, branch "Bray, Boghall Road". Unmatched retailer names are listed in the preview. |
| Basket Total | `receipts.subtotal_before_discounts` | |
| Voucher | `receipt_discounts` rows (type `basket_voucher`) and `receipts.basket_discounts_total` | €20 on DS001 imports as one pooled voucher unless you split it in the preview. |
| Final Paid | `receipts.total_paid` | |
| Voucher % | not imported | Recomputed as `voucher_efficiency`. |

## Purchases tab → `receipt_lines`
| Sheet column | Destination | Notes |
|---|---|---|
| Receipt ID | `receipt_lines.receipt_id` | Joined via `receipts.external_id`. |
| Product ID | `receipt_lines.product_id` | Joined via `products.external_id`. |
| Qty | `quantity` | Decimal quantities (1.165 kg bananas) are allowed. |
| Shelf Price | `listed_unit_price` | |
| Item Discount | `item_discount` | Per line, as in the sheet. |
| Effective Price | `net_line_price` | Also stored in `original_values`. |
| Voucher Eligible | `voucher_eligible` | |
| Voucher Allocation / Final Item Cost | `original_values` only | Recomputed by the price engine; sheet values kept for comparison. |
| Unit Price Before/After Voucher | `original_values` only | Not imported as data: these are on inconsistent bases in the sheet. |
| Include in Core Analysis | `include_in_analysis` | |
| Date / Shop | validation only | Must agree with the receipt row; mismatches go in the error report. |

Deposit rows (P028) import with `is_deposit = true`, `deposit_amount = qty × price` and `include_in_analysis = false`.

## Aliases tab → `receipt_aliases`
Only "Receipt Description" and "Product ID" are used. The "Normalized Product" column is ignored because it folds the brand into the name.

## Preview and validation (built in Phase 3)
- Missing mandatory fields, unmatched retailers, product conflicts and probable duplicates are shown before anything is written.
- Valid rows import; invalid rows are listed in a downloadable row-level error report and skipped.
- Every imported record carries `external_id` and an `import_batches` row.
