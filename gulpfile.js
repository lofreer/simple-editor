var gulp = require('gulp'),
    cleancss = require('gulp-clean-css'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    jshint = require('gulp-jshint'),
    autoprefixer = require('gulp-autoprefixer');

gulp.task('jshint', function(){
    return gulp.src('lib/js/editor.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

gulp.task('minifycss', function(){
    return gulp.src('lib/css/editor.css')
        .pipe(autoprefixer({
            browsers: ['last 2 versions'],
            cascade: false
        }))
        .pipe(cleancss())
        .pipe(rename({suffix: '.min'}))        
        .pipe(gulp.dest('lib/css'));
});

gulp.task('minifyjs', function(){
    return gulp.src('lib/js/editor.js')
        .pipe(rename({suffix: '.min'}))
        .pipe(uglify())
        .pipe(gulp.dest('lib/js'));
});

gulp.task('default', ['jshint'], function(){
    gulp.start('minifycss', 'minifyjs');
});

gulp.task('watch', function() {
	gulp.watch('lib/js/*.js', ['default']);
    gulp.watch('lib/css/*.css', ['default']);
});