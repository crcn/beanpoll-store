var store = require('./store'),
logger = require('mesh-winston').loggers.get('store.core')

exports.plugin = function(router)
{

	var channelsKey = 'stored/channels3';

	var storedChannels = store.get(channelsKey) || {},
	models = {};

	function getData(channel)
	{
		var d = store.get(channel);




			logger.debug('get data');
		//model? deserialize it.
		if(d.name && models[d.name])
		{
			var md = new models[d.name]();

			if(md._set) md._set(d.data);

			logger.debug('set model');
			return md;
		}
		else
		{
			return d.data;
		}
	}


	function listenOnPull(channel)
	{
		try
		{ 
			router.on(channel, { type: 'pull' }, function()
			{
				return getData(channel);
			});
		}

		//error thrown IF it already exists...
		catch(e)
		{

		}
	}




	router.on({

		/**
		 */


		'push store': function(ops)
		{
			logger.debug('store data: ' + ops.channel);

			var toStore = null;

			if(ops.data)
			{

				//is it a model? serialize it.
				if(ops.data._bindings && ops.data.doc)
				{
					toStore = { name: ops.data.name, data: ops.data.doc };
				}
				else
				{
					toStore = { data: ops.data };
				}

				storedChannels[ops.channel] = 1;

				//data exists? listen on pull since it's cached
				listenOnPull(ops.channel);
			}

			//otherwise delete the store channel so we don't listen for it on startup
			else
			{
				delete storedChannels[ops.channel];
			}

			store.set(channelsKey, storedChannels);


			//cache the data now.
			store.set(ops.channel, toStore);

			//PUSH the data out now
			router.request(ops.channel).query(ops.data).push();
		},

		/**
		 * used for deserializing data
		 */

		'push models': function(m)
		{
			models = m;
		},

		/**
		 */

		'push -one init': function()
		{
			logger.debug('store ready');

			for(var channel in storedChannels)
			{
				listenOnPull(channel);

				router.push(channel, getData(channel));
			}	
			logger.debug('done pushing data');

		}
	});

}