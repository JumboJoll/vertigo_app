// (c) 2014 Don Coleman
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* global mainPage, deviceList, refreshButton */
/* global detailPage, resultDiv, messageInput, sendButton, disconnectButton */
/* global ble, cordova  */
/* jshint browser: true , devel: true*/
'use strict';

// ASCII only
function bytesToString(buffer) {
    return String.fromCharCode.apply(null, new Uint8Array(buffer));
}

// ASCII only
function stringToBytes(string) {
    var array = new Uint8Array(string.length);
    for (var i = 0, l = string.length; i < l; i++) {
        array[i] = string.charCodeAt(i);
    }
    return array.buffer;
}

// this is RedBear Lab's UART service
var redbear = {
    serviceUUID: "713D0000-503E-4C75-BA94-3148F18D941E",
    txCharacteristic: "713D0003-503E-4C75-BA94-3148F18D941E", // transmit is from the phone's perspective
    rxCharacteristic: "713D0002-503E-4C75-BA94-3148F18D941E", // receive is from the phone's perspective
    TX_UUID_DESCRIPTOR : '00002902-0000-1000-8000-00805f9b34fb'
};

var app = {
    initialize: function() {
        app.bindEvents();
        app.connected = false;
        app.device = null;
    },
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        $('#scan-button')[0].addEventListener('click', this.refreshDeviceList, false);
        $('#disconnect-button')[0].addEventListener('click', this.disconnect, false);
        $('#device-ul')[0].addEventListener('click', this.connect, false);
        $('#start-button')[0].addEventListener('click', this.startReading, false);
    },
    onDeviceReady: function() {
        //app.refreshDeviceList()
    },
    refreshDeviceList: function() {
        console.log("Starting device search");
        $('#device-ul').empty();
        evothings.ble.stopScan();
        evothings.ble.startScan(app.onDiscoverDevice, app.onError);//, {serviceUUIDs : [redbear.serviceUUID]});
    },
    onDiscoverDevice: function(device) {
        console.log("Found Device: " + device.name);
        if (device.name != null) {
            var device_dom = $('<li><b>' + device.name + '</b><br/>' +
                'RSSI: ' + device.rssi + '&nbsp;|&nbsp;' +
                device.address+'</li>');
            device_dom[0].dataset.device = device;

            $('#device-ul').append(device_dom);
        }
    },
    connect: function(e) {
        var device = e.target.dataset.device;
        evothings.ble.stopScan(function(){console.log('Stopped Scanning'), app.onError});
        
        function onConnect(device){
            console.log('Connected to ' + device.name);
            app.connected = true;
            app.device = device;

            evothings.ble.writeDescriptor(
                device,
                redbear.RBL_TX_UUID_DESCRIPTOR,
                new Uint8Array([1,0]),
                app.showConnectedPage,
                function(errorCode){
                     // Disconnect and give user feedback.
                     app.disconnect('Failed to set descriptor.');

                     // Write debug information to console.
                     console.log('Error: writeDescriptor: ' + errorCode + '.');
                }
            );

            evothings.ble.enableNotification(
                device,
                redbear.rxCharacteristic,
                app.onData,
                app.onError
            );

            // Connect to the appropriate BLE service
            //device.readServices(
            //    [redbear.serviceUUID],
            //    onServiceSuccess,
            //   onServiceFailure
            //);
        };
        
        evothings.ble.connect(device, onConnect, app.onError);
        
    },
    onData: function(data) { // data received from Arduino
        var raw_input = new Uint8Array(data);
        var number = (raw_input[1] << 8) | raw_input[2];
        console.log(number);
        $('#testing').innerHTML = number;
    },
    sendData: function(data) { // send data to Arduino
        if (app.connected)
        {
            function onMessageSendSucces()
            {
                console.log('Succeded to send message.');
            }
    
            function onMessageSendFailure(errorCode)
            {
                console.log('Failed to send data with error: ' + errorCode);
                app.disconnect('Failed to send data');
            }
    
            data = new Uint8Array(data);
    
            app.device.writeCharacteristic(
                app.RBL_CHAR_RX_UUID,
                data,
                onMessageSendSucces,
                onMessageSendFailure
            );
        }
        else
        {
            // Disconnect and show an error message to the user.
            app.disconnect('Disconnected');
    
            // Write debug information to console
            console.log('Error - No device connected.');
        }
    },
    startReading : function() {
        if (app.connected) 
        {
            console.log("Trying to start data collection to " + app.device.name)
            var success = function() {
                console.log("Sent data to start readings");
            };
    
            var failure = function() {
                alert("Failed writing data to the redbear hardware");
            };
    
            data = new Uint8Array([0xA0,0x00,0x00]);
            evothings.ble.writeCharacteristic(app.device, redbear.txCharacteristic, data.buffer, success, failure);

        } else {
            console.log("Not connected to device")
        }
    },
    disconnect: function(event) {
        console.log("Disconnecting")
        var success = function() {
            app.connected = false;
            app.device = null;
            app.showHomePage();
        };
        ble.disconnect(app.device, success, app.onError);
    },
    showHomePage: function() {
        $('#device-ul').empty();
        $.mobile.navigate( "#home" );
    },
    showConnectedPage: function() {
        $.mobile.navigate( "#connected" );
    },
    onError: function(reason) {
        console.log("ERROR: " + reason)
        alert("ERROR: " + reason); // real apps should use notification.alert
    }
};
