url = require('url')
http = require('https')
os = require("os")
fs = require('fs')

class SlowReport

    constructor: (@app) ->
        @data = {
            client: "javascript_server",
            server: os.hostname(),
            report_details: []
        }

    addRequest: (request) ->
        @data.report_details.push({
            start_time: new Date(request.time()),
            end_time: new Date(),
            username: request.username,
            request_id: request.id(),
            url: request.url
            ip: request.connection.remoteAddress,
            user_agent: request.headers['user-agent'],
            message: "Request duration",
            request: {
                REQUEST_METHOD: request.method,
                PATH_INFO: request.path()
            },
            slow_calls: []
        })

    serialize: () ->
        return @data

    send: () ->
        opt = url.parse(@app.slow_url)
        opt.headers = @app.getHeaders()

        @app.doPost opt, JSON.stringify([@data])
        

class Logger
    constructor: (@app, @namespace, @request) ->

    log: (level, message, date=new Date()) ->

        obj = {
            log_level: level,
            message: message,
            namespace: @namespace,
            request_id: @request.id(),
            server: os.hostname(),
            date: date
        }
        
        options = url.parse(@app.log_url)
        options.headers = @app.getHeaders()

        @app.doPost options, JSON.stringify([obj])


    info: (message, date) ->
        @log "INFO", message, date

    debug: (message, date) ->
        @log "DEBUG", message, date

    warn: (message, date) ->
        @log "WARN", message, date

    error: (message, date) ->
        @log "ERROR", message, date


class ErrorReporter
    constructor: (@app, @options) ->

    addReport: (request, message) ->
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
        }

        @options.report_details.push(data)

        @send()

    send: () ->
        opt = url.parse(@app.report_url)
        opt.headers = @app.getHeaders()

        @app.doPost opt, JSON.stringify([@options])

class Errormator
    constructor: (config) ->
        @verbose = config.verbose
        @logger = config.logger
        @key = config.api_key

        @log_url = config.logUrl || "https://api.errormator.com/api/logs?protocol_version=0.3"
        @report_url = config.reportUrl || "https://api.errormator.com/api/reports?protocol_version=0.3"
        @slow_url = config.slowUrl || "https://api.errormator.com/api/slow_reports?protocol_version=0.3"

    doPost: (options, data) ->
        if @debug && @outFile
            fs.appendFileSync(@outFile, data)
        else
            options.method = "POST"
            options.headers['Content-Length'] = data.length
            options.headers['Content-Type'] = 'application/json'

            req = http.request options, (res) =>
                if @verbose && @logger
                    @logger.debug "Status code: #{res.statusCode}"

                    res.on 'data', (d) =>
                        @logger.debug d

            req.write(data)
            req.end()


    getLogger: (namespace, request) ->
        return new Logger(this, namespace, request)

    getHeaders: () ->
        return {
            "X-errormator-api-key": @key
        }

    getSlowReport: () ->
        return new SlowReport(this)

    getReporter: (priority, errorType, status, traceback) ->
        options = {
            client: "javascript_server",
            server: os.hostname(),
            priority: priority,
            error_type: errorType,
            traceback: traceback,
            http_status: status,
            report_details: []
        }

        return new ErrorReporter(this, options)

    restify: (server, config) ->
        server.use (req, res, next) =>
            # Inject our logger
            req.getLogger = (namespace) =>
                return @getLogger(namespace, req)

            res.on 'finish', () =>
                report = @getSlowReport()
                report.addRequest(req)
                report.send()

                if @verbose && @logger
                    now = new Date()
                    ms = now - req.time()
                    @logger.debug "[#{now.toLocaleTimeString()}]: #{req.method.toUpperCase()} '#{req.path()}'  in #{ms}ms"

            next()

        # Basic errormator config
        server.on 'NotFound', (request, response, cb) =>
            @getReporter(3, "NotFound: #{request.url}", 404, "").addReport(request, "NotFound: #{request.url}")

            if config.onNotFound
                config.onNotFound(request, response, cb)
            else
                response.status(404)
                response.send("")

        server.on 'uncaughtException', (request, response, route, error) =>
            @getReporter(5, error.message, 500, error.stack).addReport(request, error.message)

            if config.onException
                config.onException(request, response, route, error)
            else
                response.status(500)
                response.send("")

    express: (server, config) ->

module.exports = Errormator
