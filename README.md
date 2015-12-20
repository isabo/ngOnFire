# ngOnFire
Angular bindings for [OnFire](https://github.com/isabo/onfire).
More convenient (for me) than AngularFire, because
* property values and collection members can be automatically fully-fledged models in their own
  right.
* data manipulation logic does not have to be divided between client and server, and can be
  concentrated in your model definitions, which are then lightly wrapped to make them
  Angular-friendly. (I use Google Closure Compiler so code that is not used by the client does not
  get distributed to the client.)
* model code is not angular-specific.

## How to Use

### Define your models in the normal way
This is core data manipulation code. It is oblivious of Angular and is usable client-side or
server-side and will survive even if the project is rewritten to use a different framework from
Angular.
```javascript
/**
 * @constructor
 * @extends {onfire.model.Model}
 */
var Person = onfire.defineModel(
    {
        firstName: 'string',
        lastName: 'string',
        friends: {
            $id: {
                timestamp: 'string',
                relationshipType: 'string'
            }
        }
    });

Person.prototype.makeFriend = function(withPerson, type) {

    return this.friends().fetchOrCreate(withPerson.key(),
        {
            timestamp: Date.now(),
            relationshipType: type
        });
};


/**
 * @constructor
 * @extends {onfire.model.Collection}
 */
var People = onfire.defineModel(
    {
        $id: Person
    });
```

### Make the models Angular-friendly
ngOnFire provides a `$Model()` service which generates Angular-friendly model constructors from
regular onfire models.
Use this service to generate all your model constructors.
```javascript
angular.module('models', ['ngOnFire']).
    factory('$Person', ['$Model', function($Model) {
        return $Model(Person);
    }]).
    factory('$People', ['$Model', function($Model) {
        return $Model(People);
    }]);
```

### Use in the Angular way
Note how the current user, represented by a Person instance, has a `makeFriend()` method. We didn't
need to use a method defined on our controller or scope.
Also note how the `person` in each iteration is a fully-fledged Person instance that we can pass
to a method that is expecting a `Person` instance.

#### Template:
```html
<div ng-repeat="person in ctrl.people">
    <button ng-click="ctrl.currentUser.makeFriend(person)">
        Add {{person.firstName}} to friends list
    </button>
</div>
```

#### Controller:
```javascript
/**
 * @param {!function(new:ngOnFire.Model)} $People Angular service that is a constructor for collection of people.
 * @param {!function(new:ngOnFire.Model)} $Person Angular service that is a constructor for a person instance.
 * @param {!onfire.Ref} rootRef A reference to the root of the database.
 * @param {string} userId The ID of the current user.
 * @ngInject
 */
function Controller($People, $Person, rootRef, userId) {

    this.people = new $People(rootRef.child('people'));
    this.currentUser = new $Person(rootRef.child('people/' + userId));

    // TODO: hook into the destroy event so we can dispose().
}
```
