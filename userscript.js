// ==UserScript==
// @name         Loux Legacy
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        *://starve.io*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=starve.io
// @webRequest   [{"selector":"*https://cadmus.script.ac/d1r100yi8pmbig/script.js*","action":"cancel"}]
// @run-at       document-start
// @grant        none
// ==/UserScript==

function injectJS(dt) {
    let s = document.createElement('script');
    s.type = 'text/javascript';
    s.innerHTML = dt;
    document.getElementsByTagName('body')[0].appendChild(s);
    document.getElementsByTagName('body')[0].removeChild(s);
};
const request = url => fetch(url).then(res => res.text());
let code = request("https://raw.githubusercontent.com/youdie323323/starve-deobfuscator/main/script_client.js");
window.addEventListener("load", e => {
    setTimeout(async () => {
        injectJS(await code);
    }, 1000);
});
let observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
        for (let node of mutation.addedNodes) {
            if (node.src && node.src.match(`client.min.js`)) {
                node.outerHTML = ``
                node.innerHTML = ``;
                node.src = '';
            };
        };
    };
});

observer.observe(document, {
    childList: true,
    subtree: true
});
