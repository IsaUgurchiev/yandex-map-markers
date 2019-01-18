/**
 * todo: delete and copy only the changed files;
 * todo: css sprites;
 * todo: preprocessor for HTML;
 */

'use strict';

var _ = require('underscore');
var path = require('path');
var es = require('event-stream');
var rjs = require('requirejs');
var autoprefixer = require('autoprefixer-core');
var less = require('less');
var browserSync = require('browser-sync');
var vinylPaths = require('vinyl-paths');
var del = require('del');
var gulp = require('gulp');
var gulpIf = require('gulp-if');
var gulpConcat = require('gulp-concat');
var gulpPlumber = require('gulp-plumber');
var gulpCsso = require('gulp-csso');
var gulpSourcemaps = require('gulp-sourcemaps');
var gulpFilter = require('gulp-filter');
var gulpTtf2woff = require('gulp-ttf2woff');
var gulpGzip = require('gulp-gzip');
var gulpImage = require('gulp-image');
var gulpWebp = require('gulp-webp');
var gulpExec = require('gulp-exec');
var mainBowerFiles = require('main-bower-files');
var lazypipe = require('lazypipe');

var options = {
    'autoprefixerOptions': [
        'ie >= 9',
        'ie_mob >= 10',
        'ff >= 30',
        'chrome >= 34',
        'safari >= 7',
        'opera >= 23',
        'ios >= 7',
        'android >= 4.4',
        'bb >= 10'
    ]
};

options.paths = {
    'main': [
        'src/client/favicon.ico',
        'src/client/humans.txt',
        'src/client/index.html',
        'src/client/.htaccess',
        'src/client/index.php',
        'src/client/manifest.webapp',
        'src/client/robots.txt'
    ],
    'server': 'src/server/*',
    'images': 'src/client/images/*',
    'fonts': 'src/client/fonts/*',
    'json': 'src/client/json/*',
    'svg': 'src/client/svg/*',
    'templates': 'src/client/templates/*',
    'styles': ['src/client/styles/css/*.css', 'src/client/styles/less/*.less', 'src/client/styles/less/**/*.less'],
    'scripts': ['src/client/scripts/js/*.js', 'src/client/scripts/js/**/*.js'],
    'scriptsBase': 'src/client/scripts/js',
    'fontsConverts': {
        'src': 'src/client/fonts/*.ttf',
        'dest': 'src/client/fonts'
    },
    'optimizeImages': {
        'src': 'src/client/images/*',
        'dest': 'src/client/images'
    },
    'gzip': {
        'styles': ['dist/styles/css/*.css', 'dist/styles/css/*.map'],
        'scripts': ['dist/scripts/js/*.js', 'dist/scripts/js/*.map']
    },
    'dest': {
        'main': 'dist',
        'server': 'dist/server',
        'scripts': 'dist/scripts/js',
        'scriptFileName': 'script.min.js',
        'styles': 'dist/styles/css',
        'styleFileName': 'style.min.css',
        'fonts': 'dist/fonts',
        'images': 'dist/images',
        'json': 'dist/json',
        'svg': 'dist/svg',
        'templates': 'dist/templates'
    },
    'clean': {
        'main': [
            'dist/favicon.ico',
            'dist/humans.txt',
            'dist/index.html',
            'dist/index.php',
            'dist/.htaccess',
            'dist/manifest.webapp',
            'dist/robots.txt'
        ],
        'server': 'dist/server',
        'images': 'dist/images',
        'fonts': 'dist/fonts',
        'svg': 'dist/svg',
        'json': 'dist/json',
        'styles': 'dist/styles',
        'scripts': 'dist/scripts',
        'templates': 'dist/templates'
    },
    'watch': {
        'main': [
            'src/client/favicon.ico',
            'src/client/humans.txt',
            'src/client/index.html',
            'src/client/.htaccess',
            'src/client/index.php',
            'src/client/manifest.webapp',
            'src/client/robots.txt'
        ],
        'server': 'src/server/*',
        'images': 'src/client/images/*',
        'fonts': 'src/client/fonts/*',
        'svg': 'src/client/svg/*',
        'json': 'src/client/json/*',
        'templates': 'src/client/templates/*',
        'styles': ['src/client/styles/css/*.css', 'src/client/styles/less/*.less', 'src/client/styles/less/**/*.less'],
        'scripts': ['src/client/scripts/js/*.js', 'src/client/scripts/js/**/*.js']
    },
    'test': 'src/client/scripts/js/test/runner.html'
};

