'use strict';

// Data Server
const RedisDataServer		= require( './src/redis_data_server' );
RedisDataServer.getPlugin	= require( './src/redis_data_server_plugin' );

module.exports				= RedisDataServer;
