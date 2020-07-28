# er_redis_data_server
Redis data server plugin for EventRequest

[![Build Status](https://travis-ci.com/Michaelpalacce/er_redis_data_server.svg?branch=master)](https://travis-ci.com/Michaelpalacce/er_redis_data_server) [![codecov](https://codecov.io/gh/Michaelpalacce/er_redis_data_server/branch/master/graph/badge.svg)](https://codecov.io/gh/Michaelpalacce/er_redis_data_server) [![codecov](https://codecov.io/gh/Michaelpalacce/er_redis_data_server/branch/master/graph/badge.svg)](https://codecov.io/gh/Michaelpalacce/er_redis_data_server) 


Plugin for event_request that implements a redis data server

# Notes:
- Redis does not preserve value types ( numbers will not be numbers but stings after they are returned )
- Redis does not natively support objects. Any object you are trying to add will be JSON encoded and then JSON decoded when getting it
- The Redis Data Server has a MAX_TTL of 2147483647, that will be enforced if a bigger number is given

# Use:
~~~javascript
// Get the data server only
const RedisDataServer = require( 'er_redis_data_server' );

// Get the plugin that you can attach instead of the default one
const { App } = require( 'event_request' );
const app = App();

app.apply( RedisDataServer.getPlugin() );
~~~
