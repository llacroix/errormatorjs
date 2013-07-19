(function() {
  var ErrorReporter, Errormator, Logger, SlowReport, fs, http, os, url;

  url = require('url');

  http = require('https');

  os = require("os");

  fs = require('fs');

  SlowReport = (function() {
    function SlowReport(app) {
      this.app = app;
      this.data = {
        client: "javascript_server",
        server: os.hostname(),
        report_details: []
      };
    }

    SlowReport.prototype.addRequest = function(request) {
      return this.data.report_details.push({
        start_time: new Date(request.time()),
        end_time: new Date(),
        username: request.username,
        request_id: request.id(),
        url: request.url,
        ip: request.connection.remoteAddress,
        user_agent: request.headers['user-agent'],
        message: "Request duration",
        request: {
          REQUEST_METHOD: request.method,
          PATH_INFO: request.path()
        },
        slow_calls: []
      });
    };

    SlowReport.prototype.serialize = function() {
      return this.data;
    };

    SlowReport.prototype.send = function() {
      var opt;
      opt = url.parse(this.app.slow_url);
      opt.headers = this.app.getHeaders();
      return this.app.doPost(opt, JSON.stringify([this.data]));
    };

    return SlowReport;

  })();

  Logger = (function() {
    function Logger(app, namespace, request) {
      this.app = app;
      this.namespace = namespace;
      this.request = request;
    }

    Logger.prototype.log = function(level, message, date) {
      var obj, options;
      if (date == null) {
        date = new Date();
      }
      obj = {
        log_level: level,
        message: message,
        namespace: this.namespace,
        request_id: this.request.id(),
        server: os.hostname(),
        date: date
      };
      options = url.parse(this.app.log_url);
      options.headers = this.app.getHeaders();
      return this.app.doPost(options, JSON.stringify([obj]));
    };

    Logger.prototype.info = function(message, date) {
      return this.log("INFO", message, date);
    };

    Logger.prototype.debug = function(message, date) {
      return this.log("DEBUG", message, date);
    };

    Logger.prototype.warn = function(message, date) {
      return this.log("WARN", message, date);
    };

    Logger.prototype.error = function(message, date) {
      return this.log("ERROR", message, date);
    };

    return Logger;

  })();

  ErrorReporter = (function() {
    function ErrorReporter(app, options) {
      this.app = app;
      this.options = options;
    }

    ErrorReporter.prototype.addReport = function(request, message) {
      var data;
      data = {
        start_time: new Date(request.time()),
        url: request.url,
        ip: request.connection.remoteAddress,
        user_agent: request.headers['user-agent'],
        message: message,
        request_id: request.id(),
        request: {
          REQUEST_METHOD: request.method,
          PATH_INFO: request.path()
        }
      };
      this.options.report_details.push(data);
      return this.send();
    };

    ErrorReporter.prototype.send = function() {
      var opt;
      opt = url.parse(this.app.report_url);
      opt.headers = this.app.getHeaders();
      return this.app.doPost(opt, JSON.stringify([this.options]));
    };

    return ErrorReporter;

  })();

  Errormator = (function() {
    function Errormator(config) {
      this.verbose = config.verbose;
      this.logger = config.logger;
      this.key = config.api_key;
      this.log_url = config.logUrl || "https://api.errormator.com/api/logs?protocol_version=0.3";
      this.report_url = config.reportUrl || "https://api.errormator.com/api/reports?protocol_version=0.3";
      this.slow_url = config.slowUrl || "https://api.errormator.com/api/slow_reports?protocol_version=0.3";
    }

    Errormator.prototype.doPost = function(options, data) {
      var req,
        _this = this;
      if (this.debug && this.outFile) {
        return fs.appendFileSync(this.outFile, data);
      } else {
        options.method = "POST";
        options.headers['Content-Length'] = data.length;
        options.headers['Content-Type'] = 'application/json';
        req = http.request(options, function(res) {
          if (_this.verbose && _this.logger) {
            _this.logger.debug("Status code: " + res.statusCode);
            return res.on('data', function(d) {
              return _this.logger.debug(d);
            });
          }
        });
        req.write(data);
        return req.end();
      }
    };

    Errormator.prototype.getLogger = function(namespace, request) {
      return new Logger(this, namespace, request);
    };

    Errormator.prototype.getHeaders = function() {
      return {
        "X-errormator-api-key": this.key
      };
    };

    Errormator.prototype.getSlowReport = function() {
      return new SlowReport(this);
    };

    Errormator.prototype.getReporter = function(priority, errorType, status, traceback) {
      var options;
      options = {
        client: "javascript_server",
        server: os.hostname(),
        priority: priority,
        error_type: errorType,
        traceback: traceback,
        http_status: status,
        report_details: []
      };
      return new ErrorReporter(this, options);
    };

    Errormator.prototype.restify = function(server, config) {
      var _this = this;
      server.use(function(req, res, next) {
        req.getLogger = function(namespace) {
          return _this.getLogger(namespace, req);
        };
        res.on('finish', function() {
          var ms, now, report;
          report = _this.getSlowReport();
          report.addRequest(req);
          report.send();
          if (_this.verbose && _this.logger) {
            now = new Date();
            ms = now - req.time();
            return _this.logger.debug("[" + (now.toLocaleTimeString()) + "]: " + (req.method.toUpperCase()) + " '" + (req.path()) + "'  in " + ms + "ms");
          }
        });
        return next();
      });
      server.on('NotFound', function(request, response, cb) {
        _this.getReporter(3, "NotFound: " + request.url, 404, "").addReport(request, "NotFound: " + request.url);
        if (config.onNotFound) {
          return config.onNotFound(request, response, cb);
        } else {
          response.status(404);
          return response.send("");
        }
      });
      return server.on('uncaughtException', function(request, response, route, error) {
        _this.getReporter(5, error.message, 500, error.stack).addReport(request, error.message);
        if (config.onException) {
          return config.onException(request, response, route, error);
        } else {
          response.status(500);
          return response.send("");
        }
      });
    };

    Errormator.prototype.express = function(server, config) {};

    return Errormator;

  })();

  module.exports = Errormator;

}).call(this);
