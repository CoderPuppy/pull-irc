var toPullStream = require('stream-to-pull-stream')
var net = require('net')
var pull = require('pull-stream')
var split = require('pull-split')
var pushable = require('pull-pushable')
var parse = require('irc-parser')

var socket = net.connect({
	host: '127.0.0.1',
	port: 6667
}, function() {
	console.log('Connected')
})

var output = pushable()
output.push('NICK cbotn')
output.push('USER cbotn 8 * :cbotn')

pull(
	toPullStream.source(socket),
	split(),
	pull.Through(function(read) {
		read(null, function next(end, data) {
			if(!end) {
				var input = parse(data)
				console.log('IN: ', data, input)
				if(input.command == 'PING') {
					output.push('PONG :' + input.params[0])
				}
				read(null, next)
			}
		})
		return output
	})(),
	pull.map(function(data) {
		console.log('OUT: %s', data)
		return data + '\n'
	}),
	toPullStream.sink(socket)
)