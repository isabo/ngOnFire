angular.module('test', ['ngOnFire']);


describe('$Model service', function() {

    // Set the context for inject calls.
    beforeEach(angular.mock.module('test'));

    it('exists and is injectable', inject(function($Model) {
        expect(typeof $Model).toBe('function');
    }));


});
