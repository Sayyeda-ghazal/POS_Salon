# Offline POS Complete App Documentation

## App Summary

Offline POS is a desktop point-of-sale app built with Electron, React, Vite, and SQLite. It is designed to work locally first, keep business data on the machine, and optionally sync to Neon when configured.

The app combines these workflows in one system:

- Product checkout
- Service and package billing
- Customer management
- Loyalty tracking
- Inventory control
- Revenue and activity reporting
- Salon branding and loyalty settings
- Local backup and restore

## Architecture

- Renderer UI: `src/App.tsx`
- Electron main process: `electron/main.ts`
- Local database and business logic: `electron/db.ts`
- Optional sync layer: `electron/sync.ts`
- Shared types: `electron/schema.ts`

## Data Stored Locally

The SQLite database stores:

- Products
- Sales and sale items
- Visits
- Customers
- Loyalty transactions
- Services
- Inventory movements
- Sync queue records
- App settings

## Global Behavior

- The app works offline by default.
- SQLite is the source of truth.
- Sync to Neon is only enabled when `NEON_DATABASE_URL` is set.
- Printed receipts use salon branding from settings.
- Many workflows refresh the same shared local data after a save.

## Screen Overview

- Dashboard
- Customers
- Billing
- POS
- Reports
- Services
- Inventory
- Settings

## Dashboard

### Purpose

The Dashboard gives the front desk a quick operational snapshot.

### What It Shows

- Total customers
- Visits today
- Revenue today and this month
- Loyalty points total
- Recent visits

### Working Flow

1. The app loads dashboard data on startup.
2. Summary cards show customer, visit, revenue, and loyalty counts.
3. Quick actions let the user jump to customer creation, visit logging, billing, services, and reports.
4. Recent visit rows show customer name, service, notes, amount, and points earned.

### Actions

- New Bill
- Services
- Reports
- Add Customer
- New Visit

## Customers

### Purpose

The Customers screen manages customer profiles and loyalty history.

### Main Parts

- Search by name or phone
- Customer profile panel
- Favorite services
- Recent visits
- Loyalty activity
- Edit, redeem, delete, and clear actions

### Working Flow

1. Search the customer directory.
2. Select a customer from the list.
3. Review profile stats, favorite services, and recent visit history.
4. Edit the customer if needed.
5. Redeem loyalty points if needed.
6. Delete the customer to hide them from active lists.

### Customer Modal Flows

- Add customer
- New visit
- Edit customer
- Redeem loyalty

## Billing

### Purpose

The Billing screen is for service-based billing and recent bill review.

### Main Parts

- Service card grid
- Selected services draft
- Total amount summary
- Saved bills list

### Working Flow

1. Select one or more service cards.
2. The selected services area updates automatically.
3. Review the running total.
4. Open the bill modal to select a customer and finalize the bill.
5. Save the bill locally.
6. Refresh the recent bills list.

### Notes

- Billing is service-oriented.
- It overlaps with POS in that both can lead to customer-linked transactions, but Billing is centered on service packages.

## POS

### Purpose

The POS screen is the retail checkout flow for products.

### Main Parts

- Search field
- Product grid
- Cart panel
- Totals
- Generate invoice action
- Recent bills list

### Working Flow

1. Search products by name, SKU, barcode, or category.
2. Tap a product or scan a barcode to add it to the cart.
3. Adjust quantities as needed.
4. Review subtotal, tax, and total.
5. Generate the invoice.
6. Print the receipt.
7. Refresh dashboard, reports, inventory, sales, and bills.

### Barcode Flow

- The app buffers barcode input while POS or Billing is active.
- Pressing Enter after a barcode string looks up the matching product and adds it to the cart.

### Notes

- POS is the product checkout side of the app.
- It reduces stock when a sale is created.

## Reports

### Purpose

The Reports screen summarizes business activity.

### Report Sections

- Revenue
- Customers
- Visits
- Loyalty

### Working Flow

1. The app loads report data from SQLite.
2. Revenue cards show sales totals, tax, discounts, average sale value, and top payment method.
3. Customer cards show total customers, active customers, new customers this month, and top customers.
4. Visit cards show total visits, visits today, manual visits, sale visits, and top services.
5. Loyalty cards show earned points, redeemed points, outstanding balance, and top balances.

### Notes

- Reports are read-only.
- They are derived from the existing local records.

## Services

### Purpose

The Services screen manages treatment and package templates.

### Main Parts

- New service form
- Active services list

### Working Flow

1. Enter a service code, name, description, and price.
2. Save the service.
3. The service appears in the active services list.
4. The service becomes available in visit and billing workflows.

### Notes

- Services are separate from products.
- They are used for salon-style work and package billing.

## Inventory

### Purpose

The Inventory screen manages product stock.

### Main Parts

- New product form
- Active items table
- Stock adjustment controls
- Deleted items section

### Working Flow

1. Add a product with SKU, barcode, name, category, price, stock, and tax rate.
2. Review active inventory.
3. Adjust stock manually.
4. Soft delete a product to hide it from the POS.
5. Optionally view deleted items.
6. Permanently delete items that were already soft deleted.

### Notes

- Active inventory is what the POS uses.
- Stock changes are tracked in inventory movements.

## Settings

### Purpose

The Settings screen controls salon branding, loyalty rules, and database maintenance.

### Main Parts

- Salon info form
- Loyalty rules form
- Backup database action
- Restore database action

### Working Flow

1. Edit salon name, tagline, phone, email, and address.
2. Save the salon profile.
3. Edit loyalty earning and redemption rules.
4. Save the loyalty configuration.
5. Back up the SQLite database.
6. Restore the database from a backup file when needed.

### Receipt Impact

- Salon info appears on printed receipts.
- Loyalty rules affect points earned and redeemable thresholds.

## Shared Modal Workflows

### Add Customer

1. Open from Dashboard or Customers.
2. Enter customer details.
3. Save the customer.

### New Visit

1. Open from Dashboard or Customers.
2. Search for a customer or use Walk-in.
3. Select a service package.
4. The amount is auto-filled unless manual override is enabled.
5. Save the visit.

### New Bill

1. Open from Billing or POS.
2. Search for a customer.
3. Use the selected services already staged on the Billing screen.
4. Add optional notes.
5. Save the bill.

### Edit Customer

1. Open from a selected customer profile.
2. Update profile fields.
3. Save changes.

### Redeem Loyalty

1. Open from a selected customer profile.
2. Enter points to redeem.
3. Save to subtract points and log the transaction.

## Key Data Flows

- Creating a sale reduces stock and records sale items.
- Creating a visit updates customer visit history and loyalty points.
- Creating a bill records a service transaction and links it to a customer.
- Editing customer settings updates the local customer record.
- Redeeming loyalty creates a loyalty transaction and reduces the customer balance.
- Backing up and restoring works on the local SQLite database file.

## Sync Behavior

- Sync is optional.
- The sync service watches for pending records in the queue.
- When Neon is configured, it attempts to push queued sales, inventory movements, customers, and visits.
- If Neon is not configured, the app stays offline and local-only.

## Current Shape Of The App

This app is broad for one codebase, but the main idea is consistent: keep point-of-sale, customer, inventory, billing, and reporting data in one local offline-first desktop app.

The main thing to watch is not the feature set itself, but keeping the shared data and screen flows clean and consistent as the app grows.

