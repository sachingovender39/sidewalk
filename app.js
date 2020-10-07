////////initial setup////////////////
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const https = require("https");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require('passport');
const passportLocal = require('passport-local');
const passportMong = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("Public"));
app.set('view engine', 'ejs');
//session setup
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));
//authentication setup
app.use(passport.initialize());
app.use(passport.session());
//database connection
mongoose.connect(process.env.MONGO_CONNECTION, {useNewUrlParser: true});
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
const db = mongoose.connection;
db.once('open', function() {
  console.log("Connected");
});
//User Schema setup
var postSchema = new mongoose.Schema({username:String,message:String,date:String});
var userSchema = new mongoose.Schema({email:String, password:String, googleID:String,posts:[postSchema],about:String});
//add plugin for passport local and google auth for mongoose. this takes care of all encryption and database handling
userSchema.plugin(passportMong);
userSchema.plugin(findOrCreate);
var user = mongoose.model('User',userSchema);
var post = mongoose.model('Post',postSchema);
//Use local strategy and implement serial and deserial
passport.use(user.createStrategy(user.authenticate()));
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  user.findById(id, function(err, user) {
    done(err, user);
  });
});

///Google Authentication strategy
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/feed",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    user.findOne({googleID:profile.id}, function(err,foundUser){
      if(err)
      {
        console.log(err);
      }
      else{
        var new_username="";
        if (foundUser==null){
          console.log('new user');
          const random_val = Math.floor(Math.random() * 101);
          new_username = profile.name.givenName+profile.name.familyName+String(random_val);
        }
        else{
            console.log('current user');
          new_username = foundUser.username ;
        }
        user.findOrCreate({ username:new_username ,googleID: profile.id}, function (err, result) {
          user.findOne({googleID:profile.id}, function(err,foundUser){
            if(err)
            {
              console.log(err);
            }
            else{
              console.log(foundUser.email);
              if (foundUser.email==null){
                foundUser.email = profile.emails[0].value;
                foundUser.save(function(){console.log(profile.emails[0].value);});
              }
            }
          });
          return cb(err, result);
        });

      }
    });

  }
));
////////////////requests///////////////////
app.get('/',function(req,res){
  res.render('home');
});

app.get('/app',function(req,res){
  res.render('app_not_found');
});
///newsletter
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
  //Establish request handler
  var url = "https://us2.api.mailchimp.com/3.0/lists/94b1086669";
  var options={
    method:"POST",
    auth:MAILCHIMP_AUTH
  };
  const request = https.request(url,options,function(response){
    if (response.statusCode==200)
    {
      //res.render('success_newsletter');
      response.on('data',function(d){
        console.log(JSON.parse(d));
        const feedback = JSON.parse(d);
        if (feedback.error_count!=0){
          const error_data = {message:feedback.errors[0].error_code};
          res.render('fail_newsletter',error_data);
        }
        else
        {
          console.log('no error');
          res.render('success_newsletter');
        }
      });

    }
    else
    {
      const error_data = {message:'HTTP ERROR'+String(response.statusCode)};
      res.render('fail_newsletter',error_data);
    }
  });
  request.write(jsonData);
  request.end();
  });

//login page//
app.get('/login', function(req,res){
  if (req.isAuthenticated())
  {
    res.redirect('/feed');
  }
  else{
    res.render('login');
  }
});

app.post('/login',function(req,res){
  const current_user = new user({username:req.body.username,password:req.body.password});
  req.login(current_user, function(err) {
  if (err) {
    console.log(err);
    res.redirect('/login');
  }
  else
  {
    console.log('trying to authenticate');
    var authenticate = user.authenticate();
    authenticate(req.body.username, req.body.password, function(err, result) {
      if (err)
      {
        console.log(err);
      }
      else{
        console.log("login authenticated");
        console.log(result);
        res.redirect('/feed');
      }
    });
  }

  });

});

//feed page
app.get('/feed',function(req,res){
  if (req.isAuthenticated())
  {
    req.session.current_url = '/feed';
    post.find({},function(err,result){
      res.render('feed',{items:result});
    });
  }
  else
  {
    res.redirect('/login');
  }
});

//register page
app.post('/register',function(req,res){
  //recieve from html page
  if (req.body.password==req.body.password_repeat)
  {
  var new_user = new user({username:req.body.username, email:req.body.email});
  const password = req.body.password;
  //register user
  user.register(new_user, password, function(err, user) {
    if (err)
    {
      console.log(err);
      res.redirect('/login');
    }
    else{
        passport.authenticate('local')(req,res,function()
      {
        res.redirect('/feed');
      });

    }
    });
    }
    else
    {
      res.redirect('/login');
    }
    });

//logout of feed page
app.get('/logout', function (req, res){
  req.session.destroy(function (err) {
    res.redirect('/');
  });
});
////Google Authentication
app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile","email"] })
);

app.get("/auth/google/feed",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to feed.
    res.redirect("/feed");
  });
//user post submission
app.post('/user/post', function(req,res){
  //add post to post database
  const current_date = new Date();
  const new_post = new post({username:req.user.username,message:req.body.message,date:current_date});
  new_post.save(function(err){if (err) return console.error(err);});
  //add post to users post
  user.findById({_id:req.user._id}, function(err,foundUser){
    if(err)
    {
      console.log(err);
    }
    else
    {
      if(foundUser)
      {
        foundUser.posts.unshift(new_post);
        foundUser.save(function(){res.redirect(req.session.current_url);});
      }
    }
  });

});

//profile page
app.get('/profile', function(req,res){
  if (req.isAuthenticated())
  {
    req.session.current_url = '/profile';
    const profile_data = {username:req.user.username,posts:req.user.posts,email:req.user.email,about:req.user.about};
    res.render('profile',profile_data);
  }
  else{
    res.redirect('/login');
  }
});
//update username
/*app.post('/profile/username', function(req,res){
  const new_username = req.body.username;
  user.find({username:new_username}, function(err,result){
    console.log(result);
    if (err)
    {
      console.log(err);
    }
    else{
      if (result.length==0){
        console.log("username available");
        user.findById({_id:req.user._id},function(err,foundUser){
          if (err){
            console.log(err);
          }
          else{
            if(foundUser){
              post.updateMany({username:req.user.username},{$set:{username:new_username}},function(){
                foundUser.username=new_username;
                for (var i = 0;i<foundUser.posts;i++)
                {
                  foundUser.posts[i].username = new_username;
                }
                foundUser.save(function(){res.redirect('/profile');});
              });
            }
          }
        });
      }
      else{
        console.log("username used");
      }
    }
  });
});*/
//update email
app.post('/profile/email', function(req,res){
  const new_email = req.body.email;
  user.findById({_id:req.user._id},function(err,result){
    if (err){
      console.log(err);
    }
    else{
      if(result){
        result.email=new_email;
        result.save(function(){res.redirect('/profile');});
      }
    }
  });
});

//server listen
app.listen(3000,function(){console.log("Server ready");});
