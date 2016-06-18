function (doc) {
  if (doc.TYPE_NAME === 'config.syncToken') {
    var type = doc._id.split(':')[1];
    emit(type, doc);
  }
}
