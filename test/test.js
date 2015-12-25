angular.module('test', ['ngOnFire']);

// Load initial test data.
var data;
(function loadTestData() {

    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (req.readyState == 4 && req.status == 200) {
            data = JSON.parse(req.responseText);
        }
    };

    req.open("GET", 'base/test/data.json', false);
    req.send();
})();


/**
 * When testing Angular code, we often need to move things along by manually calling $digest().
 * This becomes especially necessary when interacting with non-Angular asynch code, in which case
 * we don't know when is the right time to call $digest. This function will keep calling $digest
 * if there is work to do, just like Angular would.
 *
 * @param {!angular.Scope} $scope
 * @return {*} A handle that needs to be passed when calling stopPumping.
 */
function startPumping($scope) {
    return setInterval(function(){
        if ($scope.$$asyncQueue.length || $scope.$$applyAsyncQueue.length) {
            $scope.$digest();
        }
    }, 10);
}


function stopPumping(handle) {
    clearInterval(handle);
}


// Define our test model in the usual, non-Angular way.
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



describe('Model instance', function() {

    var client = new Firebase('ws://127.0.1:5000');
    var rootRef = new onfire.Ref(client);

    var $rootScope;
    var $Person;

    // Set the context for inject calls.
    beforeEach(angular.mock.module('test'));

    beforeEach(inject(function(_$rootScope_, $Model) {
        $rootScope = _$rootScope_;
        $Person = $Model(Person);
    }));

    it('loads the data correctly', function(done) {

        var p1Ref = rootRef.child('people/p1');
        var person = new $Person(p1Ref);

        person.$whenLoaded().
            then(function() {
                for (var prop in data.people.p1) {
                    expect(person[prop]).toBe(data.people.p1[prop]);
                }
                expect(person.$key()).toBe('p1');
                expect(person.$exists()).toBe(true);
                expect(person.$hasChanges()).toBe(false);
                expect(person.$dispose.bind(person)).not.toThrow();

                stopPumping(h);
                done();
            });

        var h = startPumping($rootScope);
    });


    it('saves the data correctly', function(done) {

        var p1Ref = rootRef.child('people/p1');
        var person = new $Person(p1Ref);

        var prevAge;
        person.$whenLoaded().
            then(function() {
                prevAge = person.age;
                person.age = prevAge + 1;
                expect(person.age).toBe(prevAge);
                expect(person.$hasChanges()).toBe(true);
                return person.$save();
            }).
            then(function() {
                expect(person.$hasChanges()).toBe(false);
                expect(person.age).toBe(prevAge + 1);

                person.$dispose();
                stopPumping(h);
                done();
            });

        var h = startPumping($rootScope);
    });


    it('reflects changes in the underlying data', function(done) {

        var p1Ref = rootRef.child('people/p1');
        var person = new $Person(p1Ref);

        var prevAge;
        person.$whenLoaded().
            then(function() {
                prevAge = person.age;

                // Manipulate the data not via our library. Will simulate data coming from server.
                setTimeout(function() {
                    var rawPersonRef = client.child('people/p1');
                    rawPersonRef.update({age: prevAge + 1});
                }, 300);
            });


        $rootScope.$watch(function(scope) {
            try {
                return person.age;
            } catch (e) {

            }
        }, function(newVal, oldVal, scope) {
            if (newVal !== oldVal) {
                if (person.age === prevAge + 1) {

                    person.$dispose();

                    stopPumping(h);
                    done();
                }
            }
        });

        // Nudge things along:
        var h = startPumping($rootScope);
    });

});


// TODO: When a property is a nested model
