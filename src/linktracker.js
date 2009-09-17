/**
@name tracking
@namespace
@version 0.0.1
@description Tracks clicks on the page and informs a server.
	Create an instance of {@link tracking.init} to begin tracking.
*/

var tracking = (function() {
	// anything attached to 'tracking' will be public
	var tracking = {},
		buttons = ['left', 'middle', 'right'],
		defaultProtocols = ['http', 'https', 'ftp'],
		// get the protocol, host+port, path+search of a url
		urlParser = /^([^:]+):\/{0,2}([^\/]*)([^#]*)/;
	
	/**
	@name tracking.LinkTracker
	@class
	@description Tracks and logs links that are clicked on the page
	
	@param {Function} buildUrl Function called when a link is clicked.
		This function must return either a tracking url, or false (no tracking will
		be performed).
		
		The function will be passed 3 parameters in the following order
		
		linkElm  - The link element that was clicked
		
		button   - This will be 'left', 'middle', 'right' or 'key'. The first
				   3 refer to mouse buttons, 'key' means the keyboard was used
				   to activate the link
				  
		redirect - If this is true, the returned url must redirect to the url
				   you're tracking. If false, you can optimise for the user
				   by building a url that returns an empty 204
		
	@param {Object} [opts] Options The following setting are optional
		@param {Element} [opts.container=document] An HTML element to restrict tracking to
		@param {Boolean} [opts.trackRightClicks=false] Should right clicks be tracked?
			This will track any right click on a link, regardless of whether the
			user follows the link or not. Because of this, tracking right clicks
			is unreliable and likely to give false positive results.
		@param {Boolean} [opts.trackMiddleClicks=true] Should middle clicks be tracked?
			Middle clicks open links in a background tab in the majority of browsers
			that support tabbed browsing. If this option is true, each middle click
			on links will be tracked.
		@param {Number} [opts.trackingLevel=0] What kind of links should be tracked?
			0 - Track only links to external urls
			1 - Track external links & links pointing the same host & port
			    as the current page
			2 - Track all links, including those pointing to anchors / ids
			    within the current page
		@param {String[]} [opts.protocols] Which protocols should be logged?
			By default, the following protocols are logged: ['http', 'https', 'ftp']
	
	@example
		function createTrackingLink(linkElm, button, redirect) {
			return 'http://www.bbc.co.uk/mytracker.php?url='
				+ encodeURIComponent(linkElm.href)
				+ '&redirect=' + (redirect-0)
				+ '&button=' + button;
		}
		new tracking.LinkTracker(createTrackingLink, {
			container: document.getElementById('relatedLinks')
		});
	*/
	/* 'private' properties:
	  
	  _o - options object populated with defaults + settings from constructor
	  _mUpElm - the last elm mouseup picked up
	  _mUpBtn - the last mouse buttons used in mouseup
	  _isKey - the last action before clickListener was a key action (1/0)
	  _bUrl - the function to build the tracking url
	  _p - a space separated string representing the protocols to track, with a space and the start & end
	  
	*/
	tracking.LinkTracker = function(buildUrl, options) {
		if ( !(this instanceof tracking.LinkTracker) ) {
			return new tracking.LinkTracker(buildUrl, options);
		}
		this._bUrl = buildUrl;
		
		// merge opts with defaults
		options = this._o = setDefaultOpts( options || {} );
		
		// protocols to track
		this._p = ' ' + options.protocols.join(' ') + ' ';
		
		// assign listeners
		addListener(options.container, 'keyup',   keyupListener,   this);
		addListener(options.container, 'click',   clickListener,   this);
		addListener(options.container, 'mouseup', mouseupListener, this);
		// assign unload cleanup for IE
	}
	
	// called when a key is released
	function keyupListener() {
		//manualTests.log('key');
		// clear mouse click details - the next click may come from keyboard
		this._isKey = 1;
	}
	
	// called when an element is click'd
	// we use click as it also captures links activated by keyboard.
	// Some browsers also fire a click for right & middle clicks,
	// however, this is inconsistent so we handle those separately
	function clickListener(event) {
		// manualTests.log('click');
		// normalise event object for IE
		event = event || window.event;
		
		// convert the button to 'left', 'middle', 'right' or 'key'
		var button = this._isKey ? 'key' : buttons[this._mUpBtn],
			linkElm,
			trackUrl,
			trackingType,
			resetFunction,
			originalHref;
		
		// bail if the last action wasn't a key or left click
		if ( !(this._isKey || this._mUpBtn === 0) ) { return; }
		
		// get the link element for this event
		linkElm = getParentLinkFor(event.target || event.srcElement)
		
		// if we haven't clicked on a link, exit
		if (!linkElm) { return;	}
		
		// look at the url to see how we should track it
		trackingType = getTrackingType(this, linkElm.href);
		if (!trackingType) { return; }
		
		// get new url
		trackUrl = this._bUrl(linkElm, button, true);
		originalHref = attr(linkElm, 'href');
		
		resetFunction = function() {
			if (linkElm) {
				attr(linkElm, 'href', originalHref);
				linkElm._rewritten = 0;
			}
			resetFunction = undefined;
		}
		
		// if newUrl is false, don't track
		if (trackUrl) {
			if (trackingType == 2) {
				makeRequest(trackUrl);
			}
			else if (!linkElm._rewritten) {
				// replace the current link
				linkElm.href = trackUrl;
				linkElm._rewritten = 1;
				setTimeout(resetFunction, 100);
			}
		}
	}
	
	// called when an element is mouseup'd
	function mouseupListener(event) {
		//manualTests.log('up');
		// normalise event object for IE
		event = event || window.event;
		
		var linkElm,
			button = this._mUpBtn = tracking.isIe ? (event.button & 1 ? 0 : event.button & 2 ? 2 : 1) : event.button,
			source = this._mUpElm = event.target || event.srcElement,
			opts = this._o,
			trackUrl;
		
		// this isn't a key event
		this._isKey = 0;
		
		// need to look at the button pressed
		// if the left button was pressed, or we're not listening for the button clicked, exit
		if ( button === 0 || (button == 1 && !opts.trackMiddleClicks) || (button == 2 && !opts.trackRightClicks) ) {
			// exit, we're not wanting to track this click
			return;
		}
		
		// get the link element that's been clicked
		linkElm = getParentLinkFor(source);
		// if we haven't clicked on a link, exit
		if (!linkElm) { return; }
		
		// look at the url to see how we should track it
		if ( !getTrackingType(this, linkElm.href) ) { return; }
		
		// get tracking url
		trackUrl = this._bUrl(linkElm, buttons[button], false);
		
		// if we've got a url and we should be tracking it, go!
		if ( trackUrl ) {
			makeRequest(trackUrl);
		}
	}
	
	// Show should we track this url? Returns:
	// 0 - Don't track
	// 1 - Track, sync or async (depending on mouse button used)
	// 2 - Track, async (is an internal page link)
	function getTrackingType(linkTracker, url) {
		var loc           = location,
			urlParts      = urlParser.exec(url),
			protocol      = urlParts[1],
			host          = urlParts[2],
			request       = urlParts[3],
			thisProtocol  = loc.protocol.slice(0,-1),
			isHttpOrHttps = thisProtocol == 'http' || thisProtocol == 'https',
			isThisHost    = thisProtocol == protocol && loc.host == host,
			isThisPage    = isThisHost && (loc.pathname + loc.search) == request,
			trackingLevel = linkTracker._o.trackingLevel;
		
		if (
			// not tracking this protocol?
			(linkTracker._p.indexOf(' ' + protocol + ' ') == -1)
			// not tracking this host?
			|| (isHttpOrHttps && isThisHost && trackingLevel < 1)
			// not tracking this page?
			|| (isHttpOrHttps && isThisPage && trackingLevel < 2)
		) {
			return 0;
		}
		
		// pages to somewhere within this page should be tracked async
		return isThisPage ? 2 : 1;
	}
	
	// get / set attributes
	// val is optional, current value will be returned if ommited
	function attr(elm, attrName, val) {
		if (typeof val == 'undefined') {
			if (tracking.isIe) {
				try {
					return elm.getAttribute(attrName, 2)
				} catch (e) {}
			}
			return elm.getAttribute(attrName);
		}
		elm.setAttribute(attrName, val);
	}
	
	// make an async request 
	function makeRequest(url) {
		// TODO: check for memory leaks
		new Image().src = url;
	}
	
	// gets the parent link element for an element, or returns null
	function getParentLinkFor(elm) {
		// TODO: limit this to x parent elements?
		if (elm) {
			do {
				if (elm.nodeName.toLowerCase() == 'a') {
					return elm;
				}
			} while (elm = elm.parentNode);
		}
		return null;
	}
	
	// add an event listener to a particular element
	// context is what 'this' is in the callback, is optional
	function addListener(elm, name, callback, context) {
		var onname = 'on' + name,
			oldFunc;
		
		function callCallback() {
			return callback.apply(context || this, arguments);
		}
		
		if (elm.addEventListener) {
			elm.addEventListener(name, callCallback, false);
		}
		else if (elm.attachEvent) {
			elm.attachEvent(onname, callCallback);
		}
		else {
			oldFunc = elm[onname] || new Function;
			elm['on' + name] = wrapFunction(oldFunc, callCallback);
		}
	}
	
	// returns a function that calls both oldFunc and newFunc
	function wrapFunction(oldFunc, newFunc) {
		return function() {
			oldFunc.apply(this, arguments);
			newFunc.apply(this, arguments);
		}
	}
	
	// take in options from the user and fill in the gaps with defaults
	function setDefaultOpts(opts) {
		var mergedOptions = {
				container: document,
				trackRightClicks: false,
				trackMiddleClicks: true,
				trackingLevel: 0,
				protocols: defaultProtocols
			},
			i;
		
		// copy options
		for (i in opts) {
			mergedOptions[i] = opts[i];
		}
		return mergedOptions;
	}
	
	// returning public interface
	return tracking;
}());

tracking.isIe = /*@cc_on !@*/0;
