const SHEET_NAME = 'MasterData';
const LISTS_SHEET_NAME = 'Lists';
const TRANSACTION_PREFIX = 'GM_';
const TRANSACTION_PAD_LENGTH = 7;

const HEADERS = [
  'Timestamp',
  'Transaction Number',
  'Date',
  'Courtesy Car',
  'Customer / User Name',
  'Mobile No.',
  'Vehicle / Plate No.',
  'EID',
  "Driver's License",
  'Release Form',
  'Job Card No.',
  'Mileage',
  'Date / Time Released',
  'Date / Time Returned',
  'Service Advisor',
  'Remarks'
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const payload = JSON.parse(e.postData.contents || '{}');

    if (payload.mode === 'updateReturn') {
      return json_(updateReturnedDateTime_(payload));
    }

    const sheet = getMasterDataSheet_();
    const transactionNumber = getNextTransactionNumber_(sheet);
    const row = buildRow_(payload, transactionNumber);
    sheet.appendRow(row);

    return json_({
      ok: true,
      row: sheet.getLastRow(),
      transactionNumber
    });
  } catch (error) {
    return json_({
      ok: false,
      error: error.message || String(error)
    });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || '');

  if (action === 'lists') {
    return json_({
      ok: true,
      courtesyCars: getListValues_(1),
      serviceAdvisors: getListValues_(2)
    });
  }

  if (action === 'nextTransaction') {
    return json_({
      ok: true,
      transactionNumber: getNextTransactionNumber_(getMasterDataSheet_())
    });
  }

  if (action === 'search') {
    return json_(findEntryByTransaction_((e.parameter && e.parameter.transactionNumber) || ''));
  }

  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Courtesy Car Monitoring')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function saveEntryFromForm(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getMasterDataSheet_();
    const transactionNumber = getNextTransactionNumber_(sheet);
    const row = buildRow_(payload || {}, transactionNumber);
    sheet.appendRow(row);

    return {
      ok: true,
      row: sheet.getLastRow(),
      transactionNumber
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message || String(error)
    };
  } finally {
    lock.releaseLock();
  }
}

function getListsForForm() {
  return {
    ok: true,
    courtesyCars: getListValues_(1),
    serviceAdvisors: getListValues_(2)
  };
}

function getNextTransactionForForm() {
  return {
    ok: true,
    transactionNumber: getNextTransactionNumber_(getMasterDataSheet_())
  };
}

function findEntryByTransaction_(transactionNumber) {
  const sheet = getMasterDataSheet_();
  const rowNumber = findTransactionRow_(sheet, transactionNumber);

  if (!rowNumber) {
    return {
      ok: false,
      error: 'Transaction number not found.'
    };
  }

  const values = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getValues()[0];
  const entry = {};

  HEADERS.forEach((header, index) => {
    entry[header] = values[index];
  });

  return {
    ok: true,
    row: rowNumber,
    entry: {
      transactionNumber: entry['Transaction Number'] || '',
      date: toDateInputValue_(entry.Date),
      courtesyCar: entry['Courtesy Car'] || '',
      customerName: entry['Customer / User Name'] || '',
      mobileNo: entry['Mobile No.'] || '',
      vehiclePlateNo: entry['Vehicle / Plate No.'] || '',
      eid: normalizeBoolean_(entry.EID),
      driversLicense: normalizeBoolean_(entry["Driver's License"]),
      releaseForm: normalizeBoolean_(entry['Release Form']),
      jobCardNo: entry['Job Card No.'] || '',
      mileage: entry.Mileage || '',
      dateTimeReleased: toDateTimeLocalValue_(entry['Date / Time Released']),
      dateTimeReturned: toDateTimeLocalValue_(entry['Date / Time Returned']),
      serviceAdvisor: entry['Service Advisor'] || '',
      remarks: entry.Remarks || ''
    }
  };
}

