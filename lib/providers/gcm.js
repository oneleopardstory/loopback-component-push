// Copyright IBM Corp. 2013,2015. All Rights Reserved.
// Node module: loopback-component-push
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

'use strict';

var inherits = require('util').inherits;
var extend = require('util')._extend;
var EventEmitter = require('events').EventEmitter;
var gcm = require('node-gcm');
var debug = require('debug')('loopback:component:push:provider:gcm');

function GcmProvider(pushSettings) {
  var settings = pushSettings.gcm || {};
  this._setupPushConnection(settings);
}

inherits(GcmProvider, EventEmitter);

exports = module.exports = GcmProvider;

GcmProvider.prototype._setupPushConnection = function(options) {
  debug('Using GCM Server API key %j', options.serverApiKey);
  this._connection = new gcm.Sender(options.serverApiKey);
};

GcmProvider.prototype.pushNotification = function(notification, deviceToken) {
  return new Promise((resolve, reject) => {
    var self = this;

    var registrationIds = (typeof deviceToken == 'string') ?
      [deviceToken] : deviceToken;
    var message = this._createMessage(notification);

    debug('Sending message to %j: %j', registrationIds, message);
    this._connection.send(message, registrationIds, 3, function(err, result) {
      let response = {
        sent: [],
        failed: []
      };

      if (err) {
        debug('Cannot send message: %s', err.stack);
        return reject(err);
      }

      result.results.forEach(function(value, index) {
        let code = value && value.error;
        if (code) {
          debug('GCM error code: %s, deviceToken: %s', code, registrationIds[index]);
          response.failed.push({
            device: registrationIds[index],
            error: code,
          });
        } else {
          response.sent.push({
            device: registrationIds[index]
          });
        }
      });

      debug('GCM result: %j', response);
      return resolve(response);
    });
  });
};

GcmProvider.prototype._createMessage = function(notification) {
  // Message parameters are documented here:
  //   https://developers.google.com/cloud-messaging/server-ref
  var message = new gcm.Message({
    timeToLive: notification.getTimeToLiveInSecondsFromNow(),
    collapseKey: notification.collapseKey,
    delayWhileIdle: notification.delayWhileIdle,
  });

  var propNames = Object.keys(notification);
  // GCM does not have reserved message parameters for alert or badge, adding them as data.
  propNames.push('alert', 'badge');

  propNames.forEach(function(key) {
    if (notification[key] !== null &&
        typeof notification[key] !== 'undefined') {
      message.addData(key, notification[key]);
    }
  });

  return message;
};
