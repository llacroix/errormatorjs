Errormatorjs
============

Non official https://errormator.com/ API implementation for NodeJS

#### Installing

The project is still not present in NPM but you can install it or add it in your package.json with the
github url.

    npm install git://github.com/llacroix/errormatorjs.git


#### TODOS

- Add slow requests reporter
- Make an integration for connect/expressjs
- Make reporters lazy. They currently sends reports whenever something has to be reported. There should be a way to wait for some times to gather as much as possible reports and to log something under the 75kb limit. This will reduce processing time of small requests.

#### Changelog 7/14/2013

- Made an integration with restify

    // create server
    reporter = new Errormator({api_key: "..."})
    reporter.restify(server, config)

#### Changelog 7/13/2013:

- Can create report errors
- Can log to errormator
