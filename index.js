var EasyWaf = require('easy-waf');
if(EasyWaf.default) {
  EasyWaf = EasyWaf.default;
}
var nodemailer = undefined;
try {
  var nodemailer = require('nodemailer');
} catch(ex) {

}
var fs = require("fs");
var os = require("os");
var url = require("url");
var easywafconfig = {};
var easywafhooks = {};
var logm = {};
if (fs.existsSync(__dirname + "/../../../easywaf-config.json")) easywafconfig = JSON.parse(fs.readFileSync(__dirname + "/../../../easywaf-config.json").toString());
if (fs.existsSync(__dirname + "/../../../easywaf-hooks.js")) easywafhooks = require(__dirname + "/../../../easywaf-hooks.js");

var version = "UNKNOWN";
try {
 version = JSON.parse(fs.readFileSync(__dirname + "/mod.info")).version;
} catch (ex) {
 // Can't determine version
}

function createRegex(regex) {
  var regexObj = regex.split("/");
  if (regexObj.length == 0) throw new Error("Invalid regex!");
  var modifiers = regexObj.pop();
  regexObj.shift();
  var searchString = regexObj.join("/");
  return new RegExp(searchString, modifiers);
}

if(easywafconfig.modules) {
  var moduleOptions = Object.keys(easywafconfig.modules);
  for(var i=0;i<moduleOptions.length;i++) {
    try {
      if(easywafconfig.modules[moduleOptions[i]].excludePaths) easywafconfig.modules[moduleOptions[i]].excludePaths = createRegex(easywafconfig.modules[moduleOptions[i]].excludePaths);
    } catch(ex) { }
  }
}

var mailtransport = undefined;

if(nodemailer && easywafconfig.mailConfig && easywafconfig.mailConfig.serverConfig) {
  mailtransport = nodemailer.createTransport(easywafconfig.mailConfig.serverConfig);
}

var maxRequestCheckedSize = easywafconfig.maxRequestCheckedSize ? easywafconfig.maxRequestCheckedSize : 65536;
var maxRequestCheckedSizeStrict = easywafconfig.maxRequestCheckedSizeStrict ? easywafconfig.maxRequestCheckedSizeStrict : false;

easywafconfig.preBlockHook = function(req, moduleInfo, ip) {
  var returnvalue = true;
  if(easywafhooks.preBlockHook) {
    try {
      var customPreBlockHookResult = easywafhooks.preBlockHook(req, moduleInfo, ip);
      if(typeof customPreBlockHookResult !== "undefined") returnvalue = customPreBlockHookResult;
    } catch(ex) {
      logm[ip].locwarnmessage("There was a problem when executing custom pre-block hook!");
      logm[ip].locwarnmessage("Stack:");
      logm[ip].locwarnmessage(ex.stack);
    }
  }
  if(returnvalue) {
    try {
      logm[ip].errmessage("Request blocked by EasyWAF. Module: " + moduleInfo.name);
    } catch (ex) {

    }
  }
  return returnvalue;
}

