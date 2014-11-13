import collections
import ConfigParser
import hashlib
import json
import logging
import os
import requests
import time
import urllib

import pprint

CONFIG = {}

def setup_config():
    global CONFIG

    # Load global config file
    path = os.path.join(os.path.dirname(__file__), '../../config.ini')
    con = ConfigParser.SafeConfigParser()
    con.readfp(open(path))

    host = con.get('general', 'host')
    port = con.get('general', 'port')
    CONFIG['host'] = '%s:%s' % (host, port)

    # Load module config file
    path = os.path.join(os.path.dirname(__file__), 'config.ini')
    con = ConfigParser.SafeConfigParser()
    con.readfp(open(path))

    CONFIG['nagios'] = collections.OrderedDict()
    for title, url in con.items('nagios'):
        CONFIG['nagios'][title.title()] = url


# Generic push to dashboard function
def dashboard_push_data(plugin, data, multiple = False):
    global CONFIG

    d = []
    if multiple:
        d.append(('multiple', 1))
        for item in data:
            # escape any nasties
            for i,t in item.iteritems():
                item[i] = t
            j = json.dumps(item)
            d.append(('data', j))
    else:
        # escape any nasties
        for i,t in data.iteritems():
            data[i] = t
        j = json.dumps(data)
        d.append(('data', j))

    r = requests.post('http://%s/update/%s?%s' % (CONFIG['host'], plugin, urllib.urlencode(d)))


# Main code
def main():
    global CONFIG
    setup_config()

    STATE = collections.OrderedDict()
    STATE['pending'] = 1
    STATE['ok'] = 2
    STATE['warning'] = 4
    STATE['unknown'] = 8
    STATE['critical'] = 16

    reversed_states = STATE.keys()
    reversed_states.reverse()

    lasthash = ''
    laststates = {}

    # Run forever
    while 1:
        try:

            codes = collections.OrderedDict()
            states = {}

            for servername in CONFIG['nagios']:
                server = CONFIG['nagios'][servername]

                # Get status overview
                maxstate = 'ok';
                sstates = {}
                group = {}
                try:
                    overview = requests.get(server, verify=False)

                    # Get members and loop through
                    members = overview.json()['status']['hostgroup_overview'][0]['members']
                    for member in members:
                        mserver = member['host_name']
                        for sstatus in member:
                            if not sstatus.startswith('services_status_'):
                                continue

                            if member[sstatus] > 0:
                                state = sstatus[16:]

                                if state == 'ok':
                                    continue

                                if state not in sstates.keys():
                                    sstates[state] = []

                                sstates[state].append(mserver)


                except requests.exceptions.RequestException:
                    logging.exception('Failed to get status overview')
                    maxstate = STATE['unknown']

                # Get server notices if any
                if sstates:
                    for state in sstates:
                        group[state] = []

                        # Check each member
                        for member in sstates[state]:
                            moverview_url = '%s&host=%s&servicestatustypes=%d' % (server, member, STATE[state])
                            moverview = requests.get(moverview_url, verify=False)

                            checks = moverview.json()['status']['service_status']
                            for check in checks:
                                gc = {}
                                gc['server'] = member
                                gc['service'] = check['service']
                                gc['duration'] = check['duration']
                                gc['downtimed'] = check['in_scheduled_downtime']
                                group[state].append(gc)

                                if not gc['downtimed']:
                                    if STATE[state] > STATE[maxstate]:
                                        maxstate = state

                if servername not in laststates.keys() or laststates[servername][0] != maxstate:
                    timechanged = int(time.time())
                else:
                    timechanged = laststates[servername][1]

                states[servername] = [maxstate, timechanged]

                # Re-order states for display purposes
                codes[servername] = collections.OrderedDict()
                for state in reversed_states:
                    if state in group.keys():
                        codes[servername][state] = group[state]

            print json.dumps(states)
            print json.dumps(codes)

            newhash = hashlib.md5(str(codes) + str(states)).hexdigest()

            if newhash != lasthash:
                print 'Update sent'
                dashboard_push_data('nagios', {'lastchange': time.time(), 'groups': codes, 'states': states})

            lasthash = newhash
            laststates = states

        except Exception as e:
            logging.exception('Exceptional exception')

        time.sleep(30)

if __name__ == "__main__":
    main()
