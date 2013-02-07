// Copyright 2009 FriendFeed
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

var plugins = {};

$(document).ready(function() {
    if (!window.console) window.console = {};
    if (!window.console.log) window.console.log = function() {};

    // Set the name of the hidden property
    updater.config.hidden = false;
    var h = ['hidden', 'mozHidden', 'msHidden', 'webkitHidden'];
    for (var i = 0; i < h.length; i++) {
        if (typeof document[h[i]] !== "undefined") {
            updater.config.hidden = h[i];
            break;
        }
    }

    for (p in plugins) {
        plugin = plugins[p];
        console.log('Start plugin '+p);
        plugin.start();
    }

    updater.start();

    // add listener for view toggle
    $('#view-toggler').click(function (e) {
        if (!$('body').hasClass('dashboard-fullscreen')) {
            $('body').addClass('dashboard-fullscreen');

            transitioner.init();
            transitioner.add_listeners();
        } else {
            transitioner.stop();
            transitioner.remove_listeners();

            $('body').removeClass('dashboard-fullscreen');

            // show all plugins
            $('div.plugin').show();
        }
    });
});

// Plugin transitioner
var transitioner = {
    config: {
        tdelay: 10000,  // delay between transitions
        edelay: 1000,   // effect delay (cannot be more than tdelay!)
        interval: 0,
        paused: 0,
        firstplugin: null,
        lastplugin: null,
        toshow: null // plugin to show
    },

    init: function() {
        var obj = this;

        // hide all plugins
        $('.dashboard-fullscreen div.plugin').hide();

        obj.config.firstplugin = $('.dashboard-fullscreen div.plugin:first');
        obj.config.lastplugin = $('.dashboard-fullscreen div.plugin:last');

        // show the first plugin immediately
        obj.config.firstplugin.fadeIn(obj.config.edelay);

        // start on interval (if more than one plugin)
        if (obj.config.firstplugin.next().length) {
            obj.config.toshow = obj.config.firstplugin.next();
            obj.start();
        } else {
            obj.config.toshow = obj.config.firstplugin;
        }
    },

    add_listeners: function() {
        var obj = this;

        // add keyboard listeners
        $('body.dashboard-fullscreen').keydown(function (e) {
            if (e.which == 32) {  // spacebar for pause
                obj.config.paused = !obj.config.paused;
                if (obj.config.paused) {
                    obj.stop();
                    $('.footer-center').append('<p id="transitioner-paused-indicator">Paused</p>');
                    $('#transitioner-paused-indicator').effect("pulsate", { times:77 }, 77777);
                } else {
                    $('#transitioner-paused-indicator').remove();
                    obj.start();
                }
            } else {
                // any other keypress should unpause
                $('#transitioner-paused-indicator').remove();
                obj.config.paused = 0;
            }

            if (e.which == 39) {  // rigth arrow
                //  stop transitioner temporarily
                obj.stop();

                // call transition manually
                obj.plugin_transition();

                // start transitioner
                obj.start();
            } else if (e.which == 37) {  // left arrow
                //  stop transitioner temporarily
                obj.stop();

                // call transition manually
                obj.config.toshow = obj.get_prev();
                obj.plugin_transition();

                // start transitioner
                obj.start();
            }
        });
    },

    remove_listeners: function() {
        $('body.dashboard-fullscreen').off('keydown');
    },

    // show the current plugin and set next one to show
    plugin_transition: function() {
        var obj = this;

        // hide all plugins
        $('.dashboard-fullscreen div.plugin').hide();

        // show current plugin
        obj.config.toshow.fadeIn(obj.config.edelay);

        // set next plugin to show
        obj.config.toshow = obj.get_next();
    },

    get_next: function() {
        var next = this.config.toshow.next();

        if (next.length) {
            return next;
        } else {
            // wrap around :D
            return this.config.firstplugin;
        }
    },

    get_prev: function() {
        var prev = this.config.toshow.prev().prev();  // we need to go back 2 as toshow is the next one

        if (prev.length) {
            return prev;
        } else if (this.config.toshow == this.config.firstplugin) {
            // little hack to get wrapping to work
            return this.config.lastplugin.prev();
        } else {
            // wrap around :D
            return this.config.lastplugin;
        }
    },

    stop: function() {
        var obj = this;

        // remove the transitioning interval
        clearInterval(obj.config.interval);
        obj.config.interval = 0;
    },

    start: function() {
        var obj = this;

        // add new interval (if more than one plugin)
        if (obj.config.firstplugin.next().length) {
            tinterval = obj.config.tdelay + obj.config.edelay;
            obj.config.interval = setInterval(function() {obj.plugin_transition();}, obj.config.tdelay);
        }
    }
}

// Websocket handler
var updater = {
    config: {},
    socket: null,

    start: function() {
        // Create websocket
        var url = "ws://" + location.host + "/chatsocket";
        if ("WebSocket" in window) {
            updater.socket = new WebSocket(url);
        } else {
            updater.socket = new MozWebSocket(url);
        }

        // On websocket message receive
        updater.socket.onmessage = function(event) {
            // Get data
            var data = JSON.parse(event.data);

            // Loop through messages
            updater.routeMessage(data);
        };

        // On websocket close
        updater.socket.onclose = function() {
            $('body').prepend($('<div class="error">Connection lost, please refresh browser</div>'));
        };
    },

    // Route received message
    routeMessage: function(data) {
        // Get data
        var plugin = $(data.html).data('plugin');
        var content = $(data.html).text();

        if (!plugins[plugin]) {
            return;
        }

        // Check if dashboard is not hidden, or if it is that it supports background data
        if (!document[updater.config.hidden] || updater.pluginSupportsBackgroundData(plugin)) {
            // Push to plugin
            console.log('Data received for '+plugin+' plugin');
            plugins[plugin].receiveData(jQuery.parseJSON(content));
        }
    },

    // Check plugin supports receiving background data
    pluginSupportsBackgroundData: function(plugin) {
        return typeof plugins[plugin].noBackgroundData === "undefined";
    }
};

var videoElement = document.getElementById("videoElement");
