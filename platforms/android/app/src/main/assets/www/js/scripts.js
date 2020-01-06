
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
    txCharacteristic: "713D0002-503E-4C75-BA94-3148F18D941E",
    rxCharacteristic: "713D0003-503E-4C75-BA94-3148F18D941E",
    txDescriptor: "00002902-0000-1000-8000-00805F9B34FB"
};

var app = {
    initialize: function() {
        app.bindEvents();
        app.connected = false;
        app.device = null;
        app.analog_enabled = false;
        app.foundDevices = {};
        app.readings = [];
        app.display = [];
    },
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        $('#scan-button')[0].addEventListener('click', this.refreshDeviceList, false);
        $('#disconnect-button')[0].addEventListener('click', this.disconnect, false);
        $('#device-ul')[0].addEventListener('click', this.connect, false);
        $('#start-button')[0].addEventListener('click', this.toggleAnalog, false);
    },
    onDeviceReady: function() {
        //app.refreshDeviceList()
        $('#EOG-chart').CanvasJSChart({
            title: {
                text: "EOG Readings"
            },
            axisY : {
                inlcudeZero: false
            },
            data: [{
                type: "splineArea",
                dataPoints: app.display
            }
            ]
        })
    },
    refreshDeviceList: function() {
        console.log("Starting device search");
        $('#device-ul').empty();
        app.foundDevices = {};
        evothings.easyble.reportDeviceOnce(true);
	    evothings.easyble.startScan([redbear.serviceUUID], app.onDiscoverDevice, app.onError);
    },
    onDiscoverDevice: function(device) {
        console.log("Found Device: " + device.name);
        if (device.name != null) {
            var device_dom = $('<li><b>' + device.name + '</b><br/>' +
                'RSSI: ' + device.rssi + '&nbsp;|&nbsp;' +
                device.address+'</li>');
            device_dom[0].dataset.serviceUUID = device.address;
            app.foundDevices[device.address] = device;
            $('#device-ul').append(device_dom);
        }
    },
    connect: function(e) {
        var deviceUUID = e.target.dataset.serviceUUID;
        evothings.easyble.stopScan();
        
        function onConnect(device){
            function onServiceSuccess(device) {
                console.log('Connected to ' + device.name);
                // Helpful for showing services and descriptor UUIDs 
                //$.each(device.__uuidMap, function(key, data) {
                //    console.log(key + ' -> ' + data);
                //});
                app.connected = true;
                app.device = device;
                $('#device-name').text(device.name);
                app.device.writeDescriptor(
                    redbear.txCharacteristic,
                    redbear.txDescriptor,
                    new Uint8Array([1,0]),
                    app.showConnectedPage,
                    app.onError
                );
    
                app.device.enableNotification(
                    redbear.txCharacteristic,
                    app.onData,
                    app.onError
                );
            };
            
            // Connect to the appropriate BLE service
            device.readServices(
                [redbear.serviceUUID],
                onServiceSuccess,
                app.onError
            );
        };
        
        app.foundDevices[deviceUUID].connect(onConnect, app.onError);
        
    },
    onData: function(data) { // data received from Arduino
        var raw_input = new Uint8Array(data);
        var number = (raw_input[1] << 8) | raw_input[2];
        $('#testing').text(number);
        app.readings.push({
            x: app.readings.length+1,
            y: number
        });
        app.renderChart();
    },
    renderChart: function() {
        var MAX_READINGS = 100;
        var num_readings = app.readings.length;
        var chart =  $('#EOG-chart').CanvasJSChart();
        if (num_readings > MAX_READINGS) {
            chart.options.data[0].dataPoints = app.readings.slice(num_readings-MAX_READINGS)
        } else {
            chart.options.data[0].dataPoints = app.readings
        }
        chart.render();
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
                redbear.rxCharacteristic,
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
    toggleAnalog : function() {
        if (app.analog_enabled)
        {
            app.analog_enabled = false;
            app.sendData([0xA0,0x00,0x00]);
            $('#start-button').text('Start');
        }
        else
        {
            app.analog_enabled = true;
            app.sendData([0xA0,0x01,0x00]);
            $('#start-button').text('Stop');
        }
    },
    disconnect: function(event) {
        console.log("Disconnecting")
        evothings.easyble.closeConnectedDevices();
        app.connected = false;
        app.analog_enabled = false;
        app.attacking = false;
        app.device = null;
        app.showHomePage();
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
