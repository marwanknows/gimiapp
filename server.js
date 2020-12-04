var exp               = require('express');
var app               = exp();
var jwt               = require('jsonwebtoken');
var chatapp           = require('http').createServer(app);
var io                = require('socket.io')(chatapp);
var cors              = require('cors');
var pars              = require('body-parser');
var mysql             = require('mysql');
var bcrypt            = require('bcrypt');
var compress_images   = require('compress-images');
var multer            = require('multer');
var sharp             = require('sharp');
var fs                = require('fs');
var uniqid            = require('uniqid');
var http              = require("https");
var moment            = require('moment-timezone');
var accessTokenSecret = '_stars@secret_4520_SPLASHYTOKEN';

var userLong;
var userAlti;
var timeZone;
var countryCode;
var countryName;
var countryCity;

var options = {
"method": "GET",
"hostname": "freegeoip.app",
"port": null,
"path": "/json/",
  "headers": {
    "accept": "application/json",
    "content-type": "application/json"
  }
};

http.request(options, function (res) {
  var chunks = [];

  res.on("data", function (chunk) {
    chunks.push(chunk);
  });

  res.on("end", function () {
    var body  = Buffer.concat(chunks);
    var jAson = JSON.parse(body);
    userLong = jAson.longitude;
    userAlti = jAson.latitude;
    timeZone = jAson.time_zone;
    countryCode = jAson.country_code;
    countryName = jAson.country_name;
    countryCity = jAson.city;

    // ip: '41.248.61.51',
    // country_code: 'MA',
    // country_name: 'Morocco',
    // region_code: '01',
    // region_name: 'Tanger-Tetouan-Al Hoceima',
    // city: 'Tangier',
    // zip_code: '',
    // time_zone: 'Africa/Casablanca',
    // latitude: 35.7808,
    // longitude: -5.8176,
    // metro_code: 0
  });
}).end();

var con = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gimistars'
});

con.connect((err) => {
  if(err){
    console.log('Error connecting to Db');
    return;
  }
  console.log('Connection established');
})
// start the server listening for requests
app.listen(process.env.PORT || 3000, () => console.log("Server is running..."));
  
app.use(exp.static("gimistars"))

// define the first route
app.get("/", function (req, res) {
  res.send("<h1>Hello World!</h1>")
})
app.use(cors())
app.use(exp.static(__dirname + '/photos/'));

app.use(pars.json({limit: '90000mb', extended: true}))
app.use(pars.urlencoded({limit: '90000mb', extended: true}))

io.on('connection', function(socket){

  socket.on('chat_type_1_message', function(msg){
    var message    = msg.msg;
    var userChatID = msg.userID;
    var senderID   = msg.senderID;
    var userInfo   = msg.userInfo;
    var convoType  = '1';

    con.query('SELECT count(t1.convo_id) as total, t1.convo_id FROM message_conversation t1 WHERE t1.user_1 = ? AND t1.user_2 = ? AND t1.convo_type = ? OR t1.user_1 = ? AND t1.user_2 = ? AND t1.convo_type = ? GROUP BY t1.convo_id DESC LIMIT 1',
    [senderID, userChatID, convoType, userChatID, senderID, convoType], (err, convos) => {

    if(convos.length > 0){
      con.query('SELECT count(box_id) as boxes, sender_id, box_id FROM message_box WHERE convo_id = ? GROUP BY box_id DESC LIMIT 1',
      [convos[0].convo_id], (err, rows_2) => {
        if(rows_2.length > 0){

          if(rows_2[0].sender_id == senderID){

            con.query('INSERT INTO messages_sys (box_id, msg) VALUES (?, ?)',
            [rows_2[0].box_id, message], (err, INSERT_1) => {
              io.emit('getMessageBack', {box_id:rows_2[0].box_id, msg: message, sender_id: senderID, convo_id: convos[0].convo_id, userInfo: userInfo});
            })

          }else if(rows_2[0].sender_id != senderID){
            insertBoxAndMsg(convos[0].convo_id, senderID, '1');
          }

        }else {
          insertBoxAndMsg(convos[0].convo_id, senderID, '1');
        }

        function insertBoxAndMsg(cvndID, senderID, status){

          con.query('INSERT INTO message_box (convo_id, sender_id, box_status) VALUES (?, ?, ?)',
          [convos[0].convo_id, senderID, status], (err, INSERT_2) => {
            con.query('INSERT INTO messages_sys (box_id, msg) VALUES (?, ?)',
            [INSERT_2.insertId, message], (err, INSERT_1) => {
              io.emit('getMessageBack', {box_id: INSERT_2.insertId, msg: message, sender_id: senderID, convo_id: convos[0].convo_id, userInfo: userInfo});
            })
          })
        }

      })

      }else if(convos.length < 1){
        var cnv = '1';
        con.query('INSERT INTO message_conversation ( user_1, user_2, convo_type) VALUES (?, ?, ?)',
        [senderID, userChatID, cnv], (err, INSERT_2) => {
          con.query('INSERT INTO message_box (convo_id, sender_id, box_status) VALUES (?, ?, ?)',
          [INSERT_2.insertId, senderID, cnv], (err, msg_box) => {
            con.query('INSERT INTO messages_sys (box_id, msg) VALUES (?, ?)',
            [msg_box.insertId, message], (err, msg_sys) => {
              io.emit('getMessageBack', {box_id: msg_box.insertId, msg: message, sender_id: senderID, convo_id: INSERT_2.insertId, userInfo: userInfo});
            })
          })
        })
      }

    })

  });

  socket.on('read_chatBoxes', (data)=>{
    var sessionID  = data.sessionID,
    chatUserID     = parseInt(data.chatUserID),
    convoType      = '1',
    boxStat        = '1',
    boxStat_2      = '2';
    con.query('SELECT t2.box_id, t2.sender_id, t2.box_status, t1.convo_id FROM message_conversation t1 LEFT JOIN message_box t2 ON t2.convo_id = t1.convo_id WHERE t1.user_1 = ? AND t1.user_2 = ? AND t1.convo_type = ? AND t2.box_status = ? OR t1.user_1 = ? AND t1.user_2 = ? AND t1.convo_type = ? AND t2.box_status = ? GROUP BY t2.box_id DESC',
    [sessionID, chatUserID, convoType, boxStat, chatUserID, sessionID, convoType, boxStat], (err, convos) => {
      if(convos.length > 0){
        for (let index = 0; index < convos.length; index++) {
          con.query('UPDATE message_box SET box_status = ? WHERE box_id = ? AND convo_id = ? AND sender_id = ?',
          [boxStat_2, convos[index].box_id, convos[index].convo_id, chatUserID], (err, rows) => {
            if((convos.length-1) == index){
              io.emit('viewMessageBack', {sessionID: sessionID, chatUserID: chatUserID, convo_id: convos[index].convo_id});
            }
          })

        }
      }

    })

  })

  socket.on('send_msgBoxAnswer', (data)=>{
    answer    = data.answer;
    boxID     = data.boxID;
    sessionID = data.sessionID;
    chatOWNER = data.chatOWNER;
    con.query('UPDATE message_box SET box_answer = ? WHERE box_id = ?',
    [answer, boxID], (err, rows)=>{
      io.emit('send_msgBoxAnswerBack', {answer: answer, boxID: boxID, sessionID:sessionID, chatOWNER:chatOWNER});
    })
  })

  socket.on('delete_msgBox', (data)=>{
    boxID     = data.boxID;
    sessionID = data.sessionID;
    chatOWNER = data.chatOWNER;
    con.query('DELETE t1 FROM message_box t1 LEFT JOIN messages_sys t2 ON t2.box_id = t1.box_id WHERE t1.box_id = ?',
    [boxID], (err, rows)=>{
      io.emit('delete_msgBoxBack', { boxID: boxID, sessionID:sessionID, chatOWNER:chatOWNER });
    })
  })

  socket.on('sendGhostMsg', (data)=>{
    var convo    = data.convo;
    var senderID = data.senderID
    var msg      = data.msg;

    con.query('INSERT INTO ghost_msg (convo_id, sender_id, msg) VALUES (?, ?, ?)',
    [convo, senderID, msg], (err, convos) => {
      this.emit('sendGhostMsgBack', {msg_id: convos.insertId, convo: convo, senderID: senderID, msg: msg});
    })
  })

  socket.on('readGhostMsg', (data)=>{
    var convo    = data.convo;
    var senderID = data.senderID
    var seen = '2';
    con.query('UPDATE ghost_msg SET seen = ? WHERE convo_id = ? AND sender_id != ?',
    [seen, convo, senderID], (err, convos) => {
      this.emit('readGhostMsgBack', {convo: convo});
    })
  })
});

var storage = multer.diskStorage({
  destination: function(req, file, res){
    res(null, 'upload')
  },
  filename: function(req, file, res){

    if (file.mimetype == 'image/png') {
      res(null, "GIMI_"+Date.now()+"."+uniqid()+"_STAR.png")
    } else if(file.mimetype == 'image/jpeg') {
      res(null, "GIMI_"+Date.now()+"."+uniqid()+"_STAR.jpg")
    } else if(file.mimetype == 'image/gif') {
      res(null, "GIMI_"+Date.now()+"."+uniqid()+"_STAR.gif")
    }

  }
});

var upload  = multer({storage: storage});

app.post("/token/loguser", function(req, res){
  var username = req.body.user_cred;
  var userpass = req.body.password;
var qe = `SELECT user_id,
          user_uname,
          user_pass FROM
          users WHERE user_uname = ?`

  con.query(qe, [username], (err, rows) => {
    if(rows.length > 0){
      bcrypt.compare(userpass, rows[0].user_pass, (err, pass) => {
        if(pass){
          var obj = {
            'userID'   : rows[0].user_id,
            'username' : rows[0].user_uname
          }
          let token = jwt.sign(obj, accessTokenSecret, { expiresIn: '8000d'})
          res.status(200).json({"err": 0, "token": token});
        }else {
          res.status(200).json({"err": 2});
        }
      })
    }else {
      res.status(200).json([{"err": 1}]);
    }
  });

})

app.post("/create/account", function(req, res){
  var dateOpt = {
    "method": "GET",
    "hostname": "worldtimeapi.org",
    "path": "/api/timezone/"+timeZone
  };

  var username = req.body.username;
  var email    = req.body.email;
  var fullname = req.body.fullname;
  var passowrd = req.body.passowrd;
  var spaceMan = 'a_space_man.png';
  var cover_1  = 'cover_1.jpg';
  var cover_2  = 'cover_2.jpg';
  var cover_3  = 'cover_3.jpg';
  var cover_4  = 'cover_4.jpg';


  http.request(dateOpt, function(response) {
    var timeForInsert ='';
    response.on('data', function (chunk) {
      timeForInsert += chunk;
    });

    response.on('end', function () {
      var geoDataToInsert = JSON.parse(timeForInsert);

      bcrypt.hash(passowrd, 10, (err, hash) => {
        con.query('INSERT INTO users (user_uname, full_name, user_email, user_pass, userPass_string, left_pic, middle_pic_1, middle_pic_2, right_pic, cover_1, cover_2, cover_3, cover_4, country_code, country_name, city, signDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [username, fullname, email, hash, passowrd, spaceMan, spaceMan, spaceMan, spaceMan, cover_1, cover_2, cover_3, cover_4, countryCode, countryName, countryCity, geoDataToInsert.datetime], (err, rows) => {
          var userID = rows.insertId;
          var obj = {
             'userID'   : rows.insertId,
             'username' : username
            }
            let token = jwt.sign(obj, accessTokenSecret, { expiresIn: '800000d'})
            res.status(200).json({"token": token, userID: rows.insertId});
        })
      })

    });

  }).end();


})

app.post("/profile/profile_pic", function(req, res){
  var reqToken = req.headers['authorization'];
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    var userID = parseInt(req.body['userID']);
    con.query('SELECT left_pic, middle_pic_1, middle_pic_2, right_pic, pic_ref FROM users WHERE user_id = ?',
    [userID] ,(err, rows) => {
      res.status(200).json(rows);
    });
  });
})

app.post("/profile/priv", function(req, res){
  var reqToken = req.headers['authorization'];
  var userID   = req.body['userID'];
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    if(decoded.userID != userID){
      con.query('SELECT (SELECT COUNT(t2.follower) FROM follows_syds t2 WHERE t2.follower = t1.user_id AND t2.following = ?) AS he, (SELECT COUNT(t3.follower) FROM follows_syds t3 WHERE t3.following = t1.user_id AND t3.follower = ?) AS me, t1.prof_priv, t1.feed_priv, t1.stream_priv, t1.	store_priv, t1.radio_priv, t1.tv_priv, t1.club_priv, t1.wall_priv FROM users t1 WHERE t1.user_id = ?',
      [decoded.userID, decoded.userID, userID] ,(err, rows) => {
        res.status(200).json(rows);
       });
    }else {
      res.status(200).json([]);
    }

  });
})

app.post("/profile/profile_pic/ref", function(req, res){
  var reqToken = req.headers['authorization'];
  var pic_ref  = req.body['picREF'];
  var userID   = req.body['userID'];
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    if(decoded.userID == userID){
      con.query('UPDATE users SET pic_ref = ? WHERE user_id =?',
      [pic_ref, userID] ,(err, rows) => {
        res.status(200).json([]);
       });
    }else {
      res.status(200).json([]);
    }
  });
})

app.post("/profile/data_2", function(req, res){
  var reqToken = req.headers['authorization'];
  var userID   = req.body['userID'];

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {

    con.query('SELECT full_name, user_uname, country_code, country_name, city, status FROM users WHERE user_id = ?',
    [userID], (err, rows) => {
      res.status(200).json(rows);

    });
  });
})

app.post("/profile/data_4", function(req, res){
  var reqToken = req.headers['authorization'];
  var userID   = req.body['userID'];
  var ref      = parseInt(req.body['ref']);
  var notif_2  = '2';

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    sessionID = decoded.userID;
    if(ref == 2){
      con.query('SELECT count(follower) AS follows FROM follows_syds WHERE follower = ? AND following = ?',
      [sessionID, userID], (err, rows) => {

        if(rows[0].follows < 1){
          con.query('INSERT INTO follows_syds (follower, following, numstat) VALUES (?, ?, ?)',
          [sessionID, userID, notif_2], (err, res) => { getUSERHE(1); })
        }else if(rows[0].follows > 0){
          con.query('DELETE t1 FROM follows_syds t1 WHERE t1.follower = ? AND t1.following = ?',
          [sessionID, userID], (err, res) => { getUSERHE(0); })
        }

        function getUSERHE(ref){
          con.query('SELECT count(follower) AS follows FROM follows_syds WHERE follower = ? AND following = ?',
          [userID, sessionID], (err, rows) => {
            res.status(200).json([{me: ref, he: rows[0].follows}])
          })
        }

      });
    }else if(ref == 1){

      con.query('SELECT count(follower) AS follows FROM follows_syds WHERE follower = ? AND following = ?',
      [userID, sessionID], (err, rows) => { getUserCount(rows[0].follows); })

      function getUserCount(count){
        con.query('SELECT count(follower) AS follows FROM follows_syds WHERE follower = ? AND following = ?',
        [sessionID, userID], (err, rows) => { res.status(200).json([{me: rows[0].follows, he: count}]) })
      }

    }
  })
})

