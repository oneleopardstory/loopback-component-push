// Copyright IBM Corp. 2013,2015. All Rights Reserved.
// Node module: loopback-component-push
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

'use strict';

var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var debug = require('debug')('loopback:component:push:provider:apns');
var apn = require('apn');

function ApnsProvider(pushSettings) {
  pushSettings = pushSettings || {};
  var settings = pushSettings.apns || {};
  var pushOptions = settings.pushOptions || {};

  if (settings.token) {
    pushOptions.token = pushOptions.token || settings.token;
  }

  // Populate the shared cert/key data
  if (settings.certData) {
    pushOptions.cert = pushOptions.certData || settings.certData;
  }

  if (settings.keyData) {
    pushOptions.key = pushOptions.keyData || settings.keyData;
  }

  // Check the push mode production vs development
  if (settings.production) {
    pushOptions.production = true;
  } else {
    pushOptions.production = false;
  }

  // Keep the options for testing verification
  this._pushOptions = pushOptions;

  this._setupPushConnection(pushOptions);
}

inherits(ApnsProvider, EventEmitter);

exports = module.exports = ApnsProvider;

ApnsProvider.prototype._setupPushConnection = function(options) {
  debug('setting up push connection', options);

  this._connection = new apn.Provider(options);
};

ApnsProvider.prototype.pushNotification = function(notification, deviceToken) {
  return new Promise((resolve, reject) => {
    // Note parameters are described here:
    //   http://bit.ly/apns-notification-payload
    var note = new apn.Notification();
    note.expiry = notification.getTimeToLiveInSecondsFromNow() || note.expiry;
    note.badge = notification.badge;
    note.sound = notification.sound;
    note.alert = notification.alert;
    note.category = notification.category;
    note.contentAvailable = notification.contentAvailable;
    note.urlArgs = notification.urlArgs;
    note.topic = notification.topic;
    note.payload = {};

    Object.keys(notification).forEach(function(key) {
      note.payload[key] = notification[key];
    });

    debug('Pushing notification to %j: %j', deviceToken, note);
    this._connection.send(note, deviceToken)
      .then(response => {
        response.sent.forEach(succeed => {
          debug('Notification Sent to %s', succeed.device);
        });

        response.failed.forEach(failure => {
          if (failure.error) {
            debug('Notification Error to %s: %j', failure.device, failure.error);
          } else {
            debug('Notification Failed to %s: (status = %d) %j', failure.device, failure.status, failure.response);
          }
        });

        return resolve(response);
      });
  });
};
