doTA.Router
=================

doTA.Router, full regex and doTA compiled templates support, originally ngRoute fork

- Full regex support
- Support doTA compiled templates

```javascript

app.modules('yourapp', ['doTA.Router'])

// on app.config
$routeProvider

/* prefix for language related, it will striped for others routes, like /en, /jp */
.route([{
    prefix: true,
     regexp: /^(\/en|\/jp|)/,
     names: ["lang"]
 }], {
     "abstract": true,
     /* will run after route is evaluated, no template or controller here */
     run: function($rootScope, params) {
         $rootScope.lang = params.lang.replace(/^\//, "");
         $rootScope.base = params.lang;
     }
 })
 /* you can use like $translate.use($rootScope.lang) on $routeChangeStart event */

/* to exact match root '/' */
.route([{
     regexp: /^\/$/
 }], {
     templateUrl: "app/main/main.html",
     controller: "MainCtrl"
 })

.route([{
     regexp: new RegExp("^/somethings(?:/([a-z-]+))?$"),
     names: ["type"]
 }], {
     templateUrl: "app/somelist/somepage.html",
     controller: "SomePageCtrl"
 })
```

Enjoy!
