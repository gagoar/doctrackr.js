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
    DT.initialize({ client_id: 'YOUR APP HERE'
                    , redirect_uri: 'YOUR CALLBACK HERE'
                    , secret: 'YOUR SECRET HERE'
    })
      document.getElementById('authorize_me').addEventListener('click', DTLogin.login);

      // triggers from DT library
      document.addEventListener('success.login.dt', showToken); // on success login we show the token via console.warn
      document.addEventListener('success.file.dt', readIt); // on success recieving the file we read it
      document.addEventListener('success.createPolicy.dt', averte); // create a policy and show all the details
      document.addEventListener('success.updatePolicy.dt', averte); // we show the policy info
      document.addEventListener('success.logout.dt',byeBye); // on logout we show a console.warn with you need to re login
    })
  }