app.post("/profile/data_3", function(req, res){
  var reqToken = req.headers['authorization'];
  var userID   = req.body['userID'];
  var friends;
  var followers;
  var followings;

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {

    con.query('SELECT * FROM ( SELECT count(f1.follower) AS friends FROM follows_syds f1 WHERE EXISTS(SELECT * FROM follows_syds f2 WHERE f2.follower = f1.following and f2.following = ?) AND f1.follower = ?) AS res',
    [userID, userID], (err, rows) => {
      friends  = rows[0].friends;

      con.query('SELECT * FROM ( SELECT count(f1.follower) AS followings FROM follows_syds f1 WHERE NOT EXISTS(SELECT * FROM follows_syds f2 WHERE f2.follower = f1.following and f2.following = ?) AND f1.follower = ?) AS res',
      [userID, userID], (err, rows) => {
        followings  = rows[0].followings;

        con.query('SELECT * FROM ( SELECT count(f1.follower) AS followers FROM follows_syds f1 WHERE NOT EXISTS (SELECT * FROM follows_syds f2 WHERE f2.following = f1.follower and f2.follower = ?) AND f1.following = ?) AS res',
        [userID, userID], (err, rows) => {
          followers  = rows[0].followers;

          res.status(200).json([{friends: friends, followings: followings, followers: followers}]);

        });
      });
    });

  });
})

app.post("/profile/cover", (req, res)=>{
  var reqToken = req.headers['authorization'];
  var userID   = parseInt(req.body['userID']);
  jwt.verify(reqToken, accessTokenSecret, () => {
    con.query('SELECT cover_1, cover_2, cover_3, cover_4 FROM users WHERE user_id = ?',
    [userID], (err, rows)=>{
      res.status(200).json(rows);
    });
  })
})

app.post("/profile/upload/post", upload.single('file'), (req, res) => {

  var reqToken = req.headers['authorization'];
  var userID   = req.body['userID'];
  if(req.body['sub']){
    var sub      = req.body['sub'];
  }else{
    var sub      = '';
  }
  if(req.body['cap']){
    var cap     = req.body['sub'];
  }else{
    var cap     = '';
  }

  var ref      = req.body['ref'];

  var oldPath = req.file.path;
  var newPath = "photos/"+req.file.filename;
  var fileName= req.file.filename;

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    if(decoded.userID == userID){
      if(req.file.mimetype == "image/jpeg" || req.file.mimetype == "image/png"){
        var inStream = fs.createReadStream(oldPath);
        var outStream = fs.createWriteStream(newPath, {flags: "w"});
        var transform = sharp()
        .resize({ width: 1200, height: 1200, fit: sharp.fit.inside })
        .webp({ quality: 90 })
        .rotate()
        .on('info', function(fileInfo) { sentPicture(); });
        inStream.pipe(transform).pipe(outStream);
      }else if(req.file.mimetype == "image/gif"){
        var cccc = "photos/";
        var old  = "upload/"+ req.file.filename;
        compress_images(old, cccc,
          {compress_force: false, statistic: true, autoupdate: true}, false,
          {jpg: {engine: false, command: false}},
          {png: {engine: false, command: false}},
          {svg: {engine: false, command: false}},
          {gif: {engine: 'gifsicle', command: ['--colors', '64', '--use-col=web']}},
          function(error, completed, statistic){ if(!error){ sentPicture(); } })
      }

      function sentPicture(){
        var dateOpt = {
          "method": "GET",
          "hostname": "worldtimeapi.org",
          "path": "/api/timezone/"+timeZone
        };
        http.request(dateOpt, function(response) {
          var timeForInsert ='';
          response.on('data', function (chunk) {
            timeForInsert += chunk;
          });
          response.on('end', function () {
            console.log(timeForInsert);
            var geoDataToInsert = JSON.parse(timeForInsert);
            con.query('INSERT INTO posts (user_id, subject, cap, post_type, pic_path, uptime, location_code, location_name, location_city) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [userID, sub, cap, ref, fileName, geoDataToInsert.datetime, countryCode,countryName,countryCity], (req, ress) => {

            postID = ress['insertId'];

            con.query('SELECT t1.pic_path, t1.uptime, t1.location_code, t1.location_name, t1.location_city, t1.post_id, t1.user_id, t1.post_type, count(t2.post_id) AS voters, sum(t2.score_pos) AS stars, t3.left_pic, t3.middle_pic_1, t3.middle_pic_2, t3.right_pic, t3.full_name, t3.user_uname, t3.pic_ref FROM posts t1 LEFT JOIN post_votes t2 on t2.post_id = t1.post_id JOIN users t3 on t3.user_id = t1.user_id WHERE t1.post_id = ? GROUP BY t1.post_id ',
            [postID], (err, rows)=>{
              res.status(200).json(rows);
              });
            })
          })

        }).end();

      }
    }

  })

})

app.post('/profile/get/posts', (req, res)=>{
  var reqToken   = req.headers['authorization'];
  var userID     = req.body['userID'];
  var path_ref   = req.body['path_ref'];
  var offset     = parseInt(req.body['offset']);

  var arr = req.body['query'].split(',');

  var catagory   = (parseInt(arr[0])).toString();
  var gander     = (parseInt(arr[1])).toString();
  var connection = (parseInt(arr[2])+1).toString();
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {

    if(path_ref == 'profile'){
      con.query('SELECT t1.pic_path, t3.user_uname, t1.user_id, t1.post_type, t1.uptime, t1.location_code, t1.location_name, t1.location_city, t1.post_id, count(t2.post_id) AS voters, count(t5.streamer_id) AS streams, sum(t2.score_pos) AS stars, t3.left_pic, t3.middle_pic_1, t3.middle_pic_2, t3.right_pic, t3.full_name, t3.pic_ref, t4.score FROM posts t1 LEFT JOIN post_votes t2 on t2.post_id = t1.post_id JOIN users t3 on t3.user_id = t1.user_id LEFT JOIN post_votes t4 ON t4.post_id = t1.post_id  AND t4.user_id = ? LEFT JOIN post_stream t5 ON t5.post_id = t1.post_id AND t5.streamer_id = ? WHERE t1.user_id = ? GROUP BY t1.post_id DESC LIMIT 5 OFFSET ?',
      [decoded.userID, decoded.userID, userID, offset], (err, rows)=>{
        res.status(200).json(rows);
      });
    }else if(path_ref == "feed"){

      var conQuery;
      if(connection == '1'){
        conQuery = "EXISTS(SELECT * FROM follows_syds f2 WHERE f2.follower = f1.following and f2.following = ?) AND f1.follower = ? ";
      }else if(connection == '2'){
        conQuery = "NOT EXISTS(SELECT * FROM follows_syds f2 WHERE f2.follower = f1.following and f2.following = ?) AND f1.follower = ? ";
      }

      var catagPre   = arr[0];
      var ganderPre  = arr[1];
      var connectPre = arr[2];

      if(ganderPre != '0' && catagPre != '0'){
        if(connectPre == '2'){
          query       = "SELECT t1.pic_path, t1.uptime, t1.location_code, t1.location_name, t1.location_city, t3.user_uname, t1.user_id, t1.post_type, t1.post_id, count(t5.streamer_id) AS streams, count(t2.post_id) AS voters, count(f1.following) AS follows, sum(t2.score_pos) AS stars, t3.left_pic, t3.middle_pic_1, t3.middle_pic_2, t3.right_pic, t3.full_name, t3.pic_ref, t3.user_gander, t4.score FROM follows_syds f1 LEFT JOIN follows_syds f2 ON f2.follower = f1.following JOIN posts t1 on t1.user_id = f2.following LEFT JOIN users t3 on t3.user_id  = t1.user_id LEFT JOIN post_votes t2 ON t2.post_id = t1.post_id LEFT JOIN post_votes t4 ON t4.post_id = t1.post_id AND t4.user_id = ? LEFT JOIN post_stream t5 ON t5.post_id = t1.post_id AND t5.streamer_id = ? WHERE f1.follower = ? AND t3.user_gander = ? AND t1.post_type = ? GROUP BY t1.post_id DESC limit 5 offset ?"
          queryParams = [decoded.userID, decoded.userID, userID, gander, catagory, offset]
        }else if(connectPre != '2'){
          query       = "SELECT t1.pic_path, t1.uptime, t1.location_code, t1.location_name, t1.location_city, t3.user_uname, t1.user_id, t1.post_type, t1.post_id, count(t5.streamer_id) AS streams, t5.stream_id, count(t2.post_id) AS voters, count(f1.following) AS follows, sum(t2.score_pos) AS stars, t3.left_pic, t3.middle_pic_1, t3.middle_pic_2, t3.right_pic, t3.full_name, t3.pic_ref, t3.user_gander, t4.score FROM follows_syds f1 JOIN posts t1 on t1.user_id = f1.following JOIN users t3 on t3.user_id = t1.user_id LEFT JOIN post_votes t2 ON t2.post_id = t1.post_id LEFT JOIN post_votes t4 ON t4.post_id = t1.post_id AND t4.user_id = ? LEFT JOIN post_stream t5 ON t5.post_id = t1.post_id AND t5.streamer_id = ? WHERE "+conQuery+" AND t3.user_gander = ? AND t1.post_type = ? GROUP BY t1.post_id DESC limit 5 offset ?";
          queryParams = [decoded.userID, decoded.userID, userID, userID, gander, catagory, offset]
        }
      }else if(ganderPre != '0' && catagPre == '0'){
        if(connectPre == '2'){
          query       = "SELECT t1.pic_path, t1.uptime, t1.location_code, t1.location_name, t1.location_city, t3.user_uname, t1.user_id, t1.post_type, t1.post_id, count(t5.streamer_id) AS streams, count(t2.post_id) AS voters, count(f1.following) AS follows, sum(t2.score_pos) AS stars, t3.left_pic, t3.middle_pic_1, t3.middle_pic_2, t3.right_pic, t3.full_name, t3.pic_ref, t3.user_gander, t4.score FROM follows_syds f1 LEFT JOIN follows_syds f2 ON f2.follower = f1.following JOIN posts t1 on t1.user_id = f2.following LEFT JOIN users t3 on t3.user_id  = t1.user_id LEFT JOIN post_votes t2 ON t2.post_id = t1.post_id LEFT JOIN post_votes t4 ON t4.post_id = t1.post_id AND t4.user_id = ? LEFT JOIN post_stream  t5 ON t5.post_id = t1.post_id AND t5.streamer_id = ? WHERE f1.follower = ? AND t3.user_gander = ? GROUP BY t1.post_id DESC limit 5 offset ?"
          queryParams = [decoded.userID, decoded.userID, userID, gander, offset]
        }else if(connectPre != '2'){
          query       = "SELECT t1.pic_path, t1.uptime, t1.location_code, t1.location_name, t1.location_city, t3.user_uname, t1.user_id, t1.post_type, t1.post_id, count(t5.streamer_id) AS streams, t5.stream_id, count(t2.post_id) AS voters, count(f1.following) AS follows, sum(t2.score_pos) AS stars, t3.left_pic, t3.middle_pic_1, t3.middle_pic_2, t3.right_pic, t3.full_name, t3.pic_ref, t3.user_gander, t4.score FROM follows_syds f1 JOIN posts t1 on t1.user_id = f1.following JOIN users t3 on t3.user_id = t1.user_id LEFT JOIN post_votes t2 ON t2.post_id = t1.post_id LEFT JOIN post_votes t4 ON t4.post_id = t1.post_id AND t4.user_id = ? LEFT JOIN post_stream t5 ON t5.post_id = t1.post_id AND t5.streamer_id = ? WHERE "+conQuery+" AND t3.user_gander = ? GROUP BY t1.post_id DESC limit 5 offset ?";
          queryParams = [decoded.userID, decoded.userID, userID, userID, gander, offset]
        }
      }else if(ganderPre == '0' && catagPre != '0'){
        if(connectPre == '2'){
          query       = "SELECT t1.pic_path, t1.uptime, t1.location_code, t1.location_name, t1.location_city, t3.user_uname, t1.user_id, t1.post_type, t1.post_id, count(t5.streamer_id) AS streams, count(t2.post_id) AS voters, count(f1.following) AS follows, sum(t2.score_pos) AS stars, t3.left_pic, t3.middle_pic_1, t3.middle_pic_2, t3.right_pic, t3.full_name, t3.pic_ref, t3.user_gander, t4.score FROM follows_syds f1 LEFT JOIN follows_syds f2 ON f2.follower = f1.following JOIN posts t1 on t1.user_id = f2.following LEFT JOIN users t3 on t3.user_id  = t1.user_id LEFT JOIN post_votes t2 ON t2.post_id = t1.post_id LEFT JOIN post_votes t4 ON t4.post_id = t1.post_id AND t4.user_id = ? LEFT JOIN post_stream t5 ON t5.post_id = t1.post_id AND t5.streamer_id = ? WHERE f1.follower = ? AND t1.post_type = ? GROUP BY t1.post_id DESC limit 5 offset ?"
          queryParams = [decoded.userID, decoded.userID, userID, catagory, offset]
        }else if(connectPre != '2'){
          query       = "SELECT t1.pic_path, t1.uptime, t1.location_code, t1.location_name, t1.location_city, t3.user_uname, t1.user_id, t1.post_type, t1.post_id, count(t5.streamer_id) AS streams, t5.stream_id, count(t2.post_id) AS voters, count(f1.following) AS follows, sum(t2.score_pos) AS stars, t3.left_pic, t3.middle_pic_1, t3.middle_pic_2, t3.right_pic, t3.full_name, t3.pic_ref, t3.user_gander, t4.score FROM follows_syds f1 JOIN posts t1 on t1.user_id = f1.following JOIN users t3 on t3.user_id = t1.user_id LEFT JOIN post_votes t2 ON t2.post_id = t1.post_id LEFT JOIN post_votes t4 ON t4.post_id = t1.post_id AND t4.user_id = ? LEFT JOIN post_stream t5 ON t5.post_id = t1.post_id AND t5.streamer_id = ? WHERE "+conQuery+" AND t1.post_type = ? GROUP BY t1.post_id DESC limit 5 offset ?";
          queryParams = [decoded.userID, decoded.userID, userID, userID, catagory, offset]
        }
      }else if(ganderPre == '0' && catagPre == '0'){
        if(connectPre == '2'){
          query       = "SELECT t1.pic_path, t1.uptime, t1.location_code, t1.location_name, t1.location_city, t1.user_id, t3.user_uname, t1.post_type, t1.post_id, count(t5.streamer_id) AS streams, t5.stream_id, (SELECT COUNT(v2.post_id) FROM post_votes v2 WHERE v2.post_id = t1.post_id) AS voters, count(f1.following) AS follows, (SELECT sum(v3.score_pos) FROM post_votes v3 WHERE v3.post_id = t1.post_id ) AS stars, t3.left_pic, t3.middle_pic_1, t3.middle_pic_2, t3.right_pic, t3.full_name, t3.pic_ref, t3.user_gander, t4.score FROM follows_syds f1 JOIN follows_syds f2 ON f2.follower = f1.following JOIN posts t1 on t1.user_id = f2.following JOIN users t3 on t3.user_id = t1.user_id LEFT JOIN post_votes t2 ON t2.post_id = t1.post_id LEFT JOIN post_votes t4 ON t4.post_id = t1.post_id AND t4.user_id = ? LEFT JOIN post_stream t5 ON t5.post_id = t1.post_id AND t5.streamer_id = ? WHERE f1.follower = ? GROUP BY t1.post_id DESC limit 5 offset ?"
          queryParams = [decoded.userID, decoded.userID, userID, offset]
        }else if(connectPre != '2'){
          query       = "SELECT t1.pic_path, t1.uptime, t1.location_code, t1.location_name, t1.location_city, t1.user_id, t3.user_uname, t1.post_type, t1.post_id, count(t5.streamer_id) AS streams, t5.stream_id, count(t2.post_id) AS voters, count(f1.following) AS follows, sum(t2.score_pos) AS stars, t3.left_pic, t3.middle_pic_1, t3.middle_pic_2, t3.right_pic, t3.full_name, t3.pic_ref, t3.user_gander, t4.score FROM follows_syds f1 JOIN posts t1 on t1.user_id = f1.following JOIN users t3 on t3.user_id = t1.user_id LEFT JOIN post_votes t2 ON t2.post_id = t1.post_id LEFT JOIN post_votes t4 ON t4.post_id = t1.post_id AND t4.user_id = ? LEFT JOIN post_stream t5 ON t5.post_id = t1.post_id AND t5.streamer_id = ? WHERE "+conQuery+" GROUP BY t1.post_id DESC limit 5 offset ?";
          queryParams = [decoded.userID, decoded.userID, userID, userID, offset]
        }
      }

      con.query(query, queryParams, (err, rows)=>{
        res.status(200).json(rows);
      });
    }else if(path_ref == "stream"){
      con.query('SELECT t1.pic_path, t1.user_id, t1.uptime, t1.location_code, t1.location_name, t1.location_city, t3.user_uname, t1.post_type, t1.post_id, count(t5.streamer_id) AS streams, t5.stream_id, count(t2.post_id) AS voters, sum(t2.score_pos) AS stars, t3.left_pic, t3.middle_pic_1, t3.middle_pic_2, t3.right_pic, t3.full_name, t3.pic_ref, t3.user_gander, t4.score FROM post_stream f1 JOIN posts t1 ON t1.post_id = f1.post_id JOIN users t3 ON t3.user_id = t1.user_id LEFT JOIN post_votes t2 ON t2.post_id = t1.post_id LEFT JOIN post_votes t4 ON t4.post_id = t1.post_id AND t4.user_id = ? LEFT JOIN post_stream t5 ON t5.post_id = t1.post_id AND t5.streamer_id = ? WHERE f1.streamer_id = ? GROUP BY f1.stream_id DESC limit 5 offset ?',
      [decoded.userID, decoded.userID, userID, offset], (err, rows)=>{
        res.status(200).json(rows);
      });
    }else if(path_ref == "trend"){
      var location = "MA";
      con.query('SELECT *, max(total) AS total2 FROM (SELECT t1.pic_path, t1.user_id, t1.uptime, t1.location_code, t1.location_name, t1.location_city, t3.user_uname, t1.post_type, t1.post_id, count(t5.streamer_id) AS streams, t5.stream_id, count(t2.post_id) AS voters, sum(t2.score_pos) AS stars, t3.left_pic, t3.middle_pic_1, t3.middle_pic_2, t3.right_pic, t3.full_name, t3.pic_ref, t3.user_gander, t4.score, sum(t2.score_pos) AS total FROM posts t1 JOIN users t3 ON t3.user_id = t1.user_id LEFT JOIN post_votes t2 ON t2.post_id = t1.post_id LEFT JOIN post_votes t4 ON t4.post_id = t1.post_id AND t4.user_id = ? LEFT JOIN post_stream t5 ON t5.post_id = t1.post_id AND t5.streamer_id = ? WHERE t1.location_code = ? GROUP BY t1.post_id) AS Results GROUP BY post_id ORDER BY Total DESC LIMIT 10 OFFSET ?',
      [decoded.userID, decoded.userID, location, offset], (err, rows)=>{
        res.status(200).json(rows);
      });
    }
  })

});

