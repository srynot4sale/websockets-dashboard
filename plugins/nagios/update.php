<?php

require_once(dirname(dirname(__FILE__)).'/lib.php');
require_once(dirname(__FILE__).'/config.php');

/**
 * Expects config to look similar to:

<?php

$config = new stdClass();
$config->groups = array();
$config->groups['groupname'] = 'https://username:password@server/cgi-bin/nagios3/status.cgi?hostgroup=all';

 */


// Verbose
function debug($message) {
    global $config;
    if (!empty($config->verbose)) {
        echo "$message\n";
    }
}

// Last dataset hash
$lasthash = '';
$lastcodes = array();
$laststates = array();

define('STATE_OK',          'OK');
define('STATE_WARNING',     'Warning');
define('STATE_UNKNOWN',     'Unknown');
define('STATE_CRITICAL',    'Critical');

while (1) {

    print "API call\n";

    $codes = array();
    $states = array();
    $details = array();
    foreach ($config->groups as $name => $url) {

        $data = array();
        $markup = array();
        $group = array();
        debug("CURL: $url");
        exec("curl -s --insecure $url | grep serviceTotalsO -A 3 | awk -F'[>|<]' '{ print $3 }'", $data);
        $state = 0;

        $types = array(STATE_OK, STATE_WARNING, STATE_UNKNOWN, STATE_CRITICAL);

        if (is_array($data) && count($data)) {
            foreach ($data as $i => $row) {
                $group[$types[$i]] = $row;

                if ($row) {
                    $state = max($state, $i);
                }
            }

            $state = $types[$state];
        } else {
            // If no data supplied, critical
            debug("No data received!");
            $state = STATE_CRITICAL;
        }

        debug("State: $state");

        // Loop over groups grabbing more details if required
        if (is_array($data) && count($data)) {
            foreach ($group as $t => $c) {
                if ($t == STATE_OK || !$c) {
                    continue;
                }

                $ids = array(STATE_WARNING => 4, STATE_UNKNOWN => 8, STATE_CRITICAL => 16);
                $gdata = array();
                $gurl = $url . "\&style=detail\&servicestatustypes=" . $ids[$t] . "\&hoststatustypes=15";

                exec("curl -s --insecure $gurl", $gdata);
                $gdata = implode("\n", $gdata);

                $start = strpos($gdata, '<TABLE BORDER=0 width=100% CLASS=\'status\'>');
                $finish = strpos($gdata, '</body>');

                $markup[$t] = substr($gdata, $start, $finish - $start);
                debug($markup[$t]);
            }
        }

        // Check when state last changed
        if (!in_array($name, array_keys($laststates)) || $laststates[$name][0] !== $state) {
            $timechanged = time();
        } else {
            $timechanged = $laststates[$name][1];
        }

        $states[$name] = array($state, $timechanged);
        $codes[$name] = $group;
        $details[$name] = $markup;
    }

    $newhash = md5(serialize($codes) . serialize($states));

    if ($newhash != $lasthash) {
        print "Update sent\n";
        dashboard_push_data('nagios', array('lastchange' => time(), 'groups' => $codes, 'states' => $states, 'markup' => $details));
    }

    $lasthash = $newhash;
    $lastcodes = $codes;
    $laststates = $states;

    print "Sleeping...\n";
    sleep(30);
}
