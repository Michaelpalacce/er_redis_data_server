'use strict';

const { Server, Loggur }			= require( 'event_request' );
const { test, assert, runAllTests }	= require( 'event_request' ).Testing;
const { request }					= require( 'http' );
const RateLimitsPlugin				= require( 'event_request/server/plugins/available_plugins/rate_limits_plugin' );
const Session						= require( 'event_request/server/components/session/session' );
const path							= require( 'path' );

const RedisDataServer				= require( '../src/redis_data_server' );
const DataServerPlugin				= require( 'event_request/server/plugins/available_plugins/data_server_plugin' );

const app							= new Server();
const dataServer					= new RedisDataServer();

Loggur.disableDefault();
Loggur.loggers	= {};

app.apply( new DataServerPlugin( 'er_data_server', { dataServer } ) );

dataServer.server.flushall( function () {
	console.log( arguments );
});

/**
 * @brief	Sends a request to the server and returns a Promise
 *
 * @param	String path
 * @param	String method
 * @param	Number statusCode
 * @param	mixed data
 * @param	Number port
 * @param	String expectedBody
 *
 * @return	Promise
 */
function sendServerRequest( path, method = 'GET', statusCode = 200, data = '', headers = {}, port = 3333, expectedBody = null )
{
	return new Promise(( resolve,reject ) => {
		const predefinedHeaders	= {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': Buffer.byteLength( data )
		};

		headers	= { ...predefinedHeaders, ...headers };

		const options	= {
			hostname	: 'localhost',
			port,
			path,
			method,
			headers
		};

		const req	= request( options, ( res ) => {
			const bodyParts	= [];
			res.on( 'data',( chunk ) => {
				bodyParts.push( chunk );
			} );

			res.on( 'end',() => {
				res.body	= Buffer.concat( bodyParts );

				if ( res.statusCode !== statusCode )
				{
					return reject( `Expected StatusCode: ${statusCode} but got ${res.statusCode} with body: ${res.body}`)
				}

				if ( expectedBody !== null )
				{
					assert.equal( res.body.toString(), expectedBody );
				}

				return resolve( res );
			});
		});

		req.on('error', ( e ) => {
			reject( e );
		});

		req.write( data );
		req.end();
	});
}

test({
	message	: 'RedisDataServer.set sets data',
	test	: ( done ) => {

		setTimeout( async () => {
			const dataServer	= new RedisDataServer();
			const key			= `key${Math.random()}`;
			const value			= 'value';
			const ttl			= 100;
			const persist		= true;

			await dataServer.set( key, value, ttl, { persist } )

			const dataSet	= await dataServer.get( key );

			assert.equal( dataSet !== null, true );

			assert.equal( dataSet, value );

			done();
		}, 10 );
	}
});

test({
	message	: 'RedisDataServer.set.sets.data.twice',
	test	: ( done ) => {

		setTimeout( async () => {
			const dataServer	= new RedisDataServer();
			const key			= `key${Math.random()}`;
			const value			= 'value';
			const ttl			= 100;
			const persist		= true;

			await dataServer.set( key, value, ttl, { persist } )
			await dataServer.set( key, value, ttl, { persist } )

			const dataSet	= await dataServer.get( key );

			assert.equal( dataSet !== null, true );

			assert.equal( dataSet, value );

			done();
		}, 10 );
	}
});

test({
	message	: 'RedisDataServer.set sets data without options',
	test	: async ( done ) => {
		const dataServer	= new RedisDataServer();
		const key			= `key${Math.random()}`
		const value			= 'value';
		const ttl			= 100;

		await dataServer.set( key, value, ttl );

		const dataSet	= await dataServer.get( key );

		assert.equal( dataSet !== null, true );
		assert.equal( dataSet, value );

		done();
	}
});

test({
	message	: 'RedisDataServer.set with ttl === -1',
	test	: async ( done ) => {
		const dataServer	= new RedisDataServer();
		const key			= `key${Math.random()}`
		const value			= 'value';
		const ttl			= -1;

		await dataServer.set( key, value, ttl );

		const dataSet	= await dataServer.get( key );

		assert.equal( dataSet !== null, true );
		assert.equal( dataSet, value );

		done();
	}
});

