(function(){

angular.module('ngOnFire').
    factory('$model', createModelService);


/**
 * @param {!angular.Scope} $rootScope The Angular $rootScope.
 * @param {!angular.$q} $q The Angular promise service.
 * @ngInject
 */
function createModelService($rootScope, $q) {

    /**
     * Base class for Angular-friendly models. It instantiates a "real" model and proxies the
     * standard methods through to it.
     *
     * Note:
     * Quoted property names are used in order to prevent Google Closure Compiler from renaming the
     * properties, because we cannot guarantee that the new names will start with $, which is
     * necessary if we want Angular to ignore these. Tagging the public properties with @export will
     * not prevent the compiler from shortening the function name: all it does is tell the compiler
     * to add the human-readable name as an alias to the short-name.
     *
     * @param {ModelCtor|onfire.model.Model} ctorOrInstance The constructor of the relevant onfire
     *      model, or a model instance that we need to represent.
     * @param {!onfire.Ref=} ref A reference to the location of the data in Firebase.
     * @constructor
     */
    function ProxyModel(ctorOrInstance, ref) {

        // For Google Closure Compiler's benefit, this is broken down into multiple steps.
        var realModel;
        if (ctorOrInstance instanceof onfire.model.Model) {
            realModel = ctorOrInstance;
        } else {
            var ctor = /** @type ModelCtor */(ctorOrInstance);
            realModel = new ctor(/** @type {!onfire.Ref}*/(ref));
        }

        /**
         * @type {!onfire.model.Model}
         * @private
         */
        this['$$model_'] = realModel;

        // Listen for changes on the original model, and make sure that Angular notices.
        realModel.onValueChanged(function() {
            // This will schedule a digest cycle that will pick up the change.
            $rootScope.$evalAsync(function(){});
        });
    }

    /**
     * Free up memory when we're finished with it.
     */
    ProxyModel.prototype['$dispose'] = function() {
        this['$$model_'].dispose();
        this['$$model_'] = null;
    };

    // Proxy the public methods from the "real" model constructor's prototype.
    var propertyNames = ['whenLoaded', 'key', 'exists', 'hasChanges', 'set', 'save'];
    for (var i in propertyNames) {
        var name = propertyNames[i]
        ProxyModel.prototype['$' + name] = generateProxyMethod(name);
    }


    /**
     * Base class for Angular-friendly collections. It instantiates a "real" model and proxies the
     * standard methods through to it.
     *
     * @param {CollectionCtor|!onfire.model.Collection} ctorOrInstance The constructor of the
     *      relevant onfire model, or an instance.
     * @param {
        function(new:ProxyModel, !onfire.Ref)
        |
        function(new:ProxyCollection, !onfire.Ref)
    } memberProxyCtor The constructor to use when creating proxies for the collection members.
     * @param {!onfire.Ref=} ref A reference to the location of the data in Firebase.
     * @constructor
     */
    function ProxyCollection(ctorOrInstance, memberProxyCtor, ref) {

        // For Google Closure Compiler's benefit, this is broken down into multiple steps.
        var realModel;
        if (ctorOrInstance instanceof onfire.model.Collection) {
            realModel = ctorOrInstance;
        } else {
            var ctor = /** @type CollectionCtor */(ctorOrInstance);
            realModel = new ctor(/** @type {!onfire.Ref}*/(ref));
        }

        /**
         * @type {!onfire.model.Collection}
         * @private
         */
        this['$$model_'] = realModel;

        /**
         * The constructor to use when creating proxies for the collection members.
         *
         * @type {ProxyModel|ProxyCollection}
         * @private
         */
        this['$$memberProxyCtor_'] = memberProxyCtor;


        // Listen for changes on the original model, and make sure that Angular notices.
        realModel.onChildAdded(handleChildAdded_.bind(this));
        realModel.onChildRemoved(handleChildRemoved_.bind(this));


        /**
         * Indicates whether this collection is loaded.
         *
         * @type {boolean}
         * @private
         */
        this['$$isLoaded_'] = false;

        // Unlike the non-Angular collection, which instantiates members on demand only, in this
        // Angular-friendly implementation, we need to instantiate each member so that ng-repeat
        // can use them immediately.
        // onfire.model.Collection, during the loading phase, does not trigger child_added events,
        // so we have to instantiate the members when the load is complete.
        var self = this;
        var p = realModel.whenLoaded().
            then(function(/** !onfire.model.Collection */model) {
                return model.forEach(function(/** !onfire.model.Model|Firebase.Value */member, /** string */key) {
                    if (member instanceof onfire.model.Model) {
                        // The member model is fully loaded at this point.
                        // Represent it using a ProxyModel instance.
                        self[key] = newProxyModel_(self['$$memberProxyCtor_'], member);
                    } else {
                        // It's a simple value.
                        self[key] = member;
                    }
                });
            }).
            then(function() {
                self['$$isLoaded_'] = true;
                // No digests were triggered while instantiating the members. Trigger a digest to
                // pick them all up in one go.
                scheduleDigest_.call(self);
                return self;
            });

        /**
         * @type {!Promise<(!ProxyCollection),!Error>}
         * @private
         */
        this['$$loadPromise_'] = p;
    };

    /**
     * Synchronously retrieves the value associated with a key. If the collection members are not
     * primitive values, a model instance will be returned. Such models will be ready to use --
     * there is no need to call $whenLoaded().
     * Throws an exception if the key does not have a value in the underlying data.
     */
    ProxyCollection.prototype['$get'] = get_;

    /**
     * @param {string} key A key of a member of the the collection.
     * @return {Firebase.Value|!ProxyModel|!ProxyCollection} A primitive value or a model instance.
     * @this {ProxyCollection}
     */
    function get_(key) {

        // For Google Closure Compiler's benefit.
        var thisModel = /** @type {!onfire.model.Collection} */(this['$$model_']);

        if (!this['$$isLoaded_']) {
            throw new Error(onfire.model.Error.NOT_LOADED);
        }

        if (!thisModel.containsKey(key)) {
            throw new Error(onfire.model.Error.NO_SUCH_KEY);
        }

        return this[key];
    }


    /**
     * Asynchronously creates a model instance and adds it as a member of the collection, with an
     * automatically generated key.
     */
    ProxyCollection.prototype['$create'] = create_;

    /**
     * @param {!Object<string,Firebase.Value>=} opt_values An object containing the property/value
     *      pairs to initialize the new object with.
     * @return {!angular.$q.Promise<(!ProxyModel|!ProxyCollection),!Error>} An angular promise that
     *      resolves to a model instance, or is rejected with an error.
     * @this {ProxyCollection}
     */
    function create_(opt_values) {

        // For Google Closure Compiler's benefit.
        var thisModel = /** @type {!onfire.model.Collection} */(this['$$model_']);

        var self = this;
        return thisModel.create(opt_values).
            then(function(/** !onfire.model.Model */model) {
                // By this point, we should have already handled the child_added event.
                // But only if opt_values was supplied.
                // If we have a value for this key, use it, otherwise use the provided value.
                var key = model.key();
                if (key in self) {
                    model.dispose();
                    return get_.call(self, key);
                } else {
                    return newProxyModel_(self['$$memberProxyCtor_'], model)['$whenLoaded']();
                    // Note: handleChildAdded_ will create a distinct instance from this one. This
                    // one will have to be disposed after use, whereas the one from handleChildAdded_
                    // will not.
                }
            });
    }


    /**
     * Calls a callback for each member of the collection. Returns a promise that is resolved once
     * all the callbacks have been invoked, and any promises returned by callbacks have themselves
     * been resolved.
     * The callback function should accept a primitive value or a model instance, according to the
     * type of members in the collection. It does not need to return anything, but if it returns a
     * promise, the main return value of this method (a promise) will depend on it.
     */
    ProxyCollection.prototype['$forEach'] = forEach_;

    /**
     * @param {
            !function((!ProxyModel|!ProxyCollection|Firebase.Value), string=):(!angular.$q.Promise|undefined)
        } callback
     * @return {!angular.$q.Promise} A promise that in resolved when all callbacks have completed.
     * @this {ProxyCollection}
     */
    function forEach_(callback) {

        // For Google Closure Compiler's benefit.
        var thisModel = /** @type {!onfire.model.Collection} */(this['$$model_']);

        var promises = [];
        var keys = thisModel.keys();
        keys.map(function(key) {
            var model = self[key];
            var p = callback.call(null, model, key);
            if (p && typeof p.then === 'function') {
                promises.push($q.when(p));
            }
        });

        return $q.all(promises);
    }


    /**
     * Returns a promise that is resolved to this instance when the data has been loaded.
     */
    ProxyCollection.prototype['$whenLoaded'] = whenLoaded_;

    /**
     * @return {!angular.$q.Promise<(ProxyModel|!ProxyCollection),!Error>} A promise that resolves
     *      to this instance when the data has been loaded.
     * @this {ProxyCollection}
     */
    function whenLoaded_() {

        // We're only loaded once we've instantiated the member models.
        return $q.when(this['$$loadPromise_']);
    };


    /**
     * A key/value pair has been added. If the value is a model, create a Proxy for it.
     *
     * @param {string} key
     * @this {ProxyCollection}
     */
    function handleChildAdded_(key) {

        // For Google Closure Compiler's benefit.
        var thisModel = /** @type {!onfire.model.Collection} */(this['$$model_']);

        var self = this;
        return thisModel.fetch(key).
            then(function(/** !onfire.model.Model|Firebase.Value */model) {
                self[key] = (model instanceof onfire.model.Model) ?
                    newProxyModel_(self['$$memberProxyCtor_'], model) : model;
                scheduleDigest_.call(self);
            });
    }


    /**
     * A key/value pair has been removed.
     *
     * @param {string} key
     * @param {boolean=} opt_noDigest If truthy, no digest will be scheduled.
     * @this {ProxyCollection}
     */
    function handleChildRemoved_(key, opt_noDigest) {

        var model = this[key];
        if (model) {
            delete this[key];
            if (model instanceof ProxyModel || model instanceof ProxyCollection) {
                model['$dispose']();
            }
            if (!opt_noDigest) {
                scheduleDigest_.call(this);
            }
        }
    }


    /**
     * Schedules an Angular digest cycle that will pick up recent changes.
     *
     * @this {ProxyCollection}
     */
    function scheduleDigest_() {

        $rootScope.$evalAsync(function(){});
    }


    /**
     * Create a new proxy instance appropriate for the model that is being proxied.
     *
     * @param {
        (
            function(new:ProxyModel, !onfire.model.Model)
            |
            function(new:ProxyCollection, !onfire.model.Collection)
        )} proxyCtor
     * @param {!onfire.model.Model} realModel
     * @return {!ProxyModel|!ProxyCollection}
     */
    function newProxyModel_(proxyCtor, realModel) {

        return new proxyCtor(realModel);
    }


    /**
     * Free up memory when we're finished with it.
     */
    ProxyCollection.prototype['$dispose'] = dispose_;

    /**
     * @this {ProxyCollection}
     */
    function dispose_() {

        // For Google Closure Compiler's benefit.
        var thisModel = /** @type {!onfire.model.Collection} */(this['$$model_']);

        // Dispose of the subordinate models.
        var keys = thisModel.keys();
        for (var i = 0; i < keys.length; i++) {
            handleChildRemoved_.call(this, keys[i], true);
        }

        thisModel.dispose();
        this['$$model_'] = null;
    };


    // TODO: fetchOrCreate needed?

    // Proxy the public methods from the "real" model constructor's prototype.
    propertyNames = ['key', 'exists', 'hasChanges', 'save', 'set', 'remove', 'containsKey', 'keys',
        'count'];
    for (var i in propertyNames) {
        var name = propertyNames[i];
        ProxyCollection.prototype['$' + name] = generateProxyMethod(name);
    }



    /**
     * Takes a "real" model constructor and returns an equivalent constructor that is Angular-
     * friendly.
     *
     * @param {ModelCtor|CollectionCtor} modelCtor A model constructor.
     * @return {
            function(new:ProxyModel, !onfire.Ref)
            |
            function(new:ProxyCollection, !onfire.Ref)
        }
     */
    function generateProxyModelCtor(modelCtor) {

        var proxyCtor = (modelCtor.prototype instanceof onfire.model.Collection) ?
                generateSpecificProxyCollectionCtor(modelCtor) :
                generateSpecificProxyModelCtor(modelCtor);

        // Add proxies to access the data, and to call methods defined on the real model.
        generatePrototypeProperties(proxyCtor, modelCtor);

        return proxyCtor;
    }


    /**
     * Derives a specific proxy model class from the base ProxyModel class.
     *
     * @param {ModelCtor} modelCtor
     * @return {function(new:ProxyModel, !onfire.Ref)}
     */
    function generateSpecificProxyModelCtor(modelCtor) {

        /**
         * @param {!onfire.Ref|!onfire.model.Model} refOrModel
         * @constructor
         * @extends {ProxyModel}
         */
        var SpecificProxyModel = function(refOrModel){
            if (refOrModel instanceof onfire.Ref) {
                SpecificProxyModel.base(this, 'constructor', modelCtor, refOrModel);
            } else {
                // Assume real model instance.
                SpecificProxyModel.base(this, 'constructor', refOrModel);
            }
        };
        goog.inherits(SpecificProxyModel, ProxyModel);

        return SpecificProxyModel;
    }


    /**
     * Derives a specific proxy collection class from the base ProxyCollection class.
     *
     * @param {CollectionCtor} modelCtor
     * @return {function(new:ProxyCollection, !onfire.Ref)}
     */
    function generateSpecificProxyCollectionCtor(modelCtor) {

        /**
         * @return {ModelCtor|CollectionCtor}
         * @suppress {checkTypes} because getMemberCtor is a static method added to the inherited
         *      model constructor, and therefore not defined in the OnFire externs.
         */
        function getMemberCtor() {
            return /** @type {ModelCtor} */(modelCtor.getMemberCtor());
        }
        var memberProxyCtor = generateProxyModelCtor(getMemberCtor());

        /**
         * @param {!onfire.Ref|!onfire.model.Collection} refOrCollection
         * @constructor
         * @extends {ProxyCollection}
         */
        var SpecificProxyCollection = function(refOrCollection){
            if (refOrCollection instanceof onfire.Ref) {
                SpecificProxyCollection.base(this, 'constructor', modelCtor, memberProxyCtor,
                    refOrCollection);
            } else {
                // Assume real collection instance.
                SpecificProxyCollection.base(this, 'constructor', refOrCollection, memberProxyCtor);
            }
        };
        goog.inherits(SpecificProxyCollection, ProxyCollection);

        return SpecificProxyCollection;
    }


    /**
     * Add proxy methods and properties onto our proxy model prototype so that it has the
     * functionality of the original.
     *
     * @param {ModelCtor} realCtor The original model
     *      constructor for which the proxy is being created.
     * @param {function(new:ProxyModel, !onfire.Ref)} proxyCtor The proxy constructor we are
     *      building.
     */
    function generatePrototypeProperties(proxyCtor, realCtor) {

        /**
         * @return {!Object}
         * @suppress {checkTypes} because getSchema is a static method added to the inherited model
         *      constructor, and therefore not defined in the OnFire externs.
         */
        function getSchema() {
            return /** @type {!Object} */(realCtor.getSchema());
        }
        var schema = getSchema();

        for (var name in realCtor.prototype) {

            if (realCtor.prototype.hasOwnProperty(name)) {

                // This property was created directly on the prototype, i.e. it does not belong to
                // onfire.model.Model, whose properties will be proxied explicitly.

                if (typeof realCtor.prototype[name] === 'function') {
                    // This is one of the following:
                    // 1. A getter/setter generated by onfire.
                    // 2. A constructor for a subordinate model. If so the name will end in Ctor_.
                    // 3. A method added to the prototype by the consumer.

                    if (name in schema) {
                        // It's a getter/setter. We need to create a getter and a setter on the
                        // proxy class we're generating.
                        defineProxyProperty(proxyCtor, name);

                    } else if (name.slice(-5) === 'Ctor_') {

                        // A constructor for a subordinate model. None of our business.
                        continue;

                    } else {

                        // It's a method added to the prototype by the consumer.
                        // Add an Angular-friendly proxy for the method.
                        proxyCtor.prototype['$' + name] = generateProxyMethod(name);
                    }
                } else {
                    // This property/value pair was added by the consumer.
                    // Proxy it? TODO ?
                }
            }
        }
    }


    /**
     * Defines a getter and setter for a named property on the prototype of the supplied proxy.
     * These methods pass through to the "real" model instance.
     *
     * @param {function(new:ProxyModel, !onfire.Ref)} proxyCtor The constructor of a proxy model we
     *      are building.
     * @param {string} propName The name of the model property we are proxying.
     */
    function defineProxyProperty(proxyCtor, propName) {

        Object.defineProperty(proxyCtor.prototype, propName,
            {
                get: function() {
                    return this['$$model_'][propName].call(this['$$model_']); // TODO: need to proxy this!?
                },
                set: function(v) {
                    this['$$model_'][propName].call(this['$$model_'], v);
                },
                enumerable: true // Angular needs to be able to enumerate this property.
            });
    }


    /**
     * Generate a method to add to our ProxyModel prototype, which proxies a method on the "real"
     * model instance. If the real method returns a promise, it will be returned as an angular
     * promise. If the promise resolves to the model, it is the ProxyModel that will be returned.
     *
     * @param {string} methodName The name of the method to be proxied.
     * @return {function(this:ProxyModel)}
     */
    function generateProxyMethod(methodName) {

        /**
         * @this {ProxyModel}
         */
        function method() {
            var args = Array.prototype.slice.apply(arguments);
            args.unshift(this, methodName);
            return callRealMethod.apply(null, args)
        }

        return method;
    }


    /**
     * Enable a ProxyModel instance to call a method on the "real" model, and return the result
     * in an Angular-friendly way, i.e. if the real method returns a promise, it will be returned as
     * an angular promise. If the promise resolves to the model itself, it is the ProxyModel
     * instance that will be returned instead of the onfire.model.Model instance.
     *
     * @param {!ProxyModel} proxyModel A ProxyModel instance.
     * @param {string} methodName The name of the "real" method.
     * @param {...*} var_args The appropriate arguments, if any, for the original method.
     * @return {*}
     */
    function callRealMethod(proxyModel, methodName, var_args) {

        // Call the "real" method.
        var args = Array.prototype.slice.call(arguments, 2);
        var realModel = proxyModel['$$model_'];
        var v = realModel[methodName].apply(realModel, args);

        if (v && typeof v.then === 'function') {
            // The "real" method returned a Then-able. We need to wrap it in an Angular promise.
            // If the promise returns the real model itself, return the proxy instance instead.
            var p = v.then(function(result) {
                if (result === realModel) {
                    return proxyModel;
                }
                return result;
            });
            return $q.when(p);
        } else {
            // If the "real" method was chainable, i.e. returned the model itself, return the proxy.
            if (v === realModel) {
                return proxyModel;
            }
            return v;
        }
    }


    /**
     * @param {function(new:onfire.model.Model)} ctor
     * @return {function(new:ProxyModel, !onfire.Ref)}
     */
    function service(ctor) {
        return generateProxyModelCtor(ctor);
    }
    return service;
}

})();

/**
 * Allows us to use ModelCtor as shorthand.
 *
 * @typedef {function(new:onfire.model.Model, !onfire.Ref)}
 */
var ModelCtor;

/**
 * Allows us to use CollectionCtor as shorthand.
 *
 * @typedef {function(new:onfire.model.Collection, !onfire.Ref)}
 */
var CollectionCtor;
