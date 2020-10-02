//initial setup
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const https = require("https");
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("Public"));
app.set('view engine', 'ejs');
//requests
app.get('/',function(req,res){
  res.render('home');
});

//server listen
app.listen(3000,function(){console.log("Server ready");});
