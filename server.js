
const express = require("express");
const fs = require("fs");
const http = require("http");
var SSHClient = require("ssh2").Client;
var utf8 = require("utf8");
const os = require('os');

const app = express();

var serverPort = 8080;

var server = http.createServer(app);

//set the template engine ejs
app.set("view engine", "ejs");

//middlewares
app.use(express.static("public"));

//routes
app.get("/", (req, res) => {
  res.render("index");
});

server.listen(serverPort);

//socket.io instantiation
const io = require("socket.io")(server);

//Socket Connection

io.on("connection", function(socket) {
  const { login, passphrase, host, port, password, privateKey } = socket.handshake.query;
  const connectionParams = {
    username: login,
    passphrase,
    password,
    host,
    port,
    privateKey,
  };

  if (connectionParams.privateKey) {
    let { privateKey } = connectionParams;
    if (privateKey.startsWith('~')) {
      privateKey = os.homedir()+privateKey.slice(1);
    }
    if (fs.existsSync(privateKey)) {
      privateKey = fs.readFileSync(privateKey);
    }
    connectionParams.privateKey = privateKey;
  }

  var ssh = new SSHClient();
  ssh.on("ready", function() {
      socket.emit("data", "\r\n*** SSH CONNECTION ESTABLISHED ***\r\n");
      connected = true;
      ssh.shell(function(err, stream) {
        if (err)
          return socket.emit(
            "data",
            "\r\n*** SSH SHELL ERROR: " + err.message + " ***\r\n"
          );
        socket.on("data", function(data) {
          stream.write(data);
        });
        stream
          .on("data", function(d) {
            socket.emit("data", utf8.decode(d.toString("binary")));
          })
          .on("close", function() {
            ssh.end();
          });
      });
    })
    .on("close", function() {
      socket.emit("data", "\r\n*** SSH CONNECTION CLOSED ***\r\n");
      socket.disconnect();
    })
    .on("error", function(err) {
      console.log(err);
      socket.emit(
        "data",
        "\r\n*** SSH CONNECTION ERROR: " + err.message + " ***\r\n"
      );
    });

  try {
    ssh.connect(connectionParams);
  } catch (e) {
    console.error(e);
    socket.emit('data', "\r\n*** SSH CONNECTION ERROR: " + e.message + " ***\r\n")
    socket.disconnect();
  }
});
