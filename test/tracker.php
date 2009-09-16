<?php

$trackingFiles = array(
	'log1.txt',
	'log2.txt'
);

function useIfSet(&$var, $default) {
	return isset($var) ? $var : $default;
}

function removeTrackingFiles() {
	global $trackingFiles;
	
	foreach ($trackingFiles as $fileName) {
		unlink($fileName);
	}
}

function addTrackingEntry() {
	global $trackingFiles;
	
	$url      = useIfSet($_GET['url'],    'Unknown URL');
	$button   = useIfSet($_GET['button'], 'Unknown Button');
	$logFile  = $trackingFiles[ (int)useIfSet($_GET['logfile'], 0) ];
	$redirect = useIfSet($_GET['redirect'], '0') == '1';
	$stamp    = '[' . date('Y-m-d H:i:s') . ']';
	$logMsg   = "$stamp $url (button: $button)\n";
	
	file_put_contents( $logFile, $logMsg, FILE_APPEND );
	
	if ($redirect) {
		header("Location: $url", false, 302);
		exit;
	} else {
		header("HTTP/1.0 204 No Content");
		exit;
	}
}

$action = useIfSet($_GET['action'], '');

switch ($action) {
	case 'reset':
		removeTrackingFiles();
		exit;
	case 'log':
		addTrackingEntry();
		exit;
	default:
		echo 'unknown action';
		exit;
}