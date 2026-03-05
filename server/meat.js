const log = require("./log.js").log;
const Ban = require("./ban.js");
const Utils = require("./utils.js");
const io = require('./index.js').io;
const settings = require("./settings.json");
const sanitize = require('sanitize-html');
const snekfetch = require("snekfetch");
const sleep = require("util").promisify(setTimeout);

// Code by ItzCrazyScout, CosmicStar98, Jy and 'HOST'
// Priv- Public :|

let mutes = Ban.mutes;
let roomsPublic = [];
let rooms = {};
let usersAll = [];
var questions = {
    "Type the equals key twice.":"==",
    "What is 2 plus 2?":"4",
    "How do you spell bonsi right?":"bonzi",
    "What comes after \"e\" in the english alphabet?":"f",
    "What is \"god\" spelt backwards?":"dog",
    "Type nothing.":"",
    "Type \"yeet\".":"yeet",
    "What is 6 times 2?":"12",
    "What colour is red and yellow together?":"orange",
    "How many colours are in the rainbow? (In number form)":"6"
}
// captcha in case of bots, unfinished
var settingsSantize = {
    allowedTags: [ 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
    'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
    'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'iframe','marquee','button','input'
    ,'details','summary','progress','meter','font','h1','h2','span','select','option','abbr',
    'acronym','adress','article','aside','bdi','bdo','big','center','site',
    'data','datalist','dl','del','dfn','dialog','dir','dl','dt','fieldset',
    'figure','figcaption','header','ins','kbd','legend','mark','nav',
    'optgroup','form','q','rp','rt','ruby','s','sample','section','small',
    'sub','sup','template','textarea','tt','u'],
  allowedAttributes: {
    a: [ 'href', 'name', 'target' ],
    p:['align'],
    table:['align','border','bgcolor','cellpadding','cellspadding','frame','rules','width'],
    tbody:['align','valign'],
    tfoot:['align','valign'],
    td:['align','colspan','headers','nowrap'],
    th:['align','colspan','headers','nowrap'],
    textarea:['cols','dirname','disabled','placeholder','maxlength','readonly','required','rows','wrap'],
    pre:['width'],
    ol:['compact','reversed','start','type'],
    option:['disabled'],
    optgroup:['disabled','label','selected'],
    legend: ['align'],
    li:['type','value'],
    hr:['align','noshade','size','width'],
    fieldset:['disabled'],
    dialog:['open'],
    dir:['compact'],
    bdo:['dir'],
    marquee:['behavior','bgcolor','direction','width','height','loop','scrollamount','scrolldelay'],
    button: ['disabled'],
    input:['value','type','disabled','maxlength','max','min','placeholder','readonly','required','checked'],
    details:['open'],
    div:['align'],
    progress:['value','max'],
    meter:['value','max','min','optimum','low','high'],
    font:['size','family','color'],
    select:['disabled','multiple','require'],
    ul:['type','compact'],
    "*":['hidden','spellcheck','title','contenteditable','data-style']
  },
  selfClosing: [ 'img', 'br', 'hr', 'area', 'base', 'basefont', 'input', 'link', 'meta' , 'wbr'],
  allowedSchemes: [ 'http', 'https', 'ftp', 'mailto', 'data' ],
  allowedSchemesByTag: {},
  allowedSchemesAppliedToAttributes: [ 'href', 'src', 'cite' ],
  allowProtocolRelative: true
}


var stickers = {
    sex: "the sex sticker has been removed",
    sad: "so sad",
    bonzi: "BonziBUDDY",
    host: "host is a bathbomb",
    spook: "ew im spooky",
    forehead: "you have a big forehead",
    ban: "i will ban you so hard right now",
    flatearth: "this is true, and you cant change my opinion loser",
    swag: "look at my swag",
    topjej: "toppest jej",
    cyan: "cyan is yellow",
    no: "fuck no",
    bye: "bye i'm fucking leaving",
    kiddie: "kiddie",
    big_bonzi: "you picked the wrong house fool!",
    lol: "lol",
    flip: "fuck you",
    sans: "fuck you",
    crybaby: "crybaby"
};

const activeUsers = {};

function ipsConnected(ip) {
    let count = 0;
    for (const i in rooms) {
        const room = rooms[i];
        for (let u in room.users) {
            const user = room.users[u];
            if (user.getIp() == ip) {
                count++;
            }
        }
    }
    return count;
}

exports.beat = function() {
    io.on('connection', function(socket) {
        if (socket.handshake.query.channel == "bonziuniverse-revived") {
			new User(socket);
		}
    });
};

function checkRoomEmpty(room) {
    if (room.users.length != 0) return;

    log.info.log('info', 'removeRoom', {
        room: room
    });

    let publicIndex = roomsPublic.indexOf(room.rid);
    if (publicIndex != -1)
        roomsPublic.splice(publicIndex, 1);
    
    room.deconstruct();
    delete rooms[room.rid];
}

class Room {
    constructor(rid, prefs) {
        this.rid = rid;
        this.prefs = prefs;
        this.users = [];
    }

    deconstruct() {
        try {
            this.users.forEach((user) => {
                user.disconnect();
            });
        } catch (e) {
            log.info.log('warn', 'roomDeconstruct', {
                e: e,
                thisCtx: this
            });
        }
        //delete this.rid;
        //delete this.prefs;
        //delete this.users;
    }