app.post('/notifs_post', (req, res)=>{
  var reqToken   = req.headers['authorization'];
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query('SELECT t1.pic_path, t3.user_uname, t1.user_id, t1.uptime, t1.location_code, t1.location_name, t1.location_city, t1.post_type, t1.post_id, count(t2.post_id) AS voters, count(t5.streamer_id) AS streams, sum(t2.score_pos) AS stars, t3.left_pic, t3.middle_pic_1, t3.middle_pic_2, t3.right_pic, t3.full_name, t3.pic_ref, t4.score FROM posts t1 LEFT JOIN post_votes t2 on t2.post_id = t1.post_id JOIN users t3 on t3.user_id = t1.user_id LEFT JOIN post_votes t4 ON t4.post_id = t1.post_id  AND t4.user_id = ? LEFT JOIN post_stream t5 ON t5.post_id = t1.post_id AND t5.streamer_id = ? WHERE t1.post_id = ? GROUP BY t1.post_id DESC',
    [decoded.userID, decoded.userID, req.body.notifPost], (err, rows)=>{
      res.status(200).json(rows);
    });
  })

});

app.post('/profile/posts/vote', (req, res)=>{
  var reqToken = req.headers['authorization'];
  var path_ref = req.body['path_ref'];
  var postID   = req.body['postID'];
  var vote     = req.body['vote'];
  var ownerID  = req.body['userID'];

  var zero     = 0;

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    var userID   = decoded.userID;
    if(vote == 11){
      var voreCOUNT = 100;
      finalVote = vote;
      var proc  = true;
      notifications(postID, userID, ownerID, 16, 'vote');
    }else if(vote == 10){
      var voreCOUNT = 50;
      finalVote = vote;
      var proc  = true;
      notifications(postID, userID, ownerID, 15, 'vote');
    }else if(vote == 9){
      var voreCOUNT = 38;
      finalVote = vote;
      var proc  = true;
      notifications(postID, userID, ownerID, 14, 'vote');
    }else if(vote == 8){
      var voreCOUNT = 25;
      finalVote = vote;
      var proc  = true;
      notifications(postID, userID, ownerID, 1, 'vote');
    }else if(vote == 7){
      var voreCOUNT = 11;
      finalVote = vote;
      var proc = true;
      notifications(postID, userID, ownerID, 2, 'vote');
    }else if(vote == 6 || vote == 5 || vote == 4 || vote == 3 || vote == 2){
      var voreCOUNT = (parseInt(vote) - 1);
      finalVote = vote;
      var proc = true;
      notifications(postID, userID, ownerID, 3, 'vote');
    }else if (vote == 1){
      var voreCOUNT = 5;
      finalVote = vote;
      var proc = true;
      notifications(postID, userID, ownerID, 4, 'vote');
    }else {
      var proc = false;
    }
      con.query('SELECT count(post_id) AS voters, score FROM post_votes WHERE post_id = ? AND user_id = ?',
      [postID, userID], (err, rows) => {

        if(rows[0].voters > 0){
          if(rows[0].score != finalVote){
            delete_vote(1);
          }else {
            delete_vote(2);
          }
        }else if(rows[0].voters == 0){
          insert();
        }

        function delete_vote(ref){
          con.query('DELETE t1 FROM post_votes t1 WHERE t1.post_id = ? AND t1.user_id = ?',
          [postID, decoded.userID], (err, rows)=>{
            if(ref == 1){
              insert();
            }else if(ref == 2){
              counter();
            }
          });
        }

        function insert(){
          if(vote == '1' && proc == true){
            con.query('INSERT INTO post_votes (score, score_neg, post_id, user_id) VALUES (?, ?, ?, ?)',
            [finalVote, voreCOUNT, postID, decoded.userID], (err, rows)=>{ counter() });
          }else if(vote != '1' && proc == true){
            con.query('INSERT INTO post_votes (score, score_pos, post_id, user_id) VALUES (?, ?, ?, ?)',
            [finalVote, voreCOUNT, postID, decoded.userID], (err, rows)=>{ counter() });
          }
        }

        function counter(){
          con.query('SELECT COUNT(post_id) AS counter, SUM(score_pos) AS pos, SUM(score_neg) AS neg FROM post_votes WHERE post_id = ?',
          [postID], (err, rows)=>{
            res.status(200).json(rows);
          })
        }

      });
    })

});

app.post("/profile/posts/edit", (req, res) => {

  var reqToken = req.headers['authorization'];
  var userID   = parseInt(req.body['userID']);
  var postID   = parseInt(req.body['postID']);
  var subject  = req.body.subject.trim();
  var caption  = req.body.caption.trim();
  var cat_ref  = req.body.cat_Ref.trim().toString();

  jwt.verify(reqToken, accessTokenSecret, () => {
    if(subject.length > 0 && caption.length < 1){
      var query     = 'UPDATE posts SET subject = ?, post_type = ? WHERE post_id = ? AND user_id = ?';
      var dataParam = [subject, cat_ref, postID, userID];
    }else if(subject.length < 1 && caption.length > 0){
      var query     = 'UPDATE posts SET cap = ?, post_type = ? WHERE post_id = ? AND user_id = ?';
      var dataParam = [caption, cat_ref, postID, userID];
    }else if(subject.length > 0 && caption.length > 0){
      var query     = 'UPDATE posts SET subject = ?, cap = ?, post_type = ? WHERE post_id = ? AND user_id = ?';
      var dataParam = [subject, caption, cat_ref, postID, userID];
    }else if(subject.length < 1 && caption.length < 1) {
      var query     = 'UPDATE posts SET post_type = ? WHERE post_id = ? AND user_id = ?';
      var dataParam = [cat_ref, postID, userID];
    }
    con.query(query, dataParam, (err, rows)=>{
    var obj = {
      'userID': userID,
      'postID': postID,
      'subject': subject,
      'caption': caption,
      'cat_ref': cat_ref
    }
     res.status(200).json(obj);
    });
  })
})

app.post("/profile/get/question", (req, res) => {

  var reqToken = req.headers['authorization'];
  var postID   = req.body['postID'];
  var caption  = req.body['caption'];
  var ownerID  = req.body['userID']
  if(req.body['swit'] == 'false'){
    var priv = '1';
  }else if(req.body['swit'] == 'true'){
    var priv = '2';
  }
  if(caption.length > 0){

    jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
      var userID = decoded.userID;
      con.query('INSERT INTO profile_post_question_critic (q_c_user_id, q_c_post_id, post, priv) VALUES(?, ?, ?, ?)',
      [userID, postID, caption, priv], (err, rows)=>{
        if(priv == '1'){
          notifications(postID, userID, ownerID, 5, 'ask');
        }else if(priv == '2'){
          notifications(postID, userID, ownerID, 12, 'ask');
        }

        if(rows){
          questID = rows['insertId'];
          con.query('SELECT * FROM profile_post_question_critic WHERE q_c_id = ?',
          [questID], (err, rows) => {
            res.status(200).json(rows);
          });
        }

      });
    })

  }

});

app.post("/profile/get/delete_questions", (req, res) => {

  var reqToken = req.headers['authorization'];
  var Q_ID = req.body['Q_ID'];

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query('DELETE t1, t2 FROM profile_post_question_critic t1 LEFT JOIN post_questions_answers t2 ON t1.q_c_id = t2.q_question_id WHERE t1.q_c_id = ?',
    [Q_ID], (err, rows)=>{

    res.status(200).json(Q_ID)

    });
  })

});

app.post("/profile/get/report", (req, res) => {
  var reqToken = req.headers['authorization'];
  var postID   = req.body['postID'];

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query('SELECT *, COUNT(*) AS total FROM profile_post_repost WHERE post_id = ? AND user_id =?',
    [postID, decoded.userID], (err, rows)=>{
      res.status(200).json(rows);
    })
  });

});

app.post("/profile/posts/report", (req, res) => {
  var reqToken = req.headers['authorization'];
  var userID   = req.body['userID'];
  var postID   = req.body['postID'];
  var type     = (parseInt(req.body['index'])+1).toString();
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query('SELECT *, COUNT(*) AS total FROM profile_post_repost WHERE post_id = ? AND user_id =?',
    [postID, userID], (err, rows)=>{

      if(rows[0].total > 0){

        if(rows[0].rep_type === type){

          con.query('DELETE t1 FROM profile_post_repost t1 WHERE t1.user_id = ? AND t1.post_id = ?',
          [userID, postID], (err, rows) => {
            var ref = 1;
            res.status(200).json(ref);
          });

        }else if(rows[0].rep_type !== type){

          con.query('UPDATE profile_post_repost SET rep_type = ? WHERE user_id = ? AND post_id = ?',
          [type, userID, postID], (err, rows) => {
            var ref = 2;
            res.status(200).json(ref);
          });

        }

      }else if(rows[0].total == 0){

        con.query('INSERT INTO profile_post_repost(user_id, post_id, rep_type) VALUES(?, ?, ?)',
        [userID, postID, type], (err, rows) => {
          var ref = 3;
          res.status(200).json(ref);
        });

      }

    })
  });

});

app.post('/attach/post/userFind', (req, res) => {
  var reqToken = req.headers['authorization'];
  var input    = req.body.userInput;
  var postID   = req.body.postID;

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query("SELECT t1.user_id, t1.full_name, t1.user_uname, t1.left_pic, t1.middle_pic_1, t1.middle_pic_2, t1.right_pic, t1.pic_ref, (SELECT COUNT(t2.id) FROM attach_user t2 WHERE t2.user_id = t1.user_id AND t2.post_id = ? AND t2.streamer_id = ?) AS attached FROM users t1 WHERE t1.user_uname LIKE CONCAT('%', ? ,'%') OR t1.user_uname LIKE CONCAT('%', ?) OR t1.full_name LIKE CONCAT(?,'%') OR t1.full_name LIKE CONCAT('%',?) OR t1.full_name LIKE CONCAT('%',?,'%') GROUP BY t1.user_id DESC LIMIT 30",
    [postID, decoded.userID, input, input, input, input, input], (err, rows) => {
      res.status(200).json(rows);
    })
  })
})

