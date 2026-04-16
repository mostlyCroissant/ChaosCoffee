# Coffee Runner

A lightweight phone-friendly internal web app for managing coffee orders during events.

## What this version does
- Loads events and guest lists from Google Sheets
- Lets staff tap a guest, use their usual drink, and add today's changes
- Builds a Japanese order string for the cafe
- Stores the cart and collected checkboxes locally in the phone browser

## Why this setup
This version is intentionally simple:
- **Google Sheets** = easy for assistants to maintain
- **Static web app** = easy to deploy to Netlify, Vercel, GitHub Pages, or any static host
- **LocalStorage for cart state** = no backend needed yet

## Spreadsheet structure
Create one Google Spreadsheet with two tabs:

### 1) Events
Use the columns from `sheet-template-events.csv`.

Required columns:
- `event_id`
- `event_name`
- `event_date`
- `location`
- `is_current`

### 2) Guests
Use the columns from `sheet-template-guests.csv`.

Required columns:
- `guest_id`
- `event_id`
- `guest_name`
- `search_terms`
- `usual_order_label`
- `usual_order_summary_en`
- `usual_order_summary_jp`
- `usual_orders_json`
- `internal_note`

`usual_orders_json` should contain a JSON array, for example:

```json
[
  {
    "id": "usual",
    "label": "Hot latte (usual)",
    "summary_en": "Hot latte",
    "summary_jp": "ホットラテ"
  },
  {
    "id": "alt",
    "label": "Black coffee M",
    "summary_en": "Black coffee M",
    "summary_jp": "ブラックコーヒー Mサイズ"
  }
]
```

## Google Apps Script setup
1. Open the Google Spreadsheet.
2. Go to **Extensions → Apps Script**.
3. Replace the default code with the contents of `google-apps-script/Code.gs`.
4. Replace `appsscript.json` with the included file if you want matching settings.
5. Deploy as a **Web App**:
   - Execute as: **Me**
   - Who has access: **Anyone with the link**
6. Copy the deployed Web App URL.

## Frontend setup
1. Copy `config.example.js` to `config.js`.
2. Paste your Apps Script Web App URL into `SHEETS_ENDPOINT`.
3. Deploy `index.html`, `styles.css`, `app.js`, and `config.js` to any static host.

## Local testing
Because browsers can block file-based fetches, test with a local server.

Examples:
- `python3 -m http.server 8000`
- or use the local preview in your editor

Then open:
- `http://localhost:8000`

## Hosting options
This app can be deployed as a static site on:
- Netlify
- Vercel
- GitHub Pages
- Cloudflare Pages

## Current limitations
- Cart state is local to the browser on that phone
- Collected checkboxes do not sync back to Google Sheets
- No login or user management
- No editing of guest data inside the app

## Good next step later
If you want, the next iteration can write the cart and status back into Google Sheets through Apps Script so the phone checklist is preserved outside the browser.
