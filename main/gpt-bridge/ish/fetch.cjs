'use strict';
const fetch=require('../node_modules/node-fetch');
globalThis.fetch=fetch;
globalThis.Headers=fetch.Headers;
globalThis.Request=fetch.Request;
globalThis.Response=fetch.Response;
