const toPullStream = require('stream-to-pull-stream')
const genStream    = require('gen-stream')
const debug        = (function(debug) {
	return {
		main: debug('pull-irc'),
		output: debug('pull-irc:output')
	}
})(require('debug'))
const pull         = require('pull-stream')
const irc          = require('./')
const net          = require('net')

console.log('Connecting')
const socket = net.connect(6667, '127.0.0.1', function() {
	console.log('Connected')
})
const user = irc.user('cbotode')
var commandPrefix = '#'
pull(
	toPullStream.source(socket),
	irc.parser(),
	genStream.through(function*(read) {
		var firstMode = true

		yield* user.setup()

		input: while(true) {
			var input = yield read()
			if(!input) break input
			user.handle(input)
			switch(input.command) {
			case 'RPL_WELCOME':
				yield irc.join('#code')
				yield irc.join('#opers')
				break
			case 'PRIVMSG':
				debug.main('[ %s : %s ]: %s', input.params[0], input.prefix.split('!')[0], input.params[1])
				if(input.params[1].substr(0, commandPrefix.length) == commandPrefix) {
					var cmd = input.params[1].substr(commandPrefix.length)
					var it
					if(it = /^([^\s=]+)$/.exec(cmd)) {
						switch(it[1]) {
						case 'name':
							yield irc.privmsg(input.params[0], 'My name is currently: ' + user.nick)
							break
						case 'command-prefix':
							yield irc.privmsg(input.params[0], it[1] + ' = ' + commandPrefix)
							break
						default:
							yield irc.privmsg(input.params[0], 'Unknown option: ' + it[1])
						}
					} else if(it = /^([^\s=]+)\s*=\s*(.+)$/.exec(cmd)) {
						switch(it[1]) {
						case 'name':
							yield irc.nick(it[2])
							break
						case 'command-prefix':
							commandPrefix = it[2]
							yield irc.privmsg(input.params[0], 'Set command-prefix to ' + it[2])
							break
						default:
							yield irc.privmsg(input.params[0], 'Unknown option: ' + it[1])
						}
					} else {
						yield irc.privmsg(input.params[0], 'Unknown command: ' + cmd)
					}
				}
				break
			case 'JOIN':
				debug.main('%s has joined %s', input.prefix.split('!')[0], input.params[0])
				break
			case 'NOTICE':
				debug.main('%s/%s -- %s', input.prefix.split('!')[0], input.params[0], input.params[1])
				break
			case 'NICK':
				debug.main('%s is now known as %s', input.prefix.split('!')[0], input.params[0])
				break
			case 'RPL_NAMREPLY':
				debug.main('%s = [ %s ]', input.params[2], input.params[3].replace(/(?:^\s+|\s+$)/g, ''))
				break
			case 'ERROR':
				console.error.apply(console, input.params)
				break input
			case 'PING':
				yield irc.pong(input.params[0])
				break
			case 'ERR_ERRONEOUSNICKNAME':
				yield irc.privmsg('#code', 'invalid nickname: ' + input.params[1])
				break
			case 'RPL_ENDOFNAMES':
			case 'ERR_NOMOTD':
			case 'RPL_GLOBALUSERS':
			case 'RPL_LOCALUSERS':
			case 'RPL_LUSERME':
			case 'RPL_LUSERCHANNELS':
			case 'RPL_LUSEROP':
			case 'RPL_LUSERCLIENT':
			case 'RPL_ISUPPORT':
			case 'RPL_MYINFO':
			case 'RPL_CREATED':
			case 'RPL_YOURHOST':
				break
			default:
				debug.main(input)
			}
		}
	}),
	pull.map(function(data) {
		debug.output('%s', data)
		return data.toString() + '\n'
	}),
	toPullStream.sink(socket)
)