test({
	message			: 'RedisDataServer.set fails on handleError',
	dataProvider	: [
		[`key${Math.random()}`, 'value', 10, 123],
		[`key${Math.random()}`, 'value', 10, 'str'],
		[`key${Math.random()}`, 'value', 10, false],
		[`key${Math.random()}`, 'value', null, {}],
		[`key${Math.random()}`, 'value', [], {}],
		[`key${Math.random()}`, 'value', 'str', {}],
		[`key${Math.random()}`, 'value', false, {}],
		[`key${Math.random()}`, 'value', {}, {}],
	],
	test			: async ( done, key, value, ttl, options ) => {
		const dataServer	= new RedisDataServer();

		assert.equal( await dataServer.set( key, value, ttl, options ), null );
		assert.equal( await dataServer.get( key ) === null, true );

		done();
	}
});

test({
	message	: 'RedisDataServer.get gets data',
	test	: async ( done ) => {
		const dataServer	= new RedisDataServer();
		const key			= `key${Math.random()}`;
		const value			= 'value';
		const ttl			= 100;

		await dataServer.set( key, value, ttl );
		const dataSet	= await dataServer.get( key );

		assert.equal( dataSet, value );

		done();
	}
});

test({
	message	: 'RedisDataServer.get.when.data.does.not.exist',
	test	: async ( done ) => {
		const dataServer	= new RedisDataServer();
		const dataSet		= await dataServer.get( 'test' );

		assert.equal( dataSet, null );


		done();
	}
});

test({
	message			: 'RedisDataServer.get with invalid data',
	dataProvider	: [
		['key', 123],
		['key', false],
		[undefined, {}],
		[null, {}],
		[false, {}],
		[[], {}],
		[{}, {}],
	],
	test			: async ( done, key, options ) => {
		const dataServer	= new RedisDataServer();

		assert.equal( await dataServer.get( key, options ), null );

		done();
	}
});

test({
	message	: 'RedisDataServer.get prunes ( when expired it will be null )',
	test	: async ( done ) => {
		const dataServer	= new RedisDataServer();
		const key			= `key${Math.random()}`;
		const value			= 'value';
		const ttl			= 1;
		const persist		= true;

		await dataServer.set( key, value, ttl, { persist } );

		setTimeout( async () => {
			assert.equal( await dataServer.get( key ), null );

			done();
		}, 1100 );
	}
});

test({
	message	: 'RedisDataServer.touch.updates.expirationDate',
	test	: async ( done ) => {
		const dataServer	= new RedisDataServer();
		const key			= `key${Math.random()}`;
		const value			= 'value';
		const ttl			= 1;
		const persist		= true;

		await dataServer.set( key, value, ttl, { persist } );
		await dataServer.touch( key, 5 );

		setTimeout( async() => {
			const dataSet	= await dataServer.get( key );

			assert.equal( dataSet, value );

			done();
		}, 1100 );
	}
});

test({
	message	: 'RedisDataServer.touch.if.data.does.not.exist',
	test	: async ( done ) => {
		const dataServer	= new RedisDataServer();
		const key			= `key${Math.random()}`;

		assert.deepStrictEqual( await dataServer.touch( key, 5 ), false );

		done();
	}
});

test({
	message	: 'RedisDataServer.testWithServerAttachesSuccessfully',
	test	: ( done ) => {
		const app	= new Server();
		const name	= '/testWithServerAttachesSuccessfully';
		const key	= `${name}${Math.random()}`;
		const value	= 'test';

		app.apply( new DataServerPlugin( 'er_data_server', { dataServer } ) );

		app.get( name, async ( event ) => {
			assert.equal( event.dataServer instanceof RedisDataServer, true );

			await event.dataServer.set( key, value );

			event.send( name );
		});

		app.get( `${name}GET`, async ( event ) => {
			assert.equal( event.dataServer instanceof RedisDataServer, true );

			assert.equal( await event.dataServer.get( key ), value );

			event.send( `${name}GET` );
		});

		app.listen( 3334, () => {
			sendServerRequest( name, 'GET', 200, '', {}, 3334 ).then(( response ) => {
				assert.equal( response.body.toString(), name );

				return sendServerRequest( `${name}GET`, 'GET', 200, '', {}, 3334 );
			}).then(( response ) => {
				assert.equal( response.body.toString(), `${name}GET` );

				done();
			}).catch( done );
		});
	}
});

