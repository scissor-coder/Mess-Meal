// --- CONFIGURATION ---
const SPREADSHEET_ID = "1SlbtqetMK2603HNk7cfOkEzYPEN303XmXo1jmV6pjqg"; // !!! REPLACE WITH YOUR ACTUAL SPREADSHEET ID
const DATA_SHEET_NAME = "Meal_Entries";
const CONFIG_SHEET_NAME = "Config";
const REPORTS_SHEET_NAME = "Reports"; // Assuming a separate sheet for meal reports/summary

// --- CORE FUNCTIONS ---

/**
 * Handles HTTP GET requests to the Web App.
 * Used for fetching initial data, today's entries, and meal reports.
 * @param {object} e The event parameter for the GET request.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response or HTML content.
 */
function doGet(e) {
  // Check if an action parameter is provided
  if (e.parameter.action) {
    const action = e.parameter.action;

    try {
      let result;
      switch (action) {
        case 'getInitialData':
          result = getInitialData();
          break;
        case 'getTodayEntries':
          result = getTodayEntries();
          break;
        case 'getMealReports':
          result = getMealReports();
          break;
        default:
          return createJSONResponse({
            status: 'error',
            message: `Invalid action: ${action}`
          }, 400);
      }
      return createJSONResponse({
        status: 'success',
        ...result
      });
    } catch (error) {
      Logger.log(`Error in doGet action ${action}: ${error.toString()}`);
      return createJSONResponse({
        status: 'error',
        message: `Server error: ${error.message}`
      }, 500);
    }
  }

  // Fallback for serving the HTML file (for use with Script as the host)
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Handles HTTP POST requests to the Web App.
 * Used for submitting new meal entries.
 * @param {object} e The event parameter for the POST request.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function doPost(e) {
  try {
    const data = e.postData.contents;
    const params = parseFormEncodedData(data);

    // 1. Validate required fields
    if (!params.name || !params.meal || !params.nextDay) {
      return createJSONResponse({
        status: 'error',
        message: 'Missing required form data: name, meal, or nextDay.'
      }, 400);
    }

    // 2. Get the target sheet
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DATA_SHEET_NAME);

    if (!sheet) {
      throw new Error(`Sheet not found: ${DATA_SHEET_NAME}`);
    }

    // 3. Prepare data row
    const timestamp = new Date();
    // Data structure: Timestamp, Name, Today's Meal, Next Day's Meal
    const row = [
      timestamp,
      params.name,
      params.meal,
      params.nextDay
    ];

    // 4. Append the new row
    sheet.appendRow(row);

    return createJSONResponse({
      status: 'success',
      message: 'Data submitted successfully'
    });

  } catch (error) {
    Logger.log(`Error in doPost: ${error.toString()}`);
    return createJSONResponse({
      status: 'error',
      message: `Submission failed: ${error.message}`
    }, 500);
  }
}

// --- HELPER FUNCTIONS ---

/**
 * Fetches initial data like names, meal options, year, and notice text.
 * @returns {object} An object containing the initial configuration data.
 */
function getInitialData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const configSheet = ss.getSheetByName(CONFIG_SHEET_NAME);

  if (!configSheet) {
    throw new Error(`Configuration sheet not found: ${CONFIG_SHEET_NAME}`);
  }

  // Assuming data is structured in the Config sheet:
  // A1: Year Name, B1: Notice Text
  // A2: Name 1, A3: Name 2, ...
  // B2: Meal Option 1 (Today), B3: Meal Option 2, ...
  // C2: Meal Option 1 (Next Day), C3: Meal Option 2, ...

  const yearName = configSheet.getRange('A1').getDisplayValue() || 'Default Year';
  const noticeText = configSheet.getRange('B1').getDisplayValue() || 'No notice available.';

  // Get Names (Column A, starting from A2)
  const lastRowA = configSheet.getLastRow();
  const namesRange = configSheet.getRange(2, 1, lastRowA - 1, 1).getValues();
  const names = namesRange.map(row => row[0]).filter(name => name && name.toString().trim() !== '');

  // Get Today's Meal Options (Column B, starting from B2)
  const lastRowB = configSheet.getLastRow();
  const mealsRange = configSheet.getRange(2, 2, lastRowB - 1, 1).getValues();
  const meals = mealsRange.map(row => row[0]).filter(meal => meal && meal.toString().trim() !== '');

  // Get Next Day's Meal Options (Column C, starting from C2)
  const lastRowC = configSheet.getLastRow();
  const nextDayMealsRange = configSheet.getRange(2, 3, lastRowC - 1, 1).getValues();
  const nextDayMeals = nextDayMealsRange.map(row => row[0]).filter(meal => meal && meal.toString().trim() !== '');

  return {
    names: names,
    meals: meals,
    nextDayMeals: nextDayMeals,
    yearName: yearName,
    noticeText: noticeText
  };
}