gulp.task('scripts', ['clean:scripts'], function(callback) {
    var vendors = mainBowerFiles({
        paths: {
            paths: './',
            bowerDirectory: 'vendor',
            bowerrc: '.bowerrc',
            bowerJson: 'bower.json'
        },
        filter: /.js/
    });

    var modules = {};
    var baseUrl = options.paths.scriptsBase;
    var excluded = ['almond'];

    vendors.map(function(el){
        el = el.replace(/.js$/, '');
        var name = path.basename(el);

        if(excluded.indexOf(name) >= 0){
            return false;
        }

        modules[name] = path.relative(baseUrl, el);
    });

    rjs.optimize({
        baseUrl: baseUrl,
        paths: modules,
        name: path.relative(baseUrl, 'vendor/almond/almond'),
        include: ['common'],
        insertRequire: [path.relative(baseUrl, 'vendor/almond/almond')],
        out: options.paths.dest.scripts + '/' + options.paths.dest.scriptFileName,
        optimize: "uglify2",
        uglify2: {
            compress: {
                drop_console: false
            }
        },
        preserveLicenseComments: false,
        generateSourceMaps: true
    }, function(buildResponse){
        callback();
    }, callback);
});

gulp.task('styles', ['clean:styles'], function() {
    var vendors = mainBowerFiles({
        paths: {
            paths: './',
            bowerDirectory: 'vendor',
            bowerrc: '.bowerrc',
            bowerJson: 'bower.json'
        },
        filter: /.less|.css/
    });

    vendors = _.union(vendors, options.paths.styles);

    return gulp.src(vendors)
        .pipe(gulpPlumber())
        .pipe(gulpSourcemaps.init())
        .pipe(gulpIf(/.less/, lessRender()))
        .pipe(urlRebase())
        .pipe(autoprefixerRender())
        .pipe(gulpCsso())
        .pipe(gulpConcat(options.paths.dest.styleFileName))
        .pipe(gulpSourcemaps.write('.'))
        .pipe(gulp.dest(options.paths.dest.styles))
        .pipe(gulpFilter('*.css'))
        .pipe(browserSync.reload({stream:true}))
        ;
});

gulp.task('bower:images', ['clean:images'], function() {
    var vendors = mainBowerFiles({
        paths: {
            paths: './',
            bowerDirectory: 'vendor',
            bowerrc: '.bowerrc',
            bowerJson: 'bower.json'
        },
        filter: /.jpg|.png|.gif|.jpeg/
    });

    return gulp.src(vendors)
        .pipe(gulpPlumber())
        .pipe(gulp.dest(options.paths.dest.images))
        ;
});

gulp.task('bower:fonts', ['clean:fonts'], function() {
    var vendors = mainBowerFiles({
        paths: {
            paths: './',
            bowerDirectory: 'vendor',
            bowerrc: '.bowerrc',
            bowerJson: 'bower.json'
        },
        filter: /.eot|.svg|.ttf|.woff|.woff2/
    });

    return gulp.src(vendors)
        .pipe(gulpPlumber())
        .pipe(gulp.dest(options.paths.dest.fonts))
        ;
});

gulp.task('copy:fonts', ['bower:fonts'], function (callback) {
    return gulp.src(options.paths.fonts).pipe(gulp.dest(options.paths.dest.fonts));
});

gulp.task('copy:images', ['clean:images'], function (callback) {
    return gulp.src(options.paths.images).pipe(gulp.dest(options.paths.dest.images));
});

gulp.task('copy:svg', ['clean:svg'], function (callback) {
    return gulp.src(options.paths.svg).pipe(gulp.dest(options.paths.dest.svg));
});

gulp.task('copy:json', ['clean:json'], function (callback) {
    return gulp.src(options.paths.json).pipe(gulp.dest(options.paths.dest.json));
});

gulp.task('copy:main', ['clean:main'], function (callback) {
    return gulp.src(options.paths.main)
        .pipe(gulp.dest(options.paths.dest.main))
        .pipe(browserSync.reload({stream:true}))
        ;
});