test({
	message			: 'RedisDataServer.touch with invalid data',
	dataProvider	: [
		['key', '123', {}],
		[false, '123', {}],
		[[], '123', {}],
		[{}, '123', {}],
		[null, '123', {}],
		[undefined, '123', {}],
		['key', [], {}],
		['key', {}, {}],
		['key', false, {}],
		['key', null, {}],
		['key', null, 123],
		['key', null, 'string'],
		['key', null, false]
	],
	test			: ( done, key, ttl, options ) => {

		setTimeout( async () => {
			const dataServer	= new RedisDataServer();
			await dataServer.set( key, '123' );

			assert.equal( await dataServer.touch( key, ttl, options ), false );


			done();
		}, 10 );
	}
});

test({
	message	: 'RedisDataServer.delete removes key and returns true but returns false if it does not exist or not string',
	test	: async ( done ) => {
		const dataServer	= new RedisDataServer({ persist: false });
		const key			= `key${Math.random()}`;
		const value			= { test: 'value' };


		assert.equal( await dataServer.delete( 123 ), false );
		assert.equal( await dataServer.delete( key ), true );
		assert.equal( await dataServer.delete( key ), true );

		done();
	}
});

test({
	message	: 'RedisDataServer.increment.increments.data',
	dataProvider	: [
		[100, 100, 200],
		[0, 100, 100],
		[-1, 100, 99],
		['string', 100, null],
		[[], 100, null],
		[{}, 100, null],
		[100, null, null],
		[100, 'string', null],
		[100, {}, null],
		[100, [], null],
	],
	test	: async ( done, value, increment, expectedValue ) => {
		const dataServer	= new RedisDataServer({ persist: false });
		const key			= `key${Math.random()}`;

		await dataServer.set( key, value ).catch( done );
		const result		= await dataServer.increment( key, increment ).catch( done );


		if ( expectedValue === null )
			return done( ! ( null === result ) );

		if ( result === null )
			return done( `Result was null but expected: ${expectedValue}` );

		assert.equal( result, expectedValue );

		done();
	}
});

test({
	message	: 'RedisDataServer.decrement decrement data',
	dataProvider	: [
		[100, 100, 0],
		[0, 100, -100],
		[1, 100, -99],
		[100, 99, 1],
		[100, 50, 50],
		['string', true, null],
		[[], 100, null],
		[{}, 100, null],
		[100, null, null],
		[100, 'string', null],
		[100, {}, null],
		[100, [], null],
	],
	test	: async ( done, value, decrement, expectedValue ) => {
		const dataServer	= new RedisDataServer({ persist: false });
		const key			= `key${Math.random()}`;

		await dataServer.set( key, value ).catch( done );

		const result	= await dataServer.decrement( key, decrement ).catch( done );

		if ( expectedValue === null )
			return done( ! ( null === result ) );

		if ( result === null )
			return done( `Result was null but expected: ${expectedValue}` );

		assert.equal( result, expectedValue );

		done();
	}
});

test({
	message			: 'RedisDataServer.set does not set if invalid data',
	dataProvider	: [
		[null, 'value', 100, true],
		['key', null, 100, true],
		['key', 'value', null, true],
		[123, 'value', 100, true],
		['key', 'value', '100', true],
		['key', 'value', 100, 'true'],
		[null, 'value', 100, 'true'],
		[undefined, 'value', 100, 'true'],
		[[], 'value', 100, 'true'],
		[{}, 'value', 100, 'true'],
		[false, 'value', 100, 'true'],
	],
	test			: async ( done, key, value, ttl, persist ) => {
		const dataServer	= new RedisDataServer();

		assert.equal( await dataServer.set( key, value, ttl, persist ), null );

		done();
	}
});

test({
	message			: 'RedisDataServer.lock locks data correctly',
	test			: async ( done ) => {
		const dataServer	= new RedisDataServer();

		await dataServer.unlock( 'key' );

		assert.equal( await dataServer.lock( 'key' ), true );
		assert.equal( await dataServer.lock( 'key' ), false );
		assert.equal( await dataServer.unlock( 'key' ), true );
		assert.equal( await dataServer.lock( 'key' ), true );
		assert.equal( await dataServer.lock( 'key' ), false );

		done();
	}
});

