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
		buttons = ['left', 'middle', 'right'];
	
	/**
	@name tracking.LinkTracker
	@class
	@description Tracks and logs links that are clicked on the page
	
	@param {Function} buildUrl Function called when a link is clicked.
		This function must return either a tracking url, or false (no tracking will
		be performed).
		
		The function will be passed 3 parameters in the following order
		
		linkElm  - The link element that was clicked
		
		button 	 - This will be 'left', 'middle', 'right' or 'key'. The first
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
	
	@example
		TODO
	*/
	/* 'private' properties:
	  
	  _o - options object populated with defaults + settings from constructor
	  _mUpElm - the last elm mouseup picked up
	  _mUpBtn - the last mouse buttons used in mouseup
	  _isKey - the last action before clickListener was a key action (1/0)
	  _bUrl - the function to build the tracking url
	  
	*/
	tracking.LinkTracker = function(buildUrl, options) {
		if ( !(this instanceof tracking.LinkTracker) ) {
			return new tracking.LinkTracker(buildUrl, options);
		}
		this._bUrl = buildUrl;
		
		// merge opts with defaults
		options = this._o = setDefaultOpts( options || {} );
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
	// we use click as it also captures links activated by keyboard
	function clickListener(event) {
		//manualTests.log('click');
		// normalise event object for IE
		event = event || window.event;
		
		// convert the button to 'left', 'middle', 'right' or 'key'
		var button = this._isKey ? 'key' : buttons[this._mUpBtn],
			linkElm,
			newUrl;
		
		// should we ignore this click? (is it from a right or middle click?)
		if ( !processClick(this, event) ) { return; }
		
		// get the link element for this event
		linkElm = getParentLinkFor(event.target || event.srcElement)
		
		// if we haven't clicked on a link, exit
		if (!linkElm) { return;	}
		
		// get out new url
		newUrl = this._bUrl(linkElm, button, true);
		
		// replace the current link
		if (newUrl) {
			linkElm.href = newUrl;
		}
	}
	
	// should we process a click event?
	function processClick(linkTracker, event) {
		// we want to process it if the click came after a key event, or a left mouse event on the correct element
		var r = linkTracker._isKey
			|| linkTracker._mUpBtn === 0 && ( linkTracker._mUpElm == (event.target || event.srcElement) );
		
		return r;
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
		if ( button === 0 || (button == 1 && !opts.trackMiddleClicks) || (button == 2 && !opts.trackRightClicks)
		) {
			// exit, we're not wanting to track this click
			return;
		}
		
		// get the link element that's been clicked
		linkElm = getParentLinkFor(source);
		// if we haven't clicked on a link, exit
		if (!linkElm) { return; }
		
		// get tracking url
		trackUrl = this._bUrl(linkElm, buttons[button], false);
		
		if (trackUrl) {
			makeRequest(trackUrl);
		}
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
				trackMiddleClicks: true
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
