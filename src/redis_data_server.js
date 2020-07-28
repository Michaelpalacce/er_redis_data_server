'use strict';

const DataServer				= require( 'event_request/server/components/caching/data_server' );
const redis						= require( 'redis' );

const MAX_TTL					= 9223372036854775295;

/**
 * @brief	Data server that stores data in a local or remote redis instance
 */
class RedisDataServer extends DataServer
{
	/**
	 * @param	{Object} options
	 */
	_configure( options )
	{
		this.clientSettings		= typeof options.clientSettings === 'object'
								? options.clientSettings
								: {};

		this.server				= redis.createClient( this.clientSettings );
	}

	/**
	 * @copydoc	DataServer::_stop()
	 */
	_stop()
	{
		/* istanbul ignore next */
		this.server.end(() => {});
	}

	/**
	 * @copydoc	DataServer::_get()
	 */
	_get( key, options )
	{
		return new Promise(( resolve, reject ) => {
			this.server.get( key, ( err, response ) => {
				/* istanbul ignore next */
				if ( err )
					reject( err );

				resolve( typeof response !== 'undefined' ? response : null );
			});
		});
	}

	/**
	 * @copydoc	DataServer::_set()
	 */
	async _set( key, value, ttl, options )
	{
		return new Promise(( resolve, reject ) => {
			this.server.set( key, value, this._getTtl( ttl ), ( error ) => {
					/* istanbul ignore next */
					if ( error )
						reject( error );

					resolve( value );
				}
			);
		});
	}

	/**
	 * @copydoc	DataServer::_delete()
	 */
	async _delete( key, options )
	{
		return new Promise(( resolve, reject ) => {
			this.server.del( key, ( error ) => {
					/* istanbul ignore next */
					if ( error )
						reject( error );

					resolve( true );
				}
			);
		});
	}

	/**
	 * @copydoc	DataServer::_increment()
	 */
	async _increment( key, value, options )
	{
		return new Promise(( resolve, reject ) => {
			this.server.incr( key, value, ( error, result ) => {
					if ( error )
						resolve( false );

					if ( result === false || result === undefined )
						resolve( false );

					resolve( result );
				}
			);
		});
	}

	/**
	 * @copydoc	DataServer::_decrement()
	 */
	async _decrement( key, value, options )
	{
		return new Promise(( resolve, reject ) => {
			this.server.decr( key, value, ( error, result ) => {
					if ( error )
						resolve( false );

					if ( result === false || result === undefined )
						resolve( false );

					resolve( result );
				}
			);
		});
	}

	/**
	 * @copydoc	DataServer::_touch()
	 */
	async _touch( key, ttl, options )
	{
		return new Promise(( resolve, reject ) => {
			this.server.touch( key, this._getTtl( ttl ), ( error, result ) => {
					/* istanbul ignore next */
					if ( error )
						reject( error );

					if ( result === false )
						resolve( false );

					resolve( result );
				}
			);
		});
	}

	/**
	 * @copydoc	DataServer::_lock()
	 */
	async _lock( key, options )
	{
		const promisify	= require( 'util' ).promisify;
		const serverAdd	= promisify( this.server.add.bind( this.server ) );

		return await serverAdd( key, DataServer.LOCK_VALUE, MAX_TTL ).catch(() => {
			return false;
		});
	}

	/**
	 * @copydoc	DataServer::_lock()
	 */
	async _unlock( key, options )
	{
		const promisify	= require( 'util' ).promisify;
		const serverDel	= promisify( this.server.del.bind( this.server ) );

		await serverDel( key );

		return true;
	}

	/**
	 * @copydoc	DataServer::_getTtl()
	 */
	_getTtl( ttl = -1 )
	{
		ttl	= super._getTtl( ttl );

		if ( ttl === Infinity || ttl > MAX_TTL )
			ttl	= MAX_TTL;

		return ttl;
	}
}

module.exports	= RedisDataServer;