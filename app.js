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

app.get('/app',function(req,res){
  res.render('app_not_found');
});

app.get('/newsletter', function(req,res){
  res.render('newsletter');
}
);

//server listen
app.listen(3000,function(){console.log("Server ready");});