easywafconfig.postBlockHook = function(req, moduleInfo, ip) {
  if(easywafhooks.postBlockHook) {
    try {
      easywafhooks.postBlockHook(req, moduleInfo, ip);
    } catch(ex) {
      logm[ip].locwarnmessage("There was a problem when executing custom post-block hook!");
      logm[ip].locwarnmessage("Stack:");
      logm[ip].locwarnmessage(ex.stack);
    }
  }
  if(mailtransport) {
    var fromAddress = easywafconfig.mailConfig.from;
    if(easywafconfig.mailConfig.from && !easywafconfig.mailConfig.from.match(/ <[^<>]+>$/)) {
      fromAddress = "\"easy-waf integration with SVR.JS\" <" + fromAddress + ">";
    }
    mailtransport.sendMail({
      from: fromAddress,
      to: easywafconfig.mailConfig.to,
      subject: "Request blocked by EasyWAF from " + ip + " - Urgent Attention Required",
      text: "Dear Webmaster,\n\nI hope this email finds you well. I am writing to inform you that a request has been blocked by our Web Application Firewall (WAF) and it requires your immediate attention.\n\nThe WAF module that flagged this request is \"" + moduleInfo.name + "\". We have received an automated message from the WAF system indicating that a request to " + ((req.socket && ((req.headers && req.headers.host) || req.socket.localAddress)) ? ((req.socket.encrypted ? "https://" : "http://") + ((req.headers && req.headers.host) ? req.headers.host : req.socket.localAddress)) : "" ) + req.url + " from the following IP address " + ip + " has been blocked due to security concerns.\n\nTo ensure the smooth functioning of our website and prevent any potential threats, it is crucial that you investigate this issue promptly. Please review the logs to gather more information about the specific request that triggered the block.\n\nOnce you have identified the reason for the block, please take the necessary steps to either whitelist the IP address or address any potential security vulnerabilities that may have caused the block. This will ensure that legitimate users can access our website without any interruptions.\n\nIf you require any assistance or further information regarding this issue, please do not hesitate to contact either EasyWAF support at info[at]timokoessler[dot]de or SVR.JS support at support[at]svrjs[dot]org. We are here to help you resolve any concerns related to the WAF.\n\nThank you for your immediate attention to this matter. We appreciate your efforts in maintaining the security and integrity of our website.",
      html: ("Dear Webmaster,\n\nI hope this email finds you well. I am writing to inform you that a request has been blocked by our Web Application Firewall (WAF) and it requires your immediate attention.\n\nThe WAF module that flagged this request is \"" + moduleInfo.name + "\". We have received an automated message from the WAF system indicating that a request to " + ((req.socket && ((req.headers && req.headers.host) || req.socket.localAddress)) ? ((req.socket.encrypted ? "https://" : "http://") + ((req.headers && req.headers.host) ? req.headers.host : req.socket.localAddress)) : "" ) + req.url + " from the following IP address " + ip + " has been blocked due to security concerns.\n\nTo ensure the smooth functioning of our website and prevent any potential threats, it is crucial that you investigate this issue promptly. Please review the logs to gather more information about the specific request that triggered the block.\n\nOnce you have identified the reason for the block, please take the necessary steps to either whitelist the IP address or address any potential security vulnerabilities that may have caused the block. This will ensure that legitimate users can access our website without any interruptions.\n\nIf you require any assistance or further information regarding this issue, please do not hesitate to contact either EasyWAF support at info[at]timokoessler[dot]de or SVR.JS support at support[at]svrjs[dot]org. We are here to help you resolve any concerns related to the WAF.\n\nThank you for your immediate attention to this matter. We appreciate your efforts in maintaining the security and integrity of our website.").replace(/&/g,"&amp;").replace(/\</g,"&lt;").replace(/\>/g,"&gt;").replace(/[\r\n]/g,"<br/>")
    }).catch(function (ex) {
      logm[ip].locwarnmessage("There was a problem when sending e-mail!");
      logm[ip].locwarnmessage("Stack:");
      logm[ip].locwarnmessage(ex.stack);
    });
  } else if(easywafconfig.mailConfig) {
    logm[ip].locwarnmessage("You need to install \"nodemailer\" module in order for easy-waf integration to send e-mails!");
  }
}

easywafconfig.disableLogging = true;
const easyWaf = EasyWaf(easywafconfig);