/**
 * Fetches today's meal entries from the main data sheet.
 * Assumes the sheet columns are: Timestamp (Col 1), Name (Col 2), Today's Meal (Col 3), Next Day's Meal (Col 4).
 * @returns {object} An object with a 'data' property containing an array of today's entries.
 */
function getTodayEntries() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const dataSheet = ss.getSheetByName(DATA_SHEET_NAME);

  if (!dataSheet || dataSheet.getLastRow() < 2) {
    return {
      data: []
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  const allEntries = dataSheet.getRange(2, 1, dataSheet.getLastRow() - 1, 4).getValues(); // Get all data

  const todayEntries = allEntries.filter(row => {
    const entryDate = new Date(row[0]); // Timestamp is in column 1 (index 0)
    entryDate.setHours(0, 0, 0, 0);
    return entryDate.getTime() === today.getTime();
  });

  // Extract only the Name (Col 2), Today's Meal (Col 3), Next Day's Meal (Col 4)
  // These correspond to indices 1, 2, and 3 in the array.
  const displayData = todayEntries.map(row => [row[1], row[2], row[3]]);

  return {
    data: displayData
  };
}

/**
 * Fetches the summarized meal reports.
 * Assumes a separate 'Reports' sheet contains the summary data.
 * Assumes the report sheet columns are: NameOfB (Col 1), Given Taka (Col 2), Total Meal (Col 3), Enough (Col 4).
 * @returns {object} An object with a 'data' property containing an array of report rows.
 */
function getMealReports() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const reportSheet = ss.getSheetByName(REPORTS_SHEET_NAME);

  if (!reportSheet || reportSheet.getLastRow() < 2) {
    return {
      data: []
    };
  }

  // Get all data from the report sheet, excluding headers (assuming row 1 is header)
  const allReports = reportSheet.getRange(2, 1, reportSheet.getLastRow() - 1, 4).getValues();

  // The client expects 4 columns: NameOfB, Given Taka, Total Meal, Enough
  // We don't need to change the data as it's directly from the report sheet.
  return {
    data: allReports
  };
}

/**
 * Parses application/x-www-form-urlencoded data from the request body.
 * @param {string} data The form-encoded string.
 * @returns {object} An object containing the parsed key-value pairs.
 */
function parseFormEncodedData(data) {
  const params = {};
  data.split('&').forEach(pair => {
    const parts = pair.split('=');
    const key = decodeURIComponent(parts[0].replace(/\+/g, ' '));
    const value = decodeURIComponent(parts[1].replace(/\+/g, ' '));
    params[key] = value;
  });
  return params;
}

/**
 * Creates a JSON response for the Web App.
 * @param {object} object The JavaScript object to be converted to JSON.
 * @param {number} status_code The HTTP status code to set (optional).
 * @returns {GoogleAppsScript.Content.TextOutput} The TextOutput object.
 */
function createJSONResponse(object, status_code) {
  const output = ContentService.createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);

  if (status_code) {
    // Note: Setting HTTP status code is only possible for Web Apps deployed
    // using the new V8 runtime and executed as "Me".
    // Setting a custom status code is generally for advanced error handling
    // and is less reliable in GAS than returning an error object in the JSON body.
  }

  return output;
}