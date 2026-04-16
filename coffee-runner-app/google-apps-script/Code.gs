/**
 * Coffee Runner data endpoint.
 *
 * Required sheet tabs:
 *  - Events
 *  - Guests
 *  - StarbucksMenu
 *
 * Deploy as Web App:
 *  Execute as: Me
 *  Who has access: Anyone with the link
 */

const EVENTS_SHEET_NAME = 'Events';
const GUESTS_SHEET_NAME = 'Guests';
const STARBUCKS_SHEET_NAME = 'StarbucksMenu';

function doGet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const payload = {
    events: readSheetAsObjects_(spreadsheet.getSheetByName(EVENTS_SHEET_NAME)),
    guests: readSheetAsObjects_(spreadsheet.getSheetByName(GUESTS_SHEET_NAME)),
    starbucks_menu: readSheetAsObjects_(spreadsheet.getSheetByName(STARBUCKS_SHEET_NAME)),
    generated_at: new Date().toISOString(),
  };

  return jsonResponse_(payload);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action;

    if (action === 'add_guest') {
      return addGuest(body);
    }

    return jsonResponse_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function readSheetAsObjects_(sheet) {
  if (!sheet) {
    throw new Error('Missing required sheet tab.');
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map((header) => String(header).trim());

  return values.slice(1)
    .filter((row) => row.some((cell) => String(cell).trim() !== ''))
    .map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = row[index];
      });
      return record;
    });
}

function addGuest(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(GUESTS_SHEET_NAME);

  if (!sheet) {
    throw new Error('Guests sheet not found');
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 1) {
    throw new Error('Guests sheet is missing a header row');
  }

  const headers = values[0].map((h) => String(h).trim());

  const guestIdCol = headers.indexOf('guest_id');
  if (guestIdCol === -1) {
    throw new Error('Missing guest_id column in Guests sheet');
  }

  let maxNum = 0;
  for (let i = 1; i < values.length; i++) {
    const raw = String(values[i][guestIdCol] || '').trim();
    const match = raw.match(/^GUEST-(\d+)$/);
    if (match) {
      maxNum = Math.max(maxNum, Number(match[1]));
    }
  }

  const guestId = `GUEST-${String(maxNum + 1).padStart(3, '0')}`;

  const name = String(body.guest_name || '').trim();
  const drink = String(body.drink || '').trim();
  const eventId = String(body.event_id || '').trim();

  if (!name) throw new Error('guest_name is required');
  if (!drink) throw new Error('drink is required');
  if (!eventId) throw new Error('event_id is required');

  const rowObject = {
    guest_id: guestId,
    guest_name: name,
    event_id: eventId,
    usual_order_label: drink,
    usual_order_summary_en: drink,
    usual_order_summary_jp: '',
    usual_orders_json: JSON.stringify([
      {
        id: 'default',
        label: drink,
        summary_en: drink,
        summary_jp: '',
      }
    ]),
  };

  const row = headers.map((header) => rowObject[header] ?? '');
  sheet.appendRow(row);

  return jsonResponse_({ ok: true, guest_id: guestId });
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}