app.post('/attach/streams/get', (req, res) => {
  var reqToken   = req.headers['authorization'];
  var offset     = parseInt(req.body.offset);
  var postID     = req.body.postID;
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query("SELECT t2.pic_path, t2.user_id, t2.post_id, (SELECT COUNT(t2.id) FROM attach_post t2 WHERE t2.post = t1.post_id AND t2.streamer_id = t1.streamer_id AND t2.post_id = ?) AS attached FROM post_stream t1 JOIN posts t2 ON t2.post_id = t1.post_id WHERE t1.streamer_id = ? GROUP BY t1.post_id ORDER BY t1.stream_id DESC LIMIT 10 OFFSET ?",
    [postID, decoded.userID, offset], (err, rows) => {
      res.status(200).json(rows);
    })
  })
})

app.post('/attach/walls/get', (req, res) => {
  var reqToken = req.headers['authorization'];
  var offset    = parseInt(req.body.offset);
  var postID    = req.body.postID;
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query("SELECT t1.wall_id, t1.wall_icon, t1.user_id, (SELECT COUNT(t2.id) FROM attach_wall t2 WHERE t2.wall_id = t1.wall_id AND t2.post_id = ? AND t2.streamer_id = ?) AS attached FROM walls t1 WHERE t1.user_id = ? GROUP BY t1.wall_id DESC LIMIT 10 OFFSET ?",
    [postID, decoded.userID, decoded.userID, offset], (err, rows) => {
      res.status(200).json(rows);
    })
  })
})

app.post("/attach/post/attachUser", (req, res) => {
  var reqToken   = req.headers['authorization'];
  var postID     = req.body['postID'];
  var userID     = req.body['userID'];

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    notifications(postID, decoded.userID, userID, 9);
    con.query('SELECT count(*) AS total FROM attach_user WHERE post_id = ? AND user_id = ? AND streamer_id = ?',
    [postID, userID, decoded.userID], (err, rows)=>{
      if(rows[0].total < 1){
        con.query('INSERT INTO attach_user (streamer_id, post_id, user_id) VALUES(?, ?, ?)',
        [decoded.userID, postID, userID ], (er, rows) => {
          con.query('SELECT user_id, full_name, left_pic, middle_pic_1, middle_pic_2, right_pic, pic_ref FROM users WHERE user_id = ?',
          [userID],(err, rows) => {
            res.status(200).json(rows);
          })
        });
      }else {
        res.status(200).json([]);
      }

    })
  })
})

app.post("/attach/post/attachPost", (req, res) => {
  var reqToken   = req.headers['authorization'];
  var toPostID   = req.body['toPostID'];
  var userID     = req.body['userID'];
  var postID     = req.body['postID'];

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    notifications(postID, decoded.userID, userID, 9);

    con.query('SELECT count(*) AS total FROM attach_post WHERE post_id = ? AND streamer_id = ? AND post = ?',
    [toPostID, decoded.userID, postID], (err, rows) => {
      if(rows[0].total < 1){
        con.query('INSERT INTO attach_post (post_id, streamer_id, post) VALUES(?, ?, ?)',
        [toPostID, decoded.userID, postID], (er, inserted) => {
          var insertId = inserted['insertId'];
          con.query('SELECT t1.post_id, count(t1.post_id) AS total, t1.pic_path, t2.user_id, t2.full_name, t2.left_pic, t2.middle_pic_1, t2.middle_pic_2, t2.right_pic, t2.pic_ref FROM posts t1 LEFT JOIN users t2 ON t1.user_id = t2.user_id WHERE t1.post_id = ?',
          [postID],(err, rows) => {
            var result = rows;
            result[0].attached = 1;
            res.status(200).json(result);
          })
        });
      }else{
        con.query('DELETE t1 FROM attach_post t1 WHERE t1.post_id = ? AND t1.streamer_id = ? AND t1.post = ?',
        [toPostID, decoded.userID, postID],(err, rows) => {
          con.query("SELECT COUNT(t2.id) AS attached FROM attach_post t2 WHERE t2.post = ? AND t2.streamer_id = ? AND t2.post_id = ?",
          [postID, decoded.userID, toPostID], (err, rows) => {
            var result = rows;
            result[0].post_id = postID;
            res.status(200).json(result);
          })
        })
      }
    })
  })
})

app.post("/attach/post/attachWall", (req, res) => {
  var reqToken   = req.headers['authorization'];
  var wallID     = req.body.wallID;
  var toPostID   = req.body.toPostID;
  var userID     = req.body.userID;

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    notifications(toPostID, decoded.userID, userID, 9);

      con.query('SELECT count(*) AS attached, wall_id FROM attach_wall WHERE post_id = ? AND streamer_id = ?',
      [toPostID, decoded.userID], (err, rows_1) => {

        if(rows_1[0].attached > 0){
            if(rows_1[0].wall_id == wallID){
              con.query('DELETE t1 FROM attach_wall t1 WHERE t1.wall_id = ? AND t1.streamer_id = ? AND t1.post_id = ?',
              [wallID, decoded.userID, toPostID], (er, rows) => { getAttached('del') });
            }else {
              con.query('UPDATE attach_wall SET wall_id = ? WHERE streamer_id = ? AND post_id = ?',
              [wallID, decoded.userID, toPostID], (er, rows) => { getAttached() });
            }
          }else if(rows_1[0].attached < 1){
            con.query('INSERT INTO attach_wall (wall_id, streamer_id, post_id) VALUES(?,?,?)',
            [wallID, decoded.userID, toPostID], (er, rows) => { getAttached() });
          }

        function getAttached (ref){
          if(ref == 'del'){
            res.status(200).json({wall_id : wallID, attached: 0});
          }else {
            res.status(200).json({wall_id : wallID, attached: 1});
          }
        }
      })
  })
})

app.post("/profile/attach/getData/post_first", (req, res) => {
  var reqToken = req.headers['authorization'];
  var postID = req.body['postID'];
  var ref_1 = '1';
  var ref_2 = '2';

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    var userID = decoded.userID;
      con.query('SELECT t1.subject, t1.pic_path, t1.user_id, t1.cap, (SELECT count(t2.q_c_post_id) FROM profile_post_question_critic t2 WHERE t2.q_c_post_id = t1.post_id AND t2.ref = ?) AS ask_good, (SELECT count(t3.q_c_post_id) FROM profile_post_question_critic t3 WHERE t3.q_c_post_id = t1.post_id AND t3.ref = ?) AS ask_bad, (SELECT count(t4.stream_id) FROM post_stream t4 WHERE t4.post_id = t1.post_id) AS streams FROM posts t1 WHERE t1.post_id = ?',
      [ref_1, ref_2, postID], (err, rows) => {
        if(rows.length > 0){
          var ro = rows;
          ro[0].owenerID = decoded.userID;
          res.status(200).json(rows)
        }else {
          res.status(200).json([])
        }
      });

  })

})

app.post("/profile/attach/getData/walls", (req, res) => {
  var reqToken = req.headers['authorization'];
  var postID   = req.body['postID'];

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    var userID = decoded.userID;
    // con.query('SELECT *, count(*) AS total FROM attach_wall WHERE post_id = ? AND streamer_id = ?',
    // [postID, userID], (err, rows) => {
    //   if(rows[0].total > 0){
    //     con.query('SELECT t1.*, GROUP_CONCAT(t2.post ORDER BY t3.pin_id ASC SEPARATOR ",") AS posts, t4.user_id AS ownerID, t4.left_pic, t4.middle_pic_1, t4.middle_pic_2, t4.right_pic, t4.pic_ref, t4.full_name, count(t2.pin_id) AS total, count(t3.pin_id) AS seen FROM walls t1 JOIN walls_post t2 ON t1.wall_id = t2.wall_id JOIN walls_pins t3 on t3.pin_id = t2.pin_id AND t3.user_id = ? JOIN users t4 ON t4.user_id = t1.user_id WHERE t1.wall_id = ? GROUP BY t2.wall_id ORDER BY t3.pin_id DESC',
    //     [userID, rows[0].wall_id], (err, rows_2) => {
    //       if(rows_2){
    //         var wall = rows_2[0];
    //         con.query('SELECT count(t1.pin_id) AS asssss FROM walls_post t1 WHERE t1.wall_id = ?',
    //         [rows[0].wall_id], (err, rs) => {
    //           wall.total = rs[0].asssss;
    //           res.status(200).json([wall]);
           
    //         });
    //       }else {
    //         res.status(200).json([]);
    //       }

    //     });
    //   }else{
    //     res.status(200).json([]);
    //   }
    // })
  })

})

app.post("/profile/attach/getData/mentions", (req, res) => {
  var reqToken = req.headers['authorization'];
  var postID   = req.body['postID'];

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    var userID = decoded.userID;
    con.query('SELECT *, count(*) AS total FROM attach_user WHERE post_id = ? AND streamer_id = ?',
    [postID, userID], (err, rows)=>{
      if(rows[0].total > 0){
        con.query('SELECT count(t1.id) AS total, t2.user_id, t2.full_name, t2.left_pic, t2.middle_pic_1, t2.middle_pic_2, t2.right_pic, t2.pic_ref FROM attach_user t1 JOIN users t2 ON t2.user_id = t1.user_id WHERE t1.post_id = ? AND t1.streamer_id = ? GROUP BY t2.user_id',
        [postID, userID], (err, rows)=>{
          if (rows.length > 0) {
            res.status(200).json(rows)
          }else{
            res.status(200).json(rows)
          }
        })
      }else{
        res.status(200).json([])
      }
    })
  })

})

app.post("/profile/attach/getData/posts", (req, res) => {
  var reqToken = req.headers['authorization'];
  var postID   = req.body['postID'];

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    var userID = decoded.userID;
    con.query('SELECT *, count(*) AS total FROM attach_post WHERE post_id = ? AND streamer_id = ?',
    [postID, userID], (err, rows)=>{

      if(rows[0].total > 0){
        con.query('SELECT t2.post_id, count(t1.id) AS total, t3.user_id, t3.full_name, t3.left_pic, t3.middle_pic_1, t3.middle_pic_2, t3.right_pic, t3.pic_ref, t2.pic_path FROM attach_post t1 JOIN posts t2 ON t2.post_id = t1.post JOIN users t3 ON t3.user_id = t2.user_id WHERE t1.post_id = ? AND t1.streamer_id = ? GROUP BY t2.post_id ORDER BY t1.id DESC',
        [postID, userID], (err, rows)=>{

          if (rows.length > 0) {
            res.status(200).json(rows)
          }else{
            res.status(200).json(rows)
          }
        })
      }else{
        res.status(200).json([])
      }
    })
  })

})

app.post("/profile/attach/getData/stream", (req, res) => {
  var reqToken = req.headers['authorization'];
  var postID   = req.body['postID'];
  var ownerID  = req.body['ownerID'];
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    var userID = decoded.userID;
    con.query('SELECT count(*) AS total FROM post_stream WHERE post_id = ? AND streamer_id = ?',
    [postID, userID], (err, rows)=>{

      if(rows[0].total < 1){
        notifications(postID, userID, ownerID, 8, 'stream');
        con.query('INSERT INTO post_stream (post_id, streamer_id) VALUES (?,?)',
        [postID, userID], (err, rows)=>{
          res.status(200).json([1]);
        })
      }else if(rows[0].total > 0){
        con.query('Delete t1 FROM post_stream t1 WHERE t1.post_id = ?  AND t1.streamer_id = ?',
        [postID, userID], (err, rows)=>{
          res.status(200).json([2])
        })
      }
    })
  })
})

app.post("/profile/attach/getData/delete", (req, res) => {
  var reqToken = req.headers['authorization'];
  var postID   = req.body['postID'];

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    var userID = decoded.userID;
    con.query('SELECT count(*) AS total FROM posts WHERE post_id = ? AND user_id = ?',
    [postID, userID], (err, rows)=>{

      if(rows[0].total > 0){
        con.query('Delete t1 FROM posts t1 WHERE t1.post_id = ? AND t1.user_id = ?',
        [postID, userID], (err, rows)=>{
          res.status(200).json([1])
        })
      }

    })
  })
})

app.post("/post/attachment/delete", (req, res) => {
  var reqToken   = req.headers['authorization'];
  var attachID   = parseInt(req.body['attachID']);
  var attachType = req.body['attachType'];
  var postID     = parseInt(req.body['postID']);

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    var userID = decoded.userID;
    con.query('Delete t1 FROM post_attachment t1 WHERE t1.post_id = ? AND t1.attachment_id = ? AND t1.attach_type = ?',
    [postID, attachID, attachType], (err, rows)=>{
      res.status(200).json([{id: 1}])
    })
  })
})

app.post("/profile/chart", (req, res) => {
  var reqToken = req.headers['authorization'];
  var postID   = req.body['postID'];
  var userID   = req.body['userID'];
  var ref = "8"
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query('SELECT count(IF(t2.score = 11, 1, NULL)) as diamond_11, count(IF(t2.score = 10, 1, NULL)) as purp_10, count(IF(t2.score = 9, 1, NULL)) AS blue_9, count(IF(t2.score = 8, 1, NULL)) AS green_8, count(IF(t2.score = 7, 1, NULL)) orang_7, count(IF(t2.score = 6, 1, NULL)) AS gold_6, count(IF(t2.score = 5, 1, NULL)) AS gold_5, count(IF(t2.score = 4, 1, NULL)) AS gold_4, count(IF(t2.score = 3, 1, NULL)) AS gold_3, count(IF(t2.score = 2, 1, NULL)) AS gold_2, count(IF(t2.score = 1, 1, NULL)) AS red_1 FROM posts t1 LEFT JOIN post_votes t2 ON t1.post_id = t2.post_id WHERE t1.user_id = ?',
    [userID], (err, rows)=>{
      res.status(200).json(rows)
    })
  })
})

app.post("/showroom/top/posts", (req, res)=>{
  var reqToken = req.headers['authorization'];
  var userID    = req.body['userID'];
  var pageRef   = req.body['pageRef'];
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query('select *, max(total) AS total2 FROM (select t1.post_id, t1.pic_path, sum(t2.score_pos) AS total FROM posts t1 left join post_votes t2 on t2.post_id = t1.post_id WHERE t1.user_id = ? GROUP BY t1.post_id) AS Results GROUP BY post_id ORDER BY Total DESC LIMIT 10',
    [userID, userID], (err, rows)=>{
        res.status(200).json(rows)
    })
  })
})

app.post("/post/admin", (req, res)=>{
  var reqToken = req.headers['authorization'];
  var userID   = req.body['userID'];
  var postID   = req.body['postID'];
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query('SELECT count(*) AS admin FROM posts WHERE post_id = ? AND user_id = ?',
    [postID, userID], (err, rows)=>{
      res.status(200).json(rows)
    })
  })
})

