/**
 * Código de Google Apps Script para Punto 25 Delivery
 * Desplegar como Aplicación Web (con acceso para "Cualquiera" o "Anyone")
 * 
 * Vinculado a la planilla:
 * https://docs.google.com/spreadsheets/d/1Ge1ks6bpgkwuG-TWLRH39Oz_3wgy6SwSXN5dJiaru9M/edit
 */

// ID de la hoja de cálculo de Google
var SPREADSHEET_ID = "1Ge1ks6bpgkwuG-TWLRH39Oz_3wgy6SwSXN5dJiaru9M";

// Mapeo flexible de campos para soportar cabeceras en español (las actuales) e inglés
var headerMapping = {
  orderId: ["ID Pedido", "orderId", "numero_de_solicitud"],
  date: ["Fecha", "date", "timestamp", "fecha"],
  nombre: ["Cliente", "nombre", "nombre_del_cliente"],
  tel: ["Teléfono", "tel", "telefono"],
  deliveryMode: ["Modalidad", "deliveryMode", "metodo_de_entrega"],
  direccion: ["Dirección", "direccion", "sucursal___direccion"],
  paymentMethod: ["Método Pago", "paymentMethod", "medio_de_pago"],
  detalle: ["Detalle del Pedido", "detalle", "productos_detalle"],
  total: ["Total de Compra", "total", "total_estimado"],
  pagoDetalle: ["Paga Con / Vuelto", "pagoDetalle", "pago_detalle"],
  notes: ["Notas / Aclaraciones", "notes", "observaciones"],
  estado: ["Estado", "estado"]
};

