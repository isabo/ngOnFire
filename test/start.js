var path = require('path');

var FirebaseServer = require('firebase-server');
var KarmaServer = require('karma').Server;

// Load initial test data.
var data = require('./data.json');


// Start the Karma server
var options = {
    configFile: path.resolve('karma.conf.js')
};
if (process.argv.length > 2 && process.argv[2] === '--single-run') {
    options.singleRun = true;
    initRun(); // There doesn't seem to be a run_start event for singleRun invocations.
}
var karmaServer = new KarmaServer(options, function(exitCode) {
    console.log('Karma has exited with code ' + exitCode);

    // Allow Karma to completely finish, then do our own shutdown.
    setTimeout(function() {
        shutdown(exitCode);
    }, 0);
});
karmaServer.start();


// Start a fresh firebase-server for each run.
var firebaseServer;
karmaServer.on('run_start', initRun);

// Stop the firebase-server at the end of each run.
karmaServer.on('run_complete', cleanUpRun);


// Listen for shutdown interrupts.
// process.on('SIGINT', shutdown);
// process.on('SIGTERM', shutdown);
// The above is not necessary: Karma server calls shutdown with its exitCode.


function initRun() {
    console.log('run starting');
    console.log('firebase-server starting ...');
    firebaseServer = new FirebaseServer(5000, 'test.firebaseio.com', data);
}

function cleanUpRun() {
    console.log('run complete');
    console.log('firebase-server shutting down ...');
    firebaseServer.close(function() {
        firebaseServer = null;
        console.log('firebase-server shut down complete.');
    });
}

function shutdown(exitCode) {

    if (firebaseServer) {
        console.log('firebase-server shutting down ...');
        firebaseServer.close(function() {
            console.log('firebase-server shut down complete.');
            process.exit(exitCode || 0);
        });
    } else {
        process.exit(exitCode || 0);
    }
}
