const timestamp = require('monotonic-timestamp')
const replies   = require('irc-replies')
const split     = require('pull-split')
const parse     = require('irc-parser')
const pull      = require('pull-stream')
const util      = require('util')
const EE        = require('events').EventEmitter

const debug = (function(debug) {
	return {
		main: debug('pull-irc'),
		input: debug('pull-irc:input')
	}
})(require('debug'))

exports.parser = function() {
	return pull(
		split(/[\n\r]+/g),
		pull.map(function(line) {
			var input = parse(line)
			input.time = timestamp()
			if(replies[input.command]) {
				input.command = replies[input.command]
			}
			debug.input(line)
			return input
		})
	)
}

exports.nick = (function() {
	function nick(newNick) {
		if(!(this instanceof nick))
			return new nick(newNick)

		this.newNick = newNick
	}
	nick.prototype.toString = function() {
		return 'NICK ' + this.newNick
	}
	return nick
})()

exports.userSetup = (function() {
	function userSetup(username, realname) {
		if(!(this instanceof userSetup))
			return new userSetup(username, realname)

		this.username = username
		this.realname = realname
	}
	userSetup.prototype.toString = function() {
		return 'USER ' + this.username + ' 8 * :' + this.realname
	}
	return userSetup
})()

exports.privmsg = (function() {
	function privmsg(dest, msg) {
		if(!(this instanceof privmsg))
			return new privmsg(dest, msg)

		this.dest = dest
		this.msg = msg
	}
	privmsg.prototype.toString = function() {
		return 'PRIVMSG ' + this.dest + ' :' + this.msg
	}
	return privmsg
})()

exports.pong = (function() {
	function pong(id) {
		if(!(this instanceof pong))
			return new pong(id)

		this.id = id
	}
	pong.prototype.toString = function() {
		return 'PONG :' + this.id
	}
	return pong
})()

exports.join = (function() {
	function join(channel) {
		if(!(this instanceof join))
			return new join(channel)

		this.channel = channel
	}
	join.prototype.toString = function() {
		return 'JOIN ' + this.channel
	}
	return join
})()

exports.user = (function() {
	function user(nick, username, realname) {
		if(!(this instanceof user))
			return new user(nick, username, realname)

		if(!username)
			username = nick
		if(!realname)
			realname = username

		this.nick = nick
		this.username = username
		this.realname = realname
		this.channels = []
		EE.call(this)
	}
	util.inherits(user, EE)
	user.prototype.setup = function*() {
		yield exports.nick(this.nick)
		yield exports.userSetup(this.username, this.realname)
	}
	user.prototype.handle = function(input) {
		switch(input.command) {
		case 'NICK':
			if(input.prefix.split('!')[0] == this.nick) {
				this.emit('nick', this.nick, input.params[0])
				this.nick = input.params[0]
			}
			break
		case 'PRIVMSG':
			if(input.prefix.split('!')[0] == this.nick) {
				this.emit('msg', input.params[0], input.params[1])
			}
			break
		case 'JOIN':
			if(input.prefix.split('!')[0] == this.nick) {
				if(this.channels.indexOf(input.params[0]) == -1)
					this.channels.push(input.params[0])
				this.emit('join', input.params[0])
			}
			break
		case 'PART':
			if(input.prefix.split('!')[0] == this.nick) {
				if(~this.channels.indexOf(input.params[0]))
					this.channels.splice(this.channels.indexOf(input.params[0]), 1)
				this.emit('part', input.params[0])
			}
			break
		default:
		}
	}
	return user
})()