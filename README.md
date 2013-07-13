Errormatorjs
============

Non official https://errormator.com/ API implementation for NodeJS

Todo:

- Add slow requests reporter
- Make an integration in restify (no need to create our own wrappers)
- Make an integration for connect/expressjs
- Make reporters lazy. They currently sends reports whenever something has to be reported. There should be a way to wait for some times to gather as much as possible reports and to log something under the 75kb limit. This will reduce processing time of small requests.

Changelog 7/13/2013:

- Can create report errors
- Can log to errormator
