/**
 * Nexus CRM - Google Apps Script Backend (Optional)
 * 
 * Este script permite usar una hoja de Google Sheets como base de datos en la nube.
 * Almacena toda la base de datos JSON en la primera celda (A1) para rápida lectura/escritura.
 */

var SPREADSHEET_ID = ""; // REEMPLAZAR CON ID DE HOJA

function getTargetSheet() {
  var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("DB") || ss.insertSheet("DB");
  return sheet;
}

function doPost(e) {
  var result = {};
  try {
    var params = {};
    if (e && e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    }

    var sheet = getTargetSheet();

    if (params.action === "saveData") {
      var dataToSave = params.payload;
      // Guardar el JSON stringificado en A1
      sheet.getRange("A1").setValue(JSON.stringify(dataToSave));
      result = { status: "success", message: "Datos guardados" };
    } 
    else if (params.action === "getData") {
      var data = sheet.getRange("A1").getValue();
      if (!data) data = '{"clients":[],"projects":[],"billing":[]}';
      result = { status: "success", data: JSON.parse(data) };
    } 
    else {
      throw new Error("Acción desconocida");
    }
  } catch (error) {
    result = { status: "error", message: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput("Nexus CRM API Activa").setMimeType(ContentService.MimeType.TEXT);
}
