function (doc) {
  if (doc.TYPE_NAME === 'moysklad.company') {
    var phones = [];
    var phoneInfo;
    var phoneInvert;
    var person;
    var i;
    var r = /\D+/g;

    if (doc.contact) {
      if (doc.contact.phones) {
        phones.push({
          phoneType: 'phone',
          phone: doc.contact.phones
        });
      }
      if (doc.contact.faxes) {
        phones.push({
          phoneType: 'fax',
          phone: doc.contact.faxes
        });
      }
    }

    if (doc.contactPerson && doc.contactPerson.length) {
      for (i = 0; i < doc.contactPerson.length; i++) {
        person = doc.contactPerson[i];
        if (person.phone) {
          phones.push({
            phoneType: 'contact',
            phone: person.phone,
            contactId: person.uuid
          });
        }
      }
    }

    if (phones.length) {
      for (i = 0; i < phones.length; i++) {
        phoneInfo = phones[i];
        phoneInvert = phoneInfo.phone.replace(r, '');
        if (phoneInvert !== '') {
          phoneInvert = phoneInvert.split('').reverse().join('').substring(0, 7);
          phoneInfo.companyId = doc.uuid;
          phoneInfo.callerName = doc.name;
          emit(phoneInvert, phoneInfo);
        }
      }
    }
  }
}
