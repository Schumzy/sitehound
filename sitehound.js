//
// SiteHound - Easy & powerful user, session and event tracking
//
// Supports tracking events to:
// - Segment.com's analytics.js
// - mixpanel.js
// 
// ~~ 500 Startups Distro Team // #500STRONG // 500.co ~~
//
// @author        Andy Young // @andyy // andy@apexa.co.uk
// @version       0.8 - 3rd April 2016
// @licence       GNU GPL v3
//
//
//  Copyright (C) 2016 Andy Young // andy@apexa.co.uk
//
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License
//  along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
!function() {
    var VERSION = "0.8";

    !function() {
        var initialConfig = window.sitehound || {};

        // initialize adaptor for the analytics library we want to use
        var adaptorClass = titleCase(initialConfig.adaptor) || 'Segment';
        try {
            var adaptor = eval('new SiteHound_Adaptor_' + adaptorClass);
        } catch (error) {
            if (window.console && console.error) {
                console.error('[SiteHound] adaptor class SiteHound_Adaptor_' + adaptorClass + " could not be loaded");
                console.error('[SiteHound] ' + error.name + '; ' + error.message);
            }
            return;
        }
        if (!adaptor.check()) {
            if (window.console && console.error) {
                console.error('[SiteHound] failed to attach to ' + adaptorClass);
            }
            return;
        }

        // initialize SiteHound when our adaptor's target library is ready
        adaptor.ready(function() {
            // grab our custom config and calls, if any
            var initialConfig = window.sitehound || {};
            // initialize SiteHound library, passing in our custom config
            var sitehound = new SiteHound(initialConfig, adaptor);
            // finally, replace the global sitehound var with our instance for future reference
            window.sitehound = sitehound;
        });
    }();

    function SiteHound(initialConfig, adaptor) {
        var config = {
            // names and paths of key pages we want to track
            // paths can be simple string matches, arrays, or regular expressions
            trackPages: null,
            // track all other pageviews? (as "unidentified")
            trackAllPages: false,
            // detect and re-run tracking if the window.location changes?
            detectURLChange: true,
            detectHashChange: false,
            // whitelist domains on which to run tracking
            domains: location.host,
            domainsIgnore: ['localhost'],
            domainsIgnoreIPAddress: true,
            domainsIgnoreSubdomains: ['staging', 'test'],
            // any un-tagged pages we want to track as the actual landing page if discovered in the referrer?
            trackReferrerLandingPages: [],
            page: null,
            pageTraits: {},
            // traits to set globally for this user/session
            globalTraits: {},
            // traits that we only want to pass on calls to analytics.[track|page] on this pageview
            thisPageTraits: {},
            //
            userId: undefined,
            userTraits: {},
            detectLogout: undefined,
            //
            logToConsole: false,
            //
            sessionTimeout: 30, // minutes
            //
            overrideReferrer: undefined,
        };

        var self = this;

        this.adaptor = adaptor;
        if ((typeof adaptor !== 'object') || !adaptor.check()) {
            if (window.console && console.error) {
                console.error('[SiteHound] adaptor not valid');
            }
            return;
        }

        for (var key in config) {
            if (initialConfig[key] !== undefined) {
                config[key] = initialConfig[key];
            }
            this[key] = config[key];
        }

        this.thisPageTraits['SiteHound library version'] = this.VERSION = VERSION;

        // for auto-detection of page URL change (single-page sites e.g. angularjs)
        var intervalId, currentURL;

        //
        // privileged methods
        //

        this.sniff = this.done = function() {
            try {
                self.info('Sniffing..');
                // check we want to track this host
                if (ignoreHost(location.host)) {
                    self.info('Ignoring host: ' + location.host);
                    self.adaptor = new SiteHound_Adaptor_Disabled();
                    return;
                }
                if (getCookie('dnt')) {
                    self.info('do-not-track cookie present');
                    self.adaptor = new SiteHound_Adaptor_Disabled();
                    return;
                }

                // core tracking for on page load
                doSniff();

                // callback for adaptor
                if (typeof self.adaptor.afterSniff === 'function') {
                    self.adaptor.afterSniff();
                }

                // replay any events queued up by the snippet before the lib was loaded
                replayQueue();

                if (self.sniffed) {
                    return;
                }
                self.sniffed = true;

                // auto-detect URL change and re-trigger sniffing for any future virtual pageviews
                if ((self.detectURLChange || self.detectHashChange) && !intervalId) {
                    currentURL = location.href;
                    intervalId = setInterval(
                        function() {
                            if (self.detectHashChange ?
                                (location.href !== currentURL) :
                                (location.href.replace(/#.*$/, '') !== currentURL.replace(/#.*$/, ''))
                            ) {
                                self.overrideReferrer = currentURL || document.referrer;
                                currentURL = location.href;
                                self.info('Detected URL change: ' + currentURL);
                                self.page = undefined;
                                self.sniff();
                            }
                        },
                        1000
                    );
                }
            } catch(error) {
                this.trackError(error);
            }
        }

        // like analytics.identify({..}), but only set traits if they're not already set
        this.identifyOnce = function(params) {
            self.adaptor.identify(self.ignoreExistingTraits(params));
        }

        this.getTraitsToSend = function(traits) {
            if (typeof traits === 'object') {
                return mergeObjects(self.thisPageTraits, traits);
            } else {
                return self.thisPageTraits;
            }
        }

        this.info = function(message) {
            if (self.logToConsole && window.console && console.log) {
                if (typeof message === 'object') {
                    console.log(message);
                } else {
                    console.log('[SiteHound] ' + message);
                }
            }
        }

        this.doNotTrack = function(dnt) {
            dnt = (typeof dnt === 'undefined') ? true : !!dnt;
            if (dnt) {
                setCookie('dnt', '1', 1000);
            } else {
                // clear cookie - track again
                setCookie('dnt', '', -100);
            }
        }

        //
        // private methods
        //

        function ignoreHost(host) {
            if (self.domains.indexOf(host) != -1) {
                // domain is one of ours to track
                return false;
            }
            if (self.domainsIgnore.indexOf(host) != -1) {
                // domain is one of ours to ignore
                return true;
            }
            if (self.domainsIgnoreIPAddress && /([0-9]{1,3}\.){3}[0-9]{1,3}/.test(host)) {
                // host is IP address, and we want to ignore these
                return true;
            }
            if (self.domainsIgnoreSubdomains.length > 0) {
                for (var i = 0; i < self.domains.length; i++) {
                    var root_domain = self.domains[i].replace(/^www\./, '');
                    var host_subdomain = host.replace(new RegExp(root_domain.replace('.', '\.') + '$'), '');
                    if (self.domainsIgnoreSubdomains.indexOf(host_subdomain) != -1) {
                        // domain matches a subdomain pattern we wish to ignore
                        return true;
                    }
                }
            }
            // else - ignore, but warn about unexpected domain
            self.trackDebugWarn('location.host not contained within configured domains');
            return true;
        }

        function doSniff() {
            if (!self.page) {
                self.page = detectPage(location.pathname);
            }

            if (self.overrideReferrer !== undefined) {
                self.thisPageTraits['referrer'] = self.thisPageTraits['Referrer'] = self.thisPageTraits['$referrer'] = self.overrideReferrer;
                //var referrerParts = self.thisPageTraits['referrer'].match(/https?:\/\/([^/]+)(\/.*)/),
                //    referrerHost;
                //if (referrerParts) {
                //    referrerHost = referrerParts[1];
                //}
                //self.thisPageTraits['Referring Domain'] = self.thisPageTraits['$referring_domain'] = referrerHost;
            }

            trackSession();

            var userTraits = self.adaptor.userTraits();

            if (userTraits.createdAt) {
                self.globalTraits['Days since signup'] = Math.floor((new Date()-new Date(userTraits.createdAt))/1000/60/60/24);
                self.info('Days since signup: ' + self.globalTraits['Days since signup']);
            }

            if (self.userTraits['email domain']) {
                self.userTraits['email domain'] = self.userTraits['email domain'].match(/[^@]*$/)[0];
            } else if (userTraits.email || self.userTraits['email']) {
                self.userTraits['email domain'] = (userTraits.email || self.userTraits['email']).match(/[^@]*$/)[0];
            }

            // Fullstory.com session URL
            if (window.FS && window.FS.getCurrentSessionURL) {
                // ideally do it instantly so we don't trigger a separate identify() call
                self.globalTraits['Fullstory URL'] = FS.getCurrentSessionURL();
            } else if (!self.sniffed) {
                var _old_fs_ready = window._fs_ready;
                window._fs_ready = function() {
                    self.adaptor.identify({'Fullstory URL': FS.getCurrentSessionURL()});
                    if (typeof _old_fs_ready === 'function') {
                        _old_fs_ready();
                    }
                };
            }

            if (self.userId) {
                self.info('Received userId: ' + self.userId);
                var userTraits = {};
                for (var key in self.userTraits) {
                    userTraits['User ' + key] = self.userTraits[key];
                }
                var traits = mergeObjects(self.globalTraits, userTraits);
                var currentUserId;
                if (!self.adaptor.userId()) {
                    // session up to here has been anonymous
                    self.info('Anonymous session until now - alias()');
                    self.adaptor.alias(self.userId);
                    // hack: ensure identify() takes hold even if alias() was silently ignored because already in use
                    self.adaptor.identify('x');
                } else {
                    currentUserId = self.adaptor.userId();
                    self.info('Current userId: ' + currentUserId);
                }
                self.info('identify(' + self.userId + ', [traits])');
                if (self.userId !== currentUserId) {
                    // TOCHECK
                    // set time of email verification as the user creation time
                    traits = mergeObjects(traits, ignoreExistingTraits({createdAt: new Date().toISOString()}));
                }
                self.adaptor.identify(self.userId, traits);
                if (self.userId !== currentUserId) {
                    self.info('userId != currentUserId - Login');
                    self.track('Login');
                }
                setCookie('logged_out', '');
            } else {
                self.adaptor.identify(self.globalTraits);
                if (self.detectLogout === undefined) {
                    // by default, automatically detect logout if the userId property has been set
                    //  - even if it's been set to null
                    self.detectLogout = self.userId !== undefined;
                }
                if (self.detectLogout) {
                    self.info('Detecting potential logout..');
                    if (self.adaptor.userId()) {
                        // track only once until next login
                        if (!getCookie('logged_out')) {
                            self.track('Logged out');
                            setCookie('logged_out', true);
                            self.info('Logged out');
                        }
                    }
                }
            }

            if (self.trackLandingPage) {
                trackPage('Landing', self.landingPageTraits);
            }

            if (self.page) {
                // if the page contains a vertical bar, separate out the page vs. category
                var pageParts = self.page.split('|', 2).map(
                    function(a) {
                        return a.trim();
                    }
                );
                var args = pageParts.push(self.pageTraits);
                // track page view
                trackPage.apply(self, pageParts);
            } else if (self.trackAllPages) {
                trackPage('Unidentified');
            }
        }

        function detectPage(path) {
            for (var page in self.trackPages) {
                var pattern = self.trackPages[page];
                // we support matching based on string, array or regex
                if (!Array.isArray(pattern)) {
                    pattern = [pattern];
                }
                for (var i = 0; i < pattern.length; ++i) {
                    var pat = pattern[i];
                    if (typeof pat.test === 'function') {
                        if (pat.test(path)) {
                            // regex matching URL path - TOCHECK
                            self.info('Detected page: ' + page);
                            return page;
                        }
                    } else if (pat[0] === '.') {
                        // match body css class
                        if ((path === location.pathname) &&
                            document.body.className.match(new RegExp('(?:^|\\s)' + RegExp.escape(pat.slice(1)) + '(?!\\S)'))) {
                            self.info('Detected page: ' + page);
                            return page;
                        }
                    // string match - we ignore presence of trailing slash on path
                    } else if (pat.replace(/\/$/, '') === path.replace(/\/$/, '')) {
                        self.info('Detected page: ' + page);
                        return page;
                    }
                }
            }
        }

        function trackSession() {
            // visitor first seen
            var firstSeen = getCookie('firstSeen') || new Date().toISOString();
            setCookie('firstSeen', firstSeen, 366);
            var daysSinceFirst = Math.floor((new Date() - new Date(firstSeen))/1000/60/60/24);
            self.globalTraits['First seen'] = firstSeen;
            self.globalTraits['Days since first seen'] = daysSinceFirst;
            self.info('Visitor first seen: ' + firstSeen);
            self.info('Days since first seen: ' + daysSinceFirst);

            // session start + last updated time
            var sessionStarted = getCookie('sessionStarted') || new Date().toISOString(),
                sessionUpdated = getCookie('sessionUpdated') || new Date().toISOString();
            var sessionDuration = Math.floor((new Date() - new Date(sessionStarted))/1000/60);
            self.globalTraits['Session started'] = sessionStarted;
            self.globalTraits['Minutes since session start'] = sessionDuration;
            self.info('Session started: ' + sessionStarted);
            self.info('Session duration: ' + sessionDuration);
            var sessionTimedOut = sessionDuration > self.sessionTimeout;
            if (sessionTimedOut) {
                self.info('Session timed out - tracking as new session');
                sessionStarted = new Date().toISOString();
            }
            setCookie('sessionStarted', sessionStarted);
            setCookie('sessionUpdated', new Date().toISOString());

            // tracked pageviews this session
            var pageViews = (sessionTimedOut ? 0 : parseInt(getCookie('pageViews') || 0)) + 1;
            self.thisPageTraits['Pageviews this session'] = pageViews;
            setCookie('pageViews', pageViews);
            self.info('Pageviews: ' + pageViews);

            self.isLandingPage = false;
            if (!sessionTimedOut) {
                // is this a landing page hit? (i.e. first pageview in session)
                if (pageViews > 1) {
                    return;
                }
                self.isLandingPage = true;
                self.info('Detected landing page');
            }

            // session count for this visitor
            var sessionCount = parseInt(getCookie('sessionCount') || 0) + 1;
            self.globalTraits['Session count'] = sessionCount;
            setCookie('sessionCount', sessionCount, 366);
            self.info('Session count: ' + sessionCount);

            if (sessionTimedOut) {
                // we don't update attribution tracking when tracking a new session due to inactivity
                return;
            }

            // track attribution params for this session
            var attributionParams = {};
            var paramNames = [
                'UTM Source',
                'UTM Medium',
                'UTM Campaign',
                'UTM Term',
                'UTM Content',
                'Landing page',
                'Landing page type',
                'Referrer',
                'Referrer domain',
                'Referrer type'
            ];
            for (var i = 0; i < paramNames.length; i++) {
                attributionParams[paramNames[i]] = null;
            }

            // utm params
            var utmParams = getUTMParams();
            if (Object.keys(utmParams).length > 0) {
                self.info('utm params:');
                self.info(utmParams);
                attributionParams = mergeObjects(attributionParams, utmParams);
            }

            // landing page and referrer
            var referrerParts = document.referrer.match(/https?:\/\/([^/]+)(\/.*)/),
                referrerHost = null,
                referrerPath;
            if (referrerParts) {
                referrerHost = referrerParts[1];
                referrerPath = referrerParts[2];
            }
            // is the referrer from a host we should have (a) tracking on, and (b) set a cookie for, AND can read the cookie on this host?
            //  => referrer is one of domains AND current host is either the same domain as the referrer, or current host is a subdomain of the referrer
            if ((referrerHost === location.host) || ((self.domains.indexOf(referrerHost) !== -1) && ((location.host + '/').indexOf(referrerHost + '/') !== -1))) {
                // first cookie, but referrer from one of our domains - did the original landing page not have tracking?
                // Do we want to track the referrer as the original landing page?
                if (self.trackReferrerLandingPages.indexOf(referrerPath) !== -1) {
                    // track landing page view for our previously untracked referrer
                    self.info('Detected known untracked landing page: ' + document.referrer);
                    self.trackLandingPage = true;
                    self.landingPageTraits = {
                        path: referrerPath,
                        url: document.referrer,
                        '$current_url': document.referrer,
                        'Tracked from URL': location.href,
                        referrer: ''
                    };
                    attributionParams['Landing page'] = referrerPath;
                } else if (document.referrer === location.href) {
                    // referrer is the current page - treat as landing page
                    self.trackLandingPage = true;
                    attributionParams['Landing page'] = location.pathname;
                } else {
                    self.trackDebugWarn('Landing page with local referrer - tracking code not on all pages?');
                }
            } else {
                if ((referrerHost != location.host) && self.domains.indexOf(referrerHost) !== -1) {
                    self.trackDebugInfo('Landing page with referrer from one of our other domains');
                } else {
                    self.trackLandingPage = true;
                    attributionParams['Landing page'] = location.pathname;
                    attributionParams['Referrer'] = document.referrer ? document.referrer : null;
                    attributionParams['Referrer domain'] = referrerHost;
                }
            }

            // add some additional metadata
            if (attributionParams['Landing page']) {
                attributionParams['Landing page type'] = self.page;
            }
            if (attributionParams['Referrer domain'] == location.host) {
                attributionParams['Referrer type'] = detectPage(referrerPath);
            }

            // automatic attribution detection
            if (!attributionParams['utm_source']) {
                // adwords / doubleclick
                if (getQueryParam(document.URL, 'gclid') || getQueryParam(document.URL, 'gclsrc')) {
                    attributionParams['utm_source'] = 'google';
                    if (!attributionParams['utm_medium']) {
                        attributionParams['utm_medium'] = 'cpc';
                    }
                }
                // Yesware
                if (attributionParams['Referrer domain'] == 't.yesware.com') {
                    attributionParams['utm_source'] = 'Yesware';
                    if (!attributionParams['utm_medium']) {
                        attributionParams['utm_medium'] = 'email';
                    }
                }
            }

            var attributionParamsFirst = {},
                attributionParamsLast = {};
            for (var key in attributionParams) {
                attributionParamsFirst[key + ' [first touch]'] = attributionParams[key];
                attributionParamsLast[key + ' [last touch]'] = attributionParams[key];
            }

            self.info('Attribution params:');
            self.info(attributionParams);
            if (sessionCount == 1) {
                // only track first touch params on first session
                self.info('..setting first touch params');
                self.globalTraits = mergeObjects(self.globalTraits, ignoreExistingTraits(attributionParamsFirst));
            }
            self.info('..setting last touch params');
            self.globalTraits = mergeObjects(self.globalTraits, attributionParamsLast);
        }

        function trackPage(one, two, three) {
            if (typeof three === 'object') {
                self.adaptor.page(one, two, self.getTraitsToSend(three));
            } else if (typeof two === 'object') {
                self.adaptor.page(one, self.getTraitsToSend(two));
            } else if (two) {
                self.adaptor.page(one, two, self.getTraitsToSend());
            } else {
                self.adaptor.page(one, self.getTraitsToSend());
            }
        }

        function replayQueue() {
            while (initialConfig.queue && initialConfig.queue.length > 0) {
                var args = initialConfig.queue.shift();
                var method = args.shift();
                if (self[method]) {
                    self[method].apply(self, args);
                }
            }
        }

        function getUTMParams() {
            var utm_params = 'utm_source utm_medium utm_campaign utm_content utm_term'.split(' '),
                kw = '',
                params = {};

            for (var index = 0; index < utm_params.length; ++index) {
                kw = getQueryParam(document.URL, utm_params[index]);
                if (kw.length) {
                    params['UTM ' + titleCase(utm_params[index].slice(4))] = kw;
                }
            }
            return params;
        }

        function getQueryParam(url, param) {
            param = param.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
            var regexS = "[\\?&]" + param + "=([^&#]*)";
            var regex = new RegExp(regexS);
            var results = regex.exec(url);
            if (results === null || (results && typeof(results[1]) !== 'string' && results[1].length)) {
                return '';
            } else {
                return decodeURIComponent(results[1]).replace(/\+/g, ' ');
            }
        }

        function setCookie(name, value, expiry_days, domain) {
            var expires = '';
            if (expiry_days != 0) {
                var d = new Date();
                d.setTime(d.getTime() + (expiry_days*24*60*60*1000));
                expires = 'expires='+d.toUTCString();
            }
            if (domain === undefined) {
                domain = self.cookieDomain;
            }
            document.cookie = 'sh_' + name + '=' + value + '; ' + expires + ';path=/' + (domain ? ';domain=' + domain : '');
        }

        function getCookie(cname) {
            var name = 'sh_' + cname + '=';
            var cs = document.cookie.split(';');
            for(var i=0; i < cs.length; i++) {
                var c = cs[i];
                while (c.charAt(0)==' ') c = c.substring(1);
                if (c.indexOf(name) == 0) return c.substring(name.length,c.length);
            }
            return '';
        }

        function mergeObjects(obj1, obj2) {
            var obj3 = {};
            for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
            for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
            return obj3;
        }

        function ignoreExistingTraits(params) {
            var traits = self.adaptor.userTraits(),
                newParams = {};
            for (var key in params) {
                if (!(key in traits)) {
                    newParams[key] = params[key];
                }
            }
            return newParams;
        }

        //
        // Modified from https://github.com/segmentio/top-domain v2.0.1
        // @TODO: learn how to javascript good
        //
        /**
         * Get the top domain.
         *
         * The function constructs the levels of domain
         * and attempts to set a global cookie on each one
         * when it succeeds it returns the top level domain.
         *
         * The method returns an empty string when the hostname
         * is an ip or `localhost`.
         *
         * Example levels:
         *
         *      domain('www.google.co.uk');
         *      // => ["co.uk", "google.co.uk", "www.google.co.uk"]
         *
         * Example:
         *
         *      domain('localhost');
         *      // => ''
         *      domain('dev');
         *      // => ''
         *      domain('127.0.0.1');
         *      // => ''
         *      domain('segment.io');
         *      // => 'segment.io'
         *
         * @param {String} url
         * @return {String}
         * @api public
         */
        function topDomain(hostname) {
            var levels = domainLevels(hostname);

            // Lookup the real top level one.
            for (var i = 0; i < levels.length; ++i) {
                var cname = '__tld__';
                var domain = '.' + levels[i];

                setCookie(cname, 1, 0, domain);
                if (getCookie(cname)) {
                    setCookie(cname, '', -100, domain);
                    return domain
                }
            }

            return '';
        };

        /**
         * Levels returns all levels of the given url.
         *
         * @param {String} url
         * @return {Array}
         * @api public
         */
        function domainLevels(hostname) {
            var parts = hostname.split('.');
            var last = parts[parts.length-1];
            var levels = [];

            // Ip address.
            if (4 == parts.length && parseInt(last, 10) == last) {
                return levels;
            }

            // Localhost.
            if (1 >= parts.length) {
                return levels;
            }

            // Create levels.
            for (var i = parts.length-2; 0 <= i; --i) {
                levels.push(parts.slice(i).join('.'));
            }

            return levels;
        };
        //
        // END grab from https://github.com/segmentio/top-domain
        //

        //
        // ready? 
        //
        this.info('Ready (v' + VERSION + ')');

        this.cookieDomain = topDomain(location.hostname);
        this.info('Cookie domain: ' + this.cookieDomain);

        if (getCookie('dnt')) {
            self.info('do-not-track cookie present');
            self.adaptor = new SiteHound_Adaptor_Disabled();
            return;
        }

        if (initialConfig.isDone) {
            this.sniff();
        }        
    }

    //
    // public methods
    //

    SiteHound.prototype.identify = function(a, b) {
        this.adaptor.identify(a, b);
    }

    SiteHound.prototype.track = function(event, traits) {
        if (typeof traits == 'object') {
            this.adaptor.track(event, this.getTraitsToSend(traits));
        } else {
            this.adaptor.track(event, this.getTraitsToSend());
        }
    }

    // similar to identifyOnce, but also track event
    SiteHound.prototype.trackOnce = function(event, params) {
        var traits = this.adaptor.userTraits();

        if (traits['First ' + event] === undefined) {
            var userParams = {};
            userParams['First ' + event] = new Date().toISOString();

            this.adaptor.identify(userParams);
            this.track(event, params);
        }
    }

    SiteHound.prototype.trackAndCount = function(event, params) {
        var traits = this.adaptor.userTraits();

        var count = 1;
        if (traits) {
            count = traits[event + ' Count'] ? parseInt(traits[event + ' Count']) + 1: 1;
        }

        var onceTraits = {};
        onceTraits['First ' + event] = new Date().toISOString();
        this.identifyOnce(onceTraits);

        var identifyTraits = {};
        identifyTraits[event + ' Count'] = count;
        identifyTraits['Last ' + event] = new Date().toISOString();
        this.adaptor.identify(identifyTraits);
        this.track(event, params);
    }

    SiteHound.prototype.trackLink = function(elements, name) {
        this.adaptor.trackLink(elements, name, this.getTraitsToSend());
    }

    SiteHound.prototype.trackForm = function(elements, name) {
        this.adaptor.trackForm(elements, name, this.getTraitsToSend());
    }

    //
    // tracking for debugging our tracking ¯\_(ツ)_/¯
    //

    SiteHound.prototype.trackDebugInfo = function(message) {
        this.trackDebug(message, 'info');
    }

    SiteHound.prototype.trackDebugWarn = function(message) {
        this.trackDebug(message, 'warn');
    }

    SiteHound.prototype.trackDebug = function(message, level) {
        this.adaptor.track('Tracking Debug', {
            message: message,
            level: level,
            'SiteHound library version': this.VERSION
        });
        this.info('[' + level + '] ' + message);
    }

    SiteHound.prototype.trackError = function(error) {
        this.adaptor.track('Tracking Error', {
            name: error.name,
            message: error.message,
            'SiteHound library version': this.VERSION
        });
        if (window.console && console.error) {
            console.error('[SiteHound] ' + error.name + '; ' + error.message);
        }
    }

    //
    // Adaptors
    //

    function SiteHound_Adaptor_Disabled() {
        // tracking disabled
        this.check = this.ready = this.identify = this.track = this.trackLink = this.trackForm
            = this.page = this.alias = this.userId = this.userTraits
            = function() {}
    }

    function SiteHound_Adaptor_Segment() {
        var analytics = window.analytics = window.analytics || [],
            self = this;

        this.check = function() {
            return typeof window.analytics.ready !== 'undefined';
        }

        if (!this.check()) {
            if (window.console && console.error) {
                console.error('[SiteHound] window.analytics is not initialized - ensure analytics.js snippet is included first');
            }
            return;
        }

        this.calledPage = false;
        analytics.on('page', function() {
            self.calledPage = true;
        });

        this.ready = function(f) {
            window.analytics.ready(f);
        }

        this.identify = function(a, b) {
            window.analytics.identify(a, b);
        }

        this.track = function(event, traits) {
            window.analytics.track(event, traits);
        }

        this.trackLink = function(elements, event, traits) {
            window.analytics.trackLink(elements, event, traits);
        }

        this.trackForm = function(elements, event, traits) {
            window.analytics.trackForm(elements, event, traits);
        }

        this.page = function(a, b, c) {
            self.calledPage = true;
            window.analytics.page(a, b, c);
        }

        this.alias = function(to) {
            window.analytics.alias(to);
        }

        this.userId = function() {
            var user = window.analytics.user();
            return user ? user.id() : undefined;
        }

        this.userTraits = function() {
            var user = window.analytics.user();
            var traits = user.traits();
            return traits;
        }

        this.afterSniff = function() {
            if (!self.calledPage) {
                // Segment.com requires we call page() at least once
                window.analytics.page();
            }
        }
    }

    function SiteHound_Adaptor_Mixpanel() {
        var mixpanel = window.mixpanel = window.mixpanel || [],
            self = this;

        this.check = function() {
            // TODO
            return typeof window.mixpanel.ready !== 'undefined';
        }

        if (!this.check()) {
            if (window.console && console.error) {
                console.error('[SiteHound] window.mixpanel is not initialized - ensure Mixpanel snippet is included first');
            }
        }

        this.ready = function(f) {
            // TODO
            window.mixpanel.ready(f);
        }

        this.identify = function(a, b) {
            // TODO
            var id, traits;
            if (typeof a === 'object') {
                traits = a;
            } else {
                id = a;
                traits = b;
            }
            if (id) window.mixpanel.identify(id);

            var traitAliases = {
                created: '$created',
                email: '$email',
                firstName: '$first_name',
                lastName: '$last_name',
                lastSeen: '$last_seen',
                name: '$name',
                username: '$username',
                phone: '$phone'
            };

            // TODO
            // var username = identify.username();
            // var email = identify.email();
            // var id = identify.userId();
            // var nametag = email || username || id;
            // if (nametag) window.mixpanel.name_tag(nametag);

            // TODO: var traits = identify.traits(traitAliases);
            // if (traits.$created) del(traits, 'createdAt');

            window.mixpanel.register(traits); // TOCHECK: analytics.js does dates(traits, iso)
            window.mixpanel.people.set(traits); // TOCHECK: do we always want to enable people tracking?
        }

        this.track = function(event, traits) {
            // TODO

            if (typeof traits === 'object') {
                // delete mixpanel's reserved properties, so they don't conflict
                delete traits.distinct_id;
                delete traits.ip;
                delete traits.mp_name_tag;
                delete traits.mp_note;
                delete traits.token;
            }

            // track the event
            // TODO: props = dates(props, iso);
            window.mixpanel.track(event, traits);
        }

        this.trackLink = function(elements, event, traits) {
            // TODO
            window.mixpanel.track_links(elements, event, traits);
        }

        this.trackForm = function(elements, event, traits) {
            // TODO
            window.mixpanel.track_forms(elements, event, traits);
        }

        this.page = function(a, b, c) {
            self.calledPage = true;

            var name, traits;
            if (typeof a === 'object') {
                traits = a;
            } else if (typeof b === 'object') {
                name = a;
                traits = b;
            } else if (typeof c === 'object') {
                name = a + ' ' + b;
                traits = c;
            }
            // TODO
            //  use track_pageview here?
            window.mixpanel.track_pageview('Viewed ' + name + ' Page', traits);
        }

        this.alias = function(to) {
            var mp = window.mixpanel;
            if (mp.get_distinct_id && mp.get_distinct_id() === to) return;
            // HACK: internal mixpanel API to ensure we don't overwrite
            // - as per Analytics.js Mixpanel plugin
            if (mp.get_property && mp.get_property('$people_distinct_id') === to) return;
            //
            mp.alias(to);
        }

        this.userId = function() {
            return window.mixpanel.get_distinct_id();
        }

        this.userTraits = function() {
            // TODO
            var traits = window.mixpanel.people.get();
            return traits;
        }
    }

    //
    // utility methods
    //

    function titleCase(str) {
        return typeof str === 'string'
            ? str.replace(/\w\S*/g, function(txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); })
            : str;
    }
}();
