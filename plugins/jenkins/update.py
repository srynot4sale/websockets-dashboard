import os
import urllib2
import requests
import json
import time
import ConfigParser
import logging
import datetime


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

    CONFIG['apiurl'] = con.get('jenkins', 'apiurl')
    CONFIG['buildcount'] = int(con.get('general', 'buildcount'))


# Generic push to dashboard function
def dashboard_push_data(plugin, data):
    global CONFIG

    data = [('data', json.dumps(data))]
    print "push!"
    print data
    r = requests.post('http://%s/update/%s' % (CONFIG['host'], plugin), data=data)


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


def main():
    global CONFIG
    setup_config()

    url = CONFIG['apiurl']

    while 1:
        try:
            response = json.load(urllib2.urlopen(url))

            jobs = {}
            queue = []
            for job in response['jobs']:
                if job['inQueue']:
                    queue.append(job['name'])

                if not job['lastBuild']:
                    continue

                latestbuild = job['lastBuild']
                duration = 0
                if latestbuild['duration']:
                    duration = str(datetime.timedelta(seconds=int(latestbuild['duration']/1000)))
                jobs[latestbuild['timestamp']] = {
                    'id': latestbuild['fullDisplayName'],
                    'timestamp': latestbuild['timestamp'],
                    'name': html_escape(latestbuild['fullDisplayName']),
                    'duration': duration,
                    'status': (latestbuild['building'] and 'RUNNING' or latestbuild['result']),
                    'url': latestbuild['url']
                }

            count = 0
            latestbuilds = []
            for timestamp in sorted(jobs, reverse=True):
                latestbuilds.append(jobs[timestamp])
                count = count + 1
                if count > CONFIG['buildcount']:
                    break;

            # push, push push!
            dashboard_push_data('jenkins', {'builds': latestbuilds, 'queue': {'count': len(queue), 'items': queue}})

        except Exception as e:
            print 'Exceptional exception!'
            logging.exception(e)

        time.sleep(30)

if __name__ == "__main__":
    main()

