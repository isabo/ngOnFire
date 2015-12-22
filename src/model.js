(function(){

angular.module('ngOnFire').
    factory('$Model', createModelService);


/**
 * @param {!angular.$rootScope} $rootScope The Angular $rootScope.
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
     * @param {function(new:onfire.model.Model)} ctor The constructor of the relevant onfire model.
     * @param {!onfire.Ref} ref A reference to the location of the data in Firebase.
     * @constructor
     */
    function ProxyModel(ctor, ref) {
        /**
         * @type {!onfire.model.Model}
         * @private
         */
        this['$$model_'] = new ctor(ref);

        // Listen for changes on the original model, and make sure that Angular notices.
        this['$$model_'].onValueChanged(function() {
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
    var propertyNames = ['whenLoaded', 'key', 'exists', 'hasChanges', 'save'];
    for (var i in propertyNames) {
        var name = propertyNames[i]
        ProxyModel.prototype['$' + name] = generateProxyMethod(name);
    }


    /**
     * Takes a "real" model constructor and returns an equivalent constructor that is Angular-
     * friendly.
     *
     * @param {function(new:onfire.model.Model)} modelCtor A model constructor.
     * @return {function(new:ProxyModel)}
     */
    function generateProxyModel(modelCtor) {

        /**
         * @param {!onfire.Ref} ref
         * @constructor
         * @extends {ProxyModel}
         */
        var SpecificProxyModel = function(ref){
            SpecificProxyModel.base(this, 'constructor', modelCtor, ref);
        };
        goog.inherits(SpecificProxyModel, ProxyModel);

        // Add proxies to access the data, and to call methods defined on the real model.
        generateProperties(SpecificProxyModel, modelCtor);

        return SpecificProxyModel;
    }


    /**
     * Add proxy methods and properties onto our proxy model prototype so that it has the
     * functionality of the original.
     *
     * @param {function(new:onfire.model.Model)} realCtor The original model constructor for which
     *      the proxy is being created.
     * @param {function(new:ProxyModel)} proxyCtor The proxy constructor we are building.
     */
    function generateProperties(proxyCtor, realCtor) {

        for (var name in realCtor.prototype) {

            if (realCtor.prototype.hasOwnProperty(name)) {

                // This property was created directly on the prototype, i.e. it does not belong to
                // onfire.model.Model, whose properties will be proxied explicitly.

                if (typeof realCtor.prototype[name] === 'function') {
                    // This is one of the following:
                    // 1. A getter/setter generated by onfire.
                    // 2. A constructor for a subordinate model. If so the name will end in Ctor_.
                    // 3. A method added to the prototype by the consumer.

                    if (name in realCtor.getSchema()) {
                        // It's a getter/setter. We need to create a getter and a setter on the
                        // proxy class we're generating.
                        defineProxyProperty(proxyCtor, name);

                    } else if (name.slice(-5) === 'Ctor_') {

                        // A constructor for a subordinate model. None of our business.
                        continue;

                    } else {

                        // It's a method added to the prototype by the consumer.
                        // Add an Angular-friendly proxy for the method.
                        proxyCtor.prototype['$' + name] = generateProxyMethod(proxyCtor, name);
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
     * @param {function(new:ProxyModel)} proxyCtor The constructor of a proxy model we are building.
     * @param {string} propName The name of the model property we are proxying.
     */
    function defineProxyProperty(proxyCtor, propName) {

        Object.defineProperty(proxyCtor.prototype, propName,
            {
                get: function() {
                    return this['$$model_'][propName].call(this['$$model_']);
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
        return function() {
            var args = Array.prototype.slice.apply(arguments, 0);
            args.shift(methodName);
            return callRealMethod.apply(this, args)
        }
    }


    /**
     * Enable a ProxyModel instance to call a method on the "real" model, and return the result
     * in an Angular-friendly way, i.e. if the real method returns a promise, it will be returned as
     * an angular promise. If the promise resolves to the model itself, it is the ProxyModel
     * instance that will be returned instead of the onfire.model.Model instance.
     *
     * @param {!ProxyModel} proxyModel A ProxyModel instance.
     * @param {...*=} var_args The appropriate arguments, if any, for the original method.
     * @return {*}
     */
    function callRealMethod(proxyModel, methodName, var_args) {

        // Call the "real" method.
        var args = Array.prototype.slice.apply(arguments, 2);
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
            return v;
        }
    }


    /**
     * @param {function(new:onfire.model.Model)} ctor
     * @return {function(new:ProxyModel)}
     */
    return function(ctor) {
        return generateProxyModel(ctor);
    };
}

})();
