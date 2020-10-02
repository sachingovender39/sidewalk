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

app.post("/mail_list",function(req,res){
  var name = req.body.firstName;
  var surname = req.body.surname;
  var email = req.body.email;
  //send data to mailchimp Server
  //Convert data into acceptable json
  var memb = {
    email_address:email,
    status:"subscribed",
    merge_fields:{FNAME:name,LNAME:surname}
  };
  var data ={
    members:[memb]
  };
  jsonData = JSON.stringify(data);
  console.log(jsonData);
  //Establish request handler
  var url = "https://us2.api.mailchimp.com/3.0/lists/94b1086669";
  var options={
    method:"POST",
    auth:"sach:af1ea62a381148cb30014dd44e02660a-us2"
  };
  const request = https.request(url,options,function(response){
    if (response.statusCode==200)
    {
      res.render('success_newsletter');
    }
    else
    {
      res.render('fail_newsletter');
    }
    response.on('data',function(d){
      //console.log(JSON.parse(d));
    });

  });
  //try and send a request with the data
  request.write(jsonData);
  request.end();
});

//server listen
app.listen(3000,function(){console.log("Server ready");});