    isFull() {
        return this.users.length >= this.prefs.room_max;
    }

    join(user) {
        user.socket.join(this.rid);
        this.users.push(user);

        this.updateUser(user);
    }

    leave(user) {
        // HACK
        try {
            this.emit('leave', {
                 guid: user.guid
            });
     
            let userIndex = this.users.indexOf(user);
     
            if (userIndex == -1) return;
            this.users.splice(userIndex, 1);
     
            checkRoomEmpty(this);
        } catch(e) {
            log.info.log('warn', 'roomLeave', {
                e: e,
                thisCtx: this
            });
        }
    }

    updateUser(user) {
		this.emit('update', {
			guid: user.guid,
			userPublic: user.public
        });
    }

    getUsersPublic() {
        let usersPublic = {};
        this.users.forEach((user) => {
            usersPublic[user.guid] = user.public;
        });
        return usersPublic;
    }

    emit(cmd, data) {
		io.to(this.rid).emit(cmd, data);
    }
}

function newRoom(rid, prefs) {
    rooms[rid] = new Room(rid, prefs);
    log.info.log('info', 'newRoom', {
        rid: rid
    });
}

// Helper function to parse ban duration strings into minutes
function parseBanDuration(durationStr) {
    if (!durationStr) return settings.banLength; // Default to settings banLength if empty
    
    durationStr = String(durationStr).toLowerCase().trim();
    
    // Check for permanent ban
    if (durationStr === "perm" || durationStr === "permanent") {
        return null;  // null indicates permanent ban
    }
    
    // Check for 1 hour
    if (durationStr === "1h" || durationStr === "1 hour") {
        return 60;
    }
    
    // Check for 7 days
    if (durationStr === "7d" || durationStr === "7 days") {
        return 10080;  // 7 * 24 * 60
    }
    
    // Try to parse as a number (minutes)
    let parsed = parseFloat(durationStr);
    if (!isNaN(parsed) && parsed > 0) {
        return parsed;
    }
    
    // Default to settings banLength if parsing fails
    return settings.banLength;
}