// Función para abrir la hoja de cálculo y la pestaña correspondientes
function getTargetSheet() {
  var ss;
  if (SPREADSHEET_ID && SPREADSHEET_ID !== "") {
    try {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch(e) {
      console.warn("No se pudo abrir por ID, intentando obtener hoja activa:", e.message);
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  
  // Intentar abrir la pestaña "2026", si no existe, usar la primera pestaña disponible
  var sheet = ss.getSheetByName("2026");
  if (!sheet) {
    sheet = ss.getSheets()[0];
  }
  return sheet;
}

// Función auxiliar para buscar el índice (0-based) de una columna por sus posibles nombres
function findColumnIndex(headers, key) {
  var aliases = headerMapping[key] || [key];
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i].toString().trim().toLowerCase();
    for (var j = 0; j < aliases.length; j++) {
      if (h === aliases[j].toLowerCase()) {
        return i;
      }
    }
  }
  return -1;
}

function doPost(e) {
  var result = {};
  try {
    var params;
    
    // 1. Detectar el formato de entrada (JSON directo o Formulario oculto)
    if (e && e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        // Fallback si la cadena viene serializada tipo formulario
        params = e.parameter || {};
      }
    } else {
      params = e.parameter || {};
    }
    
    // 2. Extraer si los datos vienen encapsulados dentro de la variable "data"
    if (params.data) {
      try {
        params = typeof params.data === 'string' ? JSON.parse(params.data) : params.data;
      } catch(ex) {}
    }

    var sheet = getTargetSheet();
    
    // Si la hoja está completamente vacía, agregamos los encabezados de las columnas por defecto
    if (sheet.getLastRow() === 0) {
      var defaultHeaders = [
        "ID Pedido",
        "Fecha",
        "Cliente",
        "Teléfono",
        "Modalidad",
        "Dirección",
        "Método Pago",
        "Detalle del Pedido",
        "Total de Compra",
        "Paga Con / Vuelto",
        "Notas / Aclaraciones",
        "Estado"
      ];
      sheet.appendRow(defaultHeaders);
    }
    
    // Obtener las cabeceras actuales para mapear las columnas dinámicamente
    var range = sheet.getDataRange();
    var values = range.getValues();
    var headers = values[0] || [];
    
    if (params.action === "getOrders") {
      // ─── LECTURA DE PEDIDOS (PARA EL DASHBOARD) ───
      var data = [];
      
      if (values.length > 1) {
        // Mapear los índices de cada columna
        var idxs = {};
        for (var key in headerMapping) {
          idxs[key] = findColumnIndex(headers, key);
        }
        
        // Recorrer filas omitiendo la cabecera
        for (var i = 1; i < values.length; i++) {
          var row = values[i];
          var obj = {};
          
          for (var key in headerMapping) {
            var colIdx = idxs[key];
            if (colIdx !== -1 && colIdx < row.length) {
              obj[key] = row[colIdx];
            } else {
              obj[key] = (key === "estado") ? "Pendiente" : "";
            }
          }
          
          // Mapeos adicionales por compatibilidad con nombres en español en el JS
          obj["ID Pedido"] = obj.orderId;
          obj["Fecha"] = obj.date;
          obj["Cliente"] = obj.nombre;
          obj["Teléfono"] = obj.tel;
          obj["Modalidad"] = obj.deliveryMode;
          obj["Dirección"] = obj.direccion;
          obj["Método Pago"] = obj.paymentMethod;
          obj["Detalle del Pedido"] = obj.detalle;
          obj["Total de Compra"] = obj.total;
          obj["Paga Con / Vuelto"] = obj.pagoDetalle;
          obj["Notas / Aclaraciones"] = obj.notes;
          obj["Estado"] = obj.estado;
          
          data.push(obj);
        }
      }
      
      result = {
        status: "success",
        message: "Datos recuperados con éxito.",
        data: data
      };
      
    } else if (params.action === "updateState") {
      // ─── ACTUALIZAR ESTADO COMERCIAL DE UN PEDIDO ───
      var orderId = params.orderId;
      var newState = params.newState;
      
      var orderIdCol = findColumnIndex(headers, "orderId");
      var estadoCol = findColumnIndex(headers, "estado");
      
      if (orderIdCol === -1) {
        throw new Error("No se encontró la columna del identificador de pedido ('ID Pedido' u 'orderId') en la planilla.");
      }
      
      // Si la columna de estado no existe, crearla dinámicamente al final
      if (estadoCol === -1) {
        sheet.getRange(1, headers.length + 1).setValue("Estado");
        estadoCol = headers.length;
        // Recargar cabeceras y valores
        range = sheet.getDataRange();
        values = range.getValues();
        headers = values[0];
      }
      
      var foundRowIndex = -1;
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][orderIdCol]).trim() === String(orderId).trim()) {
          foundRowIndex = i + 1; // +1 porque es base 1
          break;
        }
      }
      
      if (foundRowIndex !== -1) {
        sheet.getRange(foundRowIndex, estadoCol + 1).setValue(newState);
        result = {
          status: "success",
          message: "Estado de pedido " + orderId + " cambiado a '" + newState + "' correctamente."
        };
      } else {
        throw new Error("No se encontró ningún pedido con el ID: " + orderId);
      }
      
    } else if (params.action === "updateOrder") {
      // ─── ACTUALIZAR CONTENIDO COMPLETO DE UN PEDIDO ───
      var orderId = params.orderId;
      var newDetalle = params.detalle;
      var newTotal = params.total;
      var newNotes = params.notes;
      var newEstado = params.estado;
      
      var orderIdCol = findColumnIndex(headers, "orderId");
      var detalleCol = findColumnIndex(headers, "detalle");
      var totalCol = findColumnIndex(headers, "total");
      var notesCol = findColumnIndex(headers, "notes");
      var estadoCol = findColumnIndex(headers, "estado");
      
      if (orderIdCol === -1) {
        throw new Error("No se encontró la columna del identificador de pedido.");
      }
      
      if (estadoCol === -1) {
        sheet.getRange(1, headers.length + 1).setValue("Estado");
        estadoCol = headers.length;
        range = sheet.getDataRange();
        values = range.getValues();
        headers = values[0];
      }
      
      if (detalleCol === -1) {
        sheet.getRange(1, headers.length + 1).setValue("Detalle del Pedido");
        detalleCol = headers.length;
        range = sheet.getDataRange();
        values = range.getValues();
        headers = values[0];
      }
      
      if (totalCol === -1) {
        sheet.getRange(1, headers.length + 1).setValue("Total de Compra");
        totalCol = headers.length;
        range = sheet.getDataRange();
        values = range.getValues();
        headers = values[0];
      }
      
      if (notesCol === -1) {
        sheet.getRange(1, headers.length + 1).setValue("Notas / Aclaraciones");
        notesCol = headers.length;
        range = sheet.getDataRange();
        values = range.getValues();
        headers = values[0];
      }
      
      var foundRowIndex = -1;
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][orderIdCol]).trim() === String(orderId).trim()) {
          foundRowIndex = i + 1;
          break;
        }
      }
      
      if (foundRowIndex !== -1) {
        if (detalleCol !== -1) sheet.getRange(foundRowIndex, detalleCol + 1).setValue(newDetalle);
        if (totalCol !== -1) sheet.getRange(foundRowIndex, totalCol + 1).setValue(newTotal);
        if (notesCol !== -1) sheet.getRange(foundRowIndex, notesCol + 1).setValue(newNotes);
        if (estadoCol !== -1) sheet.getRange(foundRowIndex, estadoCol + 1).setValue(newEstado);
        
        result = {
          status: "success",
          message: "Pedido " + orderId + " actualizado correctamente."
        };
      } else {
        throw new Error("No se encontró ningún pedido con el ID: " + orderId);
      }
      
    } else if (params.action === "getCatalog") {
      var catSheet = ss.getSheetByName("Catalogo");
      if (!catSheet) throw new Error("No existe pestaña Catalogo");
      
      var data = [];
      var range = catSheet.getDataRange();
      var values = range.getValues();
      if (values.length > 1) {
        var heads = values[0];
        for (var i = 1; i < values.length; i++) {
          var row = values[i];
          var obj = {};
          for (var j = 0; j < heads.length; j++) {
            obj[heads[j]] = row[j];
          }
          data.push(obj);
        }
      }
      result = { status: "success", data: data };

    } else if (params.action === "saveProduct") {
      var catSheet = ss.getSheetByName("Catalogo");
      if (!catSheet) {
        catSheet = ss.insertSheet("Catalogo");
        catSheet.appendRow(["id", "cat", "name", "desc", "ingredients", "prepDesc", "prepTime", "price", "priceHalf", "unitType", "img", "emoji", "tags", "hot", "rating", "enabled"]);
      }
      
      var p = params.product;
      var range = catSheet.getDataRange();
      var values = range.getValues();
      var heads = values[0];
      
      var foundRow = -1;
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][heads.indexOf("id")]) === String(p.id)) {
          foundRow = i + 1;
          break;
        }
      }
      
      var rowData = [
        p.id, p.cat, p.name, p.desc, p.ingredients, p.prepDesc, p.prepTime, p.price, p.priceHalf, p.unitType, p.img, p.emoji, p.tags, p.hot, p.rating, p.enabled
      ];
      
      if (foundRow !== -1) {
        catSheet.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
      } else {
        catSheet.appendRow(rowData);
      }
      result = { status: "success", message: "Producto guardado correctamente" };

    } else if (params.action === "deleteProduct") {
      var catSheet = ss.getSheetByName("Catalogo");
      if (catSheet) {
        var range = catSheet.getDataRange();
        var values = range.getValues();
        var heads = values[0];
        for (var i = 1; i < values.length; i++) {
          if (String(values[i][heads.indexOf("id")]) === String(params.id)) {
            catSheet.deleteRow(i + 1);
            break;
          }
        }
      }
      result = { status: "success", message: "Producto eliminado" };

    } else if (params.action === "toggleProductStock") {
      var catSheet = ss.getSheetByName("Catalogo");
      if (catSheet) {
        var range = catSheet.getDataRange();
        var values = range.getValues();
        var heads = values[0];
        var enabledCol = heads.indexOf("enabled") + 1;
        for (var i = 1; i < values.length; i++) {
          if (String(values[i][heads.indexOf("id")]) === String(params.id)) {
            catSheet.getRange(i + 1, enabledCol).setValue(params.enabled);
            break;
          }
        }
      }
      result = { status: "success", message: "Stock actualizado" };

    } else if (params.action === "seedCatalog") {
      var catSheet = ss.getSheetByName("Catalogo");
      if (!catSheet) {
        catSheet = ss.insertSheet("Catalogo");
      } else {
        // Clear existing data to avoid duplicates during seeding
        catSheet.clear();
      }
      
      catSheet.appendRow(["id", "cat", "name", "desc", "ingredients", "prepDesc", "prepTime", "price", "priceHalf", "unitType", "img", "emoji", "tags", "hot", "rating", "enabled"]);
      
      var products = params.products || [];
      var rows = [];
      for (var k = 0; k < products.length; k++) {
        var p = products[k];
        rows.push([
          p.id, p.cat, p.name, p.desc || "", p.ingredients || "", p.prepDesc || "", p.prepTime || "", p.price, p.priceHalf || 0, p.unitType, p.img || "", p.emoji, (p.tags||[]).join(","), p.hot||false, p.rating||4.8, p.enabled!==false
        ]);
      }
      
      if (rows.length > 0) {
        catSheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }
      
      result = { status: "success", message: "Catálogo sembrado con " + rows.length + " productos" };

    } else {
      // ─── REGISTRO DE UN NUEVO PEDIDO (CHECKOUT COMPATIBILITY) ───
      var idxs = {};
      for (var key in headerMapping) {
        idxs[key] = findColumnIndex(headers, key);
      }
      
      // Si la columna de estado no existe en la cabecera actual, agregarla al final
      if (idxs["estado"] === -1) {
        sheet.getRange(1, headers.length + 1).setValue("Estado");
        headers.push("Estado");
        idxs["estado"] = headers.length - 1;
      }
      
      // Armar la nueva fila con la longitud correcta de columnas
      var newRow = [];
      for (var j = 0; j < headers.length; j++) {
        newRow.push("");
      }
      
      // Rellenar valores según las posiciones correspondientes
      for (var key in headerMapping) {
        var colIdx = idxs[key];
        if (colIdx !== -1) {
          if (key === "date") {
            newRow[colIdx] = params.date || new Date().toLocaleString("es-AR");
          } else if (key === "estado") {
            newRow[colIdx] = params.estado || "Pendiente";
          } else {
            newRow[colIdx] = params[key] !== undefined ? params[key] : "";
          }
        }
      }
      
      sheet.appendRow(newRow);
      
      result = {
        status: "success",
        message: "Pedido registrado correctamente."
      };
    }
  } catch (err) {
    result = {
      status: "error",
      message: err.toString()
    };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Apps Script de Punto 25 activo y listo para sincronizar."
  })).setMimeType(ContentService.MimeType.JSON);
}
