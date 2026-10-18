'use strict';
/* Public contact form (POST) and the admin message list (GET/PUT/DELETE) share one function:
   Vercel's Hobby plan allows 12 functions. /api/messages is rewritten here in vercel.json. */
const form = require('./_h/contactform');
const messages = require('./_h/messages');
module.exports = function (req, res) {
  return new URL(req.url, 'http://x').searchParams.get('a') === 'messages' ? messages(req, res) : form(req, res);
};