test({
	message			: 'RedisDataServer.lock locks data correctly with double unlock',
	test			: ( done ) => {

		setTimeout( async () => {
			const dataServer	= new RedisDataServer();

			await dataServer.unlock( 'key' );

			assert.equal( await dataServer.lock( 'key' ), true );
			assert.equal( await dataServer.lock( 'key' ), false );
			assert.equal( await dataServer.unlock( 'key' ), true );
			assert.equal( await dataServer.unlock( 'key' ), true );
			assert.equal( await dataServer.lock( 'key' ), true );
			assert.equal( await dataServer.lock( 'key' ), false );

			await dataServer.unlock( 'key' );

			done();
		}, 10 );
	}
});

test({
	message			: 'RedisDataServer.unlock always returns true',
	test			: ( done ) => {

		setTimeout( async () => {
			const dataServer	= new RedisDataServer();

			assert.equal( await dataServer.unlock( 'key' ), true );
			assert.equal( await dataServer.unlock( 'key' ), true );
			assert.equal( await dataServer.lock( 'key' ), true );
			assert.equal( await dataServer.unlock( 'key' ), true );

			await dataServer.unlock( 'key' );

			done();
		}, 10 );
	}
});

test({
	message			: 'RedisDataServer.lock acquires only one lock',
	test			: ( done ) => {

		setTimeout( async () => {
			const dataServer	= new RedisDataServer();
			const promises		= [];

			for ( let i = 0; i < 10000; i ++ )
				promises.push( dataServer.lock( 'key' ) );

			Promise.all( promises ).then( async( locks ) => {
				let acquiredLocks	= 0;
				for ( const lock of locks )
				{
					if ( lock )
						acquiredLocks ++;
				}

				assert.equal( acquiredLocks, 1 );

				await dataServer.unlock( 'key' );

				done();
			}).catch( done );
		}, 10 );
	}
});

test({
	message			: 'RedisDataServer.lockBurst acquires another lock with burst of locks',
	test			: ( done ) => {
		setTimeout( async () => {
			const dataServer	= new RedisDataServer();
			const promises		= [];
			const key			= `key${Math.random()}lockBurst`;

			for ( let i = 0; i < 2000; i ++ )
			{
				if ( i % 20 === 0 )
					dataServer.unlock( key );

				promises.push( dataServer.lock( key ) );
			}

			Promise.all( promises ).then( async( locks ) => {
				let acquiredLocks	= 0;
				for ( const lock of locks )
				{
					if ( lock )
						acquiredLocks ++;
				}

				assert.equal( acquiredLocks === 100, true );

				done();
			}).catch( done );
		}, 10 );
	}
});

test({
	message	: 'RedisDataServer.testWithServerRateLimits',
	test	: async ( done ) => {
		const dataStore	= new RedisDataServer();

		const appOne	= new Server();
		const appTwo	= new Server();

		const name			= 'testErRateLimitsBucketWorksCrossApps';
		const fileLocation	= path.join( __dirname, './fixture/rate_limits.json' );

		appOne.apply( new RateLimitsPlugin( 'rate_limits' ), { fileLocation, dataStore, useFile: true } );
		appTwo.apply( new RateLimitsPlugin( 'rate_limits' ), { fileLocation, dataStore, useFile: true } );

		appOne.get( `/${name}`, async ( event ) => {
			event.send( name );
		});

		appTwo.get( `/${name}`, ( event ) => {
			event.send( name );
		});

		appOne.listen( 3360 );
		appTwo.listen( 3361 );


		setTimeout(() => {
			sendServerRequest( `/${name}`, 'GET', 200, '', {}, 3360 ).then( async ( response ) => {
				return sendServerRequest( `/${name}`, 'GET', 429, '', {}, 3361, JSON.stringify( { error: 'Too many requests' } ) );
			}).then(() => {
				done();
			}).catch( done );
		}, 100 );
	}
});

test({
	message	: 'RedisDataServer.testWithServerRateLimitsPermissive',
	test	: ( done ) => {
		const name			= 'testErRateLimitsWithPermissiveLimiting';
		const fileLocation	= path.join( __dirname, './fixture/rate_limits.json' );
		let called			= 0;

		if ( ! app.hasPlugin( app.er_rate_limits ) )
			app.apply( app.er_rate_limits, { fileLocation, useFile: true } );

		app.get( `/${name}`, ( event ) => {
			called ++;

			if ( called > 1 )
			{
				assert.equal( event.rateLimited, true );
			}
			else
			{
				assert.equal( event.rateLimited, false );
			}

			event.send( name );
		} );

		sendServerRequest( `/${name}` ).then(( response ) => {
			return sendServerRequest( `/${name}` );
		}).then(( response ) => {
			assert.equal( response.body.toString(), name );
			done();
		}).catch( done );
	}
});

