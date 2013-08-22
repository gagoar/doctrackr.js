DT = (function (){
  var versions = {
      mayor: 0
     , minor: 0
     , fix: 1
     , get version(){return [versions.mayor, versions.minor, versions.fix].join('.')}
  }
  // origin url for diverse uses
  var origin = window.location.href.replace(window.location.pathname, '')
  // secret given in the init function
  , secret = undefined
  // code obtain in the 1 fase of oauth2 authentication
  , code = undefined
  // token structure
  , tokenData  = {}
  // keeping track of how much time as passed :)
  , tokenTimer = undefined
  // validSession?
  , valid = false
  // config for authorize
  var config =  {
    client_id: '4d4aa4e01126e54003e5f4f60034a1467940ba038af702d61716e709ae4a37c7'
    , url: 'https://use.doctrackr.com/oauth/authorize'
    , token_url: 'https://api.doctrackr.com/oauth/token'
    , redirect_uri: 'http://localhost:9010/callback.html'
    , response_type: 'code'
  }
  // Policies store
  var privileges = {
    can_view: []
    , can_edit: []
    , can_print: []
  }

  // initialize the library
  var init = function (client_secret){
    if (client_secret){
      logout()
      secret = client_secret
      if(console) console.warn('all set!')
    }else throw new Error('No client secret given')

  }

  // uniq list of arrays
  var uniq = function (ar) {
    var o = {} , i, l = ar.length , r = []
    for(i=0;i<l;i++) o[ar[i]] = ar[i]
    for(i in o) r.push(o[i]);
    return r
  }

  // process parameters
  var paramsProcessor = function (properties){
    var params = []
    for (var prop in properties)
      if (properties.hasOwnProperty(prop))
        params.push([encodeURIComponent(prop), encodeURIComponent(properties[prop])].join('='))
    return params.join('&')
  }

  // get well formed url for lunching docktrackr authorization
  var auth = function (){
    return [ config.url, paramsProcessor(config) ].join('?')
  }

  // popup window in order to authorize the app
  var authorize = function (){
    if ( secret ){
      var w  = window.open(auth(), '_blank', ['toolbar=no', 'location= ' + (window.opera ? 'no' : 'yes'), 'directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,copyhistory=no', 'width=1013', 'height=754'].join())
    	w.addEventListener('locationChange', averte);
      internalEvents(true);
    } else
      throw new Error('You need to initialize the library first!')
  }

  // Catch message event with the code
  var recieveCode = function (e) {
    internalEvents();
    code = e.data
    if ((/^[0-9A-Fa-f]+$/).test(code))
      obtainToken()
    else
      throw new Error('code: ', code, 'malformed')
  }

  // storeToken => store the token along with all the related data that comes with it
  var storeToken = function (e){
    tokenData = JSON.parse(e.target.response);
    if (tokenData.access_token) setTimeOutToken()
  }

  // destroy token when expires
  var setTimeOutToken = function () {
    valid = true
    var msec = Number(tokenData.expires_in) * Number(1000);
    tokenTimer = setTimeout( "DTLogin.logout('token time out');", msec);
  }

  // anyPrivileges
  var anyPrivileges = function (){
    return privileges.can_edit.length || privileges.can_print.length || privileges.can_view.length
  }

  // responsePolicy
  var responsePolicy = function(callback){
    return function(e){
      console.log(e)
      callback(e)
    }
  }

  // createAPolicy
  var createAPolicy = function (callback) {
    if ( ! anyPrivileges() ) throw new Error('no privilages given')

    var xhr = new XMLHttpRequest()
    , formData = new FormData()
    formData.append('policy[verify_identity]', true)

    for (privilege in privileges)
      if (privileges[privilege].length)
        formData.append('policy[privileges][' + privilege + '][]', privileges[privilege].join(','))

    xhr.open('POST', 'https://api.doctrackr.com/v1/policies', true);
    xhr.setRequestHeader('Authorization', ['Bearer', returnToken()].join(' '))
    xhr.onload = responsePolicy(callback)
    xhr.send(formData)
  }

  // getUser
  var getUser = function () {


  }
  // updatePolicy
  var updatePolicy = function (policy_id, callback) {
    if ( policy_id && ! anyPrivileges() ) throw new Error('check policy_id given and try again')

    var xhr = new XMLHttpRequest()
    , formData = new FormData()

    for (privilege in privileges)
      if (privileges[privilege].length)
        formData.append('policy[privileges][' + privilege + ']', privileges[privilege].join(','))

    xhr.open('PUT', 'https://api.doctrackr.com/v1/policies/' + policy_id, true);
    xhr.setRequestHeader('Authorization', ['Bearer', returnToken()].join(' '))
    xhr.onload = responsePolicy(callback)
    xhr.send(formData)
  }

  // addPrivilege
  var addPrivilege = function (email, privilege) {
    if (/[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+/.test(email) && privileges.hasOwnProperty(privilege)){
      privileges[privilege].push(email)
      privileges[privilege] = uniq(privileges[privilege])
      return privileges
    }
    else
      throw new Error('malformed email or privilege given')
  }

  // removePrivilege
  var removePrivilege = function(email, privilege) {
    if(privilege && privileges.hasOwnProperty(privilege)){
      var i = privileges[privilege].indexOf(email)
      if ( i != -1 ) privileges[privilege].splice(i, 1);
    }else{
      for(privilege in privileges){
        var i = privileges[privilege].indexOf(email)
        if ( i != -1 ) privileges[privilege].splice(i, 1);
      }
    }
    return privileges
  }

  // returnToken
  var returnToken = function (e) {
   if (valid) return tokenData.access_token
   else throw new Error ('invalid Token');
  }

  // obtainToken
  var obtainToken = function () {
    var xhr = new XMLHttpRequest()
    , properties = { grant_type: 'authorization_code', code: code, client_id: config.client_id, client_secret: secret, redirect_uri: config.redirect_uri }
    , params = paramsProcessor(properties)
    , action = [config.token_url, params].join('?')
    console.warn('action: ', action)

    xhr.open('POST', action, true);
    xhr.onload = storeToken
    xhr.send();
  }

  // getProtectedFile
  var getProtectedFile = function (id, url, name, callback) {
    console.log('DONE:', id, url, name)
    callback(id, url, name)
  }

  // getStatus
  var getStatus = function (id, callback) {
    return function(){
      var xhr = new XMLHttpRequest()
      , action = ['https://api.doctrackr.com/v1/documents/', id].join('')
      console.log('requestStatus: ',  action + '?access_token=' + returnToken())

      xhr.open('GET', action , true);
      xhr.setRequestHeader('Authorization', ['Bearer', returnToken()].join(' '))
      xhr.onload = getResponseFile(callback)
      xhr.send()
    }
  }

  // checkForStatus
  var checkForStatus = function (id, delay, callback) {
    console.log('checkForStatus:', id, delay)
    setTimeout( getStatus(id, callback), delay)
  }

  // getResponseFile
  var getResponseFile = function (callback) {
    return function (e){
      var resp = JSON.parse(e.target.response)
      console.log('getResponseFile: ', resp, resp.status, resp.id)
      if ( resp && resp.id ){
        resp.status == 'ENABLED'?
        getProtectedFile(resp.id, resp.url, resp.name, callback)
        : checkForStatus(resp.id, 5 * Number(1000), callback)
      } else throw new Error("can't go on without an id")
    }
  }

  // protectAFile
  var protectAFile = function (blob, callback) {
    if ( blob && !anyPrivileges()){
      var formData = new FormData()
      , xhr = new XMLHttpRequest()

      formData.append('fileupload', blob, blob.name)
      formData.append('policy[verify_identity]', true)
      for (privilege in privileges)
        if (privileges[privilege].length)
          formData.append('policy[privileges][' + privilege + '][]', privileges[privilege].join(','))

      xhr.open('POST', 'https://api.doctrackr.com/v1/documents', true);
      xhr.setRequestHeader('Authorization', ['Bearer', returnToken()].join(' '))
      xhr.onload = getResponseFile(callback)
      xhr.send(formData)
    }else
      throw new Error('check the file or privileges given and try again')
  }

  // destroy session
  var logout = function (reason) {
    valid = false
    tokenData = {}
    clearTimeout(tokenTimer)
    if (reason) console.warn('reason: ', reason)
  }

  // Internal Bindings
  var internalEvents = function (set){
    var action = set? 'addEventListener' : 'removeEventListener'
    window[action]('message', recieveCode, false)
  }

  // module pattern
  return {
    initialize: init
    , authorize: authorize
    , getToken: returnToken
    , protectAFile: protectAFile
    , policy: {
        create: createAPolicy
      , addPrivilege: addPrivilege
      , removePrivilege: removePrivilege
      , update: updatePolicy
    }
    , logout: logout
    , version: versions.version
    , test:{
      anyPrivileges: anyPrivileges
      , privileges: privileges
    }

  }
}());