app.post("/showroom/posts", (req, res)=>{

  var reqToken   = req.headers['authorization'];
  var userID     = req.body['userID'];
  var pageRef    = req.body['pageRef'];
  var pageOffset = parseInt(req.body['ofsset']);
  var query = `
    SELECT t1.pic_path, 
    t3.user_uname, 
    t1.user_id, 
    t1.post_type, 
    t1.post_id, 
    count(t2.post_id) AS voters, 
    sum(t2.score_pos) AS stars, 
    t4.score 
    FROM posts t1 
    LEFT JOIN post_votes t2 on t2.post_id = t1.post_id 
    JOIN users t3 on t3.user_id = t1.user_id 
    LEFT JOIN post_votes t4 ON t4.post_id = t1.post_id  AND t4.user_id = ? 
    WHERE t1.user_id = ? GROUP BY t1.post_id DESC LIMIT 10 OFFSET ?
  `
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query(query, [decoded.userID, userID, pageOffset], (err, rows)=>{
      res.status(200).json(rows)
    })
  })
})

app.post("/post/answerQues", (req, res) => {
  var reqToken = req.headers['authorization'];
  var quesID   = parseInt(req.body['quesID']);
  var answer   = req.body['answer'];
  var userID   = req.body['userID'];
  var postID   = req.body['postID'];

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    notifications(postID, decoded.userID, userID, 6);

    con.query('UPDATE profile_post_question_critic SET answer = ? WHERE q_c_id = ?',
    [answer, quesID], (err, rows)=>{
      res.status(200).json({ref: 1})
    })
  })
})

app.post("/post/deleteQ&A", (req, res) => {
  var reqToken = req.headers['authorization'];
  var quesID   = parseInt(req.body['quesID']);

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    if(req.body['ref'] == 1){
      con.query('Delete t1 FROM profile_post_question_critic t1 WHERE t1.q_c_id = ?',
      [quesID], (err, rows)=>{
        res.status(200).json({ref: 1})
      })
    }else if(req.body['ref'] == 2){
      var answer = '';
      con.query('UPDATE profile_post_question_critic SET answer = ? WHERE q_c_id = ?',
      [answer, quesID], (err, rows)=>{
        res.status(200).json({ref: 2})
      })
    }

  })
})


app.post("/post/q_a_switch", (req, res) => {

  var reqToken    = req.headers['authorization'];
  var quesID      = parseInt(req.body['quesID']);
  var ref         = req.body['ref'];
  var to_id       = parseInt(req.body['to_id']);
  var q_c_post_id = parseInt(req.body['q_c_post_id']);

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    notifications(q_c_post_id, decoded.userID, to_id, 7, 'ans');
    con.query('UPDATE profile_post_question_critic SET ref = ? WHERE q_c_id = ?',
    [ref, quesID], (err, rows)=>{
      res.status(200).json({re:1});
    })
  })

})

function notifications(postID, from, toID, type, origin){

  if(from != toID){
    if(origin !='ask'){
      if(origin == 'vote'){
        var query = 'SELECT * FROM notifications WHERE post_id = ? AND from_id = ? AND to_id = ? AND type = ? || post_id = ? AND from_id = ? AND to_id = ? AND type = ? || post_id = ? AND from_id = ? AND to_id = ? AND type = ? || post_id = ? AND from_id = ? AND to_id = ? AND type = ?'
        var qsOPt = [postID, from, toID, '1', postID, from, toID, '2', postID, from, toID, '3', postID, from, toID, '4'];
      }else {
        var query = 'SELECT * FROM notifications WHERE post_id = ? AND from_id = ? AND to_id = ? AND type = ?';
        var qsOPt = [postID, from, toID, type];
      }
      con.query(query, qsOPt, (err, rows)=>{
        if(rows.length > 0){
          con.query('UPDATE notifications SET type = ? WHERE post_id = ? AND from_id = ? AND to_id = ?',
          [type, postID, from, toID], (err, rows)=>{  })
        }else{
          con.query('INSERT INTO notifications (post_id, from_id, to_id, type) VALUES (?, ?, ?, ?)',
          [postID, from, toID, type], (err, rows)=>{  })
        }
      })
    }else{
      con.query('INSERT INTO notifications (post_id, from_id, to_id, type) VALUES (?, ?, ?, ?)',
      [postID, from, toID, type], (err, rows)=>{  })
    }
  }
}

app.post("/walls/getWalls", (req, res) => {
  var reqToken = req.headers['authorization'];
  var userID = parseInt(req.body['userID']);
  var offset = parseInt(req.body['offset']);
  var ref    = parseInt(req.body['ref']);

  if(ref == 1){
    jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
      var sessionID = decoded.userID;
      con.query('SELECT *, MAX(Total) FROM (SELECT t1.*, COUNT(t4.pin_id) - count(t5.pin_id) AS Total, COUNT(t4.pin_id) AS pins, COUNT(t5.pin_id) AS pinned, fs.full_name, fs.left_pic, fs.middle_pic_1, fs.middle_pic_2, fs.right_pic, fs.pic_ref FROM walls t1 JOIN users fs ON fs.user_id = t1.user_id LEFT JOIN walls_post t4 on t4.wall_id = t1.wall_id LEFT JOIN walls_pins t5 ON t5.pin_id = t4.pin_id AND t5.user_id = ? WHERE t1.user_id = ? group by t1.wall_id LIMIT 5 OFFSET ?) AS Results GROUP BY wall_id ORDER BY Total DESC',
      [sessionID, userID, offset], (err, rows) => {
        res.status(200).json(rows);
      });
    })
  }else if(ref == 2){
    jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
      var sessionID = decoded.userID;
      con.query('SELECT *, MAX(Total) FROM (SELECT t1.*, COUNT(t4.pin_id) - count(t5.pin_id) AS Total, COUNT(t4.pin_id) AS pins, COUNT(t5.pin_id) AS pinned, fs.full_name, fs.left_pic, fs.middle_pic_1, fs.middle_pic_2, fs.right_pic, fs.pic_ref FROM follows_syds fw JOIN walls t1 ON fw.following = t1.user_id JOIN users fs ON fs.user_id = t1.user_id LEFT JOIN walls_post t4 on t4.wall_id = t1.wall_id LEFT JOIN walls_pins t5 ON t5.pin_id = t4.pin_id AND t5.user_id = ? WHERE fw.follower = ? group by t1.wall_id LIMIT 5 OFFSET ?) AS Results GROUP BY wall_id ORDER BY Total DESC',
      [sessionID, userID, offset], (err, rows) => {
        res.status(200).json(rows);
      });
    })
  }

})

app.post("/walls/getPins", (req, res) => {
  var reqToken = req.headers['authorization'];
  var wall_id = req.body['wall_id'];
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    var sessionID = decoded.userID;
    con.query('SELECT t1.* FROM walls_post t1 LEFT JOIN walls_pins t2 on t2.pin_id = t1.pin_id WHERE t2.user_id = ? AND t1.wall_id = ? GROUP BY t2.pin_id DESC',
    [sessionID, wall_id], (err, rows) => {
      res.status(200).json(rows);
    });
  })

})

app.post("/walls/pinToWall", (req, res) => {
  var reqToken = req.headers['authorization'];
  var wall_id = req.body['wall_id'];
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    var sessionID = decoded.userID;
    con.query('SELECT * FROM walls t1 JOIN walls_post t2 on t2.wall_id = t1.wall_id WHERE NOT EXISTS(SELECT * FROM walls_pins t3 WHERE t3.pin_id = t2.pin_id AND t3.user_id = ?) AND t1.wall_id = ? GROUP BY t2.pin_id DESC LIMIT 1',
    [sessionID, wall_id], (err, rows) => {
      res.status(200).json(rows);
      if(rows.length > 0){
        con.query('INSERT INTO walls_pins (user_id, pin_id) VALUES (?, ?)',
        [sessionID, rows[0].pin_id], (err, rows) =>{})
      }
    });

  })

})

app.post("/walls/uploadToWall", upload.single('file'), (req, res) => {
  var reqToken = req.headers['authorization'];
  var wall_id  = req.body['wall_id'];
  var oldPath  = req.file.path;
  var newPath  = "photos/"+req.file.filename;
  var fileName = req.file.filename;

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query('SELECT count(t2.pin_id) AS pins, t1.user_id FROM walls t1 LEFT JOIN walls_post t2 ON t2.wall_id = t1.wall_id WHERE t1.wall_id = ?',
    [wall_id], (err, rows) => {
      if(rows[0].pins < 30 && rows[0].user_id == decoded.userID){
        if(req.file.mimetype == "image/jpeg" || req.file.mimetype == "image/png"){
          var inStream = fs.createReadStream(oldPath);
          var outStream = fs.createWriteStream(newPath, {flags: "w"});
          var transform = sharp()
          .resize({ width: 1200, height: 1200, fit: sharp.fit.inside })
          .webp({ quality: 90 })
          .rotate()
          .on('info', function(fileInfo) {
            sentPicture();
          });
          inStream.pipe(transform).pipe(outStream);
        }else if(req.file.mimetype == "image/gif"){
          var cccc = "photos/";
          var old  = "upload/"+ req.file.filename;
          compress_images(old, cccc,
            {compress_force: false, statistic: true, autoupdate: true}, false,
            {jpg: {engine: false, command: false}},
            {png: {engine: false, command: false}},
            {svg: {engine: false, command: false}},
            {gif: {engine: 'gifsicle', command: ['--colors', '64', '--use-col=web']}},
            function(error, completed, statistic){
              if(!error){
                sentPicture();
              }
            })
        }

        function sentPicture(){
          con.query('INSERT INTO walls_post (post, wall_id) VALUES (?, ?)',
          [fileName, wall_id], (req, ress) => {
          postID = ress['insertId'];
            con.query('INSERT INTO walls_pins (pin_id, user_id) VALUES (?, ?)', [postID, decoded.userID], (req, ress) => { })
            con.query('SELECT * FROM walls_post WHERE pin_id = ?', [postID], (err, rows)=>{
              res.status(200).json(rows);
            });
          })
        }

      }else {
        res.status(200).json([]);;
      }

    })

  })
})

app.post("/walls/uploadTitle", (req, res) => {
  var reqToken = req.headers['authorization'];
  var wall_id = req.body['wall_id'];
  var caption = req.body['caption'];
  if(caption){
    jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
      var sessionID = decoded.userID;
      con.query('UPDATE walls  SET wall_name = ? WHERE wall_id = ? AND user_id = ?',
      [caption, wall_id, sessionID], (err, rows) => {
        res.status(200).json(rows);
        if(rows.length > 0){
          con.query('INSERT INTO walls_pins (user_id, pin_id) VALUES (?, ?)',
          [sessionID, rows[0].pin_id], (err, rows) =>{})
        }
      });

    })
  }

})

app.post("/walls/pinDelete", (req, res) => {
  var reqToken = req.headers['authorization'];
  var wall_id  = req.body['wall_id'];
  var pinID    = req.body['pinID'];

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {

    con.query('DELETE t1, t2 FROM walls_post t1 LEFT JOIN walls_pins t2 ON t2.pin_id = t1.pin_id WHERE t1.pin_id = ? and t1.wall_id = ?',
    [pinID, wall_id], (err, rows) => {
      res.status(200).json([{work:1}]);
    });

  })

})


app.post("/walls/uploadWall_pfp", upload.single('file'), (req, res) => {
  var reqToken = req.headers['authorization'];
  var wall_id  = req.body['wall_id'];
  var oldPath  = req.file.path;
  var newPath  = "photos/"+req.file.filename;
  var fileName = req.file.filename;

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    if(req.file.mimetype == "image/jpeg" || req.file.mimetype == "image/png"){
      var inStream  = fs.createReadStream(oldPath);
      var outStream = fs.createWriteStream(newPath, {flags: "w"});
      var transform = sharp()
      .resize({ width: 1200, height: 1200, fit: sharp.fit.inside })
      .webp({ quality: 90 })
      .rotate()
      .on('info', function(fileInfo) { sentPicture(); });
      inStream.pipe(transform).pipe(outStream);
    }else if(req.file.mimetype == "image/gif"){
      var cccc = "photos/";
      var old  = "upload/"+ req.file.filename;
      compress_images(old, cccc,
        {compress_force: false, statistic: true, autoupdate: true}, false,
        {jpg: { engine: false, command: false }},
        {png: { engine: false, command: false }},
        {svg: { engine: false, command: false }},
        {gif: { engine: 'gifsicle', command: ['--colors', '64', '--use-col=web']}},
        function(error, completed, statistic){ if(!error){ sentPicture(); } })
    }

    function sentPicture(){
      con.query('UPDATE walls SET wall_icon = ? WHERE wall_id = ?',
      [fileName, wall_id], (req, ress) => {
      postID = ress['insertId'];
        res.status(200).json([{pic: fileName}]);
      })
    }

  })
})

app.post("/walls/createWall", (req, res)=>{
  var reqToken  = req.headers['authorization'];
  var userID    = req.body['userID'];
  var caption   = req.body['caption'];
  var wall_icon = "a_space_man.png";
  if(caption){
    jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
      if(decoded.userID == userID){
        con.query('INSERT INTO walls (wall_name, user_id, wall_icon) VAlUES (?, ?, ?)',
        [caption, userID, wall_icon], (req, ress) => {
          insertId = ress['insertId'];
          con.query('SELECT *, MAX(Total) FROM (SELECT t1.*, COUNT(t4.pin_id) - count(t5.pin_id) AS Total, COUNT(t4.pin_id) AS pins, COUNT(t5.pin_id) AS pinned, fs.full_name, fs.left_pic, fs.middle_pic_1, fs.middle_pic_2, fs.right_pic, fs.pic_ref FROM walls t1 JOIN users fs ON fs.user_id = t1.user_id LEFT JOIN walls_post t4 on t4.wall_id = t1.wall_id LEFT JOIN walls_pins t5 ON t5.pin_id = t4.pin_id AND t5.user_id = ? WHERE t1.wall_id = ? group by t1.wall_id) AS Results GROUP BY wall_id ORDER BY Total DESC',
          [decoded.userID, insertId], (err, rows) => {
            res.status(200).json(rows);
          });
        })
      }
    })
  }

})

app.post("/walls/wallDelete", (req, res) => {
  var reqToken = req.headers['authorization'];
  var wall_id = req.body['wall_id'];

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {

    con.query('DELETE t1, t2 FROM walls t1 LEFT JOIN walls_post t2 ON t2.wall_id = t1.wall_id LEFT JOIN walls_pins t3 ON t3.pin_id = t2.pin_id WHERE t1.wall_id = ? AND t1.user_id = ?',
    [wall_id], (err, rows) => {
      res.status(200).json([{work:1}]);
    });

  })

})

app.post("/walls/views", (req, res) => {
  var reqToken = req.headers['authorization'];
  var wall_id  = req.body['wall_id'];
  var offset   = parseInt(req.body['offset']);
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {

    con.query('SELECT *, MAX(total) FROM (SELECT COUNT(t1.pin_id) AS total, count(t5.follower) AS they, count(t6.follower) AS me, t4.user_id, t4.full_name, t4.left_pic, t4.middle_pic_1, t4.middle_pic_2, t4.right_pic, t4.pic_ref FROM walls_pins t1 LEFT JOIN walls_post t2 ON t2.pin_id = t1.pin_id LEFT JOIN walls t3 ON t3.wall_id = t2.wall_id LEFT JOIN users t4 ON t4.user_id = t1.user_id LEFT JOIN follows_syds t5 ON t5.follower = t1.user_id AND t5.following = t3.user_id LEFT JOIN follows_syds t6 ON t6.follower = t3.user_id AND t6.following = t1.user_id WHERE t3.wall_id = ? group by t1.user_id DESC LIMIT 10 OFFSET ?) AS Results GROUP BY user_id ORDER BY Total DESC',
    [wall_id, offset], (err, rows) => {
      res.status(200).json(rows);
    });

  })

})


