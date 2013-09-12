DT = (function (){
  var versions = {
      mayor: 0
     , minor: 0
     , fix: 1
     , get version(){return [versions.mayor, versions.minor, versions.fix].join('.')}
  }
  // origin url for diverse uses
  var origin = window.location.href.replace(window.location.pathname, '')
  // code obtained in the 1 fase of oauth2
  , code = undefined
  // token structure
  , tokenData  = {}
  // keeping track of how much time as passed :)
  , tokenTimer = undefined
  // validSession?
  , valid = false
  // config for authorize
  var config =  {
    url: 'https://use.doctrackr.com/oauth/authorize'
    , token_url: 'https://api.doctrackr.com/oauth/token'
    , response_type: 'code'
    , app: {
      client_id: undefined
      , redirect_uri: undefined
      , secret: undefined
    }
    , check: function(){
      for (var property in config.app)
        if (config.app[property] == '' || config.app[property] == undefined) throw new Error('check config and try again');
      return true
    }
  }
  // Policies store
  var privileges = {
    can_view: []
    , can_edit: []
    , can_print: []
  }

  // initializer
  var init = function (app_config){
    if (Object.keys(app_config).length != 0){

      for(var attr in config.app) // iterate in order to assign only the accepted properties
        config.app[attr] = app_config[attr];

      config.check() // checking conf first.
      events.create = [ 'initialize', 'login', 'logout', 'token', 'statusFile', 'createFile', 'createPolicy', 'updatePolicy'];
      events.trigger = [ 'initialize', 'success']
      console.warn('all set!')

    }else throw new Error('check config and try again')

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

  //the event bringer. Because having 'callbacks' it's the worst thing ever
  var events = {
    events: {},
    set create(evts) {
      var dom = window.document;
      var family = 'dt';
      if (window.CustomEvent) {
        for (var i = 0, event; event = evts[i]; i++)
          events[event] = {
            success: new CustomEvent(['success', event, family].join('.')),
            fail: new CustomEvent(['fail', event, family].join('.'))
          }
      } else {
        // IE impl. for throwing events
        for (var i = 0, event; event = evts[i]; i++)
          events[event] = {
            success: dom.createElement('Event')
              .initEvent(['success', event, family].join('.'), false, false),
            fail: dom.createElement('Event')
              .initEvent(['fail', event, family].join('.'), false, false)
          }
      }
    },
    set trigger(evt) {
      var dom = window.document;
      var event = events[evt[0]][evt[1]];
      event.data = evt[2]
      dom.dispatchEvent?
        dom.dispatchEvent(event)
        : dom.fireEvent('on' + event.eventType, event);
    }
  };
  var paramsAuthProcessor =  function(){
    var params = []
    for (var prop in config.app)
      if (config.app.hasOwnProperty(prop) && prop != 'secret')
        params.push([encodeURIComponent(prop), encodeURIComponent(config.app[prop])].join('='))
    params.push([encodeURIComponent('response_type'), encodeURIComponent('code')].join('='))
    return params.join('&')
  };
  // get well formed url for lunching docktrackr authorization
  var auth = function (){
    return [ config.url, paramsAuthProcessor() ].join('?')
  };
  // popup window in order to authorize the app
  var authorize = function (){
    if ( config.app.secret ){
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
    if (tokenData.access_token){
      setTimeOutToken()
      events.trigger = ['login','success', { access_token: tokenData.access_token, expires_in: tokenData.expires_in }]
    }else
      events.trigger = [ 'login', 'fail']
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

  // standard Answer
  var policyAnswer = function(type){
   return function(e){
     console.log(e);
     result  = e.status == 200 ? 'success' : 'fail'
     events.trigger = [type, result, e]
   }
  }

  // createAPolicy
  var createAPolicy = function () {
    if ( ! anyPrivileges() ) throw new Error('no privilages given')

    var xhr = new XMLHttpRequest()
    , formData = new FormData()
    formData.append('policy[verify_identity]', true)

    for (privilege in privileges)
      if (privileges[privilege].length)
        formData.append('policy[privileges][' + privilege + '][]', privileges[privilege].join(','))

    xhr.open('POST', 'https://api.doctrackr.com/v1/policies', true);
    xhr.setRequestHeader('Authorization', ['Bearer', returnToken()].join(' '))
    xhr.onload = standardAnswer('createPolicy')
    xhr.send(formData)
  }

  // getUser
  var getUser = function () {
    var xhr = new XMLHttpRequest()
    xhr.open('GET', 'https://api.doctrackr.com/users/me' , true);
    xhr.setRequestHeader('Authorization', ['Bearer', returnToken()].join(' '))
    xhr.onload = policyAnswer('user')
  }

  // updatePolicy
  var updatePolicy = function (policy_id) {
    if ( policy_id && ! anyPrivileges() ) throw new Error('check policy_id given and try again')

    var xhr = new XMLHttpRequest()
    , formData = new FormData()

    for (privilege in privileges)
      if (privileges[privilege].length)
        formData.append('policy[privileges][' + privilege + ']', privileges[privilege].join(','))

    xhr.open('PUT', 'https://api.doctrackr.com/v1/policies/' + policy_id, true);
    xhr.setRequestHeader('Authorization', ['Bearer', returnToken()].join(' '))
    xhr.onload = policyAnswer('updatePolicy')
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
    , properties = { grant_type: 'authorization_code', code: code, client_id: config.app.client_id, client_secret: config.app.secret, redirect_uri: config.app.redirect_uri }
    , params = paramsProcessor(properties)
    , action = [config.token_url, params].join('?')
    console.warn('action: ', action)

    xhr.open('POST', action, true);
    xhr.onload = storeToken
    xhr.send();
  }

  // getProtectedFile
  var getProtectedFile = function (id, url, name) {
    console.log('DONE:', id, url, name)
    events.trigger = ['createFile', 'success' , {id: id, url: url, name: name}]
  }

  // getStatus
  var getStatus = function (id) {
    return function(){
      var xhr = new XMLHttpRequest()
        , action = ['https://api.doctrackr.com/v1/documents/', id].join('')
      console.log('requestStatus: ',  action + '?access_token=' + returnToken())
      xhr.open('GET', action , true);
      xhr.setRequestHeader('Authorization', ['Bearer', returnToken()].join(' '))
      xhr.onload = getResponseFile
      xhr.send()
    }
  }

  // checkForStatus
  var checkForStatus = function (id, delay) {
    console.log('checkForStatus:', id, delay)
    events.trigger = ['statusFile', 'success', {id: id, delay: delay}]
    setTimeout( getStatus(id), delay)
  }

  // getResponseFile
  var getResponseFile = function (e) {
    console.log('resp:' + e)
    var resp = JSON.parse(e.target.response)
    console.log('getResponseFile: ', resp, resp.status, resp.id)
    if ( resp && resp.id ){
      resp.status == 'ENABLED'?
      getProtectedFile(resp.id, resp.url, resp.name)
      : checkForStatus(resp.id, 5 * Number(1000))
    } else throw new Error("can't go on without an id")
  }

  // protectAFile
  var protectAFile = function (blob, all) {
    if ( blob && ( !anyPrivileges() || all)){
      var formData = new FormData()
        , xhr = new XMLHttpRequest()
      formData.append('fileupload', blob, blob.name)
      if (all){
        formData.append('policy[verify_identity]', false)
        formData.append('policy[privileges][can_view][]', 'everyone')
      }
      else{
        formData.append('policy[verify_identity]', true)
        for (privilege in privileges)
          if (privileges[privilege].length)
            formData.append('policy[privileges][' + privilege + '][]', privileges[privilege].join(','))
      }

      xhr.open('POST', 'https://api.doctrackr.com/v1/documents', true);
      xhr.setRequestHeader('Authorization', ['Bearer', returnToken()].join(' '))
      xhr.onload = getResponseFile
      xhr.send(formData)
    }else
      throw new Error('check the file or privileges given and try again')
  }

  // destroy session
  var logout = function (reason) {
    valid = false
    tokenData = {}
    clearTimeout(tokenTimer)
    events.trigger = ['logout', 'success', { reason: reason }]
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
    , login: authorize
    , getToken: returnToken
    , protectAFile: protectAFile
    , policy: {
        create: createAPolicy
      , addPrivilege: addPrivilege
      , removePrivilege: removePrivilege
      , update: updatePolicy
    }
    , version: versions.version
    , test:{
      anyPrivileges: anyPrivileges
      , privileges: privileges
    }
    , logout: logout
    , mnt: {
      events: events
      , config: config
      , aver: paramsAuthProcessor
  }}
}());
