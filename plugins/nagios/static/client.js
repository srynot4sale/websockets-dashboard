plugins.nagios = {

    html: null,

    start: function() {
        html = ('<div class="plugin" id="nagios"> \
                <h1>Server States</h1> \
                <div class="lastchange"></div> \
                <audio id="audio-critical" src="/plugin/nagios/gong.mp3" type="audio/mpeg" controls></audio> \
                </div>');
        $('div#body').append(html);

        $.getScript(base_url + '/plugin/nagios/jquery.timeago.js');

        // Produce audio alert when a cluster goes critical (red)
        $('#audio-critical').hide();
        var notified = 0;
        window.setInterval(function () {
                var brokencount = $('#nagios h2.Critical').length;
                if (brokencount > 0) {
                    if (brokencount > notified) {
                        console.log('Critical server!');
                        $('#audio-critical')[0].load();  // required for replays
                        $('#audio-critical')[0].play();

                        if ($('.dashboard-fullscreen').length) {
                            transitioner.stop();
                            transitioner.config.toshow = $('.dashboard-fullscreen #nagios');
                            transitioner.plugin_transition();

                            transitioner.start();
                        }
                    }
                    notified = brokencount;
                } else {
                    notified = 0;  // reset the notification
                }
            }, 1000);

    },

    receiveData: function(data) {

        // Check for a single message (is not array?)
        if (!$.isArray(data)) {
            data = [data];
        }

        var container = $('div#nagios');
        var existing = $('li', container).clone();

        // Only care about the newest message
        data = data.pop();

        // Last change
        var lastchange = $('div.lastchange', container);
        if (data['lastchange']) {
            var c = new Date();
            c.setTime(data['lastchange'] * 1000);
            lastchange.html('Last change: '+c.toDateString()+' '+c.toTimeString());
        }

        for (c in data['groups']) {

            var title = c;
            var codes = data['groups'][c];
            var markups = data['markup'][c];

            var group = $('div#'+title, container);
            if (!group.length) {
                var group = $('<div id="'+title+'"><h2>'+title+'</h2><ul></ul></div>');
                $('h1', container).after(group);
            }

            var codelist = $('ul', group);
            codelist.html('');
/**            for (cd in codes) {
                var code = codes[cd];
                codelist.append($('<li>'+cd+': '+code+'</li>'));
            } **/
            if (markups) {
                for (markup in markups) {
                    codelist.append(markups[markup]);
                }
            }

            // Set state
            $('h2', group).attr('class', data['states'][c][0]);

            // Set date state last changed
            // Build date object
            var lc = new Date();
            lc.setTime(data['states'][c][1] * 1000);

            // Delete old abbr tag (timeago plugin doesn't like the time changing)
            $('h2 abbr', group).remove();

            // Create new one
            var abbr = $('<abbr class="timeago"></abbr>').attr('title', lc.toISOString());
            $('h2', group).attr('title', lc.toDateString()+' '+lc.toTimeString());
            $('h2', group).append(abbr);
            abbr.timeago();
        }
    }
}
