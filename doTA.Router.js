(function(window, angular, undefined) {'use strict';

	var $scope, $doTAView, rawElem, loaded, preloaded; //, compileSelector;
	if (document.querySelector){
		rawElem = document.querySelector('[dota-view]')
		$doTAView = angular.element(rawElem);
		loaded = $doTAView.attr('loaded');
		preloaded = loaded === location.pathname;
		if (loaded) {
			$doTAView.removeAttr('loaded');
		}
	}

	//this should be faster than angular.forEach
	function forEachArray(arr, fn, context) {
		if (!arr) { return; }
		if (arr.forEach) {
			return arr.forEach(fn);
		}
		for (var i = 0, l = arr.length; i < l; i++) {
			fn.call(context, arr[i], i);
		}
	}

	function forEachObject(obj, iter) {
		if (!obj) { return; }
		for (var x in obj) {
			if (x in obj) {
				iter(obj[x], x);
			}
		}
	}

	function inherit(parent, extra) {
		return angular.extend(new (angular.extend(function() {}, {prototype:parent}))(), extra);
	}

	//shared with server and client
	var $$location, $$rootScope;
	var paths = [], $route = {}, forceReload = false;

	/* global -doTARouteModule */
	var doTARouteModule = angular.module('doTA.Router', ['ng', 'doTA']).
		provider('$route', $doTARouteProvider);

	function $doTARouteProvider(){

		this.route = function(path, route) {
			paths.push([path, route]);
			return this;
		};

		this.$get = ['$rootScope',
			'$location',
			'$routeParams',
			'$q',
			'$injector',
			'$http',
			'$templateCache',
			'$compile',
			'$controller',
			'$filter',
			'doTA',
			function($rootScope, $location, $routeParams, $q, $injector,
				$http, $templateCache, $compile, $controller, $filter, doTA) {

				//$location and $rootScope is shared between server and client
				$$location = $location;
				$$rootScope = $rootScope;

				$route.reload = function() {
					forceReload = true;
					$rootScope.$evalAsync(updateRoute);
				};

				$rootScope.$on('$locationChangeSuccess', updateRoute);

				return $route;

				/////////////////////////////////////////////////////

				function updateRoute() {
					var next = parseRoute(),
						last = $route.current;

					if (next && last && next.$$route === last.$$route
						&& angular.equals(next.pathParams, last.pathParams)
						&& !next.reloadOnSearch && !forceReload) {
						last.params = next.params;
						cleanCopy(last.params, $routeParams);
						$rootScope.$broadcast('$routeUpdate', last);
					} else if (next || last) {
						forceReload = false;
						$rootScope.$broadcast('$routeChangeStart', next, last);
						$route.current = next;
						if (next) {
							if (next.redirectTo) {
								if (angular.isString(next.redirectTo)) {
									$location.path(next.redirectTo).search(next.params)
										.replace();
								} else {
									$location.url(next.redirectTo(next.pathParams, $location.path(), $location.search()))
										.replace();
								}
							}
						}

						$q.when(next).
							then(function() {
								if (next) {
									var locals = angular.extend({}, next.resolve),
										template, templateUrl;
									// console.log('next', next.resolve, next.server);
									// console.log('locals', locals);
									forEachObject(locals, function(value, key) {
										if (preloaded && next.server) {
											//true: skip all resolve, next.server[key]: true
											if (next.server === true || next.server[key] === true) {
												console.log('server only rendered resolve', key, next.server);
												return;
											}
										}
										locals[key] = angular.isString(value) ?
											$injector.get(value) : $injector.invoke(value);
									});

									if (angular.isDefined(template = next.template)) {
										if (angular.isFunction(template)) {
											template = template(next.params);
										}
									} else if (angular.isDefined(templateUrl = next.templateUrl)) {
										if (angular.isFunction(templateUrl)) {
											templateUrl = templateUrl(next.params);
										}
										if (angular.isDefined(templateUrl)) {
											next.loadedTemplateUrl = templateUrl;
											//load if template is not doTA compiled
											if (!doTA.C[templateUrl]) {
												template = $http.get(templateUrl, {cache: $templateCache}).
													then(function(response) { return response.data; });
											}
										}
									}
									if (angular.isDefined(template)) {
										locals.$template = template;
									}
									return $q.all(locals);
								}
							}).
							// after route change
							then(function(locals) {
								if (next === $route.current) {
									if (next) {
										//undefined route
										if (!next.$$route) {
											return;
										}
										next.locals = locals;
										cleanCopy(next.params, $routeParams);
									}
									$rootScope.$broadcast('$routeChangeSuccess', next, last);

									var current = next.$$route;
									var attrDoTARender = current.templateUrl;

									if($scope) {
										$scope.$destroy();
									}
									$scope = $rootScope.$new();
									locals.$scope = $scope;

									if (current.controller) {
										var controller = $controller(current.controller, locals);
										if (current.controllerAs) {
											$scope[current.controllerAs] = controller;
										}

										$doTAView.data('$ngControllerController', controller);
										$doTAView.children().data('$ngControllerController', controller);
									}

									if (!attrDoTARender) {
										return $scope.$emit('$viewContentLoaded');
									}

									var options = {
										debug: 0, encode: 0, optimize: 1, loose: 1, event: 1
									};
									if (typeof current.options === 'object') {
										copy(current.options, options);
									}

									var compiledFn;
									if (doTA.C[attrDoTARender]) {
										compiledFn = doTA.C[attrDoTARender];
									} else {
										compiledFn = doTA.C[attrDoTARender] = doTA.compile(locals.$template, options);
									}
									var uniqueId = compiledFn.id || doTA.U[attrDoTARender];

									//first load and preloaded
									if (loaded && preloaded) {
										preloaded = loaded = false;
									} else {
										rawElem.innerHTML = compiledFn($scope, $filter);

										//for first load, but not preloaded
										if (loaded) {
											loaded = false;
										}
									}

									if (options.compileAll || options.compileAll === undefined) {
										console.time('$compile');
										$compile(rawElem.contentDocument || rawElem.childNodes)($scope);
										console.timeEnd('$compile');
									} else if (options.compile) {
										console.time('$compile dota-pass:' + attrDoTARender);
										forEachArray(rawElem.querySelectorAll('[dota-pass]'), function(partial){
											$compile(partial)(scope);
										});
										console.timeEnd('$compile dota-pass:' + attrDoTARender);
									}

									if (options.model) {
										doTA.addNgModels(rawElem, $scope, uniqueId);
									}
									if (options.event) {
										doTA.addEvents(rawElem, $scope, options.event, uniqueId);
									}

									$scope.$emit('$viewContentLoaded');

								}
							}, function(error) {
								console.error('route error', error);
								if (next === $route.current) {
									$rootScope.$broadcast('$routeChangeError', next, last, error);
								}
							});
					}
				}

			}];
	}

	doTARouteModule.provider('$routeParams', $RouteParamsProvider);

	function $RouteParamsProvider() {
		this.$get = function() { return {}; };
	}

	//Server Side Router
	doTARouteModule.provider('Router', $RoutesProvider);

	function $RoutesProvider() {
		this.$get = ['$location', '$rootScope', '$routeParams', function($location, $rootScope, $routeParams) {
			$$location = $location;
			$$rootScope = $rootScope;
			return {
				update: function(path) {
					window.location.pathname = window.location.href = path;
					var next = $route.current = parseRoute();

					cleanCopy(next.params, $routeParams);

					return next;
				}
			};
		}];
	}

	//doTA View Directive, do nothing, same as ng-non-bindable
	doTARouteModule.directive('dotaView', function(){
		return {
			terminal: true,
			priority: 10000
		};
	});

	////////////////////////////////////////////////////////////
	function cleanCopy(src, dst) {
		for (var x in dst) {
			delete dst[x];
		}
		copy(src, dst);
	}

	function copy(src, dst) {
		for (var x in src) {
			dst[x] = src[x];
		}
	}

	function merge(dst) {
		for (var i = 1, l = arguments.length; i < l ; i++) {
			copy(arguments[i], dst);
		}
		return dst;
	}

	//Parse a route
	function parseRoute() {
		var params, match, rootParams;
		var locator = {path: $$location.path(), search: $$location.search()};
		forEachArray(paths, function(path) {
			var route = path[1];
			if (!match && (params = switchRegexRouteMatcher(locator, path[0], path[1]))
			) {
				if(route.abstract) {
					rootParams = merge({}, locator.search, params);
				} else {
					match = inherit(route, {
						params: merge({}, locator.search, params, rootParams),
						pathParams: params
					});
					match.$$route = route;
				}
			}
		});

		// No route matched; fallback to "/"
		return match || merge({redirectTo: '/'}, {params: {}, pathParams:{}});
	}

	function switchRegexRouteMatcher(locator, routes, callback) {
		var params = {}, matched;

		if(!routes) { return; }

		for (var r=0; r<routes.length; r++) {
			var route = routes[r];
			if (!route.regexp || !route.regexp.test(locator.path)) {
				continue;
			}
			matched = true;

			var m = route.regexp.exec(locator.path);

			if(route.names) {
				for (var i = 1, len = m.length; i < len; ++i) {
					var key = route.names[i - 1];
					var val = m[i];
					if (key) {
						params[key] = val || '';
					}
				}
			}

			if(route.prefix) {
				locator.path = locator.path.replace(route.regexp, '') || '/';
			} else {
				break;
			}
		}

		if(callback.run && params) {
			callback.run($$rootScope, merge(params, locator.search));
		}

		if (matched) {
			return params;
		}
	}

})(window, window.angular);