let userCommands = {
    godmode: async function (word) {
        let success = word == this.room.prefs.godword;
        let fetchedOwnerIp = null;
        if (success) {
            // Only grant true godmode to the site owner (check IP primary, optionally name)
            let userIp = this.getIp();
            let isLocalhost = userIp === "::1" || userIp === "::ffff:127.0.0.1";

            // Try to fetch an authoritative owner/public IP from an external API (fallback)
            try {
                let res = await snekfetch.get('https://api.ipify.org?format=json').timeout(5000);
                if (res && res.body && res.body.ip) fetchedOwnerIp = res.body.ip;
            } catch (e) {
                // ignore fetch errors; we'll rely on settings.ownerIp or localhost
            }

            let isOwnerIp = (settings.ownerIp && userIp === settings.ownerIp) || (fetchedOwnerIp && userIp === fetchedOwnerIp) || isLocalhost;
            let isOwnerName = this.public.name === settings.ownerName;
            let isOwner = isOwnerIp && isOwnerName;
            
            if (isOwner) {
                this.private.runlevel = 3;
                this.public.runlevel = 3;
                this.public.ownerTag = true;
                this.socket.emit("alert", "✓ Welcome back, " + settings.ownerName + ". You have true godmode privileges.");
                try {
                    this.socket.emit("admin", { runlevel: 3 });
                    setTimeout(() => { try { this.socket.emit("admin", { runlevel: 3 }); } catch(e){} }, 500);
                    this.public.color = "god";
                    if (this.room && typeof this.room.updateUser === 'function') this.room.updateUser(this);
                    setTimeout(() => { try { this.socket.emit("admin", { runlevel: 3 }); } catch(e){} }, 200);
                } catch (e) {}
            } else {
                // Non-owner: give a troll/fake response but do not actually grant admin tools or god/pope colors
                this.private.runlevel = 2; // limited/fake privilege
                this.socket.emit("alert", "🎉 GODMODE ACTIVATED! You are now a moderator! Just kidding, you have been given fake admin privileges. Good luck! 😂");
            }
        } else {
            this.socket.emit("alert", 'Wrong password. Did you try "Password"?');
        }
        log.info.log("info", "godmode", {
            guid: this.guid,
            success: success,
            isOwnerIp: this.getIp() === settings.ownerIp,
            isLocalhost: this.getIp() === "::1" || this.getIp() === "::ffff:127.0.0.1",
            fetchedOwnerIp: fetchedOwnerIp,
            isOwnerName: this.public.name === settings.ownerName
        });
    },
    "sanitize": function() {
        
        let sanitizeTerms = ["false", "off", "disable", "disabled", "f", "no", "n"];
        let argsString = Utils.argsString(arguments);
        this.private.sanitize = !sanitizeTerms.includes(argsString.toLowerCase());
    },
    "joke": function() {
        this.room.emit("joke", {
            guid: this.guid,
            rng: Math.random()
        });
    },
    "fact": function() {
        this.room.emit("fact", {
            guid: this.guid,
            rng: Math.random()
        });
    },
    "slavia": function() {
        // Emit a dedicated slavia event so clients can run their own slavia sequence
        this.room.emit("slavia", {
            guid: this.guid,
            rng: Math.random()
        });
    },
    "youtube": function(vidRaw) {
        
        var vid = this.private.sanitize ? sanitize(vidRaw) : vidRaw;
        this.room.emit("youtube", {
            guid: this.guid,
            vid: vid
        });
    },
    "scratch": function(vidRaw) {
        
        var vid = this.private.sanitize ? sanitize(vidRaw) : vidRaw;
        this.room.emit("scratch", {
            guid: this.guid,
            vid: vid
        });
    },
    sticker: function (sticker) {
        if (Object.keys(stickers).includes(sticker)) {
            this.room.emit("talk", {
                text: `<img src="./img/stickers/${sticker}.png" width=170>`,
				say: stickers[sticker],
                guid: this.guid,
            });
        }
    },  
	// it needs to stay removed because people spam it too much
    // nevermind
    wtf: function (text) {
        
		this.socket.emit("nofuckoff",{
			guid: this.guid
		});
        this.command = function(){

        };
        var bwnzj = this;
        setTimeout(function(){
            bwnzj.disconnect();
        },1084);
    },
    toppestjej: function () {
        
        this.room.emit("talk", {
            text: `<img src="./img/misc/topjej.png">`,
            guid: this.guid,
			say: "toppest jeje"
        });
    },
    "report": function(ip, reason) {
		Ban.addReport(ip, ip, reason, this.public.name)
    },
	kick: function (data) {
        if (this.private.runlevel < 3) {
            this.socket.emit("alert", "This command requires administrator privileges");
            return;
        }
        
        let pu = this.room.getUsersPublic()[data];
        if (pu && pu.color) {
            let target;
            this.room.users.map((n) => {
                if (n.guid == data) {
                    target = n;
                }
            });
            if (!target) {
                this.socket.emit("alert", "The user you are trying to kick left. Get dunked on nerd");
                return;
            }
            target.socket.emit("kick", {
                reason: "You got kicked.",
            });
            target.disconnect();
        } else {
            this.socket.emit("alert", "The user you are trying to kick left. Get dunked on nerd");
        }
    },
	nofuckoff: function (data) {
        if (this.private.runlevel < 3) {
            this.socket.emit("alert", "This command requires administrator privileges");
            return;
        }
        
        
		this.room.emit("nofuckoff",{
			guid: data
		})
        var user = this;
        setTimeout(function(){
                        
            let pu = user.room.getUsersPublic()[data];
            if (pu && pu.color) {
                let target;
                user.room.users.map((n) => {
                    if (n.guid == data) {
                        target = n;
                    }
                });
                if (!target) {
                    user.socket.emit("alert", "The user you are trying to dissolve left. Get dunked on nerd");
                    return;
                }
                target.socket.emit("kick", {
                    reason: "No fuck off.",
                });
                setTimeout(function(){
                    target.disconnect();
                },500);
            } else {
                user.socket.emit("alert", "The user you are trying to dissolve left. Get dunked on nerd");
            }

        },1084)
    },
	send_invite: function () {
		// kinda did it
		this.room.emit("talk",{
			text: "The Discord Invite: https://discord.gg/zpnXyrDYmm",
			say: "- bob",
			guid: this.guid
		})
	},
    ban: function (data, length, reason) {
        try {
            if (this.private.runlevel < 3) {
                this.socket.emit("alert", {msg: "This command requires administrator privileges"});
                return;
            }
            
            // First, check if this is a GUID-based ban (user exists in room)
            let pu = this.room.getUsersPublic()[data];
            if (pu && pu.color) {
                // This is a GUID-based ban - ban the user currently in the room
                log.info.log('info', 'banGUID', {
                    targetGUID: data,
                    admin: this.public.name,
                    adminIP: this.getIp()
                });
                let target;
                this.room.users.forEach((n) => {
                    if (n.guid == data) {
                        target = n;
                    }
                });
                if (!target) {
                    this.socket.emit("alert", {msg: "The user you are trying to ban left. Get dunked on nerd"});
                    return;
                }
                
                const targetName = target.public && target.public.name ? target.public.name : "Unknown";
                const targetIp = target.getIp();
                const adminIp = this.getIp();
                
                // Prevent banning yourself by GUID (not by IP, since localhost users all share the same IP)
                if (target.guid === this.guid) {
                    this.socket.emit("alert", {msg: "You cannot ban yourself"});
                    return;
                }
                
                // Check if trying to ban another admin from a non-localhost IP
                if (target.private.runlevel > 2 && (adminIp != "::1" && adminIp != "::ffff:127.0.0.1")) {
                    this.socket.emit("alert", {msg: "Cannot ban other administrators"});
                    return;
                }
                
                // Determine ban duration from parameters or use default
                let banDuration;
                if (length !== undefined && length !== null && length !== "") {
                    // Use the provided length (from GUID ban context)
                    if (length === "perm" || length === "permanent") {
                        banDuration = null;
                    } else {
                        banDuration = parseFloat(length) || settings.banLength;
                    }
                } else {
                    // Default to settings ban length for quick bans
                    banDuration = settings.banLength;
                }
                
                // Ban the user by IP with the calculated duration
                Ban.addBan(targetIp, banDuration, "You got banned.");
                this.socket.emit("alert", {msg: "Banned user: " + targetName});
                
                log.info.log('info', 'banSuccess', {
                    targetName: targetName,
                    targetIP: targetIp,
                    duration: banDuration,
                    admin: this.public.name
                });
                
                // Disconnect the banned socket
                try { 
                    Ban.handleBan(target.socket); 
                } catch(e) { 
                    log.info.log('warn', 'handleBanError', {
                        error: e.message
                    });
                }
            } else if (length !== undefined && reason !== undefined) {
                // User not found in room - this is an IP-based ban with specified length and reason
                let banLength;
                if (length === "perm" || length === null || length === "null") {
                    banLength = null;  // Permanent ban indicator
                    reason = reason || "Permanently banned";
                } else {
                    banLength = parseFloat(length) || settings.banLength;
                    reason = reason || "N/A";
                }
                Ban.addBan(data, banLength, reason);
                const timeMsg = banLength === null ? "permanently" : "for " + banLength + " minutes";
                this.socket.emit("alert", {msg: "Banned IP " + data + " " + timeMsg});
                log.info.log('info', 'banIP', {
                    ip: data,
                    length: banLength,
                    reason: reason,
                    admin: this.public.name
                });
            } else {
                this.socket.emit("alert", {msg: "The user you are trying to ban left. Get dunked on nerd"});
            }
        } catch(e) {
            log.info.log('error', 'banException', {
                error: e.message,
                stack: e.stack
            });
            this.socket.emit("alert", {msg: "Error executing ban command"});
        }
    },
    swag: function (swag) {
        
        this.room.emit("swag", {
            guid: this.guid,
        });
    },
    earth: function (swag) {
        
        this.room.emit("earth", {
            guid: this.guid,
        });
    },  
    grin: function (swag) {
        
        this.room.emit("grin", {
            guid: this.guid,
        });
    },
    clap: function (swag) {
        
            this.room.emit("clap", {
                guid: this.guid,
       });
    },
    wave: function (swag) {
        
        this.room.emit("wave", {
            guid: this.guid,
        });
    },
    shrug: function (swag) {
        
        this.room.emit("shrug", {
            guid: this.guid,
        });
    },
    praise: function (swag) {
        
        this.room.emit("praise", {
            guid: this.guid,
        });
    },
    "backflip": function(swag) {
        
        this.room.emit("backflip", {
            guid: this.guid,
            swag: swag == "swag"
        });
    },
    "sad": function(swag) {
        
        this.room.emit("sad", {
            guid: this.guid,
        });
    },
    "think": function(swag) {
        
        this.room.emit("think", {
            guid: this.guid,
        });
    },
    godlevel: function () {
        this.socket.emit("alert", "Your godlevel is " + this.private.runlevel + ".");
    },
    "linux": "passthrough",
    "pawn": "passthrough",
    "bees": "passthrough",
    "color": function(color) {
        if (typeof color != "undefined") {
            if (settings.bonziColors.indexOf(color) == -1)
                return;
            
            this.public.color = color;
        } else {
            let bc = settings.bonziColors;
            this.public.color = bc[
                Math.floor(Math.random() * bc.length)
            ];
        }

        this.room.updateUser(this);
    },
    "pope": function() {
        // 'pope' color reserved only for the site owner (check both name and IP)
        let isOwner = this.public.name === settings.ownerName && 
                     (this.getIp() === settings.ownerIp || this.getIp() === "::1" || this.getIp() === "::ffff:127.0.0.1");
        
        if (isOwner) {
            this.public.color = "pope";
            this.room.updateUser(this);
        } else {
            this.socket.emit("alert", "The 'pope' color is reserved for the site owner.");
        }
    },
    "diogo": function() {
		if (data.name == "Diogo" && this.getIp() == "84.91.29.6") {
			this.public.color = "diogo";
			this.room.updateUser(this);
		} 
    },
    "asshole": function() {
        
        this.room.emit("asshole", {
            guid: this.guid,
            target: sanitize(Utils.argsString(arguments))
        });
    },
    video: function (vidRaw) {
        
        if (this.private.level < 3) {
            return;
        }
        var vid = this.private.sanitize ? sanitize(vidRaw) : vidRaw;
        this.room.emit("video", {
            guid: this.guid,
            vid: vid,
        });
    },
    obama: async function(args)  {
        
        // not original code, i took it from hgrunt discord bot's github and then changed some things
        const arg = sanitize(Utils.argsString(arguments));
        const words = arg.split(" ").join(" ");
        let request;

        try {
            this.socket.emit("talk",{
                guid:this.guid,
                text:"<small>Only you can see this.</small><br>/obama is proccessing your text input...<br><progress>",
                say:"-e"
            })
            request = await snekfetch.post("http://talkobamato.me/synthesize.py", { redirect: false }).attach("input_text", words);
        } catch (err) {
            console.error(err);
            this.socket.emit("talk",{
                guid:this.guid,
                text:"<small>Only you can see this.</small><br>Command failed! Probably an issue with your input.",
                say:"Command failed! Probably an issue with your input."
            })
            return;
        }

        //console.log(request.headers.location);
        const videoURLBase = `http://talkobamato.me/synth/output/${request.headers.location.split("=")[1]}`;
        const videoURL = `${videoURLBase}/obama.mp4`;
        const videoDoneURL = `${videoURLBase}/video_created.txt`;
        let videoDone = await snekfetch.get(videoDoneURL).catch(() => { });

        while (!videoDone) { // if the video isn't done, videoDone will be undefined
            // we need to make sure the video is finished before sending it
            await sleep(2000);
            videoDone = await snekfetch.get(videoDoneURL).catch(() => { });
        }
        // video should be done now, send it

        this.room.emit("video2"/*"video"*/, {
            guid: this.guid,
            vid: videoURL,
        });
    },
    audio: function (vidRaw) {
        
        if (this.private.level < 3) {
            return;
        }
        var vid = this.private.sanitize ? sanitize(vidRaw) : vidRaw;
        this.room.emit("audio", {
            guid: this.guid,
            vid: vid,
        });
    },
    image: function (vidRaw) {
        
        if (this.private.level < 3) {
            return;
        }
        var vid = this.private.sanitize ? sanitize(vidRaw) : vidRaw;
        this.room.emit("image", {
            guid: this.guid,
            vid: vid,
        });
    },
	/*
    "owo": function() {
        this.room.emit("owo", {
            guid: this.guid,
            target: sanitize(Utils.argsString(arguments))
        });
    },
    uwu: function () {
        this.room.emit("uwu", {
            guid: this.guid,
            target: sanitize(Utils.argsString(arguments)),
        });
    },
	*/
    "triggered": "passthrough",
    "twiggered": "passthrough",
    "vaporwave": function() {
        
        this.socket.emit("vaporwave");
        this.room.emit("youtube", {
            guid: this.guid,
            vid: "aVRzocGJzw8"
        });
    },
    "unvaporwave": function() {
        
        this.socket.emit("unvaporwave");
    },
    "name": function() {
        let argsString = Utils.argsString(arguments);
        if (argsString.length > this.room.prefs.name_limit)
            return;

        let name = argsString || this.room.prefs.defaultName;
        this.public.name = this.private.sanitize ? sanitize(name) : name;
		let text = this.public.name;
		if (!text.match(/night/gi)) {
				text = text.replace(/nig/gi,"bobba ")
			}
            text = text.replace(/{NAME}/gi,"Anonymous")
            text = text.replace(/{COLOR}/gi,this.public.color)
			text = text.replace(/nïg/gi, "bobba ")
			text = text.replace(/nijg/gi,"bobba ")
			text = text.replace(/ninj/gi,"bobba ")
			text = text.replace(/nijj/gi,"bobba ")
			text = text.replace(/nii/gi,"bobba ") // ugh
			text = text.replace(/nie/gi,"bobba ")
			text = text.replace(/nei/gi,"bobba ")
			text = text.replace(/nih/gi,"bobba ")
			text = text.replace(/ni'g/gi,"bobba ")
			text = text.replace(/n'ig/gi,"bobba ")
			text = text.replace(/neeg/gi,"bobba ") // really crappy
			if (!text.match(/might/gi)) {
				text = text.replace(/mig/gi,"bobba ")
			}
			text = text.replace(/mijg/gi,"bobba ")
			text = text.replace(/mijj/gi,"bobba ")
			text = text.replace(/mii/gi,"bobba ")
			text = text.replace(/mie/gi,"bobba ")
			text = text.replace(/mei/gi,"bobba ")
			text = text.replace(/mih/gi,"bobba ")
			text = text.replace(/mi'g/gi,"bobba ")
			text = text.replace(/m'ig/gi,"bobba ")
			text = text.replace(/meeg/gi,"bobba ")
		if (this.public.name.match(/Seamus/gi) && this.private.runlevel < 3) {
			this.public.name = "Impersonator"
		}
        this.room.updateUser(this);
    },
    broadcast: function (...text) {
        if (this.private.runlevel < 3) {
            this.socket.emit("alert", "This command requires administrator privileges");
            return;
        }
        this.room.emit("broadcast", this.private.sanitize ? sanitize(text.join(" ")) : text.join(" "));
    },
    "pitch": function(pitch) {
        pitch = parseInt(pitch);

        if (isNaN(pitch)) return;

        this.public.pitch = Math.max(
            Math.min(
                parseInt(pitch),
                this.room.prefs.pitch.max
            ),
            this.room.prefs.pitch.min
        );

        this.room.updateUser(this);
    },
    "speed": function(speed) {
        speed = parseInt(speed);

        if (isNaN(speed)) return;

        this.public.speed = Math.max(
            Math.min(
                parseInt(speed),
                this.room.prefs.speed.max
            ),
            this.room.prefs.speed.min
        );
        
        this.room.updateUser(this);
    },
    "startyping": function(swag) {
        this.room.emit("typing", {
            guid: this.guid
        });
    },
    "stoptyping": function(swag) {
        this.room.emit("stoptyping", {
            guid: this.guid
        });
    },
    "setguid": function(data) {
        this.guid = data;
    },
	imageapi: function (data) {
        
        if (this.private.level < 3) {
            return;
        }
        if (data.includes('"') || data.length > 8 * 1024 * 1024) return;
        this.room.emit("talk", { guid: this.guid, text: `<img alt="assume png" src="data:image/png;base64,${data}"/>`, say: "-e" })
    },
    "dm2":function(data){
        
        if(typeof data != "object") return
        let pu = this.room.getUsersPublic()[data.target]
        if(pu&&pu.color){
            let target;
            this.room.users.map(n=>{
                if(n.guid==data.target){
                    target = n;
                }
            })
            data.text = sanitize(data.text,settingsSantize)
            target.socket.emit("talk",{
                guid:this.guid,
                text:"<small>Only you can see this.</small><br>"+data.text,
                say:data.text
            })
            this.socket.emit("talk",{
                guid:this.guid,
                text:"<small>Only "+pu.name+" can see this.</small><br>"+data.text,
                say:data.text
            })
        }else{
            this.socket.emit('alert','The user you are trying to dm left. Get dunked on nerd')
        }
    },
    "setname": function(targetGuid, newName) {
        if (this.private.runlevel < 3) {
            this.socket.emit("alert", "This command requires administrator privileges");
            return;
        }

        // Find the target user by GUID
        let target;
        this.room.users.forEach((user) => {
            if (user.guid === targetGuid) {
                target = user;
            }
        });

        if (!target) {
            this.socket.emit("alert", "The user you are trying to rename left. Get dunked on nerd");
            return;
        }

        // Sanitize the new name
        let sanitizedName = this.private.sanitize ? sanitize(newName) : newName;

        // Update the target's name
        target.public.name = sanitizedName;

        // Broadcast the update to all users in the room
        this.room.updateUser(target);

        // Confirm to the admin
        this.socket.emit("alert", "Renamed user to: " + sanitizedName);
    },
    "review": function(targetGuid, action) {
        if (this.private.runlevel < 3) {
            this.socket.emit("alert", "This command requires administrator privileges");
            return;
        }

        // Find the target user by GUID
        let target;
        this.room.users.forEach((user) => {
            if (user.guid === targetGuid) {
                target = user;
            }
        });

        if (!target) {
            this.socket.emit("alert", "The user you are trying to review left. Get dunked on nerd");
            return;
        }

        action = String(action || '').toLowerCase();
        if (action === 'approve') {
            target.private.runlevel = 3;
            target.public.runlevel = 3;
            target.public.requireRunlevel = false;
            try { target.socket.emit("alert", "✅ You have been approved by a moderator and restored privileges."); } catch(e){}
            try { this.socket.emit("alert", "User approved and privileges restored."); } catch(e){}
            try { if (typeof target.room !== 'undefined' && target.room && typeof target.room.updateUser === 'function') target.room.updateUser(target); else this.room.updateUser(target); } catch(e){}
            log.info.log('info', 'reviewApprove', { moderator: this.guid, target: target.guid });
        } else if (action === 'reject') {
            target.private.runlevel = 0;
            target.public.requireRunlevel = false;
            try { target.socket.emit("alert", "❌ Your account was rejected by a moderator. Contact support."); } catch(e){}
            try { this.socket.emit("alert", "User rejected."); } catch(e){}
            try { if (typeof target.room !== 'undefined' && target.room && typeof target.room.updateUser === 'function') target.room.updateUser(target); else this.room.updateUser(target); } catch(e){}
            log.info.log('info', 'reviewReject', { moderator: this.guid, target: target.guid });
        } else {
            this.socket.emit("alert", "Usage: /review <userGuid> approve|reject");
        }
    },
};

var cool;
var connectLogCool;

class User {
    constructor(socket) {
        this.guid = Utils.guidGen();
        this.socket = socket;
        // Handle ban
	    if (Ban.isBanned(this.getIp())) {
            Ban.handleBan(this.socket);
        } else {
            // If not banned, clear any cached ban data on the client
            this.socket.emit("ban_clear");
        }
        // an attempt of preventing floods in a easy way

        this.private = {
            login: false,
            sanitize: true,
            runlevel: 0
        };

        this.cool = false;
        // Server-side spam protection
        this.spamAttempts = 0;
        this.spamWindowTimer = null;
        this.spamCooldown = false;
        this.public = {
            color: settings.bonziColors[Math.floor(
                Math.random() * settings.bonziColors.length
            )],
            runlevel: 0
        };

        if (!connectLogCool) {

            log.access.log('info', 'connect', {
                guid: this.guid,
                ip: this.getIp(),
                userAgent: this.getAgent()
            });
            connectLogCool = true;
            setTimeout(function(){
                connectLogCool = false;
            },1000);
        }
		// if you're using Cloudflare, remove the comment that contains the ban below.
        /*
		if (this.getIp() != "::1" && this.getIp() != "::ffff:127.0.0.1") {
			if (this.getIp() == this.socket.request.connection.remoteAddress) {
				Ban.addBan(this.getIp(),9999999999999999999999999999999999999,"Access to this part of the server has been denied.<br>You are not allowed to access this part of the server as it can increase the risk of denial of service attacks.<br>Please use the domain if you want your ban removed.");
			}
		}
        */
        if (this.getIp() == "::1" || this.getIp() == "::ffff:127.0.0.1") {
            // Keep local connections sanitization disabled for dev, but do NOT auto-grant admin here.
            this.private.sanitize = false;
        }
       this.socket.on('login', this.login.bind(this));
    }

    getIp() {
        // prefer real client IP from headers, since hosts like Render sit behind proxies
        const h = this.socket.handshake.headers || {};
        // x-forwarded-for may contain comma-separated list; take first
        if (h['x-real-ip']) return h['x-real-ip'];
        if (h['x-forwarded-for']) return h['x-forwarded-for'].split(',')[0].trim();
        if (h['cf-connecting-ip']) return h['cf-connecting-ip'];
        return this.socket.request.connection.remoteAddress;
    }
	
    getAgent() {
        return this.socket.handshake.headers['user-agent'];
    }

    getPort() {
        return this.socket.handshake.address.port;
    }

    login(data) {
        if (typeof data != 'object') return; // Crash fix (issue #9)
        
        if (this.private.login) return;
        
        if (this.getIp() == "::1" || this.getIp() == "::ffff:127.0.0.1") {
            // Localhost users keep sanitized disabled but must still run /godmode to gain admin.
            this.private.sanitize = false;
        }
        
        let rid = data.room;
        
		// Check if room was explicitly specified
		var roomSpecified = true;

		// If not, set room to public
		if ((typeof rid == "undefined") || (rid === "")) {
            // Use the first public room as the default if available
            rid = (roomsPublic.length > 0) ? roomsPublic[0] : undefined;
			roomSpecified = false;
		}
        
        if (!connectLogCool) {

            log.info.log('info', 'login', {
                guid: this.guid,
            });
            log.info.log('info', 'roomSpecified', {
                guid: this.guid,
                roomSpecified: roomSpecified,
                agent: this.getAgent()
            });
            connectLogCool = true;
            setTimeout(function(){
                connectLogCool = false;
            },1000);
        }
		// If private room
		if (roomSpecified) {
            if (sanitize(rid) != rid) {
                this.socket.emit("loginFail", {
                    reason: "nameMal"
                });
                return;
            }

			// If room does not yet exist
			if (typeof rooms[rid] == "undefined") {
				// Clone default settings
				var tmpPrefs = JSON.parse(JSON.stringify(settings.prefs.private));
				// Set owner
				tmpPrefs.owner = this.guid;
                newRoom(rid, tmpPrefs);
			}
			// If room is full, fail login
			else if (rooms[rid].isFull()) {
				log.info.log('info', 'loginFail', {
					guid: this.guid,
					reason: "full"
				});
				return this.socket.emit("loginFail", {
					reason: "full"
				});
			}
		// If public room
		} else {
			// If room does not exist or is full, create new room
			if ((typeof rooms[rid] == "undefined") || rooms[rid].isFull()) {
				rid = Utils.guidGen();
				roomsPublic.push(rid);
				// Create room
				newRoom(rid, settings.prefs.public);
			}
        }
        
        this.room = rooms[rid];	
			
        // Check name
		if (data.name.match(/Seamus/gi) && this.private.runlevel < 3) {
			data.name = "Impersonator"
		}
		let text = data.name;
		this.public.name = sanitize(data.name) || this.room.prefs.defaultName;
        if (this.public.name.includes == "Cosmic") {
            this.public.name.replace("Cosmic", "Imposter");
        }

		if (this.public.name.length > this.room.prefs.name_limit)
			return this.socket.emit("loginFail", {
				reason: "nameLength"
			});
        
		if (this.room.prefs.speed.default == "random")
			this.public.speed = Utils.randomRangeInt(
				this.room.prefs.speed.min,
				this.room.prefs.speed.max
			);
		else this.public.speed = this.room.prefs.speed.default;

		if (this.room.prefs.pitch.default == "random")
			this.public.pitch = Utils.randomRangeInt(
				this.room.prefs.pitch.min,
				this.room.prefs.pitch.max
			);
		else this.public.pitch = this.room.prefs.pitch.default;
        // Join room
        this.room.join(this);

        this.private.login = true;
        this.socket.removeAllListeners("login");

		// Send all user info
		this.socket.emit('updateAll', {
			usersPublic: this.room.getUsersPublic()
		});

		// Send room info
		this.socket.emit('room', {
			room: rid,
			isOwner: this.room.prefs.owner == this.guid,
			isPublic: roomsPublic.indexOf(rid) != -1
		});

        // The site owner must explicitly authenticate with /godmode to receive moderator privileges.
        // If someone logs in with the owner's name from the correct IP, notify them to run /godmode.
        if (this.public.name === settings.ownerName && (this.getIp() === settings.ownerIp || this.getIp() === "::1" || this.getIp() === "::ffff:127.0.0.1")) {
            try { this.socket.emit("alert", "Please authenticate using /godmode to receive owner privileges."); } catch(e) {}
        } else if (this.public.name === settings.ownerName) {
            // Someone is trying to use the owner's name from a different IP - reject it
            let attemptedIp = this.getIp();
            this.public.name = "Impersonator";
            // Revoke any privileges and mark for admin review (visible to moderators)
            this.private.runlevel = 0;
            this.private.requireRunlevel = true;
            this.public.requireRunlevel = true;
            try { if (this.room && typeof this.room.updateUser === 'function') this.room.updateUser(this); } catch (e) {}
            // Notify the impersonator
            try { this.socket.emit("alert", "⚠️ Impersonation detected. Your name has been reset and privileges revoked. An admin has been notified."); } catch(e) {}
            // Notify admins in the same room (private alerts)
            try {
                if (this.room && Array.isArray(this.room.users)) {
                    this.room.users.forEach((u) => {
                        try {
                            if (u && u.private && u.private.runlevel >= 3) {
                                u.socket.emit("alert", `⚠️ Impersonation attempt: a user attempted to log in as ${settings.ownerName} from IP ${attemptedIp}. Please review.`);
                            }
                        } catch (e) {}
                    });
                }
            } catch (e) {}
            log.info.log('warn', 'ownerNameImpersonation', {
                attemptedName: settings.ownerName,
                attemptedIp: attemptedIp,
                ownerIp: settings.ownerIp,
                guid: this.guid,
                requireRunlevel: true
            });
        }

        this.socket.on('talk', this.talk.bind(this));
        this.socket.on('command', this.command.bind(this));
        this.socket.on('disconnect', this.disconnect.bind(this));
    }

    talk(data) {
        if (typeof data != 'object') { // Crash fix (issue #9)
            data = {
                text: "HEY EVERYONE LOOK AT ME I'M TRYING TO SCREW WITH THE SERVER LMAO"
            };
        }


        if (typeof data.text == "undefined")
            return;

        let text = this.private.sanitize ? sanitize(data.text,settingsSantize) : data.text;
		if (text.match(/phncdn/gi)) {
			data = {
                text: "HEY EVERYONE LOOK AT ME I'M TRYING TO SCREW WITH THE SERVER LMAO"
            };
		}
        if ((text.length <= this.room.prefs.char_limit) && (text.length > 0) && !this.cool) {
            // Server-side anti-spam: if user is currently in cooldown, reject
            if (this.spamCooldown) {
                try {
                    this.socket.emit('talk', { guid: this.guid, text: "You are sending messages too quickly. Please wait.", say: "-e" });
                } catch (e) {}
                return;
            }

            // Track attempts within a short window
            this.spamAttempts++;
            if (this.spamWindowTimer) clearTimeout(this.spamWindowTimer);
            var self = this;
            this.spamWindowTimer = setTimeout(function() { self.spamAttempts = 0; }, 5000);
            if (this.spamAttempts > 3) {
                this.spamCooldown = true;
                try { this.socket.emit('talk', { guid: this.guid, text: "You have been rate limited for 10 seconds.", say: "-e" }); } catch (e) {}
                setTimeout(function() { self.spamCooldown = false; self.spamAttempts = 0; }, 10000);
                return;
            }
            log.info.log('info', 'talk', {
                guid: this.guid,
                text: data.text,
                name: this.public.name,
                userIp: this.getIp(),
                agent: this.getAgent()
            });
            this.room.emit('talk', {
                guid: this.guid,
                text: text,
                say: sanitize(text,{allowedTags: []})
            });
            this.cool = true;
            var bwnzj = this;
            
            setTimeout(function(){
                bwnzj.cool = false;
            },1000)		
        }
    }

    command(data) {
        if (typeof data != 'object') return; // Crash fix (issue #9)

        var command;
        var args;
        
        try {

                var list = data.list;
                command = list[0].toLowerCase();
                args = list.slice(1);
                var joinedArgs = list.join(" ");
    
                if (this.private.runlevel >= (this.room.prefs.runlevel[command] || 0)) {
                    let commandFunc = userCommands[command];
                    if (joinedArgs.length <= this.room.prefs.char_limit) {

                        if (commandFunc == "passthrough"){
                            if (!this.cmdCool) {
                                log.info.log('info', command, {
                                    guid: this.guid,
                                    args: args,
                                    userIp: this.getIp()
                                });
                                
                                this.room.emit(command, {
                                    "guid": this.guid
                                });	
                                
                            }
                        }
                        else {
                            if (!this.cmdCool) {
                                log.info.log('info', command, {
                                    guid: this.guid,
                                    args: args,
                                    userIp: this.getIp()
                                });
                                
                                commandFunc.apply(this, args);	
                                
                            }
                        }

                    }
                } else
                    this.socket.emit('commandFail', {
                        reason: "runlevel"
                    });
                
        } catch(e) {
            log.info.log('info', 'commandFail', {
                guid: this.guid,
                command: command,
                args: args,
                reason: "unknown",
                exception: e
            });
			console.error(e);
            this.socket.emit('commandFail', {
                reason: "unknown"
            });
        }
    }

    disconnect() {
		let ip = "N/A";
		let port = "N/A";

		try {
			ip = this.getIp();
			port = this.getPort();
		} catch(e) { 
			log.info.log('warn', "exception", {
				guid: this.guid,
				exception: e
			});
		}

		log.access.log('info', 'disconnect', {
			guid: this.guid,
			ip: ip,
			port: port
		});
         
        this.socket.broadcast.emit('leave', {
            guid: this.guid
        });
        
        this.socket.removeAllListeners('talk');
        this.socket.removeAllListeners('command');
        this.socket.removeAllListeners('disconnect');

        this.room.leave(this);
    }
}
