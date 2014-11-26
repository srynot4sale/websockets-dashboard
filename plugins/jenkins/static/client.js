plugins.jenkins = {

    html: null,

    start: function() {
        html = ('<div class="plugin" id="jenkins"><h1>Jenkins Builds</h1><div class="fader"></div><ol></ol></div>');
        $('div#body').append(html);
    },

    queue: 0,

    receiveData: function(data) {

        var container = $('div#jenkins ol');
        container.html('');

        // update builds
        for (c in data[0].builds) {
            var content = data[0].builds[c];

            if (content == 1) {
                // Ignore (this is a placeholder)
                continue;
            }

            var id = 'build-'+content.id;
            var status = content.status;
            var statusclass = 'status-'+status;
            var name = content.name;
            var duration = status == 'RUNNING' ? 'RUNNING' : content.duration;
            var href = content.url;

            var link = $('<a>').attr('href', href).html(name);
            var dur = $('<span class="duration">').html(duration);

            var node = $('<li data-sort="'+content.sort+'">').attr('id', id).attr('class', statusclass).data('buildid', content.id).data('sort', content.sort);
            node.html(link).append(dur);
            node.hide();

            container.append(node);

            node.fadeIn(1000);
        }


        // Update queue
        queue = data[0].queue
        var qcontainer = $('div#jenkins h1 span.queue');
        if (!qcontainer.length) {
            qcontainer = $('<span class="queue"></span>');
            $('div#jenkins h1').append(qcontainer);
        }

        if (queue.count == 0) {
            qcontainer.text('');
        } else if (queue.count == 1) {
            qcontainer.text('[1 build in queue: '+queue.items[0]+']');
        } else {
            qcontainer.text('['+queue.count+' builds in queue - next: '+queue.items[0]+']');
        }
    }
}
