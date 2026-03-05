const log = require('./log.js').log;
const fs = require('fs-extra');
const settings = require("../settings.json");
const io = require('./index.js').io;
const path = require('path');

// Utility to resolve a real client IP from socket headers/proxy
function getSocketIp(socket) {
    if (!socket) return undefined;
    const h = socket.handshake && socket.handshake.headers ? socket.handshake.headers : {};
    if (h['x-real-ip']) return h['x-real-ip'];
    if (h['x-forwarded-for']) return h['x-forwarded-for'].split(',')[0].trim();
    if (h['cf-connecting-ip']) return h['cf-connecting-ip'];
    return socket.request && socket.request.connection ? socket.request.connection.remoteAddress : undefined;
}

const bansPath = path.join(__dirname, 'bans.json');
let bans = {};

exports.init = function() {
	try {
		if (!fs.existsSync(bansPath)) {
			fs.writeFileSync(bansPath, "{}");
			console.log("Created empty bans list.");
		}
		let raw = fs.readFileSync(bansPath, 'utf8');
		bans = JSON.parse(raw || '{}');
	} catch (e) {
		console.error("Could not load bans.json. Check syntax and permissions.", e);
		bans = {};
	}
};

exports.saveBans = function() {
	fs.writeFile(bansPath, JSON.stringify(bans), { flag: 'w' }, function(error) {
		try {
			log.info.log('info', 'banSave', { error: error });
		} catch(e) {}
	});
};

// Ban length is in minutes, or null for permanent
exports.addBan = function(ip, length, reason) {
	reason = reason || "N/A";
	
	// Support permanent bans
	let endTime;
	if (length === null || length === "perm" || length === "null") {
		endTime = null;  // null represents permanent ban
	} else {
		length = parseFloat(length) || settings.banLength;
		endTime = new Date().getTime() + (length * 60000);
	}
	
	bans[ip] = {
		reason: reason,
		end: endTime
	};

	var sockets = io.sockets.sockets;
	var socketList = Object.keys(sockets);

	for (var i = 0; i < socketList.length; i++) {
		var socket = sockets[socketList[i]];
		var sockIp = getSocketIp(socket) || socket.request.connection.remoteAddress;
		if (sockIp == ip)
			exports.handleBan(socket);
	}
	exports.saveBans();
};

exports.removeBan = function(ip) {
	delete bans[ip];
	exports.saveBans();
};

exports.handleBan = function(socket) {
	var ip = getSocketIp(socket) || socket.request.connection.remoteAddress;
	
	// Check if ban has expired (permanent bans have null end date)
	if (bans[ip].end !== null && bans[ip].end <= new Date().getTime()) {
		exports.removeBan(ip);
		return false;
	}

	log.access.log('info', 'ban', {
		ip: ip
	});
	socket.emit('ban', {
		reason: bans[ip].reason,
		end: bans[ip].end
	});
	socket.disconnect();
	return true;
};

exports.kick = function(ip, reason) {
	var sockets = io.sockets.sockets;
	var socketList = Object.keys(sockets);

	for (var i = 0; i < socketList.length; i++) {
		var socket = sockets[socketList[i]];
		var sockIp = getSocketIp(socket) || socket.request.connection.remoteAddress;
		if (sockIp == ip) {
			socket.emit('kick', {
				reason: reason || "N/A"
			});
			socket.disconnect();
		}
	}
};

exports.isBanned = function(ip) {
    return Object.keys(bans).indexOf(ip) != -1;
};
