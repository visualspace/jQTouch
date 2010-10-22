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

    (c) 2009 by jQTouch project members.
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
            orientation,
            isMobileWebKit = RegExp(" Mobile/").test(navigator.userAgent),
            tapReady=true,
            lastAnimationTime=0,
            touchSelectors=[],
            publicObj={},
            tapBuffer=351,
            extensions=$.jQTouch.prototype.extensions,
            actionNodeTypes=['anchor', 'area', 'back', 'form', 'submit', 'input'];
            defaultAnimations=['slide','flip','slideup','swap','cube','pop','dissolve','fade','back'],
            animations=[],
            fallbackAnimation=null,
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
                formSelector: '#jqt form',
                submitSelector: '#jqt .submit',
                inputSelector: '#jqt input',

                // special selectors
                activableSelector: '#jqt ul > li.arrow, #jqt ol > li.arrow',
                swipeableSelector: '',
                tapableSelector: ''
                
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
                // prepare default animations
                for (var i = animations.length - 1; i >= 0; i--) {
                  if (animations[i].name === jQTSettings.defaultAnimation) {
                    fallbackAnimation = animations[i];
                      break;
                  }
                };

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

                // Make sure exactly one child of body has "current" class
                if ($('#jqt > .current').length == 0) {
                    currentPage = $('#jqt > *:first');
                } else {
                    currentPage = $('#jqt > .current:first');
                    $('#jqt > .current').removeClass('current');
                }

                // Go to the top of the "current" page
                $(currentPage).addClass('current');
                location.hash = '#' + $(currentPage).attr('id');
                addPageToHistory(currentPage);
                scrollTo(0, 0);
                startHashCheck();
            });
        }

        // PUBLIC FUNCTIONS
        function goBack(to) {
            // Init the param
            if (hist.length <= 1)
            {
                window.history.go(-2);
            }
            
            var numberOfPages = Math.min(parseInt(to || 1, 10), hist.length-1),
                curPage = hist[0];

            // Search through the history for an ID
            if(isNaN(numberOfPages) && typeof(to) === "string" && to != '#' ) {
                for( var i=1, length=hist.length; i < length; i++ ) {
                    if( '#' + hist[i].id === to ) {
                        numberOfPages = i;
                        break;
                    }
                }
            }

            // If still nothing, assume one
            if(isNaN(numberOfPages) || numberOfPages < 1) {
                numberOfPages = 1;
            };

            if (hist.length > 1) {
                // Remove all pages in front of the target page
                hist.splice(0, numberOfPages);
                animatePages(curPage.page, hist[0].page, curPage.animation, curPage.reverse === false);
            } else {
                location.hash = '#' + curPage.id;
            }

            return publicObj;
        }

        function goTo(toPage, animation, reverse) {
            var fromPage = hist[0].page;

            if (typeof(animation) === 'string') {
                for (var i = animations.length - 1; i >= 0; i--) {
                    if (animations[i].name === animation) {
                        animation = animations[i];
                        break;
                    }
                }
            }
            if (typeof(toPage) === 'string') {
                nextPage = $(toPage);
                if (nextPage.length < 1)
                {
                    showPageByHref(toPage, {
                        'animation': animation
                    });
                    return;
                }
                else
                {
                    toPage = nextPage;
                }
                
            }
            if (animatePages(fromPage, toPage, animation, reverse)) {
                addPageToHistory(toPage, animation, reverse);
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
                hash = $el.attr('hash'),
                animation=fallbackAnimation;

            if (tapReady == false || !$el.length) {
                console.warn('Not able to tap element.');
                return false;
            }

            if ($el.isExternalLink()) {
                $el.removeClass('active');
                return true;
            }

            // Figure out the animation to use
            for (var i = animations.length - 1; i >= 0; i--) {
                if ($el.is(animations[i].selector)) {
                    animation = animations[i];
                    break;
                }
            };

            // User clicked a back button
            if ($el.is(jQTSettings.backSelector)) {
                goBack(hash);
            
            } else if ($el.is(jQTSettings.submitSelector)) {
              // User clicked or tapped a submit element
                submitParentForm(e);

            } else if (target == '_webapp') {
                // User clicked an internal link, fullscreen mode
                window.location = $el.attr('href');

            } else if ($el.attr('href') == '#') {
                // Allow tap on item with no href
                $el.unselect();
                return true;

            } else if (hash && hash!='#') {
                // Branch on internal or external href
                goTo($(hash).data('referrer', $el), animation, $(this).hasClass('reverse'));
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
        function addPageToHistory(page, animation, reverse) {
            // Grab some info
            var pageId = page.attr('id');
            // Prepend info to page history
            hist.unshift({
                page: page,
                animation: animation,
                reverse: reverse || false,
                id: pageId
            });
        }
        function animatePages(fromPage, toPage, animation, backwards) {
            // Error check for target page
            if (toPage.length === 0) {
                $.fn.unselect();
                console.error('Target element is missing.');
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

            // Define callback to run after animation completes
            var callback = function animationEnd(event) {
                if($.support.WebKitAnimationEvent) {
                    fromPage[0].removeEventListener('webkitTransitionEnd', callback);
                    fromPage[0].removeEventListener('webkitAnimationEnd', callback);
                }

                if (animation) {
                        toPage.removeClass('start in ' + animation.name);
                        fromPage.removeClass('start out current ' + animation.name);
                    if (backwards) {
                        toPage.toggleClass('reverse');
                        fromPage.toggleClass('reverse');
                    }
                    toPage.css('top', 0);
                } else {
                    fromPage.removeClass('current');
                }

                toPage.trigger('pageAnimationEnd', { direction: 'in', reverse: backwards });
                fromPage.trigger('pageAnimationEnd', { direction: 'out', reverse: backwards });

                clearInterval(hashCheckInterval);
                currentPage = toPage;
                location.hash = '#' + currentPage.attr('id');
                startHashCheck();

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
                if (backwards) {
                    toPage.toggleClass('reverse');
                    fromPage.toggleClass('reverse');
                }

                // Support both transitions and animations
                fromPage[0].addEventListener('webkitTransitionEnd', callback, false);
                fromPage[0].addEventListener('webkitAnimationEnd', callback, false);

                toPage.queue(function() { $(this).addClass(animation.name + ' in current'); $(this).dequeue(); });
                fromPage.queue(function() { $(this).addClass(animation.name + ' out'); $(this).dequeue(); } );

                toPage.delay(50).queue(function() { $(this).addClass('start');  $(this).dequeue(); });
                fromPage.delay(50).queue(function() { $(this).addClass('start'); $(this).dequeue(); });

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
            hashCheckInterval = setInterval(hashCheck, 100);
        }
        function insertPages(nodes, animation) {
            var targetPage = null;
            $(nodes).each(function(index, node) {
                var $node = $(this);
                if (!$node.attr('id')) {
                    $node.attr('id', 'page-' + (++newPageCount));
                }

            $body.trigger('pageInserted', {page: $node.appendTo($body)});

                if ($node.hasClass('current') || !targetPage) {
                    targetPage = $node;
                }
            });
            if (targetPage !== null) {
                goTo(targetPage, animation);
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
        function submitParentForm(e) {
            var $form = $(this).closest('form');
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
                $el.removeClass('active');
                unbindEvents($el);
                if (!tapped && (absX <= 1 && absY <= 1)) {
                    tapped = true;
                    $el.trigger('tap');
                } else {
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
                    }, 250);
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