test({
	message	: 'RedisDataServer.testWithServerRateLimitsPermissiveRefills',
	test	: ( done ) => {
		const name			= 'testErRateLimitsWithPermissiveLimitingRefills';
		const fileLocation	= path.join( __dirname, './fixture/rate_limits.json' );

		if ( ! app.hasPlugin( app.er_rate_limits ) )
			app.apply( app.er_rate_limits, { fileLocation, useFile: true } );

		app.get( `/${name}`, ( event ) => {
			assert.equal( event.rateLimited, false );
			event.send( name );
		} );

		sendServerRequest( `/${name}` ).then(( response ) => {
			setTimeout(() => {
				sendServerRequest( `/${name}` ).then(( response ) => {
					assert.equal( response.body.toString(), name );
					done();
				}).catch( done )
			}, 1000 );
		}).catch( done );
	}
});

test({
	message	: 'RedisDataServer.testWithServerRateLimitsConnectionDelay',
	test	: ( done ) => {
		const name			= 'testErRateLimitsWithConnectionDelayPolicy';
		const fileLocation	= path.join( __dirname, './fixture/rate_limits.json' );
		const now			= Math.floor( new Date().getTime() / 1000 );

		if ( ! app.hasPlugin( app.er_rate_limits ) )
			app.apply( app.er_rate_limits, { fileLocation, useFile: true } );

		app.get( `/${name}`, ( event ) => {
			event.send( name );
		} );

		sendServerRequest( `/${name}` ).then(( response ) => {
			return sendServerRequest( `/${name}` );
		}).then(( response ) => {
			assert.equal( response.body.toString(), name );
			assert.equal( ( Math.floor( new Date().getTime() / 1000 ) - now ) >= 2, true );

			done();
		}).catch( done );
	}
});

test({
	message	: 'RedisDataServer.testWithServerRateLimitsStrict',
	test	: ( done ) => {
		const name			= 'testErRateLimitsWithStrictPolicy';
		const fileLocation	= path.join( __dirname, './fixture/rate_limits.json' );

		if ( ! app.hasPlugin( app.er_rate_limits ) )
			app.apply( app.er_rate_limits, { fileLocation, useFile: true } );

		app.get( `/${name}`, ( event ) => {
			event.send( name );
		} );

		sendServerRequest( `/${name}` ).then(( response ) => {
			return sendServerRequest( `/${name}`, 'GET', 429 );
		}).then(( response ) => {
			assert.equal( response.body.toString(), JSON.stringify( { error: 'Too many requests' } ) );
			done();
		}).catch( done );
	}
});

test({
	message	: 'RedisDataServer.testWithServerRateLimitsStrictSTRESS',
	test	: ( done ) => {
		// This test runs locally easily, but does not work well in the travis env
		const name			= 'testErRateLimitsWithStrictPolicyStress';
		const fileLocation	= path.join( __dirname, './fixture/rate_limits.json' );

		if ( ! app.hasPlugin( app.er_rate_limits ) )
			app.apply( app.er_rate_limits, { fileLocation, useFile: true } );

		app.get( `/${name}`, ( event ) => {
			event.send( name );
		} );

		const promises	= [];

		for ( let i = 0; i < 100; i ++ )
		{
			promises.push( sendServerRequest( `/${name}` ) );
		}

		setTimeout(() => {
			for ( let i = 0; i < 50; i ++ )
			{
				promises.push( sendServerRequest( `/${name}` ) );
			}

			Promise.all( promises).then(() => {
				done();
			}).catch( done );
		}, 2100 );
	}
});

test({
	message	: 'RedisDataServer.testWithServerRateLimitsStrictSpecifiedMethodMatches',
	test	: ( done ) => {
		const name			= 'testErRateLimitsWithStrictPolicyWithSpecifiedMethods';
		const fileLocation	= path.join( __dirname, './fixture/rate_limits.json' );

		if ( ! app.hasPlugin( app.er_rate_limits ) )
			app.apply( app.er_rate_limits, { fileLocation, useFile: true } );

		app.get( `/${name}`, ( event ) => {
			event.send( name );
		} );

		sendServerRequest( `/${name}` ).then(( response ) => {
			return sendServerRequest( `/${name}`, 'GET', 429 );
		}).then(( response ) => {
			assert.equal( response.body.toString(), JSON.stringify( { error: 'Too many requests' } ) );
			done();
		}).catch( done );
	}
});