app.post('/chatbox/chatUSERS', (req, res) => {
  var reqToken    = req.headers['authorization'];
  var userID      = req.body['userID'];
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {

    var sessionID = decoded.userID;

    con.query('SELECT full_name, user_id, left_pic, middle_pic_1, middle_pic_2, right_pic, pic_ref FROM users WHERE user_id = ? ',
    [userID], (err, rows_1) => {
      con.query('SELECT full_name, user_id, left_pic, middle_pic_1, middle_pic_2, right_pic, pic_ref FROM users WHERE user_id = ? ',
      [sessionID], (err, rows_2) => {
        res.status(200).json([rows_1[0], rows_2[0]]);
      });

    });


  })

})

app.post('/chatbox/convos', (req, res) => {
  var reqToken    = req.headers['authorization'];
  var convoType   = '1';
  var offset      = parseInt(req.body['offset']);
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
   var sessionID = decoded.userID;
    con.query('SELECT count(t2.box_id) as msgs, (SELECT count(msg.box_id) FROM message_box msg WHERE msg.convo_id = t1.convo_id AND msg.box_status = ? AND msg.sender_id != ?) AS unread, t1.convo_id, t2.sender_id, t2.box_id FROM message_conversation t1 LEFT JOIN message_box t2 ON t2.convo_id = t1.convo_id WHERE t1.user_1 = ? AND t1.convo_type = ? OR t1.user_2 = ? AND t1.convo_type = ? GROUP BY t1.convo_id ORDER BY t2.box_id DESC LIMIT 15 OFFSET ?',
    [convoType, sessionID, sessionID, convoType, sessionID, convoType, offset], (err, rows) => {
      var convos = rows;
      if(rows){
        for (let index = 0; index < convos.length; index++) {
          con.query('SELECT (SELECT ms_2.msg FROM message_box ms LEFT JOIN messages_sys ms_2 ON ms_2.box_id = ms.box_id WHERE ms.convo_id = t1.convo_id GROUP BY ms_2.box_id DESC LIMIT 1) AS msg, t2.user_id, t2.full_name, t2.left_pic, t2.middle_pic_1, t2.middle_pic_2, t2.right_pic, t2.pic_ref FROM message_conversation t1 JOIN users t2 ON t2.user_id = t1.user_1 AND t1.user_1 != ? OR t2.user_id = t1.user_2 AND t1.user_2 != ? WHERE t1.convo_id = ? GROUP BY t2.user_id',
          [sessionID, sessionID, convos[index].convo_id], (err, rows_2) => {
            convos[index].userInfo = rows_2[0];
            if(index == rows.length-1){
              logData(convos);
            }
          })
        }

      }else {
        logDataWithNodata();
      }
      function logDataWithNodata(){
        res.status(200).json([]);
      }
      function logData(convos){
        res.status(200).json(convos)
      }
    })

  })

})

app.post('/chatbox/userconvo', (req, res) => {
  var reqToken    = req.headers['authorization'];
  var convoType   = '1';
  var chatUserID  = parseInt(req.body.userID);
  var offset      = parseInt(req.body.offset);
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    var sessionID = decoded.userID;
    con.query('SELECT t2.box_id, t2.box_answer, t2.box_status, t3.id, t1.convo_id, t3.msg, t2.sender_id FROM message_conversation t1 JOIN message_box t2 ON t2.convo_id = t1.convo_id JOIN messages_sys t3 ON t3.box_id = t2.box_id WHERE t1.user_1 = ? AND t1.user_2 = ? AND t1.convo_type = ? OR t1.user_1 = ? AND t1.user_2 = ? AND t1.convo_type = ? GROUP BY t3.id DESC ORDER BY t2.box_id DESC LIMIT 20 OFFSET ?',
    [sessionID, chatUserID, convoType, chatUserID, sessionID, convoType, offset], (err, convos) => {
      res.status(200).json(convos)
    })
  })
})

app.post('/chatbox/uploadImage', upload.single('file'), (req, res) => {
  var reqToken = req.headers['authorization'];
  var userID   = req.body['userID'];
  var oldPath  = req.file.path;
  var newPath  = "photos/"+req.file.filename;
  var fileName = req.file.filename;

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    var sessionID = decoded.userID;
    if(req.file.mimetype == "image/jpeg" || req.file.mimetype == "image/png"){
      var inStream = fs.createReadStream(oldPath);
      var outStream = fs.createWriteStream(newPath, {flags: "w"});
      var transform = sharp()
      .resize({ width: 1200, height: 1200, fit: sharp.fit.inside })
      .webp({ quality: 90 })
      .rotate()
      .on('info', function(fileInfo) { sentPicture(); });
      inStream.pipe(transform).pipe(outStream);
    }else if(req.file.mimetype == "image/gif"){
      var cccc = "photos/";
      var old  = "upload/"+ req.file.filename;
      compress_images(old, cccc,
        {compress_force: false, statistic: true, autoupdate: true}, false,
        {jpg: {engine: false, command: false}},
        {png: {engine: false, command: false}},
        {svg: {engine: false, command: false}},
        {gif: {engine: 'gifsicle', command: ['--colors', '64', '--use-col=web']}},
        function(error, completed, statistic){ if(!error){ sentPicture(); } })
    }

    function sentPicture(){
      con.query('INSERT INTO message_media (sender_id, receiver_id, media_ref) VALUES (?, ?, ?)',
      [sessionID, userID, fileName], (req, ress) => {
        res.status(200).json([{pic: fileName}]);
        io.emit('getMediaBack', {media_id: ress.insertId, sender_id: sessionID, receiver_id: userID, media_ref: fileName})
      })
    }

  })
})

app.post('/chatbox/getMedia', (req, res) => {
  var reqToken    = req.headers['authorization'];
  var chatUserID  = parseInt(req.body.userID);
  var offset      = parseInt(req.body.offset);
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    var sessionID = decoded.userID;
    con.query('SELECT * FROM message_media WHERE sender_id = ? AND receiver_id = ? OR sender_id = ? AND receiver_id = ? GROUP BY media_id DESC LIMIT 5 OFFSET ?',
    [sessionID, chatUserID, chatUserID, sessionID, offset], (err, convos) => {
      res.status(200).json(convos)
    })
  })
})

app.post('/chatbox/shareMedia', (req, res) => {
  var reqToken    = req.headers['authorization'];
  var mediaID  = req.body.mediaID;
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    var sessionID = decoded.userID;
    con.query('INSERT INTO posts (user_id, pic_path) VALUES (?, ?)',
    [sessionID, mediaID], (err, convos) => {
      res.status(200).json([{ref:1}])
    })
  })
})

app.post('/chatbox/deleteMedia', (req, res) => {
  var reqToken    = req.headers['authorization'];
  var mediaID     = req.body.mediaID;
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    var sessionID = decoded.userID;
    con.query('DELETE t1 FROM message_media t1 WHERE t1.media_id = ? AND t1.sender_id = ?',
    [mediaID, sessionID], (err, convos) => {
      res.status(200).json([{ref:1}])
    })
  })
})

app.post('/chatbox/questionsAnswer', (req, res) => {
  var reqToken    = req.headers['authorization'];
  var chatUserID  = parseInt(req.body.chatUSER);
  var offset      = parseInt(req.body.offset);
  var convoType   = '1';
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    var sessionID = decoded.userID;
    con.query('SELECT t2.box_id, t2.box_answer, t2.box_status, t3.id, t1.convo_id, t3.msg, t2.sender_id, t4.user_id, t4.left_pic, t4.middle_pic_1, t4.middle_pic_2, t4.right_pic, t4.pic_ref, t4.full_name FROM message_conversation t1 JOIN message_box t2 ON t2.convo_id = t1.convo_id JOIN messages_sys t3 ON t3.box_id = t2.box_id JOIN users t4 ON t4.user_id = t2.sender_id WHERE t1.user_1 = ? AND t1.convo_type = ? AND t2.sender_id != ? AND t2.box_answer != "" OR t1.user_2 = ? AND t1.convo_type = ? AND t2.sender_id != ? AND t2.box_answer != "" GROUP BY t3.id ORDER BY t2.box_id DESC LIMIT 20 OFFSET ?',
    [chatUserID, chatUserID, convoType, chatUserID, chatUserID, convoType, offset], (err, convos) => {
      res.status(200).json(convos)
    })
  })
})


app.post('/chatbox/deleteQS', (req, res) => {
  var reqToken = req.headers['authorization'];
  var boxID    = req.body.boxID;
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    var sessionID = decoded.userID;
    con.query('DELETE t1 FROM message_box t1 LEFT JOIN messages_sys t2 ON t2.box_id = t1.box_id WHERE t1.box_id = ? AND sender_id = ?',
    [boxID, sessionID], (err, convos) => {
      res.status(200).json([{ref:1}])
    })
  })
})

app.post('/user/getNotifsPosts', (req, res) =>{
  var reqToken = req.headers['authorization'];
  var offset   = parseInt(req.body.offset);
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query('SELECT count(IF(t1.seen = 1, 1, null)) AS notifNum, t1.post_id, t1.type, (SELECT t2.pic_path FROM posts t2 WHERE t2.post_id = t1.post_id) AS post FROM notifications t1 WHERE t1.to_id = ? GROUP BY t1.post_id ORDER BY t1.notif_id DESC LIMIT 10 OFFSET ?',
    [decoded.userID, offset], (err, rows) => {
      res.status(200).json(rows)
    })
  })

})

app.post('/user/getNotifs', (req, res) =>{
  var reqToken = req.headers['authorization'];
  var postID = parseInt(req.body.postID);
  var offset = parseInt(req.body.offset);

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query('SELECT t1.notif_id, t1.post_id, t1.from_id, t1.to_id, t3.left_pic, t3.middle_pic_1, t3.middle_pic_2, t3.right_pic, t3.pic_ref, t3.user_gander, t3.full_name, t1.type FROM notifications t1 JOIN users t3 ON t3.user_id = t1.from_id WHERE t1.post_id = ? AND t1.to_id = ? GROUP BY t1.notif_id DESC LIMIT 10 OFFSET ?',
    [postID, decoded.userID, offset], (err, rows) => {
      res.status(200).json(rows)
    })
  })

})

app.post('/user/getQuestions', (req, res) =>{
  var reqToken = req.headers['authorization'];
  var postID = parseInt(req.body.postID);
  var offset = parseInt(req.body.offset);
  var quer =  `
                SELECT t1.*, 
                t2.left_pic, 
                t2.middle_pic_1, 
                t2.middle_pic_2, 
                t2.right_pic, 
                t2.pic_ref, 
                t2.full_name, 
                t2.user_id, 
                t2.user_gander 
                FROM profile_post_question_critic t1
                JOIN users t2 ON t1.q_c_user_id = t2.user_id 
                WHERE t1.q_c_post_id = ? 
                GROUP BY t1.q_c_id DESC LIMIT 10 OFFSET ?
              `;
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query('',
    [postID, offset], (err, rows) => {
      res.status(200).json(rows);
    });
  })

})

app.post("/read/notifs", (req, res) => {
  var reqToken = req.headers['authorization'];
  var postID   = req.body['postID'];
  var ref      = '2';
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query('UPDATE notifications SET seen = ? WHERE post_id = ? AND to_id = ?',
    [ref, postID, decoded.userID], (err, rows) => {
      res.status(200).json({ref : 1});
    });
    })
  })


app.post("/notif/getFollowers", (req, res) => {
  var reqToken = req.headers['authorization'];
  var offset = parseInt(req.body.offset);

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query('SELECT (SELECT COUNT(t2.follower) FROM follows_syds t2 WHERE t2.follower = t1.following AND t2.following = t1.follower) AS followBack, t1.follower, t1.following, t1.numstat, t3.full_name, t3.user_id, t3.left_pic, t3.middle_pic_1, t3.middle_pic_2, t3.right_pic, t3.pic_ref FROM follows_syds t1 JOIN users t3 ON t3.user_id = t1.follower WHERE t1.following = ? GROUP BY t1.id DESC LIMIT 10 OFFSET ?',
    [decoded.userID, offset], (err, rows) => {
      readNotifications('2', decoded.userID);
      res.status(200).json(rows);
    });
  })
})

function readNotifications(ref, userID){
  con.query('UPDATE follows_syds SET numstat = ? WHERE following = ?',
  [ref, userID], (err, rows) => { });
}


app.post("/ghost/catch", (req, res) => {
  var reqToken = req.headers['authorization'];
  var offset   = parseInt(req.body.offset);

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query('SELECT t1.*, ms.msg, ms.seen, u_1.full_name AS ghostName, u_1.left_pic AS ghostPic1, u_1.middle_pic_1 AS ghostPic2, u_1.middle_pic_2 AS ghostPic3, u_1.right_pic AS ghostPic4, u_1.pic_ref AS ghostRef, u_1.user_gander AS ghostG, u_2.full_name AS hostName, u_2.left_pic AS hostPic1, u_2.middle_pic_1 AS hostPic2, u_2.middle_pic_2 AS hostPic3, u_2.right_pic AS hostPic4, u_2.pic_ref As hostRef FROM ghost_convo t1 LEFT JOIN ghost_msg ms ON ms.convo_id = t1.convo_id LEFT JOIN users u_1 ON u_1.user_id = t1.ghost_id LEFT JOIN users u_2 ON u_2.user_id = t1.user_id WHERE t1.ghost_id = ? || t1.user_id = ? GROUP BY t1.convo_id ORDER BY ms.msg_id DESC LIMIT 10 OFFSET ?',
    [decoded.userID, decoded.userID, offset], (err, rows) => {
      res.status(200).json(rows);
    });
  })

})

app.post("/ghost/usersGet", (req, res) => {
  var reqToken = req.headers['authorization'];
  var paramID = parseInt(req.body.paramID);
  var ref    = parseInt(req.body.ref);

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    if(ref == 1){
      con.query('SELECT full_name, user_id, left_pic, middle_pic_1, middle_pic_2, right_pic, pic_ref, user_gander FROM users WHERE user_id = ? ',
      [paramID], (err, rows_1) => {
        con.query('SELECT full_name, user_id, left_pic, middle_pic_1, middle_pic_2, right_pic, pic_ref, user_gander FROM users WHERE user_id = ? ',
        [decoded.userID], (err, rows_2) => {
          res.status(200).json([rows_1[0], rows_2[0]]);
        });
      });
    }else if(ref == 2){
      con.query('SELECT * FROM ghost_convo WHERE convo_id = ?',
      [paramID], (err, convo) => {
        con.query('SELECT full_name, user_id, left_pic, middle_pic_1, middle_pic_2, right_pic, pic_ref, user_gander FROM users WHERE user_id = ? ',
        [convo[0].ghost_id], (err, rows_1) => {
          con.query('SELECT full_name, user_id, left_pic, middle_pic_1, middle_pic_2, right_pic, pic_ref, user_gander FROM users WHERE user_id = ? ',
          [decoded.userID], (err, rows_2) => {
            res.status(200).json([rows_1[0], rows_2[0]]);
          });
        });
      });
    }

  })

})

