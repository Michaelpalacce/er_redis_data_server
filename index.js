'use strict';

// Data Server
const RedisDataServer		= require( './src/redis_data_server' );
RedisDataServer.getPlugin	= require( './src/redis_data_server_plugin' );

module.exports					= RedisDataServer;

const redis		= require("redis");
const client	= redis.createClient();

client.on( 'error', ( error ) => {
	console.error( error );
});

// MAX TTL 9223372036854775295

client.set( 'key' , 'value', 'EX', 9223372036854775295, function () {
	console.log( arguments );
});


// client.set( 'key', 'value', function () {
// 	console.log( arguments );
// } );

setTimeout(()=>{
	client.get( 'key', function(){
		console.log( arguments );
	} );
}, 2000)
