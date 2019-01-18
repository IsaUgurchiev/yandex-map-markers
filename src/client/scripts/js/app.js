define('app', [
    'domReady',
    'jquery',
    'underscore',
    'yandex-map-markers'
],  function ( domReady, $, _, YandexMapMarkers) {
    'use strict';

    console.log('%cfile: app.js', 'color: #C2ECFF');

    /** private */
    var _this;

    /** constructor
     * @return {boolean}
     */
    function App(){
        console.log('%ctrace: App -> constructor', 'color: #ccc');

        _this = this;

        new YandexMapMarkers('map');

        domReady(function () {
            console.log('%ctrace: App -> constructor -> domReady', 'color: #ccc');
        });
    }

    return App;
});