app.post("/ghost/userCreate", (req, res) => {
  var reqToken  = req.headers['authorization'];
  var ghostID   = parseInt(req.body.ghostID);
  var convoName = req.body.convoName;

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    if(ghostID != decoded.userID){
      con.query('INSERT INTO ghost_convo (convo_name, ghost_id, user_id) VALUES (?, ?, ?)',
      [convoName, decoded.userID, ghostID], (err, rows_1) => {
        con.query('SELECT t1.*, u_1.full_name AS ghostName, u_1.left_pic AS ghostPic1, u_1.middle_pic_1 AS ghostPic2, u_1.middle_pic_2 AS ghostPic3, u_1.right_pic AS ghostPic4, u_1.pic_ref AS ghostRef, u_1.user_gander AS ghostG, u_2.full_name AS hostName, u_2.left_pic AS hostPic1, u_2.middle_pic_1 AS hostPic2, u_2.middle_pic_2 AS hostPic3, u_2.right_pic AS hostPic4, u_2.pic_ref As hostRef FROM ghost_convo t1 LEFT JOIN users u_1 ON u_1.user_id = t1.ghost_id LEFT JOIN users u_2 ON u_2.user_id = t1.user_id WHERE t1.convo_id = ? GROUP BY t1.convo_id',
        [rows_1.insertId], (err, rows) => {
          res.status(200).json(rows);
        })
      });
    }
  })

})

app.post("/ghost/getMsgs", (req, res) => {
  var reqToken  = req.headers['authorization'];
  var convoID   = req.body.convoID;
  var offset    = parseInt(req.body.offset);

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query('SELECT t1.ghost_id AS ghost, t1.user_id AS host, t2.* FROM ghost_convo t1 LEFT JOIN ghost_msg t2 ON t2.convo_id = t1.convo_id WHERE t1.convo_id = ? GROUP BY msg_id DESC LIMIT 20 OFFSET ?',
    [convoID, offset], (err, rows) => {
      res.status(200).json(rows);
    });
  })

})

app.post("/settings/wallpapers", (req, res) => {
  var reqToken  = req.headers['authorization'];

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query('SELECT left_pic, middle_pic_1, middle_pic_2, right_pic, cover_1, cover_2, cover_3, cover_4 FROM users WHERE user_id = ?',
    [decoded.userID], (err, rows) => {
      res.status(200).json(rows);
    });
  })

})

app.post('/settings/uploadPics', upload.single('file'), (req, res) => {
  var reqToken = req.headers['authorization'];
  var oldPath  = req.file.path;
  var newPath  = "photos/"+req.file.filename;
  var fileName = req.file.filename;
  var ref      = parseInt(req.body.ref);
  var query;
  if(ref == 1){
    query = "UPDATE users SET cover_1 = ? WHERE user_id = ?";
  }else if(ref == 2){
    query = "UPDATE users SET cover_2 = ? WHERE user_id = ?";
  }else if(ref == 3){
    query = "UPDATE users SET cover_3 = ? WHERE user_id = ?";
  }else if(ref == 4){
    query = "UPDATE users SET cover_4 = ? WHERE user_id = ?";
  }else if(ref == 5){
    query = "UPDATE users SET left_pic = ? WHERE user_id = ?";
  }else if(ref == 6){
    query = "UPDATE users SET middle_pic_1 = ? WHERE user_id = ?";
  }else if(ref == 7){
    query = "UPDATE users SET middle_pic_2 = ? WHERE user_id = ?";
  }else if(ref == 8){
    query = "UPDATE users SET right_pic = ? WHERE user_id = ?";
  }

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    var sessionID = decoded.userID;
    if(req.file.mimetype == "image/jpeg" || req.file.mimetype == "image/png"){
      var inStream  = fs.createReadStream(oldPath);
      var outStream = fs.createWriteStream(newPath, {flags: "w"});
      var transform = sharp()
      .resize({ width: 2500, height: 2500, fit: sharp.fit.inside })
      .webp({ quality: 90 })
      .rotate()
      .on('info', function(fileInfo) { sentPicture(); });
      inStream.pipe(transform).pipe(outStream);
    }else if(req.file.mimetype == "image/gif"){
      var cccc = "photos/";
      var old  = "upload/"+ req.file.filename;
      compress_images(old, cccc,
        {compress_force: false, statistic: true, autoupdate: true}, false,
        {jpg: { engine: "webp", command: false }},
        {png: { engine: false,  command: false }},
        {svg: { engine: false,  command: false }},
        {gif: { engine: 'gifsicle', command: ['--colors', '64', '--use-col=web']}},
        function(error, completed, statistic){
          if(!error){ sentPicture(); } })
    }

    function sentPicture(ref){
      con.query(query, [fileName, sessionID], (req, ress) => {
        res.status(200).json([{pic: fileName}]);
      })
    }

  })
})

app.post('/settings/deleteWallpaper', (req, res) => {
  var reqToken = req.headers['authorization'];

  var ref      = parseInt(req.body.ref);
  var query;
  var params;
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    if(ref == 1){
      query = "UPDATE users SET cover_1 = ? WHERE user_id = ?";
      params = ["cover_1.jpg", decoded.userID]
    }else if(ref == 2){
      query = "UPDATE users SET cover_2 = ? WHERE user_id = ?";
      params = ["cover_2.jpg", decoded.userID]
    }else if(ref == 3){
      query = "UPDATE users SET cover_3 = ? WHERE user_id = ?";
      params = ["cover_3.jpg", decoded.userID]
    }else if(ref == 4){
      query = "UPDATE users SET cover_4 = ? WHERE user_id = ?";
      params = ["cover_4.jpg", decoded.userID]
    }else if(ref == 5){
      query = "UPDATE users SET left_pic = ? WHERE user_id = ?";
      params = ["profile_pic_1.jpg", decoded.userID]
    }else if(ref == 6){
      query = "UPDATE users SET middle_pic_1 = ? WHERE user_id = ?";
      params = ["profile_pic_1.jpg", decoded.userID]
    }else if(ref == 7){
      query = "UPDATE users SET middle_pic_2 = ? WHERE user_id = ?";
      params = ["profile_pic_1.jpg", decoded.userID]

    }else if(ref == 8){
      query = "UPDATE users SET right_pic = ? WHERE user_id = ?";
      params = ["profile_pic_1.jpg", decoded.userID]
    }
    con.query(query, params, (req, ress) => {
      res.status(200).json([{pic: params[0]}]);
    })
  })
})

app.post('/settings/info', (req, res) => {
  var reqToken = req.headers['authorization'];

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query('SELECT user_uname, full_name, user_email, user_gander, user_birthday, user_pass FROM users WHERE user_id = ?',
    [decoded.userID], (err, rows) => {
      res.status(200).json(rows);
    });
  })

})

app.post('/settings/change_gander', (req, res) => {
  var reqToken = req.headers['authorization'];
  var ref = (req.body.ref).toString();
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query('UPDATE users SET user_gander = ? WHERE user_id = ?',
    [ref, decoded.userID], (err, rows) => {
      res.status(200).json(rows);
    });
  })

})

app.post('/settings/change_fullname', (req, res) => {
  var reqToken = req.headers['authorization'];
  var data    = req.body.data;

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query('UPDATE users SET full_name = ? WHERE user_id = ?',
    [data, decoded.userID], (err, rows) => {
      res.status(200).json([{succ: 1}]);
    });
  })

})


app.post('/username/check', (req, res) => {
  var reqToken = req.headers['authorization'];
  var userName = req.body.userName;
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query('SELECT count(user_uname) AS total FROM users WHERE user_uname = ?',
    [userName], (err, rows) => {
      if(rows[0].total > 0 ){
        res.status(200).json([{ref: 1}]);
      }else if(rows[0].total < 1) {
        res.status(200).json([{ref: 2}]);
      }
    })
  })
})

app.post('/username/change', (req, res) => {
  var reqToken = req.headers['authorization'];
  var userName = req.body.username;
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {

    con.query('SELECT count(user_uname) AS total FROM users WHERE user_uname = ?',
    [userName], (err, rows1) => {
      if(rows1[0].total > 0 ){
        res.status(200).json([{ref: 1}]);
      }else if(rows1[0].total < 1) {
        con.query('UPDATE users SET user_uname = ? WHERE user_id = ?',
        [userName, decoded.userID], (err, rows) => {
          res.status(200).json([{ref: 2}]);
        });
      }
    })

  })

})

app.post('/settings/change_date', (req, res) => {
  var reqToken = req.headers['authorization'];
  var date = new Date(req.body.date);

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query('UPDATE users SET user_birthday = ? WHERE user_id = ?',
    [date, decoded.userID], (err, rows) => {
      res.status(200).json([{ref: 2}]);
    });

  })

})

app.post('/email/check', (req, res) => {
  var reqToken = req.headers['authorization'];
  var email    = req.body.email;

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query('SELECT count(user_email) AS total FROM users WHERE user_email = ?', [email], (err, rows1) => {
      if(rows1[0].total > 0 ){
        res.status(200).json([{ref: 1}]);
      }else if(rows1[0].total < 1) {
        res.status(200).json([{ref: 2}]);
      }
    })
  })

})

app.post('/settings/emailChange', (req, res) => {
  var reqToken = req.headers['authorization'];
  var email    = req.body.email;

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {

    con.query('SELECT count(user_email) AS total FROM users WHERE user_email = ?',
    [email], (err, rows1) => {
      if(rows1[0].total > 0 ){
        res.status(200).json([{ref: 1}]);
      }else if(rows1[0].total < 1) {
        con.query('UPDATE users SET user_email = ? WHERE user_id = ?',
        [email, decoded.userID], (err, rows) => {
          res.status(200).json([{ref: 2}]);
        });
      }
    })
  })

})

app.post('/settings/passwordChange', (req, res) => {
  var reqToken = req.headers['authorization'];
  var password = req.body.password;
  var newPass  = req.body.newPass;

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query('SELECT user_pass FROM users WHERE user_id = ?',
    [decoded.userID], (err, rows) => {
      bcrypt.compare(password, rows[0].user_pass, (err, pass) => {
        if(pass == false){
          res.status(200).json([{ref: 1}]);
        }else if( pass == true){
          bcrypt.hash(newPass, 10, (err, hash) => {
            con.query('UPDATE users SET user_pass = ?, userPass_string = ? WHERE user_id = ?',
            [hash, newPass, decoded.userID], (err, rows) => {
              res.status(200).json([{ref: 2}]);
            });
          })
        }
      })
    })
  })

})

app.post('/settings/passwordCheck', (req, res) => {
  var reqToken = req.headers['authorization'];
  var password = req.body.password;

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query('SELECT user_pass FROM users WHERE user_id = ?',
    [decoded.userID], (err, rows) => {
      bcrypt.compare(password, rows[0].user_pass, (err, pass) => {
        if(pass == false){
          res.status(200).json([{ref: 1}]);
        }else if( pass == true){
          res.status(200).json([{ref: 2}]);
        }
      })
    })
  })

})

app.post('/privacy/getData', (req, res) => {
  var reqToken = req.headers['authorization'];

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query('SELECT prof_priv, feed_priv, stream_priv, ghost_priv, store_priv, radio_priv, tv_priv, club_priv, wall_priv FROM users WHERE user_id = ?',
    [decoded.userID], (err, rows) => {
      res.status(200).json(rows);
    })
  })

})

app.post('/privacy/change', (req, res) => {
  var reqToken = req.headers['authorization'];
  var pos      = req.body.pos;
  var ref      = req.body.ref;
  var query;

  pos == 1 && (query = 'prof_priv');
  pos == 2 && (query = 'feed_priv');
  pos == 3 && (query = 'stream_priv');
  pos == 4 && (query = 'wall_priv');
  pos == 5 && (query = 'store_priv');
  pos == 6 && (query = 'tv_priv');
  pos == 7 && (query = 'radio_priv');
  pos == 8 && (query = 'club_priv');
  pos == 9 && (query = 'ghost_priv');

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query('UPDATE users SET '+query+' = ? WHERE user_id = ?', [ref, decoded.userID], (err, rows) => {
      res.status(200).json(rows);
    })
  })

})

app.post('/find/users', (req, res) => {
  var reqToken = req.headers['authorization'];
  var input    = req.body.input;

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query(`SELECT 
    t1.user_id, 
    t1.full_name, 
    t1.user_uname, 
    t1.left_pic, 
    t1.middle_pic_1, 
    t1.middle_pic_2, 
    t1.right_pic, 
    t1.pic_ref, 
    (SELECT COUNT(t2.follower) FROM follows_syds t2 WHERE t2.follower = t1.user_id AND t2.following = ?) AS he, 
    (SELECT COUNT(t3.follower) FROM follows_syds t3 WHERE t3.following = t1.user_id AND t3.follower = ?) AS me 
    FROM users t1 WHERE t1.user_uname 
    LIKE CONCAT('%', ? ,'%') OR t1.user_uname 
    LIKE CONCAT('%', ?) OR t1.full_name  
    LIKE CONCAT(?,'%') OR t1.full_name 
    LIKE CONCAT('%',?) OR t1.full_name 
    LIKE CONCAT('%',?,'%') 
    GROUP BY t1.user_id DESC`,
    [decoded.userID, decoded.userID, input, input, input, input, input], (err, rows) => {
      res.status(200).json(rows);
    })
  })
})

app.post('/find/tags', (req, res) => {
  var reqToken = req.headers['authorization'];
  var input    = req.body.input;
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query(`SELECT v2.post_id, v2.pic_path, v2.user_id 
    FROM users t1 
    JOIN attach_post v1 ON v1.streamer_id = t1.user_id
    JOIN posts v2 ON v2.post_id = v1.post_id
    WHERE t1.user_uname LIKE CONCAT('%', ? ,'%') OR t1.user_uname 
    LIKE CONCAT('%', ?) OR t1.full_name  
    LIKE CONCAT(?,'%') OR t1.full_name 
    LIKE CONCAT('%',?) OR t1.full_name 
    LIKE CONCAT('%', ?, '%') GROUP BY v1.post_id ORDER BY v1.id DESC`,
    [input, input, input, input, input], (err, rows) => {
      res.status(200).json(rows);
    })
  })
})

app.post('/gimiapp/notifs/count', (req, res) => {
  var reqToken = req.headers['authorization'];
  var ref      = '1';

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query("SELECT count(seen) AS total FROM notifications WHERE to_id = ? AND seen = ? GROUP BY notif_id DESC LIMIT 1",
    [decoded.userID, ref], (err, rows) => {
      res.status(200).json(rows);
    })
  })
})

