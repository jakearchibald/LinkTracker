/**
@name linkTracker
@namespace
@version 0.0.1
@description Tracks clicks on the page and informs a server.
	Call {@link linkTracker.init} to begin tracking.
*/

var linkTracker = (function() {
	// anything attached to 'linkTracker' will be public
	var linkTracker = {},
		opts;
	
	/**
	@name linkTracker.init
	@function
	@description Starts tracking links that are clicked on the page
	
	@param {Function} buildUrl Function called when a link is clicked.
		This function must return either a tracking url, or false (no tracking will
		be performed).
		
		The function will be passed an instance of {@link linkTracker.LinkDetails}.
		
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
	
	@returns {void}
	
	@example
		TODO
	*/
	linkTracker.init = function(buildUrl, options) {
		// merge opts with defaults
		opts = setDefaultOpts(options);
		// assign listeners
		addListener(opts.elm, 'click',   linkActivate);
		addListener(opts.elm, 'mouseup', linkActivate);
		// assign unload cleanup for IE
	}
	
	// called when an element is clicked
	function linkActivate(event) {
		// normalise event object for IE
		event = event || window.event;
		
		// normalise mouse button detection http://www.quirksmode.org/js/events_properties.html#button
		var button = linkTracker.isIe ? (event.button & 1 ? 0 : event.button & 2 ? 2 : 1) : event.button,
			source = e.target || e.srcElement,
			linkElm;
		
		if (event.type == 'mouseup') {
			// need to look at the button pressed
			if ( !button || (button == 1 && !opts.trackMiddleClicks) || (button == 2 && !opts.trackRightClicks)	) {
				// exit, we're not wanting to track this click
				return;
			}
		} else {
			// make sure button is zero for 'click' events
			button = 0;
		}
		
		// get the link element that's been clicked
		linkElm = getParentLinkFor(source);
		// exit if there isn't a link element
		if (!linkElm) {
			return;
		}
		alert('link clicked with button ' + button);
	}
	
	// gets the parent link element for an element, or returns null
	function getParentLinkFor(elm) {
		if (elm) {
			do {
				if (elm.nodeName.toLowerCase == 'a') {
					return elm;
				}
			} while (elm = elm.parentNode);
		}
		return null;
	}
	
	// add an event listener to a particular element
	function addListener(elm, name, callback) {
		if (elm.addEventListener) {
			elm.addEventListener(name, callback, false);
		}
		else if (elm.attachEvent) {
			elm.attachEvent(name, callback);
		}
		else {
			var onname = 'on' + name,
				oldFunc = elm[onname] || new Function;
			
			elm['on' + name] = wrapFunction(oldFunc, callback);
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
	return linkTracker;
}());

linkTracker.isIe = /*@cc_on !@*/0;