test({
	message	: 'RedisDataServer.testWithServerRateLimitsStrictSpecifiedMultipleMethodsMatch',
	test	: ( done ) => {
		const name			= 'testErRateLimitsWithStrictPolicyWithMultipleSpecifiedMethods';
		const fileLocation	= path.join( __dirname, './fixture/rate_limits.json' );

		if ( ! app.hasPlugin( app.er_rate_limits ) )
			app.apply( app.er_rate_limits, { fileLocation, useFile: true } );

		app.get( `/${name}`, ( event ) => {
			event.send( name );
		} );

		sendServerRequest( `/${name}` ).then(( response ) => {
			return sendServerRequest( `/${name}`, 'GET', 429 );
		}).then(( response ) => {
			assert.equal( response.body.toString(), JSON.stringify( { error: 'Too many requests' } ) );
			done();
		}).catch( done );
	}
});

test({
	message	: 'RedisDataServer.testWithServerRateLimitsStrictSpecifiedMethodDoesNotMatch',
	test	: ( done ) => {
		const name			= 'testErRateLimitsWithStrictPolicyWithSpecifiedMethodsThatDoNotMatch';
		const fileLocation	= path.join( __dirname, './fixture/rate_limits.json' );

		if ( ! app.hasPlugin( app.er_rate_limits ) )
			app.apply( app.er_rate_limits, { fileLocation, useFile: true } );

		app.get( `/${name}`, ( event ) => {
			event.send( name );
		} );

		sendServerRequest( `/${name}` ).then(( response ) => {
			return sendServerRequest( `/${name}` );
		}).then(( response ) => {
			assert.equal( response.body.toString(), name );
			done();
		}).catch( done );
	}
});

test({
	message	: 'RedisDataServer.testWithServerRateLimitsStopPropagation',
	test	: ( done ) => {
		const name			= 'testErRateLimitsWithPropagation';
		const fileLocation	= path.join( __dirname, './fixture/rate_limits.json' );
		let called			= 0;

		if ( ! app.hasPlugin( app.er_rate_limits ) )
			app.apply( app.er_rate_limits, { fileLocation, useFile: true } );

		app.get( `/${name}`, ( event ) => {
			called ++;

			if ( called > 1 )
			{
				assert.equal( event.rateLimited, true );
			}
			else
			{
				assert.equal( event.rateLimited, false );
			}

			event.send( name );
		} );

		sendServerRequest( `/${name}` ).then(( response ) => {
			return sendServerRequest( `/${name}`, 'GET', 200 );
		}).then(( response ) => {
			assert.equal( response.body.toString(), name );
			done();
		}).catch( done );
	}
});

test({
	message	: 'RedisDataServer.testWithServerRateLimitsMultipleRules',
	test	: ( done ) => {
		const name			= 'testErRateLimitsWithMultipleRules';
		const fileLocation	= path.join( __dirname, './fixture/rate_limits.json' );

		if ( ! app.hasPlugin( app.er_rate_limits ) )
			app.apply( app.er_rate_limits, { fileLocation, useFile: true } );

		app.get( `/${name}`, ( event ) => {
			event.send( name );
		} );

		sendServerRequest( `/${name}` ).then(( response ) => {
			return sendServerRequest( `/${name}`, 'GET', 429 );
		}).then(( response ) => {
			assert.equal( response.body.toString(), JSON.stringify( { error: 'Too many requests' } ) );
			done();
		}).catch( done );
	}
});

test({
	message	: 'RedisDataServer.testWithServerRateLimitsStrictOverridesConenctionDelay',
	test	: ( done ) => {
		const name			= 'testErRateLimitsStrictOverridesConnectionDelayPolicy';
		const fileLocation	= path.join( __dirname, './fixture/rate_limits.json' );

		if ( ! app.hasPlugin( app.er_rate_limits ) )
			app.apply( app.er_rate_limits, { fileLocation, useFile: true } );

		app.get( `/${name}`, ( event ) => {
			event.send( name );
		} );

		sendServerRequest( `/${name}` ).then(( response ) => {
			return sendServerRequest( `/${name}`, 'GET', 429 );
		}).then(( response ) => {
			assert.equal( response.body.toString(), JSON.stringify( { error: 'Too many requests' } ) );
			done();
		}).catch( done );
	}
});