gulp.task('copy:server', ['clean:server'], function (callback) {
    return gulp.src(options.paths.server)
        .pipe(gulp.dest(options.paths.dest.server))
        ;
});

gulp.task('copy:templates', ['clean:templates'], function (callback) {
    return gulp.src(options.paths.templates).pipe(gulp.dest(options.paths.dest.templates));
});

gulp.task('clean:main', function(callback) {
    return gulp.src(options.paths.clean.main, { read: false })
        .pipe(vinylPaths(del));
});

gulp.task('clean:templates', function(callback) {
    return gulp.src(options.paths.clean.templates, { read: false })
        .pipe(vinylPaths(del));
});

gulp.task('clean:server', function(callback) {
    return gulp.src(options.paths.clean.server, { read: false })
        .pipe(vinylPaths(del));
});

gulp.task('clean:scripts', function(callback) {
    return gulp.src(options.paths.clean.scripts, { read: false })
        .pipe(vinylPaths(del));
});

gulp.task('clean:styles', function(callback) {
    return gulp.src(options.paths.clean.styles, { read: false })
        .pipe(vinylPaths(del));
});

gulp.task('clean:fonts', function(callback) {
    return gulp.src(options.paths.clean.fonts, { read: false })
        .pipe(vinylPaths(del));
});

gulp.task('clean:images', function(callback) {
    return gulp.src(options.paths.clean.images, { read: false })
        .pipe(vinylPaths(del));
});

gulp.task('clean:json', function(callback) {
    return gulp.src(options.paths.clean.json, { read: false })
        .pipe(vinylPaths(del));
});

gulp.task('clean:svg', function(callback) {
    return gulp.src(options.paths.clean.svg, { read: false })
        .pipe(vinylPaths(del));
});

gulp.task('copy', ['copy:main', 'copy:images', 'copy:fonts', 'copy:json', 'copy:svg', 'copy:templates']);

gulp.task('ttf2woff', function(){
    gulp.src(options.paths.fontsConverts.src)
        .pipe(gulpTtf2woff())
        .pipe(gulp.dest(options.paths.fontsConverts.dest));
});

gulp.task('optimize-images', function () {
    return gulp.src(options.paths.optimizeImages.src)
        .pipe(gulpImage())
        .pipe(gulp.dest(options.paths.optimizeImages.dest))
        ;
});

gulp.task('images-to-webp', function () {
    return gulp.src(options.paths.optimizeImages.src)
        .pipe(gulpWebp({quality: 60}))
        .pipe(gulp.dest(options.paths.optimizeImages.dest))
        ;
});

gulp.task('gzip:styles', function(){
    gulp.src(options.paths.gzip.styles)
        .pipe(gulpGzip())
        .pipe(gulp.dest(options.paths.dest.styles));
});

gulp.task('gzip:scripts', function(){
    gulp.src(options.paths.gzip.scripts)
        .pipe(gulpGzip())
        .pipe(gulp.dest(options.paths.dest.scripts));
});

gulp.task('gzip', ['gzip:styles', 'gzip:scripts']);

gulp.task('test', function() {
    var execOptions = {
        continueOnError: false, // default = false, true means don't emit error event
        pipeStdout: true, // default = false, true means stdout is written to file.contents
        customTemplatingThing: "" // content passed to gutil.template()
    };

    var reportOptions = {
        err: true, // default = true, false means don't write err
        stderr: true, // default = true, false means don't write stderr
        stdout: true // default = true, false means don't write stdout
    };

    return gulp.src(options.paths.test)
        .pipe(gulpPlumber())
        .pipe(gulpExec('node ./node_modules/mocha-phantomjs/bin/mocha-phantomjs ' + options.paths.test, execOptions))
        .pipe(gulpExec.reporter(reportOptions));
});

gulp.task('browser-sync', function() {
    browserSync({
        server: {
            baseDir: 'dist'
        }
    });
});

gulp.task('go', ['copy', 'bower:images', 'bower:fonts', 'styles', 'scripts']);