function updateReturnedDateTime_(payload) {
  const sheet = getMasterDataSheet_();
  const rowNumber = findTransactionRow_(sheet, payload.transactionNumber || '');

  if (!rowNumber) {
    return {
      ok: false,
      error: 'Transaction number not found.'
    };
  }

  const returnedColumn = HEADERS.indexOf('Date / Time Returned') + 1;
  sheet.getRange(rowNumber, returnedColumn).setValue(payload.dateTimeReturned || '');

  return {
    ok: true,
    row: rowNumber,
    transactionNumber: payload.transactionNumber || '',
    updatedField: 'Date / Time Returned'
  };
}

function findTransactionRow_(sheet, transactionNumber) {
  const cleanTransactionNumber = String(transactionNumber || '').trim();
  if (!cleanTransactionNumber) return 0;

  const transactionColumn = HEADERS.indexOf('Transaction Number') + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const values = sheet
    .getRange(2, transactionColumn, lastRow - 1, 1)
    .getValues()
    .flat();

  const index = values.findIndex(value => String(value || '').trim() === cleanTransactionNumber);
  return index === -1 ? 0 : index + 2;
}

function normalizeBoolean_(value) {
  return value === true || String(value).toUpperCase() === 'TRUE';
}

function toDateInputValue_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value);
}

function toDateTimeLocalValue_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm");
  }
  return String(value);
}

function getNextTransactionNumber_(sheet) {
  const transactionColumn = HEADERS.indexOf('Transaction Number') + 1;
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return formatTransactionNumber_(1);

  const values = sheet
    .getRange(2, transactionColumn, lastRow - 1, 1)
    .getValues()
    .flat();

  const highest = values.reduce((max, value) => {
    const text = String(value || '');
    if (!text.startsWith(TRANSACTION_PREFIX)) return max;

    const number = Number(text.slice(TRANSACTION_PREFIX.length));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);

  return formatTransactionNumber_(highest + 1);
}

function formatTransactionNumber_(number) {
  return TRANSACTION_PREFIX + String(number).padStart(TRANSACTION_PAD_LENGTH, '0');
}

function getMasterDataSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  ensureMasterDataHeaders_(sheet);

  return sheet;
}

function ensureMasterDataHeaders_(sheet) {
  const existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.length)).getValues()[0];
  const needsHeaders = existingHeaders.every(value => value === '');

  if (needsHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }

  const hasTransactionNumber = existingHeaders.includes('Transaction Number');
  const dateColumnIndex = existingHeaders.indexOf('Date') + 1;

  if (!hasTransactionNumber && dateColumnIndex === 2) {
    sheet.insertColumnAfter(1);
  }

  const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const headersMatch = HEADERS.every((header, index) => currentHeaders[index] === header);

  if (!headersMatch) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  sheet.setFrozenRows(1);
}

function getListsSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(LISTS_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(LISTS_SHEET_NAME);
    sheet.getRange(1, 1, 1, 2).setValues([['Courtesy Cars', 'Service Advisors']]);
    sheet.getRange(2, 1, 4, 1).setValues([
      ['15886/9 FENGO...'],
      ['31258/18 FENG...'],
      ['46106 / SERES 7...'],
      ['99555']
    ]);
    sheet.getRange(2, 2, 3, 1).setValues([
      ['Sir Elli'],
      ['Rana'],
      ['Heba']
    ]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function getListValues_(columnNumber) {
  const sheet = getListsSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  return sheet
    .getRange(2, columnNumber, lastRow - 1, 1)
    .getValues()
    .flat()
    .map(value => String(value || '').trim())
    .filter(Boolean);
}

function buildRow_(payload, transactionNumber) {
  return [
    new Date(),
    transactionNumber,
    payload.date || '',
    payload.courtesyCar || '',
    payload.customerName || '',
    payload.mobileNo || '',
    payload.vehiclePlateNo || '',
    payload.eid ? 'TRUE' : 'FALSE',
    payload.driversLicense ? 'TRUE' : 'FALSE',
    payload.releaseForm ? 'TRUE' : 'FALSE',
    payload.jobCardNo || '',
    payload.mileage || '',
    payload.dateTimeReleased || '',
    payload.dateTimeReturned || '',
    payload.serviceAdvisor || '',
    payload.remarks || ''
  ];
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
