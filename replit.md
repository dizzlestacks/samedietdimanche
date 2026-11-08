# Samedi Et Dimanche

A luxury website for the Samedi Et Dimanche brand with a shared PayPal watch/clothing checkout.
Tagline: "WHERE THE WEEK ENDS"

## Design System

- **Typography**: Cormorant Garamond (serif, display) + Montserrat (sans-serif, labels)
- **Palette**: Near-black (#080808), off-white (#f0ece4), rose gold (#C4956A), crimson (#8B1A2A), green (#4a9e5c) on bud page
- **Style**: High-fashion luxury — minimal, animated, mobile-first
- **Petals**: Rose/crimson CSS div petals on waitlist pages; botanical PNG petals on bud/shop pages

## Tech Stack

- **Backend**: Node.js + Express (port 5000)
- **Payments**: PayPal only. Direct Orders v2, CAD, server-priced shared cart. Do not restore Stripe.
- **Resend transport**: Replit-hosted email can use `RESEND_USE_CONNECTOR=true` with the connected Resend integration and an explicit verified `EMAIL_FROM`. External hosting can use `RESEND_API_KEY` with `EMAIL_FROM` instead; leave connector mode off there. Never switch transports after an uncertain send. A sending-only Resend key cannot list verified domains; a denied domain-list read does not mean sending credentials are invalid. No default onboarding sender.
- **Payment reliability**: `PAYMENT_RECONCILIATION_ENABLED=true` starts a minute-based GET-only PayPal reconciliation worker (25 due orders per run, independent of the newest-100 admin list). It never initiates capture; uncertain payments retain inventory. `ORDER_EMAIL_ENABLED=true`, Resend, `EMAIL_FROM`, and HTTPS `PUBLIC_URL` enable confirmation emails for newly created eligible checkouts only. Keep these flags off in test/preview environments. Never retry ambiguous sends automatically. These are explicit activation flags, not active merely because PayPal credentials exist.
- **Database**: PostgreSQL for application data and payment records.
- **Frontend**: Static HTML/CSS/JS

## Project Structure

### Pages
- `index.html` — Waitlist landing page: black+rose gold, watch dial hero, email capture, Instagram link, WATCHES nav (BUD page still exists but is no longer linked from the landing nav)
- `bud.html` — Bud collection page with MENU, FAQ, CONTACT nav links (Canada-only geo-blocked)
- `budmenu.html` — Cannabis menu page with filterable product grid (Flower, Pre-Rolls, Edibles, Concentrates, Vapes)
- `watches.html` — Watches page: same waitlist layout with the dial grid photo, "Coming Soon", email capture
- `shop.html` — Shop hub page with sub-links: Clothing, Watches, Socials
- `clothing.html` — Clothing collection page with product grid and image zoom
- `socials.html` — Socials page with Instagram link
- `admin.html` — Admin dashboard, local catalog management, PayPal orders, settings, and waitlist tools.

### Server
- `server/index.js` — Express server, API routes, static file serving
- `server/paypalRoutes.js` — PayPal checkout, order management, and verified receipts
- `server/budMenuDb.js` — PostgreSQL CRUD for bud menu items (bud_menu_items table)

### Styles
- `css/index.css` — Shared base styles (gradient, nav, footer, petals)
- `css/bud.css` — Bud page styles
- `css/budmenu.css` — Bud menu page styles (menu grid, strain badges, modal)
- `css/shop.css` — Shop page styles (product grid, modal, toast, image zoom)
- `css/admin.css` — Admin panel styles (image upload area)

### JavaScript
- `js/petals.js` — Shared petal animation (ambient falling watercolor petals)
- `js/shop.js` — Shop page logic (catalog, shared cart, product details, image zoom)
- `js/budmenu.js` — Bud menu page logic (loads from API, category filters, detail modal)
- `js/admin.js` — Admin panel logic for catalog, orders, settings, and waitlist

### Assets
- `img/newlogo.png` — Brand logo
- `img/bud-bg.png` — Cannabis background for bud page
- `img/petal1-5.png` — Watercolor botanical petals
- `img/product1-6.png` — Product images for shop page
- `img/bud1-9.png` — Cannabis product images for bud menu
- `img/uploads/` — User-uploaded product images from admin panel

## Navigation

- **BUD** → `bud.html` → Menu, FAQ, Contact
- **SHOP** → `shop.html` → Clothing, Watches, Socials

## API Endpoints

- `GET /api/products` — List active local catalog products
- `POST /api/checkout` — Create a server-priced PayPal order from the shared cart
- `GET /api/config` — PayPal provider and checkout availability (no credentials)
- `GET /api/admin/products` — List all products (including inactive) for admin
- `POST /api/admin/upload` — Upload a product image (multipart form, field: `image`)
- `POST /api/admin/products` — Create a new product (body: `{ name, description, price, badge, image }`)
- `PUT /api/admin/products/:id` — Update a product (body: `{ name, description, price, badge, active, image }`)
- `DELETE /api/admin/products/:id` — Deactivate a product
- `GET /api/bud-menu` — List active bud menu items (public)
- `GET /api/admin/bud-menu` — List all bud menu items (admin)
- `POST /api/admin/bud-menu` — Create a bud menu item
- `PUT /api/admin/bud-menu/:id` — Update a bud menu item
- `DELETE /api/admin/bud-menu/:id` — Delete a bud menu item

## Private preorder invitations — Update 39

- Admin Waitlist has a separate recipient selection, expiry picker, server review and explicit send confirmation. Up to 50 consented members in one category; no automatic selection, import delivery or automatic retries.
- Signup consent is recorded for new public signups (including re-signups). Historical and imported contacts without recorded signup consent are ineligible; CSV import permission is not assumed to be email invitation consent.
- Uses the existing Resend configuration and signed preorder credentials. Category enabled state, revocation, expiry, shipping estimate and recipient consent are rechecked before each delivery. Provider errors are sanitized; accepted means provider acceptance, not inbox delivery.
- Reviews expire in ten minutes and are consumed once before sending. They are process-local: after restart or on another server, review again. If a response is lost, check the provider before preparing another batch; there is no durable invitation history yet.
- Verification: `node --test tests/*.test.js` and `python tests/preorder-invitations-browser.py` use synthetic credentials and mocked email delivery; no real invitation is sent.

## Running the Project

```
node server/index.js
```

## Seeding Products

```
node server/seed-products.js
```

## Deployment

Configured as a static site deployment with the root directory (`.`) as the public directory.
For PayPal, configure PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and PAYPAL_ENV (live or sandbox) separately in each deployed environment. Never put credentials in the deployment ZIP.

## Checkout — Update 19

- Cart shipping form → server totals → PayPal approval → server-verified capture.
- Free worldwide shipping. Canadian GST/HST only, based on shipping province; Nova Scotia 14%, Ontario 13%, NB/NL/PE 15%, other provinces/territories 5%. Rates verified against CRA on 2026-10-11.
- Exports dispatched from Canada have 0% Canadian GST/HST; international import duties/local taxes are not collected by this integration. No unconfirmed PST/QST or foreign registration is assumed. Confirm applicability with the business's tax adviser, especially product exemptions and new registrations.
- Orders persist in PostgreSQL (paypal_orders); without a configured database, the existing DATA_DIR file-storage convention is used. Production must have a durable database or persistent DATA_DIR; never rely on an ephemeral filesystem for payment records. Database outages fail checkout rather than silently falling back.
- Admin Orders includes status, order reference, exact watch selections, quantities and shipping address. Pending captures are not treated as paid.
- PayPal quote/create/capture/cancel routes enforce shop closure, watch waitlist/preview gates, server prices and checkout ownership. Capture retries reuse PayPal request IDs.
- Tests use a simulated provider and isolated orders. Live credentials were authenticated, but no real purchase/capture has been made. Run a sandbox buyer approval test before publishing.
- Refunds and disputes are managed in PayPal; webhook-based status synchronization is not yet implemented.

## Preorder shipping — Update 37

- Orders keep payment and shipping separate. Regular and preorder items have independent fulfillment groups, each with status, carrier, tracking number, HTTPS tracking link and private notes. Original checkout fulfillment promises remain visible.
- Shipping email is opt-in: `SHIPPING_EMAIL_ENABLED=true`, `RESEND_API_KEY` and an explicit `EMAIL_FROM` are all required. Saving shipping never sends an email; use Notify customer after saving shipped/delivered status.
- Notification claims are persisted before calling Resend, with a provider idempotency key. Each group can be notified once. An unconfirmed send or interrupted process must be checked in the provider dashboard and handled manually; no automatic resend is allowed.
- Why: external email delivery and order persistence cannot be committed atomically. Blocking ambiguous retries prioritizes avoiding duplicate customer notifications, including after a crash or provider idempotency expiry.
- Each group ships as a whole; multiple parcels or quantity-level partial dispatch within one group are not supported. Tracking corrections can be saved without sending a second email. Provider acceptance is not proof of inbox delivery.
- Verification: `node --test tests/*.test.js` and `python tests/order-fulfillment-browser.py` use isolated order data and synthetic credentials; no live payment or email is sent.

## Clothing variants — Update 30

- Admin-managed clothing options use stable variant IDs, size, color, enabled status and remaining stock. Empty variant lists preserve legacy products without options. All variants share the product's CAD price.
- Product detail requires an available size/color combination. Cart identity and persisted order lines retain the selected variant; checkout derives labels, prices and stock from the server.
- Stock is deducted atomically just before PayPal capture, with a durable per-order claim preventing duplicate deductions. Cart/approval creation does not reserve stock. Normal cancellation is allowed only before any inventory claim exists.
- Ambiguous or pending payments keep their stock reserved until provider reconciliation; never release a reservation just because a network request failed or a subsequent PayPal snapshot still says APPROVED. A durable inventory claim blocks normal cancellation, including after server restart. No automatic timeout release or refund restocking is implemented.
- Inventory uses PostgreSQL row locks or the single-process atomic file-store queue. Multi-instance deployments require PostgreSQL. Admin stock edits set remaining sellable stock, not original stock.
- Admin variant saves require the inventory revision returned with the product; a concurrent stock or option change rejects the whole stale save. Reopen the product to review the latest stock before retrying.
- Verification: `node --test tests/*.test.js`; `python tests/clothing-variants-browser.py` uses a disposable Chromium CDP session on port 9222 and mock APIs only. Real signed-in admin access and a live buyer payment are not exercised by that browser fixture.
- Gallery browser verification: `python tests/product-gallery-browser.py` launches its own temporary server and Chromium profile (requires Chromium on PATH or `CHROMIUM_BIN`). It uses synthetic Basic authentication on one CDP connection and tests actual multipart uploads, pending/failed save protection, retry/removal, cover/order, create/update and fresh-page reopen. Only intentional upload failures are mocked. The temporary app root, catalog, and uploads are removed on exit; production credentials, databases, products and upload files are never used.