gulp.task('watch', ['go', 'browser-sync'], function () {
    gulp.watch(options.paths.watch.styles, ['styles']);
    gulp.watch(options.paths.watch.scripts, ['scripts', browserSync.reload]);
    gulp.watch(options.paths.watch.main, ['copy:main', browserSync.reload]);
    gulp.watch(options.paths.watch.server, ['copy:server', browserSync.reload]);
    gulp.watch(options.paths.watch.images, ['copy:images', browserSync.reload]);
    gulp.watch(options.paths.watch.fonts, ['copy:fonts', browserSync.reload]);
    gulp.watch(options.paths.watch.json, ['copy:json', browserSync.reload]);
    gulp.watch(options.paths.watch.svg, ['copy:svg', browserSync.reload]);
    gulp.watch(options.paths.watch.templates, ['copy:templates', browserSync.reload]);
});

gulp.task('watch:server', ['copy:server'], function () {
    gulp.watch(options.paths.watch.server, ['copy:server']);
});

gulp.task('default', ['copy']);

function lessRender() {
    var data = [];
    var content = new Buffer(0);
    var markerStart = '/*start file*/';
    var markerStartRegex = /(\/\*start file\*\/)/g;
    var markerEnd = '/*end file*/';
    var markerEndRegex = /(\/\*end file\*\/)/g;

    function bufferContents(file){
        if (file.isNull()) {
            return;
        }

        data.push(file);

        if (content.length !== 0) {
            content = Buffer.concat([content, new Buffer(0)]);
        }

        content = Buffer.concat([content, new Buffer(markerStart + '/* ' + path.basename(file.history) + ' */' + file.contents + markerEnd)]);
    }

    function endStream(){
        if (!data) {
            return this.emit('end');
        }

        var _this = this;

        less.render(content.toString('utf8'), {
            compress: false,
            paths: [],
            sourceMap: false
        }).then(
            function(output) {
                var css = output.css;
                var markerStartIndex = [];
                var markerEndIndex = [];

                css.replace(markerStartRegex, function (a, b, index) {
                    markerStartIndex.push(index);
                });

                css.replace(markerEndRegex, function (a, b, index) {
                    markerEndIndex.push(index);
                });

                for(var i = 0; i <= data.length - 1; i++){
                    var cssPart = css.substring(markerStartIndex[i] + markerStart.length, markerEndIndex[i]);

                    data[i].contents = new Buffer(cssPart);
                    _this.emit('data', data[i]);

                    if(i == data.length - 1){
                        _this.emit('end');
                    }
                }
            },
            function(error) {
                console.log(error);
            }
        );
    }

    return es.through(bufferContents, endStream);
}

function autoprefixerRender() {
    function render(file, callback) {
        var content = file.contents.toString('utf8');
        var css = autoprefixer({ browsers: options.autoprefixerOptions }).process(content).css;

        file.contents = new Buffer(css);

        callback(null, file);
    }

    return es.map(render);
}

function urlRebase() {
    function render(file, callback) {
        var content = file.contents.toString('utf8');

        var URL_REGEX = /url\s*\(\s*([^\)]+)\)/g;

        function cleanMatch(url) {
            var firstChar;
            url = url.trim();
            firstChar = url.substr(0, 1);
            if (firstChar === (url.substr(-1)) && (firstChar === '"' || firstChar === "'")) {
                url = url.substr(1, url.length - 2);
            }
            return url;
        }

        content = content.replace(URL_REGEX, function(match, file) {
            var file = cleanMatch(file);
            var filename = path.basename(file).toLowerCase();

            if(filename.indexOf('eot') >= 0 || filename.indexOf('woff') >= 0 || filename.indexOf('ttf') >= 0 || filename.indexOf('svg') >= 0 && file.indexOf('font') >= 0){
                return "url(\"../../fonts/" + filename + "\")";
            }

            if(filename.indexOf('jpg') >= 0 || filename.indexOf('png') >= 0 || filename.indexOf('gif') >= 0 || filename.indexOf('jpeg') >= 0 || filename.indexOf('webp') >= 0){
                return "url(\"../../images/" + filename + "\")";
            }
        });

        file.contents = new Buffer(content);

        callback(null, file);
    }

    return es.map(render);
}

function testPipe() {
    function render(file, callback) {
        console.log(file.history);

        callback(null, file);
    }

    return es.map(render);
}