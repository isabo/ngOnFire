angular.module('test', ['ngOnFire']);

var Person = onfire.defineModel(
    {
        name: 'string',
        age: 'number',
        likesBeer: 'boolean'
    });



describe('$Model service', function() {

    // Set the context for inject calls.
    beforeEach(angular.mock.module('test'));

    it('exists and is injectable', inject(function($Model) {
        expect(typeof $Model).toBe('function');
    }));
});



describe('$Model service generates a constructor whose prototype', function() {

    var $Person;

    // Set the context for inject calls.
    beforeEach(angular.mock.module('test'));

    beforeEach(inject(function($Model) {
        $Person = $Model(Person);
    }));


    it('has the expected enumerable data properties', function() {

        var expectedProps = [
            'constructor',
            'name',
            'age',
            'likesBeer'
        ].sort();

        var actualProps = Object.keys($Person.prototype).sort();

        expect(actualProps).toEqual(expectedProps);
    });


    it('has the expected standard methods', function() {

        var inheritedMethods = [
            '$dispose',
            '$whenLoaded',
            '$key',
            '$exists',
            '$hasChanges',
            '$save'
        ];

        for (var i = 0; i < inheritedMethods.length; i++) {
            expect(inheritedMethods[i] in $Person.prototype).toBe(true);
        }
    });
});



// Reflects changes made to real model
// Real model reflects changes made to proxy
// Each method does what it's supposed to
// When a property is a nested model
