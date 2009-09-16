<?php

$trackingFile = 'log.txt';

function useIfSet(&$var, $default) {
	return isset($var) ? $var : $default;
}

function removeTrackingFiles() {
	global $trackingFile;
	unlink($trackingFile);
}

function addTrackingEntry() {
	global $trackingFile;
	
	$url      = useIfSet($_GET['url'], 'Unknown URL');
	$button   = useIfSet($_GET['button'], 'Unknown Button');
	$redirect = useIfSet($_GET['redirect'], '0') == '1';
	$isRedir  = $redirect ? '1' : '0';
	$logRef   = useIfSet($_GET['logref'], '0');
	$logMsg   = "[#$logRef] $url (button: $button, redirect: $isRedir)\n";
	
	file_put_contents( $trackingFile, $logMsg, FILE_APPEND );
	
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