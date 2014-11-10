import ConfigParser
import json
import logging
import os
import requests
import time
import urllib

import jenkinsapi
from jenkinsapi.jenkins import Jenkins

CONFIG = {}

def setup_config():
    global CONFIG

    # Load global config file
    path = os.path.join(os.path.dirname(__file__), '../../config.ini')
    con = ConfigParser.ConfigParser()
    con.readfp(open(path))

    host = con.get('general', 'host')
    port = con.get('general', 'port')
    CONFIG['host'] = '%s:%s' % (host, port)

    # Load module config file
    path = os.path.join(os.path.dirname(__file__), 'config.ini')
    con = ConfigParser.ConfigParser()
    con.readfp(open(path))

    CONFIG['jenkins'] = con.get('jenkins', 'host')


# Generic push to dashboard function
def dashboard_push_data(plugin, data, multiple = False):
    global CONFIG

    d = []
    if multiple:
        d.append(('multiple', 1))
        for item in data:
            # escape any nasties
            for i,t in item.iteritems():
                item[i] = html_escape(t)
            j = json.dumps(item)
            d.append(('data', j))
    else:
        # escape any nasties
        for i,t in data.iteritems():
            data[i] = html_escape(t)
        j = json.dumps(data)
        d.append(('data', j))

    r = requests.post('http://%s/update/%s?%s' % (CONFIG['host'], plugin, urllib.urlencode(d)))


def html_escape(text):
    if not isinstance(text, basestring):
        # Not a string
        return text

    html_escape_table = {
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
        ">": "&gt;",
        "<": "&lt;",
    }

    return "".join(html_escape_table.get(c,c) for c in text)

# Main code
def main():
    global CONFIG
    setup_config()

    server = Jenkins(CONFIG['jenkins'])

    #print(dir(j['moodle']))

    jobs = ['moodle', 'totara']

    # Run forever
    while 1:

        try:
            queueitems = []
            for jobname in jobs:
                job = server[jobname]

                # Get queue length
                if job.is_queued():
                    q = server.get_queue()
                    queue = q.get_queue_items_for_job(jobname)
                    for qitem in queue:
                        queueitems.append(qitem.params.replace('\nBRANCH=', ''))

            queue = len(queueitems)
            print('Queue length: %d' % queue)
            if queue:
                print('Queue: %s' % queueitems)

            builddata = []
            for jobname in jobs:
                job = server[jobname]

                print('Job: %s' % jobname)
                print('Is running build: %s' % ('yes' if job.is_running() else 'no'))
                builds = job.get_build_ids()

                bcount = 0
                for bid in builds:
                    bcount += 1
                    if bcount > 10:
                        break

                    build = job.get_build(bid)

                    name = build.name.split(' ')
                    namestr = name[0]
                    if len(name) > 2:
                        namestr = name[2]

                    if build.is_running():
                        status = 'RUNNING'
                    else:
                        status = build.get_status()

                    duration = str(build.get_duration()).split('.')[0]

                    data = {}
                    data['id'] = jobname+'_'+str(bid)
                    data['starttime'] = str(build.get_timestamp())
                    data['sort'] = data['starttime'] + '_' + data['id']
                    data['name'] = namestr
                    data['status'] = status
                    data['duration'] = duration
                    data['href'] = build.get_result_url()

                    # If this build is running, note queue length
                    if status == 'RUNNING':
                        data['queue'] = queue

                    print(data)

                    builddata.append(data)

            dashboard_push_data('jenkins', builddata, True)

        except Exception as e:
            print 'Exceptional exception!'
            logging.exception(e)

        time.sleep(30)

if __name__ == "__main__":
    main()