test({
	message	: 'RedisDataServer.testWithServerRateLimitsConnectionOverridesPermissive',
	test	: ( done ) => {
		const name			= 'testErRateLimitsConnectionDelayOverridesPermissivePolicy';
		const fileLocation	= path.join( __dirname, './fixture/rate_limits.json' );

		if ( ! app.hasPlugin( app.er_rate_limits ) )
			app.apply( app.er_rate_limits, { fileLocation, useFile: true } );

		app.get( `/${name}`, ( event ) => {
			event.send( name );
		} );

		sendServerRequest( `/${name}` ).then(( response ) => {
			return sendServerRequest( `/${name}` );
		}).then(( response ) => {
			assert.equal( response.body.toString(), name );

			done();
		}).catch( done );
	}
});

test({
	message	: 'RedisDataServer.testWithServerRateLimitsConnectionReturns429IfNoMoreRetries',
	test	: ( done ) => {
		const name			= 'testErRateLimitsConnectionDelayReturns429IfNoMoreRetries';
		const fileLocation	= path.join( __dirname, './fixture/rate_limits.json' );

		if ( ! app.hasPlugin( app.er_rate_limits ) )
			app.apply( app.er_rate_limits, { fileLocation, useFile: true } );

		app.get( `/${name}`, ( event ) => {
			event.send( name );
		} );

		sendServerRequest( `/${name}` ).then(( response ) => {
			return sendServerRequest( `/${name}`, 'GET', 429 );
		}).then(( response ) => {
			assert.equal( response.body.toString(), JSON.stringify( { error: 'Too many requests' } ) );
			done();
		}).catch( done );
	}
});

test({
	message	: 'RedisDataServer.testWithServerRateLimitsIpLimit',
	test	: ( done ) => {
		const name			= 'testErRateLimitsWithStrictPolicyWithIpLimit';
		const fileLocation	= path.join( __dirname, './fixture/rate_limits.json' );

		if ( ! app.hasPlugin( app.er_rate_limits ) )
			app.apply( app.er_rate_limits, { fileLocation, useFile: true } );

		app.get( `/${name}`, ( event ) => {
			event.send( name );
		} );

		setTimeout(() => {
			sendServerRequest( `/${name}` ).then(( response ) => {
				return sendServerRequest( `/${name}`, 'GET', 429 );
			}).then(( response ) => {
				assert.equal( response.body.toString(), JSON.stringify( { error: 'Too many requests' } ) );
				done();
			}).catch( done );
		}, 50 );
	}
});

test({
	message	: 'RedisDataServer.testWithServerResponseCache',
	test	: ( done ) => {
		const name	= 'testErResponseCacheCaches';
		let i		= 0;

		if ( ! app.hasPlugin( app.er_response_cache ) )
		{
			app.apply( app.er_data_server, { dataServer } );
			app.apply( app.er_response_cache );
		}

		app.get( `/${name}`, 'cache.request', ( event ) => {
			if ( i === 0 )
			{
				i ++;
				return event.send( name );
			}

			event.sendError( 'ERROR', 501 );
		});

		sendServerRequest( `/${name}` ).then(( response ) => {
			assert.equal( response.body.toString(), name );

			return sendServerRequest( `/${name}` );
		}).then(( response ) => {
			assert.equal( response.body.toString(), name );

			done();
		}).catch( done );
	}
});

test({
	message	: 'RedisDataServer.testWithServerCacheDoesNotCacheIfNotNeeded',
	test	: ( done ) => {
		const name	= 'testErResponseCacheDoesNotCacheEverything';
		let i		= 0;

		if ( ! app.hasPlugin( app.er_response_cache ) )
		{
			app.apply( app.er_data_server, { dataServer } );
			app.apply( app.er_response_cache );
		}

		app.get( `/${name}`, ( event ) => {
			if ( i === 0 )
			{
				i ++;
				return event.send( name );
			}

			event.sendError( 'ERROR', 501 );
		} );

		sendServerRequest( `/${name}` ).then(( response ) => {
			assert.equal( response.body.toString(), name );

			return sendServerRequest( `/${name}`, 'GET', 501 );
		}).then(( response ) => {
			assert.equal( response.body.toString(), JSON.stringify( { error: 'ERROR' } ) );

			done();
		}).catch( done );
	}
});

