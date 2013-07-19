Errormatorjs
============

Non official https://errormator.com/ API implementation for NodeJS

#### Installing

The project is still not present in NPM but you can install it or add it in your package.json with the
github url.

    npm install git://github.com/llacroix/errormatorjs.git


#### Example with restify

    restify = require("restify")

    reporter = new Errormator({
        api_key: "Your key"
    })

    server = restify.createServer({
            name: "Test errormator",
            version: "1.0.0"
    })

    # Config the reporter
    reporter.restify(server, {})

    # More restify configuration like (server.use)
    server.use(restify.requestLogger({}))
    server.use(restify.authorizationParser())
    server.use(restify.bodyParser({mapParams: false }))

    server.get "/fun", (req, res, next) ->
        # Should not raise an error
        res.send({ok: true})

    server.get "/no_fun", (req, res, next) ->
        # Will raise an error
        null.undefinedFunction()
        res.send({ok: false})


#### TODOS

- Split the project in multiple files to make it easier for everyone
- Refactor Reporters and Reports. It should be possible to create reports without looking at the whole structure. Reports can then be pushed to a pool. Once the pool is full or there is nothing to do, we can then push it back to the server (errormator)

Needs a base class to "prevent" duplication of code. Make all reports behave alike and push them into a pool

- Make an integration for connect/expressjs
- Make reporters lazy. They currently sends reports whenever something has to be reported. There should be a way to wait for some times to gather as much as possible reports and to log something under the 75kb limit. This will reduce processing time of small requests.

#### Changelog 7/19/2013

- Added a verbose/logger config. Logger is used to log some messages to the application. Useful for debugging. The verbose parameter will activate/deactivate the logger

#### Changelog 7/15/2013

- Add slow requests reporter

#### Changelog 7/14/2013

- Made an integration with restify

Example:

    // create server
    reporter = new Errormator({api_key: "..."})
    reporter.restify(server, config)

#### Changelog 7/13/2013:

- Can create report errors
- Can log to errormator
