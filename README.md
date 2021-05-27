# er_redis_data_server
Redis data server plugin for EventRequest

[![Build Status](https://travis-ci.com/Michaelpalacce/er_redis_data_server.svg?branch=master)](https://travis-ci.com/Michaelpalacce/er_redis_data_server) [![codecov](https://codecov.io/gh/Michaelpalacce/er_redis_data_server/branch/master/graph/badge.svg)](https://codecov.io/gh/Michaelpalacce/er_redis_data_server) [![Codacy Badge](https://app.codacy.com/project/badge/Grade/838fd14c49a849e89ce27febd56ef95e)](https://www.codacy.com/manual/Michaelpalacce/er_redis_data_server?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=Michaelpalacce/er_redis_data_server&amp;utm_campaign=Badge_Grade) ![Maintenance](https://img.shields.io/maintenance/yes/2021) ![GitHub last commit](https://img.shields.io/github/last-commit/MichaelPalacce/er_redis_data_server) ![GitHub top language](https://img.shields.io/github/languages/top/MichaelPalacce/er_redis_data_server) ![npm](https://img.shields.io/npm/dt/er_redis_data_server) ![npm](https://img.shields.io/npm/dw/er_redis_data_server) [![Known Vulnerabilities](https://snyk.io/test/github/Michaelpalacce/er_redis_data_server/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Michaelpalacce/er_redis_data_server?targetFile=package.json)

Plugin for event_request that implements a redis data server

# Notes:
- Redis does not preserve value types ( numbers will not be numbers but stings after they are returned )
- Redis does not natively support objects. Any object you are trying to add will be JSON encoded and then JSON decoded when getting it
- The Redis Data Server has a MAX_TTL of 2147483647, that will be enforced if a bigger number is given
- There were issues with setting a ttl on locks, so currently the locks have no ttl set.

# Use:
~~~javascript
// Get the data server only
const RedisDataServer = require( 'er_redis_data_server' );

const DataServerPlugin = require( 'event_request/server/plugins/available_plugins/data_server_plugin' );
const app = require( 'event_request' )();

// Attach the cache server
app.apply( new DataServerPlugin( 'er_data_server', { dataServer: new RedisDataServer() } ) );
~~~