test({
	message	: 'RedisDataServer.testWithServerCacheDoesNotCacheRaw',
	test	: ( done ) => {
		const name	= 'testErResponseCacheDoesNotCacheRaw';
		let i		= 0;

		if ( ! app.hasPlugin( app.er_response_cache ) )
		{
			app.apply( app.er_data_server, { dataServer } );
			app.apply( app.er_response_cache );
		}

		app.get( `/${name}`, ( event ) => {
			if ( i === 0 )
			{
				i ++;
				return event.send( name, 200, true );
			}

			event.sendError( 'ERROR', 501 );
		} );

		sendServerRequest( `/${name}` ).then(( response ) => {
			assert.equal( response.body.toString(), name );

			return sendServerRequest( `/${name}`, 'GET', 501 );
		}).then(( response ) => {
			assert.equal( response.body.toString(), JSON.stringify( { error: 'ERROR' } ) );

			done();
		}).catch( done );
	}
});


test({
	message	: 'RedisDataServer.testWithServerSession',
	test	: ( done ) => {
		const name		= 'testErSession';
		const appTwo	= new Server();

		assert.throws(() => {
			const appOne	= new Server();
			appOne.apply( appOne.er_session );
		});

		appTwo.apply( appTwo.er_data_server, { dataServer } );
		appTwo.apply( appTwo.er_session );

		appTwo.get( `/${name}`, ( event ) => {
			event.initSession( event.next ).catch( event.next );
		} );

		appTwo.get( `/${name}`, async ( event ) => {
			assert.equal( event.session instanceof Session, true );
			const session	= event.session;

			if ( session.has( 'authenticated' ) === false )
			{
				assert.throws(() => {
					session.get( 'authenticated' );
				});

				session.add( 'authenticated', true );
			}
			else
			{
				assert.equal( session.get( 'authenticated' ), true );
				event.setResponseHeader( 'authenticated', 1 );
			}

			event.send( name );
		} );

		appTwo.listen( 3390, () => {
			sendServerRequest( `/${name}`, 'GET', 200, '', {}, 3390 ).then(( response ) => {
				assert.equal( response.body.toString(), name );
				assert.equal( typeof response.headers['set-cookie'] !== 'undefined', true );

				const cookies	= {},
					rc		= response.headers['set-cookie'][0];

				rc && rc.split( ';' ).forEach( function( cookie ) {
					const parts						= cookie.split( '=' );
					cookies[parts.shift().trim()]	= decodeURI( parts.join( '=' ) );
				});

				assert.equal( typeof cookies.sid === 'string', true );

				const headers	= { cookie: `sid=${cookies.sid}`};

				return sendServerRequest( `/${name}`, 'GET', 200, '', headers, 3390 );
			}).then(( response ) => {
				assert.equal( response.body.toString(), name );
				assert.equal( typeof response.headers.authenticated !== 'undefined', true );
				assert.equal( response.headers.authenticated, 1 );

				const headers	= { cookie: `sid=wrong`};

				return sendServerRequest( `/${name}`, 'GET', 200, '', headers, 3390 );
			}).then(( response ) => {
				assert.equal( response.body.toString(), name );
				assert.equal( typeof response.headers.authenticated === 'undefined', true );

				done();
			}).catch( done );
		});
	}
});

test({
	message	: 'RedisDataServer.with.custom.options',
	test	: ( done ) => {
		const dataServer	= new RedisDataServer( { clientSettings: {}, ttl: -1 } );

		dataServer.stop();

		setTimeout(() => {
			done();
		}, 50 );
	}
});

test({
	message	: 'RedisDataServer.with.ttl.-1',
	test	: ( done ) => {
		const dataServer	= new RedisDataServer();

		dataServer.stop();

		setTimeout(() => {
			done();
		}, 50 );
	}
});

test({
	message	: 'RedisDataServer._getTtl',
	test	: ( done ) => {
		const dataServer	= new RedisDataServer();

		dataServer.stop();

		setTimeout(() => {
			assert.deepStrictEqual( dataServer._getTtl(), 2147483647 );
			done();
		}, 50 );
	}
});

app.listen( 3333, async() => {
	runAllTests();
});
