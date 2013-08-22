var insertLink = function(id, link, name){
  var a = document.createElement('a');
    a.href = link
    a.innerHTML = name + '[protected]'
    document.getElementById('list').insertBefore(a, null);


}
var averte = function(e){
  console.log(e.target.response);
}
var readIt = function (theFile) {
  return function (e) {
    var a = document.createElement('a');
    a.href = e.target.result
    a.innerHTML = theFile.name
    document.getElementById('list').insertBefore(a, null);
  }
}
var handleFileSelect = function (evt) {
  var file = evt.target.files[0];
  if (file == undefined ) return
    console.log('called:', evt)
  reader = new FileReader();
  reader.onload = readIt(file);
  reader.readAsDataURL(file);
}

var initialize = function (e){
  document.addEventListener('DOMContentLoaded',function(e){
    document.getElementById('files').addEventListener('change', handleFileSelect);
    document.getElementById('authorize_me').addEventListener('click', DTLogin.authorize);
    DT.initialize('PUT YOUR APP_SECRET HERE')
  })
}
