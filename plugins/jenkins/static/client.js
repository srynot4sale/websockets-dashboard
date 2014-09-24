plugins.jenkins = {

    html: null,

    start: function() {
        html = ('<div class="plugin" id="jenkins"><h1>Jenkins Builds</h1><div class="fader"></div><ol></ol></div>');
        $('div#body').append(html);
    },

    queue: 0,

    receiveData: function(data) {

        // Check for a single message (is not array?)
        if (!$.isArray(data)) {
            data = [data];
        }

        var container = $('div#jenkins ol');

        // Save old queue count for comparison later
        var oldqueue = this.queue;
        this.queue = 0;

        for (c in data) {
            var content = data[c];

            if (content == 1) {
                // Ignore (this is a placeholder)
                continue;
            }

            var id = 'build-'+content.id;
            var status = content.status;
            var statusclass = 'status-'+status;
            var name = content.name;
            var duration = content.duration;
            var href = content.href;

            if (status == 'RUNNING') {
                duration = status;

                // Update queue count (only running jobs have a queue property)
                this.queue = content.queue;
            }

            var link = $('<a>').attr('href', href).html(name);
            var dur = $('<span class="duration">').html(duration);

            var node = $('<li data-sort="'+content.sort+'">').attr('id', id).attr('class', statusclass).data('buildid', content.id).data('sort', content.sort);
            node.html(link).append(dur);
            node.hide();

            // Check if this is an update (as the previous build already exists)
            var exists = $('li#'+id, container);
            if (exists.length) {
                if (exists.attr('class') !== statusclass || status == 'RUNNING') {
                    console.log('replace');
                    exists.replaceWith(node);
                    node.show();
                }
                else {
                    console.log('no change');
                }

                continue;
            }

            // Find the next highest build time and add after that
            var buildsort = content.sort;
            var next = null;
            var nextid = null;
            $('li', container).each(function() {
                var check = $(this).data('sort');
                if (check > buildsort) {
                    if (next) {
                        if (next > check) {
                            next = check;
                            nextid = $(this).data('buildid');
                        }
                    } else {
                        next = check;
                        nextid = $(this).data('buildid');
                    }
                }
            });

            if (next) {
                // If found next highest, append after
                $('li#build-'+nextid, container).after(node);
            } else {
                // Otherwise is highest, add to top
                container.prepend(node);
            }

            node.fadeIn(1000);
        }

        if ($('li', container).length > 30) {
            $('li:last', container).slideUp().remove();
        }

        // If queue length has changed, update it
        if (oldqueue != this.queue) {
            console.log('Update queue');

            // Update queue
            var qcontainer = $('div#jenkins h1 span.queue');
            if (!qcontainer.length) {
                qcontainer = $('<span class="queue"></span>');
                $('div#jenkins h1').append(qcontainer);
            }

            if (this.queue == 0) {
                qcontainer.text('');
            } else if (this.queue == 1) {
                qcontainer.text('['+this.queue+' build in queue]');
            } else {
                qcontainer.text('['+this.queue+' builds in queue]');
            }
        }
    }
}
