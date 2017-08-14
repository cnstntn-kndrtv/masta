var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var compression = require('compression');
var minify = require('express-minify');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
if (process.env.NODE_ENV == 'production') {
  app.use(compression());
  app.use(minify({
    js_match: /js/,
    css_match: /css/,
    json_match: /json/,
    uglifyJS: require('uglify-js'),
    cssmin: require('cssmin'),
    cache: false,
    onerror: undefined,
  }));
}

app.use(express.static(path.join(__dirname, './public')));
// bootstrap
app.use('/css', express.static(path.join(__dirname, './node_modules/bootstrap/dist/css')));
app.use('/js', express.static(path.join(__dirname, './node_modules/bootstrap/dist/js')));
// jquery
app.use('/js', express.static(path.join(__dirname, './node_modules/jquery/dist')));
// az
app.use('/js', express.static(path.join(__dirname, './node_modules/az/src')));
// app.use('/dicts', express.static(path.join(__dirname, './node_modules/az/dicts')));
// d3
app.use('/js', express.static(path.join(__dirname, './node_modules/d3/build')));


// routes
var routes = require('./routes/index');

app.use('/', routes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
