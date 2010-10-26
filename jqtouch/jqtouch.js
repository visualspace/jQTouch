/*

            _/    _/_/    _/_/_/_/_/                              _/
               _/    _/      _/      _/_/    _/    _/    _/_/_/  _/_/_/
          _/  _/  _/_/      _/    _/    _/  _/    _/  _/        _/    _/
         _/  _/    _/      _/    _/    _/  _/    _/  _/        _/    _/
        _/    _/_/  _/    _/      _/_/      _/_/_/    _/_/_/  _/    _/
       _/
    _/

    Created by David Kaneda <http://www.davidkaneda.com>
    Documentation and issue tracking on GitHub <http://wiki.github.com/senchalabs/jQTouch/>

    Special thanks to Jonathan Stark <http://jonathanstark.com/>
    and pinch/zoom <http://www.pinchzoom.com/>

    Contributor: Thomas Yip <http://beedesk.com/>
    (c) 2009-2010 by jQTouch project members and contributors
    See LICENSE.txt for license.

    $Revision: $
    $Date: $
    $LastChangedBy: $

*/

(function($) {
    $.jQTouch = function(options) {

        // Set support values
        $.support.WebKitCSSMatrix = (typeof WebKitCSSMatrix != "undefined");
        $.support.touch = (typeof Touch != "undefined");
        $.support.WebKitAnimationEvent = (typeof WebKitTransitionEvent != "undefined");
        $.support.wide = (window.screen.width >= 768);
        var START_EVENT = $.support.touch? 'touchstart' : 'mousedown';
        var MOVE_EVENT = $.support.touch? 'touchmove' : 'mousemove';
        var END_EVENT = $.support.touch? 'touchend' : 'mouseup';
        var CANCEL_EVENT = $.support.touch? 'touchcancel' : 'mouseout'; // mouseout on document

        // Initialize internal variables
        var $body,
            $head=$('head'),
            hist=[],
            newPageCount=0,
            jQTSettings={},
            hashCheckInterval,
            currentPage,
            currentAside=$(''),
            orientation,
            isMobileWebKit = RegExp(" Mobile/").test(navigator.userAgent),
            tapReady=true,
            lastAnimationTime=0,
            touchSelectors=[],
            publicObj={},
            tapBuffer=351,
            extensions=$.jQTouch.prototype.extensions,
            actionNodeTypes=['anchor', 'area', 'back', 'toggle', 'submit'];
            defaultAnimations=['slide', 'flip', 'slideup', 'swap', 'cube', 'pop', 'dissolve', 'fade'],
            defaultSection=null,
            animations=[],
            splitscreenmode=false,
            hairExtensions='';
        // Get the party started
        init(options);

        function init(options) {

            var defaults = {
                addGlossToIcon: true,
                cacheGetRequests: true,
                fixedViewport: true,
                fullScreen: true,
                fullScreenClass: 'fullscreen',
                icon: null,
                icon4: null, // experimental
                preloadImages: false,
                startupScreen: null,
                statusBar: 'default', // other options: black-translucent, black
                useAnimations: true,
                defaultAnimation: 'slide',
                useFastTouch: false, // Experimental.
                
                // animation selectors
                cubeSelector: '.cube',
                dissolveSelector: '.dissolve',
                fadeSelector: '.fade',
                flipSelector: '.flip',
                popSelector: '.pop',
                slideSelector: '.slide',
                slideupSelector: '.slideup',
                swapSelector: '.swap',

                // node type selectors
                anchorSelector: '#jqt a',
                areaSelector: '#jqt area',
                backSelector: '#jqt .back, #jqt .cancel, #jqt .goback, #jqt .done',
                toggleSelector: '#jqt .tog',
                formSelector: '#jqt form',
                submitSelector: '#jqt .submit, input[type=\'submit\']',
                inputSelector: '#jqt input',

                // special selectors
                activableSelector: '#jqt ul > li, #jqt ol > li',
                swipeableSelector: '#jqt .swipe',
                tapableSelector: '#jqt .tap'
                
            };
            jQTSettings = $.extend({}, defaults, options);

            // Preload images
            if (jQTSettings.preloadImages) {
                for (var i = jQTSettings.preloadImages.length - 1; i >= 0; i--) {
                    (new Image()).src = jQTSettings.preloadImages[i];
                };
            }
            // Set appropriate icon (retina display stuff is experimental)
            if (jQTSettings.icon || jQTSettings.icon4) {
                var precomposed, appropriateIcon;
                if (jQTSettings.icon4 && window.devicePixelRatio && window.devicePixelRatio === 2) {
                    appropriateIcon = jQTSettings.icon4;
                } else if (jQTSettings.icon) {
                    appropriateIcon = jQTSettings.icon;
                }
                if (appropriateIcon) {
                    precomposed = (jQTSettings.addGlossToIcon) ? '' : '-precomposed';
                    hairExtensions += '<link rel="apple-touch-icon' + precomposed + '" href="' + appropriateIcon + '" />';
                }
            }

            // Set startup screen
            if (jQTSettings.startupScreen) {
                hairExtensions += '<link rel="apple-touch-startup-image" href="' + jQTSettings.startupScreen + '" />';
            }
            // Set viewport
            if (jQTSettings.fixedViewport) {
                hairExtensions += '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0;"/>';
            }
            // Set full-screen
            if (jQTSettings.fullScreen) {
                hairExtensions += '<meta name="apple-mobile-web-app-capable" content="yes" />';
                if (jQTSettings.statusBar) {
                    hairExtensions += '<meta name="apple-mobile-web-app-status-bar-style" content="' + jQTSettings.statusBar + '" />';
                }
            }
            if (hairExtensions) {
                $head.prepend(hairExtensions);
            }

            // Initialize on document ready:
            $(document).ready(function() {

                // Add extensions
                for (var i in extensions) {
                    var fn = extensions[i];
                    if ($.isFunction(fn)) {
                        $.extend(publicObj, fn(publicObj));
                    }
                }

                // initialize animations
                initAnimations();

                // node type selector
                for (var i in actionNodeTypes) {
                  var name = actionNodeTypes[i];
                  var selector = jQTSettings[name + 'Selector'];
                  if (typeof(selector) == 'string' && selector.length > 0) {
                    touchSelectors.push(selector);
                  } else {
                    console.warn('invalid selector for nodetype: ' + name);
                  }
                }
                $(touchSelectors.join(', ')).live('click', liveTap);
                $(touchSelectors.join(', ')).css('-webkit-touch-callout', 'none');
                $(touchSelectors.join(', ')).css('-webkit-user-drag: none', 'none');

                // listen to touch events 
                // performance critical to scroll
                var tapSelectors = [];
                var swipeSel = jQTSettings['swipeable' + 'Selector'];
                if (typeof(swipeSel) == 'string' && swipeSel.length > 0) {
                  tapSelectors.push(swipeSel);
                }
                var activableSel = jQTSettings['activable' + 'Selector'];
                if (typeof(activableSel) == 'string' && activableSel.length > 0) {
                  tapSelectors.push(activableSel);
                }
                var tapableSel = jQTSettings['tapable' + 'Selector'];
                if (typeof(tapableSel) == 'string' && tapableSel.length > 0) {
                  tapSelectors.push(tapableSel);
                }
                $(tapSelectors.join(', ')).live(START_EVENT, touchstart);
                $(tapSelectors.join(', ')).css('-webkit-touch-callout', 'none');

                // other settings
                $body = $('#jqt');

                if (jQTSettings.fullScreenClass && window.navigator.standalone == true) {
                    $body.addClass(jQTSettings.fullScreenClass + ' ' + jQTSettings.statusBar);
                }

                // Create custom live events
                $body
                    .bind('orientationchange', updateOrientation)
                    .trigger('orientationchange')
                    .submit(submitForm);

                if (jQTSettings.useFastTouch && $.support.touch) {
                    $body.click(function(e) {
                        var timeDiff = (new Date()).getTime() - lastAnimationTime;
                        if (timeDiff > tapBuffer) {
                            var $el = $(e.target);

                            if ($el.isExternalLink()) {
                                return true;
                            }
                        }

                        // return false;   // issue 405: http://code.google.com/p/jqtouch/issues/detail?id=405
                    });

                    // This additionally gets rid of form focusses
                    $body.mousedown(function(e) {
                        var timeDiff = (new Date()).getTime() - lastAnimationTime;
                        if (timeDiff < tapBuffer) {
                            return false;
                        }
                    });
                }

                // handling split screen for wider device (such as iPad)
                splitscreenmode = $.support.wide & $body.hasClass('splitscreen');
                if (splitscreenmode) {
                    var $aside = $('#jqt > [section="aside"]'); 
                    if ($aside.length > 0) {
                        if ($($aside.filter('.current').length != 0)) {
                          currentAside = $($($aside.filter('.current:first')));
                          $aside.removeClass('current');
                        } else {
                          currentAside = $aside.filter(':first');
                        }
                        addPageToHistory(currentAside);
                    }
                    defaultSection = "main";
                    $('#jqt > [section!="aside"]').attr("section", defaultSection);
                } else {
                    defaultSection = "full";
                    $('#jqt > *').attr("section", defaultSection);
                }

                // Make sure exactly one child of body has "current" class
                if ($('#jqt > .current').length == 0) {
                    currentPage = $('#jqt > *:first');
                } else {
                    currentPage = $('#jqt > .current:first');
                    $('#jqt > .current').removeClass('current');
                }
                if (currentAside.length != 0) {
                    currentAside.addClass('current');
                }

                // adjust visibiliy of elements
                $.each(['full', 'main', 'aside'], function(i, section) {
                    var $section = $('#jqt > [section="' + section + '"]');
                    $section.children().find('[section~="' + section + '"]').removeClass('missection');
                    $section.children().find('[section]:not([section~="' + section + '"])').addClass('missection');                  
                });

                // Go to the top of the "current" page
                $(currentPage).addClass('current');
                addPageToHistory(currentPage);
                scrollTo(0, 0);
                startHashCheck();
            });
        }

        // PUBLIC FUNCTIONS
        function goBack(to, from) {
            // Init the param
            if (hist.length <= 1) {
                window.history.go(-2);
            }
            
            var fromPage;
            var toPage;
            if (!!from) {
                fromPage = findPageFromHistory(from, 0);
            } else {
                fromPage = $.extend({i: 0}, hist[0]);
                }
            if (!fromPage) {
                console.error('History in invalid state or goback is called at the home page.');
                return false;
            }
            if (hist.length > 1) {
                if (!!to) {
                    var myto = to.substring(1); // remove #
                    toPage = findPageFromHistory(myto, fromPage.i+1);
                    if (!toPage) {
                        console.error('Cannot find page "' + myto + '" in the history.');
                        to = null; // reset to to null, trying to recover
                    }
                }
                if (!to) {
                    to = {section: fromPage.section};
                    toPage = findPageFromHistory(to, fromPage.i+1);
                    if (!toPage) {
                        console.error('Cannot find history to go back to. The specified "from" or "to" parameters might be invalid. Or, it has already back to the beginning.');
                        return false;
            }
                }
                if (animatePages(toPage.page, fromPage.page, adjustAnimation(fromPage.animation, true))) {
                // Remove all pages in front of the target page
                removePageInHistory(toPage.i, fromPage.i, {section: fromPage.section});
                } else {
                  console.error('Could not go back.');
                  return;
                }
            } else {
                location.hash = '#' + hist[0].id;
            }
            return publicObj;
        }

        function goTo(toPage, animation, reverse) {
            if (typeof(toPage) === 'string') {
                nextPage = $(toPage);
                if (nextPage.length < 1) {
                    showPageByHref(toPage, {
                        'animation': animation
                    });
                    return;
                } else {
                    toPage = nextPage;
                }
            }
                
            var section = toPage.attr('section');
            var criteria = !!section? {section: section}: {section: defaultSection}; 
            var histPage = findPageFromHistory(criteria, 0);
            if (!histPage) {
                console.error('Cannot find destination page.');
                return false;
            }

            var adjustedName = adjustAnimation(animation, reverse);
            if (animatePages(toPage, histPage.page, adjustedName)) {
                addPageToHistory(toPage, adjustedName);
                return publicObj;
            } else {
                console.error('Could not animate pages.');
                return false;
            }
        }

        function getOrientation() {
            return orientation;
        }

        // PRIVATE FUNCTIONS
        function liveTap(e){

            // Grab the clicked element
            var $el = $(e.currentTarget);

            var anyTouchSelectors = touchSelectors.join(', '); 
            if (!$el.is(anyTouchSelectors)) {
              var $link = $(e.target).closest(anyTouchSelectors);

              if ($link.length) {
                  $el = $link;
              } else {
                  console.warn('Not a known node type. type: ' + event.target.nodeName + ' id: ' + event.target.id);
                  return;
              }
            }

            var target = $el.attr('target'),
                hash = $el.attr('hash');

            if (tapReady == false || !$el.length) {
                console.warn('Not able to tap element.');
                return false;
            }

            if ($el.isExternalLink()) {
                $el.removeClass('active');
                return true;
            }

            // Figure out the animation to use
            var animation = findAnimation(function(candidate) {
                return $el.is(candidate.selector);
            }).name;
            var reverse = $el.hasClass('reverse');

            // Handle supported action type 
            if ($el.is(jQTSettings.backSelector)) {
                // User clicked a back button
                
                // find out the from page 
                var from;
                var cur = e.currentTarget;
                while (!!cur.parentNode) { 
                    // $.parents('#jqt > *') matchs random, but parents: need to roll our own loop
                    if (cur.parentNode.id === 'jqt') { // found
                        from = cur.id;
                        break;
                    }
                    cur = cur.parentNode;
                }                
                goBack(hash, from);
            
            } else if ($el.is(jQTSettings.toggleSelector)) {
                  // User clicked a toggle
                  if (!!hash && hash.length > 1 && hash.indexOf('#') === 0) {
                      if ($(hash).hasClass('current')) {
                          goBack(null, hash.substring(1));
                      } else {
                          goTo($(hash).data('referrer', $el), animation, reverse);
                      }
                  }

            } else if ($el.is(jQTSettings.submitSelector)) {
              // User clicked or tapped a submit element
                submitParentForm($el);

            } else if (target == '_webapp') {
                // User clicked an internal link, fullscreen mode
                window.location = $el.attr('href');

            } else if ($el.attr('href') == '#') {
                // Allow tap on item with no href
                $el.unselect();
                return true;

            } else if (hash && hash!='#') {
                // Branch on internal or external href
                goTo($(hash).data('referrer', $el), animation, reverse);
                return false;

            } else {
                // External href
                $el.addClass('loading');
                showPageByHref($el.attr('href'), {
                    animation: animation,
                    callback: function() {
                        $el.removeClass('loading'); setTimeout($.fn.unselect, 250, $el);
                    },
                    $referrer: $el
                });
            }
            return false;
        }
        function addPageToHistory(page, animation) {
            // Grab some info
            var pageId = page.attr('id');
            var page = $('#' + pageId); // normalize to actual page
            var section = page.attr('section');
            // Prepend info to page history
            hist.unshift({
                page: page,
                animation: animation,
                section: section,
                id: pageId
            });
            // update hash
            if (section === defaultSection) {
                location.hash = '#' + pageId;
            }
            startHashCheck();
        }
        function findPageFromHistory(search, start) {
            var result;
            var matcher;
            if (!start) {
                start = 0;   
            }
            var number = Math.min(parseInt(search || start, 10), hist.length-1);          
            if (!isNaN(number)) {
                matcher = function(candidate, i) { return i === number; };
            } else if (typeof(search) === 'string') {
                if (search === '') {
                    matcher = function(candidate) { return true; };
                } else {
                    matcher = function(candidate) { return candidate.id === search; };
                }
            } else if ($.isFunction(search)) {
                matcher = search;
            } else {
                matcher = function(candidate) {
                    var matched = true;
                    for (var key in search) {
                        if (search[key] !== candidate[key]) {
                           matched = false;
                           break;  
                        }
                    }
                    return matched;
                };
            }
            for (var i=start, len=hist.length; i < len; i++) {
                if (matcher(hist[i], i)) {
                    result = $.extend({i: i}, hist[i]);
                    break;
                }
            }
            return result;
        }
        function removePageInHistory(to, from, cond) {
            if (!from) {
                from = 0;
            }
            var fromPage = hist[from];
            var section = fromPage.section;
            for (var i=(to-1); i >= 0; i--) {
                var matched = true;
                var candidate = hist[i];
                if (!!cond) {
                    for (var key in cond) {
                        if (cond[key] !== candidate[key]) {
                           matched = false;
                           break;  
                        }
                    }
                }
                if (matched) {
                    hist.splice(i, 1);
                }
            }
        }
        function initAnimations() {
            // Add animations and each selector
            for (var i in defaultAnimations) {
                var name = defaultAnimations[i];
                var selector = jQTSettings[name + 'Selector'];
                if (typeof(selector) == 'string' && selector.length > 0) {
                    var selector = jQTSettings[name + 'Selector'];
                    animations.push({name: name, selector: selector});
                } else {
                    console.warn('invalid selector for animation: ' + name);
                }
            }
        }
        function findAnimation(search) {
            var result = jQTSettings.defaultAnimation; 
            var matcher = function(candidate) { return false; };
            if (typeof(search) === 'string') {
                if (!!search) {
                    matcher = function(candidate) { return candidate.name === search; };
                }
            } else if ($.isFunction(search)) {
                matcher = search;
            }
            for (var i = animations.length - 1; i >= 0; i--) {
                if (matcher(animations[i]) === true) {
                    result = animations[i];
                    break;
                }
            }
            return result;
        }
        function adjustAnimation(name, reverse) {
            var result;
            if (!name) {
                name = jQTSettings.defaultAnimation;
            }
            if (reverse === true) {
                var KEY = 'reverse';
                var splitted = name.split(' ');
                var i = $.inArray(KEY, splitted);
                if (name.indexOf(KEY) >= 0 && i < 0) {
                    console.error('check didn\'t work');
                }
                if (i >= 0) {
                    splitted.splice(i, 1);
                    result = splitted.join(' ');
                } else {
                    result = name + ' ' + KEY;
                }
                if (result === 'reverse') {
                    console.error('check failed. input: ' + name + ' output: ' + result + 'i: ' + i + ' joined: ' + splitted.join('-'));
                }
            } else {
                result = name;
            }
            return result;
        }
        function animatePages(toPage, fromPage, animation) {
            // Error check for target page
            if (!toPage || !fromPage || toPage.length == 0 || fromPage.length == 0) {
                $.fn.unselect();
                console.error('Target element is missing. Dest: ' + toPage + ' Source: ' + fromPage);
                return false;
            }

            // Error check for fromPage=toPage
            if (toPage.hasClass('current')) {
                $.fn.unselect();
                console.error('Target element is the current page.');
                return false;
            }

            // Collapse the keyboard
            $(':focus').blur();

            // Make sure we are scrolled up to hide location bar
            toPage.css('top', window.pageYOffset);

            // animation settings
            var backwards = !!animation? $.inArray('reverse', animation.split(' ')) >= 0: false;
            var animation = !backwards? animation: adjustAnimation(animation, true); 
            var main = toPage.attr('section') === defaultSection; 
            // Define callback to run after animation completes
            var callback = function animationEnd(event) {
                if($.support.WebKitAnimationEvent) {
                    fromPage[0].removeEventListener('webkitTransitionEnd', callback);
                    fromPage[0].removeEventListener('webkitAnimationEnd', callback);
                }

                if (animation) {
                    toPage.removeClass('start in ' + animation);
                    fromPage.removeClass('start out current ' + animation);
                    if (backwards) {
                        toPage.toggleClass('reverse');
                        fromPage.toggleClass('reverse');
                    }
                    toPage.css('top', 0);
                } else {
                    fromPage.removeClass('current active');
                }

                toPage.trigger('pageAnimationEnd', { direction: 'in', reverse: backwards });
                fromPage.trigger('pageAnimationEnd', { direction: 'out', reverse: backwards });

                clearInterval(hashCheckInterval);
                if (main) {
                currentPage = toPage;
                    currentAside.removeClass('front');
                } else {
                    currentAside = toPage;
                    currentPage.removeClass('front');
                }

                var $originallink = toPage.data('referrer');
                if ($originallink) {
                    $originallink.unselect();
                }
                lastAnimationTime = (new Date()).getTime();
                tapReady = true;

            };

            fromPage.trigger('pageAnimationStart', { direction: 'out' });
            toPage.trigger('pageAnimationStart', { direction: 'in' });

            if ($.support.WebKitAnimationEvent && animation && jQTSettings.useAnimations) {
                tapReady = false;
                if (main) {
                    currentAside.addClass('front');
                } else {
                    currentPage.addClass('front');
                }
                if (backwards) {
                    toPage.toggleClass('reverse');
                    fromPage.toggleClass('reverse');
                }

                // Support both transitions and animations
                fromPage[0].addEventListener('webkitTransitionEnd', callback, false);
                fromPage[0].addEventListener('webkitAnimationEnd', callback, false);

                toPage.queue(function() { 
                    fromPage.addClass(animation + ' out');
                    toPage.addClass(animation + ' in current');
                    $(this).dequeue(); 
                });

                toPage.delay(50).queue(function() { 
                    fromPage.addClass('start');
                    toPage.addClass('start');  
                    $(this).dequeue(); 
                });
            } else {
                toPage.addClass('current');
                callback();
            }

            return true;
        }
        function hashCheck() {
            var curid = currentPage.attr('id');
            if (location.hash != '#' + curid) {
                clearInterval(hashCheckInterval);
                // goBack(location.hash);
            }
            else if (location.hash == '') {
                location.hash = '#' + curid;
            } 
        }
        function startHashCheck() {
            clearInterval(hashCheckInterval);
            hashCheckInterval = setInterval(hashCheck, 100);
        }
        function insertPages(nodes, animation) {
            var targetPage = null;
            $(nodes).each(function(index, node) {
                var $node = $(this);
                if (!$node.attr('id')) {
                    $node.attr('id', 'page-' + (++newPageCount));
                }
                var section = $node.attr('section'); 
                if (!section) {
                    $node.attr('section', defaultSection);
                }
                $node.children().find('[section~="' + section + '"]').removeClass('missection');
                $node.children().find('[section]:not([section~="' + section + '"])').addClass('missection');                  

            $body.trigger('pageInserted', {page: $node.appendTo($body)});

                if ($node.hasClass('current') || !targetPage) {
                    targetPage = $node;
                }
            });
            if (targetPage !== null) {
                goTo('#' + targetPage[0].id, animation);
                return targetPage;
            } else {
                return false;
            }
        }
        function showPageByHref(href, options) {
            var defaults = {
                data: null,
                method: 'GET',
                animation: null,
                callback: null,
                $referrer: null
            };

            var settings = $.extend({}, defaults, options);

            if (href != '#') {
                $.ajax({
                    url: href,
                    data: settings.data,
                    type: settings.method,
                    success: function (data, textStatus) {
                        var firstPage = insertPages(data, settings.animation);
                        if (firstPage) {
                            if (settings.method == 'GET' && jQTSettings.cacheGetRequests === true && settings.$referrer) {
                                settings.$referrer.attr('href', '#' + firstPage.attr('id'));
                            }
                            if (settings.callback) {
                                settings.callback(true);
                            }
                        }
                    },
                    error: function (data) {
                        if (settings.$referrer) {
                            settings.$referrer.unselect();
                        }
                        if (settings.callback) {
                            settings.callback(false);
                        }
                    }
                });
            }
            else if (settings.$referrer) {
                settings.$referrer.unselect();
            }
        }
        function submitForm(e, callback) {
            var $form = (typeof(e)==='string') ? $(e).eq(0) : (e.target ? $(e.target) : $(e));

            if ($form.length && $form.is(jQTSettings.formSelector)) {
                showPageByHref($form.attr('action'), {
                    data: $form.serialize(),
                    method: $form.attr('method') || "POST",
                    animation: animations[0] || null,
                    callback: callback
                });
                return false;
            }
            return true;
        }
        function submitParentForm($el) {
            var $form = $el.closest('form');
            if ($form.length) {
                var evt = $.Event("submit");
                evt.preventDefault();
                $form.trigger(evt);
                return false;
            }
            return true;
        }
        function updateOrientation() {
            orientation = Math.abs(window.orientation) == 90 ? 'landscape' : 'portrait';
            $body.removeClass('portrait landscape').addClass(orientation).trigger('turn', {orientation: orientation});
        }

        function touchstart(e) {
            var startX, startY, startTime;
            var deltaX, deltaY, deltaT;
            var endX, endY, endTime;
            var swipped = false, tapped = false, moved = false, inprogress = false;

            function bindEvents($el) {
                $el.bind(MOVE_EVENT, handlemove).bind(END_EVENT, handleend);
                if ($.support.touch) {
                    $el.bind(CANCEL_EVENT, handlecancel);
                } else {
                    $(document).bind('mouseout', handleend);
                }
            }
            
            function unbindEvents($el) {
                $el.unbind(MOVE_EVENT, handlemove).unbind(END_EVENT, handleend);
                if ($.support.touch) {
                    $el.unbind(CANCEL_EVENT, handlecancel);
                } else {
                    $(document).unbind('mouseout', handlecancel);
                }
            }

            function updateChanges() {
                var first = $.support.touch? event.changedTouches[0]: event;
                deltaX = first.pageX - startX;
                deltaY = first.pageY - startY;
                deltaT = (new Date).getTime() - startTime;
            }

            function handlestart(e) {
                inprogress = true, swipped = false, tapped = false, moved = false, timed = false;
                startX = $.support.touch? event.changedTouches[0].clientX: event.clientX;
                startY = $.support.touch? event.changedTouches[0].clientY: event.clientY;
                startTime = (new Date).getTime();
                endX = null, endY = null, endTime = null;
                deltaX = 0;
                deltaY = 0;
                deltaT = 0;

                $el = $(e.currentTarget);

                // Let's bind these after the fact, so we can keep some internal values
                bindEvents($el);

                setTimeout(function() {
                    handlehover(e);
                }, 150);
            };
            
            function handlemove(e) {
                updateChanges();
                var absX = Math.abs(deltaX);
                var absY = Math.abs(deltaY);

                if (absX >= 1 || absY >= 1) {
                    moved = true;
                }
                if (absY <= 5) {
                    if (absX > absY && (absX > 35) && deltaT < 1000) {
                        inprogress = false;
                        $el.removeClass('active');
                        unbindEvents($el);
    
                        swipped = true;
                        $el.trigger('swipe', {direction: (deltaX < 0) ? 'left' : 'right', deltaX: deltaX, deltaY: deltaY });
                    }
                } else {
                    // moved too much, can't swipe anymore 
                    inprogress = false;
                    $el.removeClass('active');
                    unbindEvents($el);
                }
            };
            
            function handleend(e) {
                updateChanges();
                var absX = Math.abs(deltaX);
                var absY = Math.abs(deltaY);

                inprogress = false;
                unbindEvents($el);
                if (!tapped && (absX <= 1 && absY <= 1)) {
                    tapped = true;
                    $el.trigger('tap');
                    setTimeout(function() {
                      $el.removeClass('active');
                  }, 1000);
                } else {
                    $el.removeClass('active');
                    e.preventDefault();
                }
            };

            function handlecancel(e) {
                inprogress = false;
                $el.removeClass('active');
                unbindEvents();
            };

            function handlehover(e) {
                timed = true;
                if (tapped) {
                    // flash the selection
                    $el.addClass('active');
                    setTimeout(function() {
                        $el.removeClass('active');
                    }, 1000);
                } else if (inprogress && !moved) {
                    $el.addClass('active');
                }
            };
            
            handlestart(e);

        }; // End touch handler

        // Public jQuery Fns
        $.fn.unselect = function(obj) {
            if (obj) {
                obj.removeClass('active');
            } else {
                $('.active').removeClass('active');
            }
        };
        $.fn.swipe = function(fn) {
            if ($.isFunction(fn)) {
                return $(this).live('swipe', fn);
            } else {
                return $(this).trigger('swipe');
            }
        };
        $.fn.tap = function(fn) {
            if ($.isFunction(fn)) {
                var tapEvent = 'tap';
                return $(this).live(tapEvent, fn);
            } else {
                return $(this).trigger('tap');
            }
        };
        $.fn.isExternalLink = function() {
            var $el = $(this);
            return ($el.attr('target') == '_blank' || $el.attr('rel') == 'external' || $el.is('input[type="checkbox"], input[type="radio"], a[href^="http://maps.google.com"], a[href^="mailto:"], a[href^="tel:"], a[href^="javascript:"], a[href*="youtube.com/v"], a[href*="youtube.com/watch"]'));
        };

        publicObj = {
            getOrientation: getOrientation,
            goBack: goBack,
            goTo: goTo,
            submitForm: submitForm
        };

        return publicObj;
    };

    // Extensions directly manipulate the jQTouch object, before it's initialized.
    $.jQTouch.prototype.extensions = [];
    $.jQTouch.addExtension = function(extension) {
        $.jQTouch.prototype.extensions.push(extension);
    };

})(jQuery);