function Mod() {}
Mod.prototype.callback = function callback(req, res, serverconsole, responseEnd, href, ext, uobject, search, defaultpage, users, page404, head, foot, fd, elseCallback, configJSON, callServerError) {
  return function() {
    logm[req.socket.remoteAddress] = serverconsole;
    if(!logm[req.socket.remoteAddress].locwarnmessage) logm[req.socket.remoteAddress].locwarnmessage = logm[req.socket.remoteAddress].errmessage;
    var oldReqBody = req.body;

    function easyWafCallback() {
      //EasyWaf
      try {
        easyWaf(req, res, function() {
          if (((href == "/easywaf-config.json" || (os.platform() == "win32" && href.toLowerCase() == "/easywaf-config.json")) || (href == "/easywaf-hooks.js" || (os.platform() == "win32" && href.toLowerCase() == "/easywaf-hooks.js"))) && __dirname == process.cwd()) {
            if (callServerError) {
              callServerError(403, "easy-waf-integration/" + version);
            } else {
              res.writeHead(403, "Forbidden", {
                "Server": "SVR.JS",
                "Content-Type": "text/plain"
              });
              res.end("403 Forbidden!");
            }
          } else {
            try {
              req.body = oldReqBody;
              elseCallback();
            } catch (ex) {
              if (callServerError) {
                callServerError(500, "easy-waf-integration/" + version, ex);
              } else {
                res.writeHead(500, "Internal Server Error", {
                  "Server": "SVR.JS",
                  "Content-Type": "text/plain"
                });
                res.end(ex.stack);
              }
            }
          }
        });
      } catch(ex) {
        if (callServerError) {
          callServerError(500, "easy-waf-integration/" + version, ex);
        } else {
          res.writeHead(500, "Internal Server Error", {
            "Server": "SVR.JS",
            "Content-Type": "text/plain"
          });
          res.end(ex.stack);
        }
      }
    }

    //req.body
    function readableHandlerPredict() {
      try {
        if(req._readableState.buffer.head !== null) {
          req.body = req._readableState.buffer.head.data.toString("latin1");
          if (req.headers["content-type"] == "application/x-www-form-urlencoded") req.body = url.parse("?" + req.body.strip(), true).query;
          if (req.headers["content-type"] == "application/json") req.body = JSON.parse(req.body.strip());
        }
      } catch (ex) {
      }
      easyWafCallback();
    }

    var chunkBuffer = [];
    var chunkBufferLength = Math.min(parseInt(req.headers["content-length"]) - 1, maxRequestCheckedSize);
    var chunkBufferPointer = 0;

    function readableHandlerWhole() {
      var chunk = req.read(chunkBufferLength - chunkBufferPointer);
      if(!chunk) chunk = req.read();
      if(chunk) {
        chunkBuffer.push(chunk);
        chunkBufferPointer += chunk.length;
      }
      if(req._readableState.ended) {
        req.removeListener("readable", readableHandlerWhole);
        if (callServerError) {
          callServerError(400, "easy-waf-integration/" + version);
        } else {
          res.writeHead(400, "Bad Request", {
            "Server": "SVR.JS",
            "Content-Type": "text/plain"
          });
          res.end("400 Bad Request!");
        }
      } else if(chunkBufferPointer >= chunkBufferLength) {
        req.removeListener("readable", readableHandlerWhole);
        try {
          for(var i = chunkBuffer.length - 1; i >= 0; i--) {
            req.unshift(chunkBuffer[i]);
          }
        } catch (ex) {
          if (callServerError) {
            callServerError(500, "easy-waf-integration/" + version, ex);
          } else {
            res.writeHead(500, "Internal Server Error", {
              "Server": "SVR.JS",
              "Content-Type": "text/plain"
            });
            res.end(ex.stack);
          }
          return;
        }
        req.body = "";
        for(var i = 0; i < chunkBuffer.length; i++) {
          req.body += chunkBuffer[i].toString("latin1");
        }
        easyWafCallback();
      }
    }

    if(!req._readableState.ended && !isNaN(chunkBufferLength) && chunkBufferLength > 0) {
      if(maxRequestCheckedSizeStrict && parseInt(req.headers["content-length"]) > maxRequestCheckSize) {
        if (callServerError) {
          callServerError(413, "easy-waf-integration/" + version);
        } else {
          res.writeHead(413, "Content Too Large", {
            "Server": "SVR.JS",
            "Content-Type": "text/plain"
          });
          res.end("413 Content Too Large!");
        }
      }
      req.on("readable", readableHandlerWhole);
    } else if(req._readableState.length > 0 || req._readableState.ended) {
      readableHandlerPredict();
    } else {
      req.once("readable", readableHandlerPredict);
    }
  }
}
module.exports = Mod;

