var ClosureCompiler = require('google-closure-compiler').compiler;


var closureCompiler = new ClosureCompiler({
    js: [
        'src/**.js',
        'node_modules/google-closure-library/closure/goog/base.js',
        'node_modules/google-closure-library/closure/goog/promise/**.js'
    ],
    externs: [
        'node_modules/firebase-externs/firebase-externs.js',
        'node_modules/onfire/dist/onfire-externs.js',
        ClosureCompiler.CONTRIB_PATH + '/externs/angular-1.4.js',
        ClosureCompiler.CONTRIB_PATH + '/externs/angular-1.4-q_templated.js',
        ClosureCompiler.CONTRIB_PATH + '/externs/angular-1.4-http-promise_templated.js'
    ],
    jscomp_warning: 'missingRequire',
    angular_pass: true,
    manage_closure_dependencies: true,
    js_output_file: 'dist/ng-onfire.min.js',
    compilation_level: 'ADVANCED',
    warning_level: 'VERBOSE',
    summary_detail_level: '3'
});


var compilerProcess = closureCompiler.run(function(exitCode, stdOut, stdErr) {

    console.log(stdErr);

    // Fail if the compiler failed - this will indicate success/failure to CI tools.
    process.exit(exitCode);
});
