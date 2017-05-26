var express = require('express');
var router = express.Router();
var fs = require('fs');

/* GET file */
router.get('/getFile', function(req, res, next) {
  fs.readFile('./topics/test.ss', function (err, data) {
    if (err) {
      console.log(err);
      throw err;
    }
    res.send(data);
  });
});

module.exports = router;
