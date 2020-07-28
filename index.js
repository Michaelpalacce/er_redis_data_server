'use strict';

// Data Server
const RedisDataServer		= require( './src/redis_data_server' );
RedisDataServer.getPlugin	= require( './src/redis_data_server_plugin' );

module.exports				= RedisDataServer;

const dataServer	= new RedisDataServer();

async function test()
{
	await dataServer.set( 'key', 'value', 1 ).catch( console.log );

	setTimeout( async ()=>{
		console.log( await dataServer.get( 'key' ).catch( console.log ) );

		await dataServer.set( 'key', 'value', 1 ).catch( console.log );

		console.log( 'TOUCHED', await dataServer.touch( 'key', 10 ).catch( console.log ) );

		setTimeout( async ()=>{
			console.log( 'VALUE:', await dataServer.get( 'key' ).catch( console.log ) );
			console.log( 'DELETED:', await dataServer.delete( 'key' ).catch( console.log ) );
			console.log( 'VALUE AFTER DELETION:', await dataServer.get( 'key' ).catch( console.log ) );


			console.log( 'ADDED', await dataServer.set( 'key', 10 ).catch( console.log ) );
			setTimeout( async ()=>{
				console.log( 'INCREMENTED', await dataServer.increment( 'key', 1000 ).catch( console.log ) );
				console.log( 'INCREMENTED', await dataServer.increment( 'key', 1000 ).catch( console.log ) );
				console.log( 'INCREMENTED', await dataServer.increment( 'key', 1000 ).catch( console.log ) );
				console.log( 'AFTER INCREMENTATION', await dataServer.get( 'key' ).catch( console.log ) );
				console.log( 'DECREMENTED', await dataServer.decrement( 'key', 500 ).catch( console.log ) );
				console.log( 'DECREMENTED', await dataServer.decrement( 'key', 500 ).catch( console.log ) );
				console.log( 'AFTER DECREMENTATION', await dataServer.get( 'key' ).catch( console.log ) );

				const lockKey	= `lockKey${Math.random()}`;
				const promises	= [];

				for ( let i = 0; i < 5000; i ++ )
				{
					if ( i % 10 === 0 )
						dataServer.unlock( lockKey ).catch( console.log );

					promises.push( dataServer.lock( lockKey ).catch( console.log ) );
				}


				Promise.all( promises ).then( ( responses )=>{
					let counter	= 0;

					for ( const response of responses )
					{
						if ( response === true )
							counter ++;
					}

					console.log( 'LOCKS OBTAINED', counter );
				}).catch( console.log );

			}, 1100 );
		}, 1100 );
	}, 1100 );
}

test();