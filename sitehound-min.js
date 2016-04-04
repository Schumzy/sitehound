//
//  SiteHound - Easy & powerful user, session and event tracking
//  ~~ 500 Startups Distro Team // #500STRONG // 500.co ~~
//
//  @author        Andy Young // @andyy // andy@apexa.co.uk
//  @version       0.81 - 4th April 2016
//  @licence       GNU GPL v3
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
!function(){function SiteHound(e,t){function r(e){if(-1!=m.domainsIgnore.indexOf(e))return!0;if(m.domainsIgnoreIPAddress&&/([0-9]{1,3}\.){3}[0-9]{1,3}/.test(e))return!0;for(var t=0;t<m.domainsIgnoreSubdomains.length;t++)if(0==e.indexOf(m.domainsIgnoreSubdomains[0]+"."))return!0;return!1}function i(){m.page||(m.page=detectPage(location.pathname)),void 0!==m.overrideReferrer&&(m.thisPageTraits.referrer=m.thisPageTraits.Referrer=m.thisPageTraits.$referrer=m.overrideReferrer),n();var e=m.adaptor.userTraits();if(e.createdAt&&(m.globalTraits["Days since signup"]=Math.floor((new Date-new Date(e.createdAt))/1e3/60/60/24),m.info("Days since signup: "+m.globalTraits["Days since signup"])),m.userTraits["email domain"]?m.userTraits["email domain"]=m.userTraits["email domain"].match(/[^@]*$/)[0]:(e.email||m.userTraits.email)&&(m.userTraits["email domain"]=(e.email||m.userTraits.email).match(/[^@]*$/)[0]),window.FS&&window.FS.getCurrentSessionURL)m.globalTraits["Fullstory URL"]=FS.getCurrentSessionURL();else if(!m.sniffed){var t=window._fs_ready;window._fs_ready=function(){m.adaptor.identify({"Fullstory URL":FS.getCurrentSessionURL()}),"function"==typeof t&&t()}}if(m.userId){m.info("Received userId: "+m.userId);var e={};for(var r in m.userTraits)e["User "+r]=m.userTraits[r];var i,o=f(m.globalTraits,e);m.adaptor.userId()?(i=m.adaptor.userId(),m.info("Current userId: "+i)):(m.info("Anonymous session until now - alias()"),m.adaptor.alias(m.userId),m.adaptor.identify("x")),m.info("identify("+m.userId+", [traits])"),m.userId!==i&&(o=f(o,l({createdAt:(new Date).toISOString()}))),m.adaptor.identify(m.userId,o),m.userId!==i&&(m.info("userId != currentUserId - Login"),m.track("Login")),c("logged_out","",-100)}else m.adaptor.identify(m.globalTraits),m.detectLogout=void 0===m.detectLogout?void 0!==m.userId:m.detectLogout,m.detectLogout&&(m.info("Detecting potential logout.."),m.adaptor.userId()&&(u("logged_out")||(m.track("Logout"),c("logged_out",!0),m.info("Logout"))));if(m.trackLandingPage&&a("Landing",m.landingPageTraits),m.page){var s=m.page.split("|",2).map(function(e){return e.trim()});s.push(m.pageTraits);a.apply(m,s)}else m.trackAllPages&&a("Unidentified")}function n(){var e=u("firstSeen")||(new Date).toISOString();c("firstSeen",e,366);var t=Math.floor((new Date-new Date(e))/1e3/60/60/24);m.globalTraits["First seen"]=e,m.globalTraits["Days since first seen"]=t,m.info("Visitor first seen: "+e),m.info("Days since first seen: "+t);var r=u("sessionStarted")||(new Date).toISOString(),i=(u("sessionUpdated")||(new Date).toISOString(),Math.floor((new Date-new Date(r))/1e3/60));m.globalTraits["Session started"]=r,m.globalTraits["Minutes since session start"]=i,m.info("Session started: "+r),m.info("Session duration: "+i);var n=i>m.sessionTimeout;n&&(m.info("Session timed out - tracking as new session"),r=(new Date).toISOString()),c("sessionStarted",r),c("sessionUpdated",(new Date).toISOString());var a=(n?0:parseInt(u("pageViews")||0))+1;if(m.thisPageTraits["Pageviews this session"]=a,c("pageViews",a),m.info("Pageviews: "+a),m.isLandingPage=!1,!n){if(a>1)return;m.isLandingPage=!0,m.info("Detected landing page")}var o=parseInt(u("sessionCount")||0)+1;if(m.globalTraits["Session count"]=o,c("sessionCount",o,366),m.info("Session count: "+o),!n){for(var g={},p=["UTM Source","UTM Medium","UTM Campaign","UTM Term","UTM Content","Landing page","Landing page type","Referrer","Referrer domain","Referrer type"],h=0;h<p.length;h++)g[p[h]]=null;var S=s();Object.keys(S).length>0&&(m.info("utm params:"),m.info(S),g=f(g,S));var v,y=document.referrer.match(/https?:\/\/([^\/]+)(\/.*)/),T=null;y&&(T=y[1],v=y[2]),T===location.host?-1!==m.trackReferrerLandingPages.indexOf(v)?(m.info("Detected known untracked landing page: "+document.referrer),m.trackLandingPage=!0,m.landingPageTraits={path:v,url:document.referrer,$current_url:document.referrer,"Tracked from URL":location.href,referrer:""},g["Landing page"]=v):document.referrer===location.href?(m.trackLandingPage=!0,g["Landing page"]=location.pathname):m.trackDebugWarn("Landing page with local referrer - tracking code not on all pages?"):(m.trackLandingPage=!0,g["Landing page"]=location.pathname,g.Referrer=document.referrer?document.referrer:null,g["Referrer domain"]=T),g["Landing page"]&&(g["Landing page type"]=m.page),g["Referrer domain"]==location.host&&(g["Referrer type"]=detectPage(v)),g.utm_source||((d(document.URL,"gclid")||d(document.URL,"gclsrc"))&&(g.utm_source="google",g.utm_medium||(g.utm_medium="cpc")),"t.yesware.com"==g["Referrer domain"]&&(g.utm_source="Yesware",g.utm_medium||(g.utm_medium="email")));var k={},w={};for(var I in g)k[I+" [first touch]"]=g[I],w[I+" [last touch]"]=g[I];m.info("Attribution params:"),m.info(g),1==o&&(m.info("..setting first touch params"),m.globalTraits=f(m.globalTraits,l(k))),m.info("..setting last touch params"),m.globalTraits=f(m.globalTraits,w)}}function a(e,t,r){"object"==typeof r?m.adaptor.page(e,t,m.getTraitsToSend(r)):"object"==typeof t?m.adaptor.page(e,m.getTraitsToSend(t)):t?m.adaptor.page(e,t,m.getTraitsToSend()):m.adaptor.page(e,m.getTraitsToSend())}function o(){for(;e.queue&&e.queue.length>0;){var t=e.queue.shift(),r=t.shift();m[r]&&m[r].apply(m,t)}}function s(){for(var e="utm_source utm_medium utm_campaign utm_content utm_term".split(" "),t="",r={},i=0;i<e.length;++i)t=d(document.URL,e[i]),t.length&&(r["UTM "+titleCase(e[i].slice(4))]=t);return r}function d(e,t){t=t.replace(/[\[]/,"\\[").replace(/[\]]/,"\\]");var r="[\\?&]"+t+"=([^&#]*)",i=new RegExp(r),n=i.exec(e);return null===n||n&&"string"!=typeof n[1]&&n[1].length?"":decodeURIComponent(n[1]).replace(/\+/g," ")}function c(e,t,r,i){var n="";if(0!=r){var a=new Date;a.setTime(a.getTime()+24*r*60*60*1e3),n="expires="+a.toUTCString()}void 0===i&&(i=m.cookieDomain),document.cookie="sh_"+e+"="+t+"; "+n+";path=/"+(i?";domain="+i:"")}function u(e){for(var t="sh_"+e+"=",r=document.cookie.split(";"),i=0;i<r.length;i++){for(var n=r[i];" "==n.charAt(0);)n=n.substring(1);if(0==n.indexOf(t))return n.substring(t.length,n.length)}return""}function f(e,t){var r={};for(var i in e)r[i]=e[i];for(var i in t)r[i]=t[i];return r}function l(e){var t=m.adaptor.userTraits(),r={};for(var i in e)i in t||(r[i]=e[i]);return r}function g(e){for(var t=p(e),r=0;r<t.length;++r){var i="__tld__",n="."+t[r];if(c(i,1,0,n),u(i))return c(i,"",-100,n),n}return""}function p(e){var t=e.split("."),r=t[t.length-1],i=[];if(4==t.length&&parseInt(r,10)==r)return i;if(1>=t.length)return i;for(var n=t.length-2;n>=0;--n)i.push(t.slice(n).join("."));return i}var h={trackPages:null,page:null,trackAllPages:!1,detectURLChange:!0,detectHashChange:!1,domainsIgnore:["localhost"],domainsIgnoreIPAddress:!0,domainsIgnoreSubdomains:["staging","test"],trackReferrerLandingPages:[],globalTraits:{},pageTraits:{},thisPageTraits:{},userId:void 0,userTraits:{},detectLogout:void 0,logToConsole:!1,sessionTimeout:30,overrideReferrer:void 0},m=this;if(this.adaptor=t,"object"!=typeof t||!t.check())return void(window.console&&console.error&&console.error("[SiteHound] adaptor not valid"));for(var S in h)void 0!==e[S]&&(h[S]=e[S]),this[S]=h[S];this.thisPageTraits["SiteHound library version"]=this.VERSION=VERSION;var v,y;return this.sniff=this.done=function(){try{if(m.info("Sniffing.."),r(location.host))return m.info("Ignoring host: "+location.host),void(m.adaptor=new SiteHound_Adaptor_Disabled);if(u("dnt"))return m.info("do-not-track cookie present"),void(m.adaptor=new SiteHound_Adaptor_Disabled);if(i(),"function"==typeof m.adaptor.afterSniff&&m.adaptor.afterSniff(),o(),m.sniffed)return;m.sniffed=!0,!m.detectURLChange&&!m.detectHashChange||v||(y=location.href,v=setInterval(function(){(m.detectHashChange?location.href!==y:location.href.replace(/#.*$/,"")!==y.replace(/#.*$/,""))&&(m.overrideReferrer=y||document.referrer,y=location.href,m.info("Detected URL change: "+y),m.page=void 0,m.sniff())},1e3))}catch(e){this.trackError(e)}},this.identifyOnce=function(e){m.adaptor.identify(m.ignoreExistingTraits(e))},this.detectPage=function(e){for(var t in m.trackPages){var r=m.trackPages[t];Array.isArray(r)||(r=[r]);for(var i=0;i<r.length;++i){var n=r[i];if("function"==typeof n.test){if(n.test(e))return m.info("Detected page: "+t),t}else if("."===n[0]){if(e===location.pathname&&document.body.className.match(new RegExp("(?:^|\\s)"+RegExp.escape(n.slice(1))+"(?!\\S)")))return m.info("Detected page: "+t),t}else if(n.replace(/\/$/,"")===e.replace(/\/$/,""))return m.info("Detected page: "+t),t}}},this.getTraitsToSend=function(e){return"object"==typeof e?f(m.thisPageTraits,e):m.thisPageTraits},this.info=function(e){m.logToConsole&&window.console&&console.log&&("object"==typeof e?console.log(e):console.log("[SiteHound] "+e))},this.doNotTrack=function(e){e="undefined"==typeof e?!0:!!e,e?c("dnt","1",1e3):c("dnt","",-100)},this.info("Ready (v"+VERSION+")"),this.cookieDomain=g(location.hostname),this.info("Cookie domain: "+this.cookieDomain),u("dnt")?(m.info("do-not-track cookie present"),void(m.adaptor=new SiteHound_Adaptor_Disabled)):void(e.isDone&&this.sniff())}function SiteHound_Adaptor_Disabled(){this.check=this.ready=this.identify=this.track=this.trackLink=this.trackForm=this.page=this.alias=this.userId=this.userTraits=function(){}}function SiteHound_Adaptor_Segment(){window.analytics=window.analytics||[];var e=this;return this.check=function(){return"undefined"!=typeof analytics.ready},this.check()?(this.calledPage=!1,analytics.on("page",function(){e.calledPage=!0}),this.ready=function(e){analytics.ready(e)},this.identify=function(e,t){analytics.identify(e,t)},this.track=function(e,t){analytics.track(e,t)},this.trackLink=function(e,t,r){analytics.trackLink(e,t,r)},this.trackForm=function(e,t,r){analytics.trackForm(e,t,r)},this.page=function(t,r,i){e.calledPage=!0,analytics.page(t,r,i)},this.alias=function(e){analytics.alias(e)},this.userId=function(){var e=analytics.user();return e?e.id():void 0},this.userTraits=function(){var e=analytics.user(),t=e.traits();return t},void(this.afterSniff=function(){e.calledPage||analytics.page()})):void(window.console&&console.error&&console.error("[SiteHound] window.analytics is not initialized - ensure analytics.js snippet is included first"))}function titleCase(e){return"string"==typeof e?e.replace(/\w\S*/g,function(e){return e.charAt(0).toUpperCase()+e.substr(1).toLowerCase()}):e}var VERSION="0.81";!function(){var initialConfig=window.sitehound||{},adaptorClass;if("object"!=typeof initialConfig.adaptor){adaptorClass=titleCase(initialConfig.adaptor)||"Segment";try{var adaptor=eval("new SiteHound_Adaptor_"+adaptorClass)}catch(error){return void(window.console&&console.error&&(console.error("[SiteHound] adaptor class SiteHound_Adaptor_"+adaptorClass+" could not be loaded"),console.error("[SiteHound] "+error.name+"; "+error.message)))}}else var adaptor=initialConfig.adaptor;return adaptor.check()?void adaptor.ready(function(){var e=window.sitehound||{},t=new SiteHound(e,adaptor);window.sitehound=t}):void(window.console&&console.error&&console.error("[SiteHound] failed to attach to "+(adaptorClass?adaptorClass:"adaptor")))}(),SiteHound.prototype.identify=function(e,t){this.adaptor.identify(e,t)},SiteHound.prototype.track=function(e,t){"object"==typeof t?this.adaptor.track(e,this.getTraitsToSend(t)):this.adaptor.track(e,this.getTraitsToSend())},SiteHound.prototype.trackOnce=function(e,t){var r=this.adaptor.userTraits();if(void 0===r["First "+e]){var i={};i["First "+e]=(new Date).toISOString(),this.adaptor.identify(i),this.track(e,t)}},SiteHound.prototype.trackAndCount=function(e,t){var r=this.adaptor.userTraits(),i=1;r&&(i=r[e+" Count"]?parseInt(r[e+" Count"])+1:1);var n={};n["First "+e]=(new Date).toISOString(),this.identifyOnce(n);var a={};a[e+" Count"]=i,a["Last "+e]=(new Date).toISOString(),this.adaptor.identify(a),this.track(e,t)},SiteHound.prototype.trackLink=function(e,t){this.adaptor.trackLink(e,t,this.getTraitsToSend())},SiteHound.prototype.trackForm=function(e,t){this.adaptor.trackForm(e,t,this.getTraitsToSend())},SiteHound.prototype.trackDebugInfo=function(e){this.trackDebug(e,"info")},SiteHound.prototype.trackDebugWarn=function(e){this.trackDebug(e,"warn")},SiteHound.prototype.trackDebug=function(e,t){this.adaptor.track("Tracking Debug",{message:e,level:t,"SiteHound library version":this.VERSION}),this.info("["+t+"] "+e)},SiteHound.prototype.trackError=function(e){this.adaptor.track("Tracking Error",{name:e.name,message:e.message,"SiteHound library version":this.VERSION}),window.console&&console.error&&console.error("[SiteHound] "+e.name+"; "+e.message)}}();