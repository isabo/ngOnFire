var ngOnFire = {};


/**
 * @param {onfire.Ref} ref
 * @constructor
 */
ngOnFire.$Model = function(ref) {};

ngOnFire.$Model.prototype.$dispose = function() {};

/**
 * @return {!angular.$q.Promise<ngOnFire.$Model,Error>}
 */
ngOnFire.$Model.prototype.$whenLoaded = function() {};

/**
 * @return {string}
 */
ngOnFire.$Model.prototype.$key = function() {};

/**
 * @return {boolean}
 */
ngOnFire.$Model.prototype.$exists = function() {};

/**
 * @return {boolean}
 */
ngOnFire.$Model.prototype.$hasChanges = function() {};

/**
 * @param {string} key
 * @param {Firebase.Value} value
 * @return {!ngOnFire.$Model}
 */
ngOnFire.$Model.prototype.$set = function(key, value) {};

/**
 * @return {!angular.$q.Promise<ngOnFire.$Model,Error>}
 */
ngOnFire.$Model.prototype.$save = function() {};


/**
 * @param {onfire.Ref} ref
 * @constructor
 * @extends {ngOnFire.$Model}
 */
ngOnFire.$Collection = function(ref) {};

/**
 * @return {!angular.$q.Promise<ngOnFire.$Collection,Error>}
 * @override
 */
ngOnFire.$Collection.prototype.$whenLoaded = function() {};

/**
 * @param {string} key
 * @param {Firebase.Value} value
 * @return {!ngOnFire.$Collection}
 * @override
 */
ngOnFire.$Collection.prototype.$set = function(key, value) {};

/**
 * @return {!angular.$q.Promise<ngOnFire.$Collection,Error>}
 * @override
 */
ngOnFire.$Collection.prototype.$save = function() {};

/**
 * @param {string} key
 * @return {Firebase.Value|ngOnFire.$Model|ngOnFire.$Collection}
 */
ngOnFire.$Collection.prototype.$get = function(key) {};

/**
 * @return {number}
 */
ngOnFire.$Collection.prototype.$count = function() {};

/**
 * @return {boolean}
 */
ngOnFire.$Collection.prototype.$containsKey = function() {};

/**
 * @return {!Array<string>}
 */
ngOnFire.$Collection.prototype.$keys = function() {};

/**
 * @param {!Object=} opt_values
 * @return {!angular.$q.Promise<(ngOnFire.$Model|ngOnFire.$Collection),Error>}
 */
ngOnFire.$Collection.prototype.$create = function(opt_values) {};

/**
 * @param {string} key
 * @return {!angular.$q.Promise<null,Error>}
 */
ngOnFire.$Collection.prototype.$remove = function(key) {};

/**
 * @param {ngOnFire.$Collection.ForEachCallBack} callback
 * @return {!angular.$q.Promise<null,Error>}
 */
ngOnFire.$Collection.prototype.$forEach = function(callback) {};


/**
 * @typedef {function((ngOnFire.$Model|ngOnFire.$Collection|Firebase.Value), string):(!angular.$q.Promise|undefined)}
 */
ngOnFire.$Collection.ForEachCallBack;