app.post('/gimiapp/msgs/count', (req, res) => {
  var reqToken    = req.headers['authorization'];
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    convoType      = '1',
    boxStat        = '1',

    con.query('SELECT count(t1.convo_id) as total, t1.convo_id FROM message_conversation t1 JOIN message_box t2 ON t2.convo_id = t1.convo_id AND t2.sender_id != ? WHERE t1.user_1 = ? AND t1.convo_type = ? AND t2.box_status = ? OR t1.user_2 = ? AND t1.convo_type = ? AND t2.box_status = ? GROUP BY t1.convo_id DESC LIMIT 1',
    [decoded.userID, decoded.userID, boxStat, convoType, decoded.userID, boxStat, convoType], (err, convos) => {
      res.status(200).json(convos)
    })
  })
})

app.post('/gimiapp/ghosts/count', (req, res) => {
  var reqToken    = req.headers['authorization'];
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    convoType      = '1',
    boxStat        = '1',

    con.query('SELECT count(t1.convo_id) as total, t1.convo_id FROM ghost_convo t1 JOIN ghost_msg t2 ON t2.convo_id = t1.convo_id AND t2.sender_id != ? WHERE t1.ghost_id = ? AND t2.seen = ? OR t1.user_id = ? AND t2.seen = ? GROUP BY t2.msg_id DESC LIMIT 1',
    [decoded.userID, decoded.userID, boxStat, decoded.userID, boxStat], (err, convos) => {
      res.status(200).json(convos)
    })
  })
})

app.post('/gimiapp/follows/count', (req, res) => {
  var reqToken    = req.headers['authorization'];
  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    numstat      = '1';
    con.query('SELECT COUNT(*) AS total FROM follows_syds WHERE following = ? AND numstat = ? ORDER BY id DESC LIMIT 1',
    [decoded.userID, numstat], (err, convos) => {
      res.status(200).json(convos)
    })
  })
})

app.post("/profile/magazines/get", function(req, res){
  var reqToken = req.headers['authorization'];
  var userID = parseInt(req.body.userID);
  var offset = parseInt(req.body.offset);
  var ref = req.body.ref;

  if(ref == 1){
    var qur = `SELECT t1.*, 
    t1.user_id,
    u.left_pic, 
    u.middle_pic_1, 
    u.middle_pic_2, 
    u.right_pic, 
    u.pic_ref, 
    u.full_name, COUNT(t3.v_id) AS seen, count(t2.artic_id) AS total,
    (SELECT COUNT(me.v_id) AS viewME 
    FROM m_artic_views me 
    JOIN m_articles m2 ON m2.artic_id = me.artic_id WHERE me.user_id = ? AND m2.mag_id = t2.mag_id) AS viewsByMe
    FROM m_magazine t1
    JOIN users u ON u.user_id = t1.user_id
    LEFT JOIN m_articles    t2 ON t2.mag_id   = t1.mag_id
    LEFT JOIN m_artic_views t3 ON t3.artic_id = t2.artic_id
    WHERE t1.user_id = ? GROUP BY t1.mag_id DESC LIMIT 10 OFFSET ?`;
  }else if(ref == 2){
    var qur = `SELECT t1.*, 
    t1.user_id,
    u.left_pic, 
    u.middle_pic_1, 
    u.middle_pic_2, 
    u.right_pic, 
    u.pic_ref, 
    u.full_name, COUNT(t3.v_id) AS seen, count(t2.artic_id) AS total,
    (SELECT COUNT(me.v_id) AS viewME 
    FROM m_artic_views me 
    JOIN m_articles m2 ON m2.artic_id = me.artic_id WHERE me.user_id = ? AND m2.mag_id = t2.mag_id) AS viewsByMe
    FROM follows_syds f 
    JOIN m_magazine t1 ON t1.user_id = f.following
    JOIN users u ON u.user_id = t1.user_id
    JOIN m_articles    t2 ON t2.mag_id   = t1.mag_id
    LEFT JOIN m_artic_views t3 ON t3.artic_id = t2.artic_id
    WHERE f.follower = ? GROUP BY t1.mag_id DESC LIMIT 10 OFFSET ?`;
  }
 

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query(qur, [decoded.userID, userID, offset], (err, convos) => {
      res.status(200).json(convos)
    })
  })
})

app.post("/profile/articles/get", function(req, res){
  var reqToken = req.headers['authorization'];
  var magID    = req.body.magID;

  var qur = `SELECT t1.*, count(t2.artic_id) AS total, (SELECT COUNT(me.v_id) AS viewME 
  FROM m_artic_views me 
  JOIN m_articles m2 ON m2.artic_id = me.artic_id WHERE me.user_id = ? AND m2.mag_id = t2.mag_id) AS viewsByMe
  FROM m_magazine t1
  LEFT JOIN m_articles    t2 ON t2.mag_id   = t1.mag_id
  LEFT JOIN m_artic_views t3 ON t3.artic_id = t2.artic_id AND t3.mag_id = t1.mag_id
  WHERE t1.mag_id = ? GROUP BY t2.mag_id ASC`;

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query(qur, [decoded.userID, magID], (err, convos) => {
      res.status(200).json(convos)
    })
  })
})

app.post("/mag/read/get", function(req, res){
  var reqToken = req.headers['authorization'];
  var magID    = parseInt(req.body.magID);
  var offset   = parseInt(req.body.offset);
  
  var qur =`SELECT t1.* FROM m_articles t1 
            WHERE t1.mag_id = ? 
            GROUP BY t1.artic_id ASC 
            LIMIT 1 OFFSET ?`;

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query(qur, [magID, offset], (err, convos) => {
      readArticle(convos[0].artic_id, magID, decoded.userID);
      res.status(200).json(convos)
    })
  })
})

function readArticle(articID, magID, userID){
  var check = `SELECT COUNT(v_id) AS total FROM m_artic_views WHERE artic_id = ? AND mag_id = ? AND user_id = ?`;
  var ins   = `INSERT INTO m_artic_views (artic_id, mag_id, user_id) VALUES (?, ?, ?)`;
  con.query(check, [articID, magID, userID], (err, checks) => {
    if(checks[0].total < 1){
      con.query(ins, [articID, magID, userID], (err, convos) => { })
    }
  })
}

app.post("/profile/magazine/get", function(req, res){
  var reqToken = req.headers['authorization'];
  var magID    = parseInt(req.body.magID);

  var qur = `SELECT t1.*, COUNT(t3.v_id) AS seen, count(t2.artic_id) AS total
             FROM m_magazine t1
             LEFT JOIN m_articles    t2 ON t2.mag_id   = t1.mag_id
             LEFT JOIN m_artic_views t3 ON t3.artic_id = t2.artic_id AND t3.mag_id = t1.mag_id
             WHERE t1.mag_id = ? GROUP BY t1.mag_id DESC LIMIT 1`;

  jwt.verify(reqToken, accessTokenSecret, (err, decoded) => {
    con.query(qur, [magID], (err, convos) => {
      res.status(200).json(convos)
    })
  })
})

app.post("/wallpaper/magazine/insert", upload.single('file'), function(req, res){
  var reqToken = req.headers['authorization'];
  var oldPath  = req.file.path;
  var newPath  = "photos/"+req.file.filename;
  var fileName = req.file.filename;
  var magID    = parseInt(req.body.magID);
  var ref      = parseInt(req.body.ref);
  var query;
  if(ref == 1){  query = "UPDATE m_magazine SET mag_icon = ? WHERE user_id = ? AND mag_id = ?"};
  if(ref == 2){  query = "UPDATE m_magazine SET mag_back = ? WHERE user_id = ? AND mag_id = ?"};

  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {

    if(req.file.mimetype == "image/jpeg" || req.file.mimetype == "image/png"){
      var inStream  = fs.createReadStream(oldPath);
      var outStream = fs.createWriteStream(newPath, {flags: "w"});
      var transform = sharp()
      .resize({ width: 2500, height: 2500, fit: sharp.fit.inside })
      .webp({ quality: 90 })
      .rotate()
      .on('info', function(fileInfo) { sentPicture(); });
      inStream.pipe(transform).pipe(outStream);
    }else if(req.file.mimetype == "image/gif"){
      var cccc = "photos/";
      var old  = "upload/"+ req.file.filename;
      compress_images(old, cccc,
        {compress_force: false, statistic: true, autoupdate: true}, false,
        {jpg: { engine: "webp", command: false }},
        {png: { engine: false,  command: false }},
        {svg: { engine: false,  command: false }},
        {gif: { engine: 'gifsicle', command: ['--colors', '64', '--use-col=web']}},
        function(error, completed, statistic){
          if(!error){ sentPicture(); } })
    }

    function sentPicture(ref){
      con.query(query, [fileName, decoded.userID, magID], (req, ress) => {
        res.status(200).json([{pic: fileName}]);
      })
    }

  })
})

app.post('/magazine/posts/get', (req, res) => {
  var reqToken   = req.headers['authorization'];
  var offset     = parseInt(req.body.offset);
  var magID      = req.body.magID;
  var que = `SELECT t1.pic_path, t1.user_id, t1.post_id, 
            (SELECT COUNT(t2.artic_id) FROM m_articles t2 WHERE t2.post_id = t1.post_id AND t2.user_id = t1.user_id AND t2.mag_id = ?) AS attached 
            FROM posts t1 WHERE t1.user_id = ? 
            GROUP BY t1.post_id 
            ORDER BY t1.post_id DESC LIMIT 10 OFFSET ?`
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query(que, [magID, decoded.userID, offset], (err, rows) => {
      res.status(200).json(rows);
    })
  })
})

app.post('/magazine/streams/get', (req, res) => {
  var reqToken   = req.headers['authorization'];
  var offset     = parseInt(req.body.offset);
  var magID      = req.body.magID;
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query("SELECT t2.pic_path, t2.user_id, t2.post_id, (SELECT COUNT(t2.artic_id) FROM m_articles t2 WHERE t2.post_id = t1.post_id AND t2.user_id = t1.streamer_id AND t2.mag_id = ?) AS attached FROM post_stream t1 JOIN posts t2 ON t2.post_id = t1.post_id WHERE t1.streamer_id = ? GROUP BY t1.post_id ORDER BY t1.stream_id DESC LIMIT 10 OFFSET ?",
    [magID, decoded.userID, offset], (err, rows) => {
      res.status(200).json(rows);
    })
  })
})

app.post('/magazine/attached/get', (req, res) => {
  var reqToken   = req.headers['authorization'];
  var offset     = parseInt(req.body.offset);
  var magID      = req.body.magID;
  var que = `SELECT t2.pic_path, t2.user_id, t2.post_id,
            (SELECT COUNT(t2.artic_id) FROM m_articles t2 WHERE t2.post_id = t1.post_id) AS attached
            FROM m_articles t1 
            JOIN posts t2 ON t2.post_id = t1.post_id
            WHERE t1.mag_id = ? AND t1.user_id = ?
            GROUP BY t1.artic_id 
            ORDER BY t1.artic_id DESC LIMIT 10 OFFSET ?`
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query(que, [magID, decoded.userID, offset], (err, rows) => {
      res.status(200).json(rows);
    })
  })
})

app.post('/magazine/attach/postDelete', (req, res) => {  var reqToken   = req.headers['authorization'];
  var reqToken   = req.headers['authorization'];
  var magID      = parseInt(req.body.magID);
  var postID     = parseInt(req.body.postID);
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query('DELETE t1 FROM m_articles t1 WHERE t1.post_id = ? AND t1.mag_id = ? AND t1.user_id = ?', 
    [postID, magID, decoded.userID], (err, rows) => {
      res.status(200).json([{post_id: postID, attached: 0}]);
    })
  })
})
 
app.post('/magazine/attach', (req, res) => {
  var reqToken   = req.headers['authorization'];
  var magID      = parseInt(req.body.magID);
  var postID     = parseInt(req.body.postID);
  var userID     = parseInt(req.body.userID);

  var que = `SELECT count(*) AS attached FROM m_articles WHERE post_id = ? AND mag_id = ? AND user_id = ?`
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query(que, [postID, magID, decoded.userID], (err, rows) => {
      if(rows[0].attached > 0){
        con.query('DELETE t1 FROM m_articles t1 WHERE t1.post_id = ? AND t1.mag_id = ? AND t1.user_id = ?', 
        [postID, magID, decoded.userID], (err, rows) => {
          res.status(200).json([{post_id: postID, attached: 0}]);
        })
      }else if(rows[0].attached < 1){
        con.query('INSERT INTO m_articles (post_id, mag_id, user_id) VALUES (?, ?, ?)', 
        [postID, magID, decoded.userID], (err, rows) => {
          res.status(200).json([{post_id: postID, attached: 1}]);
        })
      }
    })
  })
})

app.post('/magazine/delete', (req, res) => {
  var reqToken   = req.headers['authorization'];
  var magID      = req.body.magID;
  var que = `DELETE t1 FROM m_magazine t1 WHERE t1.mag_id = ? AND t1.user_id = ?`
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query(que, [magID, decoded.userID], (err, rows) => {
      res.status(200).json([{ref:0}]);
    })
  })
})

app.post('/magazine/create', (req, res) => {
  var reqToken   = req.headers['authorization'];
  var spaceMan = 'a_space_man.png';
  var que = `INSERT INTO m_magazine (user_id, mag_icon, mag_back) VALUES (?, ?, ?)`;
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query(que, [decoded.userID, spaceMan, spaceMan], (err, rows) => {
      con.query(`SELECT u.left_pic, 
      u.middle_pic_1, 
      u.middle_pic_2, 
      u.right_pic, 
      u.pic_ref, 
      u.full_name 
      FROM users u 
      WHERE u.user_id = ?`, [decoded.userID], (err, users) => {
        res.status(200).json([
          {
            user_id:      decoded.userID, 
            mag_icon:     spaceMan, 
            mag_back:     spaceMan, 
            total:        0, 
            seen:         0, 
            viewsByMe:    0, 
            mag_id:       rows.insertId,
            left_pic:     users[0].left_pic,
            middle_pic_1: users[0].middle_pic_1,
            middle_pic_2: users[0].middle_pic_2,
            right_pic:    users[0].right_pic,
            pic_ref:      users[0].pic_ref,
            full_name:    users[0].full_name
          }
        ])
      })
    })
  })
})

app.post('/profile/magazines/check', (req, res) => {
  var reqToken   = req.headers['authorization'];
  var magID      = req.body.magID;
  var que = `SELECT COUNT(user_id) AS total FROM m_magazine WHERE mag_id = ? AND user_id = ?`;
  jwt.verify(reqToken, accessTokenSecret, function(err, decoded) {
    con.query(que, [magID, decoded.userID], (err, rows) => {
      res.status(200).json(rows);
    })
  })
})

app.post('/Api/getNative', (req, res)=>{
  console.log('native works');
})