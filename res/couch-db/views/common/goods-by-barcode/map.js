function (doc) {
  var i;
  var barcode;
  if (doc.TYPE_NAME === 'moysklad.good') {
    if (doc.barcode && doc.barcode.length) {
      for (i = 0; i < doc.barcode.length; i++) {
        barcode = doc.barcode[i];
        if (barcode && barcode.barcode) {
          emit(barcode.barcode, barcode.barcodeType);
        }
      }
    }
  }
}
