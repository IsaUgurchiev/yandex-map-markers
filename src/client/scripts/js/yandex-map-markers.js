define('yandex-map-markers', [
    'domReady',
    'jquery',
    'underscore',
    'backbone',
    'jquery.scrollTo',
    'jquery.happymodal'
], function (domReady, $, _, Backbone) {
    'use strict';

    console.log('%cfile: yandex-map-markers.js', 'color: #C2ECFF');

    var self;
    var router;
    var map_options = {
        default_options: {
            center: [55.751574, 37.573856],
            zoom: 10,
            controls: []
        },

        markers_options: {
            iconImageHref: '../../images/marker.png'
        },

        controls_types: {
            zoomControl : { right: "8px", top: "125px" }
        }
    };

    //Шаблон для балуна
    var __balloonTemplate = function() {
        self.marker_balloon_layout = ymaps.templateLayoutFactory.createClass(
            '<div class="baloon-content">' +
            '<div class="baloon-title">{{ properties.name }}</div>' +
            '<div class="baloon-description">{{ properties.description }}</div>' +
            '<div class="baloon-city">{{ properties.city }}</div>' +
            '<div class="baloon-address">{{ properties.address }}</div>' +
            '<div class="baloon-phone">{{ properties.phone }}</div>' +
            '</div>'
        );

        ymaps.layout.storage.add('map#marker_balloon_layout', self.marker_balloon_layout);
    };

    //Инициализация роутеров
    var __init_routes = function() {
        self.routes_init = true;

        console.log('%ctrace: Map -> init_routes', 'color: #ccc');

        router.on('route:geolocation', function () {
            self.geolocation();
        });

        if (window.location.hash === '#geolocation') {
            self.geolocation();
        }

        router.on('route:showCities', function () {
            self.showCities();
        });

        if (window.location.hash === '#cities') {
            self.showCities();
        }

        router.on('route:showCitiesByCountyId', function (id) {
            self.showCitiesByCountyId(id);
        });

        if (window.location.hash.indexOf('#county') >= 0) {
            var id = window.location.hash.split('/')[1];
            self.showCitiesByCountyId(id);
        }

        router.on('route:showCityById', function (id) {
            self.showCityById(id);
        });

        if (window.location.hash.indexOf('#city') >= 0) {
            var id = window.location.hash.split('/')[1];
            self.showCityById(id);
        }

        router.on('route:showMetro', function () {
            self.showMetro();
        });

        if (window.location.hash === '#metro') {
            self.showMetro();
        }

        router.on('route:showStationsByLineId', function (id) {
            self.showStationsByLineId(id);
        });

        if (window.location.hash.indexOf('#metro/line') >= 0) {
            var id = window.location.hash.split('/')[2];
            self.showStationsByLineId(id);
        }

        router.on('route:showStationById', function (id) {
            self.showStationById(id);
        });

        if (window.location.hash.indexOf('#metro/station') >= 0) {
            var id = window.location.hash.split('/')[2];
            self.showStationById(id);
        }

        router.on('route:findAddress', function (str) {
            var str = decodeURIComponent(str);
            $('.js__search-value').val(str);
            ymaps.geocode(str, {
                results: 1,
                kind: 'locality'
            }).then(function (res) {
                var firstGeoObject = res.geoObjects.get(0);

                if(__findCityByLatLng(firstGeoObject.geometry.getCoordinates()[0], firstGeoObject.geometry.getCoordinates()[1])) {
                    var bounds = firstGeoObject.properties.get('boundedBy');
                } else {
                    var closestObject = ymaps.geoQuery(self.objectManager.objects).getClosestTo(firstGeoObject);
                    var bounds = ymaps.geoQuery(firstGeoObject).add(closestObject).getBounds();
                }

                self.map.setBounds(bounds, {
                    checkZoomRange: true
                });
            });
        });

        if (window.location.hash.indexOf('#address') >= 0) {
            var str = window.location.hash.split('/')[1];
            str = decodeURIComponent(str);
            $('.js__search-value').val(str);
            ymaps.geocode(str, {
                results: 1,
                kind: 'locality'
            }).then(function (res) {
                var firstGeoObject = res.geoObjects.get(0);

                if(__findCityByLatLng(firstGeoObject.geometry.getCoordinates()[0], firstGeoObject.geometry.getCoordinates()[1])) {
                    var bounds = firstGeoObject.properties.get('boundedBy');
                } else {
                    var closestObject = ymaps.geoQuery(self.objectManager.objects).getClosestTo(firstGeoObject);
                    var bounds = ymaps.geoQuery(firstGeoObject).add(closestObject).getBounds();
                }

                self.map.setBounds(bounds, {
                    checkZoomRange: true
                });
            });
        }
    };

    //Показать модалку
    var __show_modal = function (page, hideCallback) {
        var $modal = $('[data-happymodal="' + page + '"]'),
            api;

        hideCallback = hideCallback || function() {

        };

        if ($modal.length <= 0) {
            return false;
        }

        api = $.data($modal[0], 'plugin_happymodal');

        if (!api) {
            if (window.location.hash.indexOf('cities') >= 0 || window.location.hash.indexOf('metro') >= 0) {
                window.location.hash = '';
            }

            return false;
        }

        api.show();

        api.options.hideCallback = function() {
            hideCallback();

            if (window.location.hash.indexOf('city') >= 0 || window.location.hash.indexOf('station') >= 0) {
                return false;
            }

            var top = $(window).scrollTop();

            window.location.hash = '';

            if (top > 0) {
                $(window).scrollTop(top);
            }

            console.log('%ctrace: modal hide', 'color: #ccc');
        };
    };

    //Скрыть модалку
    var __hide_modal = function () {
        var $modal = $('.happymodal-open[data-happymodal]'),
            api;


        if ($modal.length <= 0) {
            return false;
        }

        api = $.data($modal[0], 'plugin_happymodal');

        if (!api) {
            if (window.location.hash.indexOf('cities') >= 0 || window.location.hash.indexOf('metro') >= 0) {
                window.location.hash = '';
            }

            return false;
        }

        api.hide();
    };

    //Найти город по названию
    var __findCityByName = function(name) {
        var result = [];

        _.find(self.collectionMarkers.features, function(object) {
            if(object.properties.city === name) {
                result = object;
                return true;
            }
        });

        return result;
    };

    //Найти город по координатам
    var __findCityByLatLng = function(lat, lng) {
        var result;

        _.find(self.collectionMarkers.features, function(object) {
            var city_lat = parseFloat(object.properties.city_coordinates[0]);
            var city_lng = parseFloat(object.properties.city_coordinates[1]);

            if(city_lat === lat && city_lng === lng) {
                result = object;
                return true;
            }
        });

        return result;
    };

    //Найти город по координатам
    var __findCityByNameFromDB = function(city) {
        city = city.toLowerCase();

        var result,
            cityPrefix = ['пос. ', 'г. ', 'станица ', 'с. '],
            prefix;

        self.collectionMarkers.features.forEach(function(object, i) {
            var cityDB = object.properties.city;

            if (cityDB.indexOf(cityPrefix[0]) >= 0) {
                prefix = cityPrefix[0];
            }

            else if (cityDB.indexOf(cityPrefix[1]) >= 0) {
                prefix = cityPrefix[1];
            }

            else if (cityDB.indexOf(cityPrefix[2]) >= 0) {
                prefix = cityPrefix[2];
            }

            else if (cityDB.indexOf(cityPrefix[3]) >= 0) {
                prefix = cityPrefix[3];
            }

            cityDB = cityDB.slice(prefix.length, cityDB.length);
            cityDB = cityDB.toLowerCase();

            if (city.indexOf(cityDB) >= 0) {
                result = object;
            }
        });

        return result;
    };

    //Получить уникальные города
    var __getCities = function() {
        var result = [];

        _.each(self.collectionMarkers.features, function(object) {
            if(object.properties.city !== 'г. Москва' && object.properties.city !== 'г. Санкт-Петербург') {
                result.push(object);
            }
        });

        result = _.uniq(result, function(object) {
            return object.properties.city;
        });

        return result;
    };

    //Получить уникальные города принадлежайщему округу с id
    var __getCitiesByCountyName = function(name) {
        var result = [];

        _.each(self.collectionMarkers.features, function(object) {
            if(object.properties.county === name) {
                result.push(object);
            }
        });

        result = _.uniq(result, function(object) {
            return object.properties.city;
        });

        return result;
    };

    //Сортировка городов по названиям
    var __sortCities = function(cities) {
        var result = _.sortBy(cities, function(object) {
            return object.properties.city;
        });

        return result;
    };

    //Получить уникальные округа
    var __getCounties = function() {
        var result = _.uniq(self.collectionMarkers.features, function(object) {
            return object.properties.county;
        });

        return result;
    };

    //Сортировка округов по названиям
    var __sortCounties = function(counties) {
        var result = _.sortBy(counties, function(object) {
            return object.properties.county;
        });

        return result;
    };

    //Найти схему метро по названию города
    var __findMetroLines = function(name) {
        var result = [];
        var name = name.replace('г. ', '');

        _.find(self.collectionMetro, function(object) {
            if(object.name === name) {
                result = object;
                return true;
            }
        });

        return result;
    };

    //Сортировка линий метро по названиям
    var __sortMetroLines = function(lines) {
        var result = _.sortBy(lines, function(object) {
            return object.name;
        });

        return result;
    };

    //Получаем список станций по линиям метро
    var __getMetroStationsFromLines = function(lines) {
        var result = [];
        _.each(lines, function(line){
            _.each(line.stations, function(station){
                result.push(station);
            });
        });

        return result;
    };

    //Получаем список станций по id линии метро
    var __getMetroStationsFromLinesByLineId = function(lines, id) {
        var result = [];

        _.find(lines, function(object) {
            if(object.id === id) {
                _.each(object.stations, function(station){
                    result.push(station);
                });

                return true;
            }
        });

        return result;
    };

    //Сортировка станций метро по названиям
    var __sortMetroStations = function(stations) {
        var result = _.sortBy(stations, function(object) {
            return object.name;
        });

        return result;
    };

    //Найти станцию метро по id
    var __findStationById = function(id) {
        var result = [];

        _.find(self.collectionMetro, function(object) {
            _.find(object.lines, function(line) {
                _.find(line.stations, function(station) {
                    if(station.id === id) {
                        result = station;
                        return true;
                    }
                });
            });
        });

        return result;
    };


    //Поиск среди видимых объектов города, имеющего метрополитен
    var __findCityWithMetro = function(objects) {
        self.current_city = null;

        if(self.map.getZoom() < 8) {
            $('.js__choose-metro').addClass('no-visible');
            return false;
        }

        if(objects.getLength() > 0) {
            objects.each(function(object) {
                _.find(self.collectionMetro, function(item) {
                    if(object.properties.get('city').replace('г. ','') === item.name) {
                        self.current_city = item.name;
                        return true;
                    }
                });

                $('.js__choose-metro').removeClass('no-visible');

                if(!self.current_city) {
                    $('.js__choose-metro').addClass('no-visible');
                }
            });
        } else {
            ymaps.geocode(self.map.getCenter(), {
                results: 1,
                kind: 'locality'
            }).then(function (res) {
                var city = res.geoObjects.get(0).properties.get('metaDataProperty.GeocoderMetaData.AddressDetails.Country.AdministrativeArea.SubAdministrativeArea.Locality.LocalityName');
                _.find(self.collectionMetro, function(item) {
                    if(city === item.name) {
                        self.current_city = item.name;
                        return true;
                    }
                });

                $('.js__choose-metro').removeClass('no-visible');

                if(!self.current_city) {
                    $('.js__choose-metro').addClass('no-visible');
                }
            });
        }
    };

    function Map(map_id, options) {
        console.log('%ctrace: Map -> constructor', 'color: #ccc');

        var Router = Backbone.Router.extend({
            routes: {
                'geolocation' : 'geolocation',
                'cities' : 'showCities',
                'county/:id' : 'showCitiesByCountyId',
                'city/:id' : 'showCityById',
                'metro' : 'showMetro',
                'metro/line/:id' : 'showStationsByLineId',
                'metro/station/:id' : 'showStationById',
                'address/:str' : 'findAddress'
            }
        });

        router = new Router();

        self = this;
        self.$body = $('body');
        self.map_id = map_id;
        self.options = options;

        domReady(function () {
            if($('#' + self.map_id).length <= 0){
                console.warn('%ctrace: Map: not found dom elements', 'color: #ccc');

                if($('#js__suggest-view').length > 0){
                    ymaps.ready(function() {
                        self.init_suggestView();
                        $('body').on('click', '.js__search-btn', self.sendAddressToMapPage);
                    });
                }

                return false;
            }

            ymaps.ready(function() {
                self.initialize();
            });
        });
    }

    Map.prototype = {
        initialize: function() {
            console.log('%ctrace: Map -> initialize', 'color: #ccc');

            self.init_map();
            self.init_ballon_template();
            self.init_event_map_change();
            self.init_map_controls();
            self.init_my_controls();
            self.init_object_manager();
            self.add_markers();
        },

        sendAddressToMapPage: function(event) {
            event.preventDefault();

            var $address = $('.js__search-value').val();
            if (!$address) {
                $('.js__search-value').val('');
                $('.js__search-value').addClass("shake animated");

                setTimeout(function() {
                    $('.js__search-value').removeClass("shake animated");
                }, 1000);

                return false;
            }

            window.location.href = '/map#address/' + encodeURIComponent($address);
        },

        //Инициализация SuggestView для поиска
        init_suggestView: function() {
            self.suggestView = new ymaps.SuggestView('js__suggest-view', {
                offset: [8, 1],
                width: 348
            });
        },

        //Инициализация карты
        init_map: function() {
            var init_options = $.extend({}, map_options.default_options, self.map_id);
            self.map = new ymaps.Map(
                self.map_id,
                init_options
            );

            self.map.behaviors.disable('scrollZoom');
            self.suggestView = new ymaps.SuggestView('js__suggest-view', {
                offset: [14, 1],
                width: 378
            });

            /*self.suggestView.state.events.add('change', function () {
                var $input = $('#js__suggest-view');
                var activeIndex = self.suggestView.state.get('activeIndex');

                if (typeof activeIndex === 'number') {
                    var activeItem = self.suggestView.state.get('items')[activeIndex];
                    if (activeItem && activeItem.value != $input.value) {
                        $input.val(activeItem.value);
                    }
                }
            });*/

        },

        //Инициализация шаблона для балунов
        init_ballon_template: function() {
            __balloonTemplate();
        },

        //Инициализация элементов урпавления для карты
        init_map_controls: function() {
            for (var control in map_options.controls_types) {
                self.map.controls.add(control, {
                    float: 'none',
                    position: map_options.controls_types[control]
                });
            }
        },

        //Событие при dran&drop карты
        init_event_map_change: function() {
            self.map.events.add(['boundschange','datachange','objecttypeschange'], function(e){
                self.getVisibleMarkers();
            });
        },

        //Инициализация дополнительных элементов управления
        init_my_controls: function() {
            $('body').on('click', '.js__show-object-balloon', _.bind(self.showObjectBalloon, self));
            $('body').on('click', '.js__map-modal-close', _.bind(__hide_modal));
            $('body').on('click', '.js__search-btn', self.findAddress);
        },

        //Инициализация ObjectManager
        init_object_manager: function() {
            self.objectManager = new ymaps.ObjectManager({
                clusterize: true,
                geoObjectPreset: 'islands#greenDotIcon',
                geoObjectBalloonContentLayout: self.marker_balloon_layout,
                geoObjectHideIconOnBalloonOpen: false,
                geoObjectIconLayout: 'default#image',
                geoObjectIconImageHref: map_options.markers_options.iconImageHref,
                geoObjectIconImageSize: [36, 36],
                geoObjectIconImageOffset: [-18, -18],
                clusterBalloonContentLayout: 'cluster#balloonCarouselContent',
                clusterBalloonItemContentLayout: self.marker_balloon_layout,
                clustergroupByCoordinates: false,
                clusterDisableClickZoom: false,
                clusterHideIconOnBalloonOpen: false
            });

            self.map.geoObjects.add(self.objectManager);
        },

        //Добавление меток в objectManager (и следовательно на карту)
        add_markers: function() {
            $.ajax({
                url: '/json/data.json'
            }).done(function(data) {
                self.collectionMarkers = data;
                self.objectManager.add(self.collectionMarkers);
                self.load_metro_data();
            });
        },
        
        //Подгрузка данных о метро
        load_metro_data: function() {
            $.ajax({
                url: '/json/metro.json'
            }).done(function(data) {
                self.collectionMetro = data;
                self.getVisibleMarkers();
            });
        },

        //Получить видимые метки
        getVisibleMarkers: function() {
            var result = ymaps.geoQuery(self.objectManager.objects).searchInside(self.map);
            result.then(function () {

                self.renderVisibleObjects(result);

                __findCityWithMetro(result);

                if(!self.routes_init) {
                    __init_routes();
                }
            });
        },

        //Отрисовать видимые на карте объекты под картой
        renderVisibleObjects: function(objects) {
            var i = 1,
                objectsItemTemplate = _.template($('#js__map-objects-item-template').html()),
                objectsList = '';

            objects.each(function(object) {
                var item = {
                    id: object.properties.get('id'),
                    name: object.properties.get('name'),
                    region: object.properties.get('region'),
                    city: object.properties.get('city'),
                    address: object.properties.get('address'),
                    description: object.properties.get('description'),
                    phone: object.properties.get('phone'),
                    i: i
                };

                i++;
                objectsList += objectsItemTemplate(item);
            });

            $('.js__map-objects').html(objectsList);
        },

        //Показать баллун при клике по объекту под картой
        showObjectBalloon: function(e) {
            //чистим строку поиска
            $('.js__search-value').val('');

            var $el = $(e.currentTarget),
                $id = $el.attr('data-id');

            var finded = self.objectManager.objects.getById($id);
            var coord = finded.geometry.coordinates;

            self.map.setCenter(coord, 17)
                .then(function () {
                    setTimeout(function() {
                        var objectState = self.objectManager.getObjectState($id);
                        //Проверяем, находится ли объект в видимой области карты.
                        if (objectState.isShown) {
                            //Если объект попадает в кластер, открываем балун кластера с нужным выбранным объектом.
                            if (objectState.isClustered) {
                                self.objectManager.clusters.state.set('activeObject', finded);
                                self.objectManager.clusters.balloon.open(objectState.cluster.id);
                            } else {
                                //Если объект не попал в кластер, открываем его собственный балун.
                                self.objectManager.objects.balloon.open($id);
                            }
                        }
                    }, 300);
                });

            self.$body.scrollTo('#map-title', {
                duration: '800',
                offsetTop : '250'
            });

            return false;
        },

        //Геолокация
        geolocation: function() {
            //чистим строку поиска
            $('.js__search-value').val('');

            ymaps.geolocation.get({
                provider: 'auto',
                mapStateAutoApply: true
            }).then(function (res) {
                var firstGeoObject = res.geoObjects.get(0);
                var closestObject = ymaps.geoQuery(self.objectManager.objects).getClosestTo(firstGeoObject);

                firstGeoObject.options.set('preset', 'islands#geolocationIcon');
                firstGeoObject.options.set('hideIconOnBalloonOpen', false);
                firstGeoObject.properties.set({
                    balloonContentBody: 'Мое местоположение'
                });

                self.map.geoObjects.add(firstGeoObject);

                var bounds = ymaps.geoQuery(firstGeoObject).add(closestObject).getBounds();

                self.map.setBounds(bounds, {
                    checkZoomRange: true
                });

                window.location.hash = '';
            });
        },

        //Показать список городов в модальном окне
        showCities: function() {
            __show_modal('cities');
            if ($('.js__map-modal-cities-main > *').length <= 0){
                self.renderMainCities();
            }

            if ($('.js__map-modal-county > *').length <= 0){
                self.renderCounties();
            }

            self.renderCities();

            $('.js__map-modal-county-item-link').removeClass('active');
            $('.js__map-modal-county-item-link[data-id= "all"]').addClass('active');

            //$('.js__map-modal-city-item-link').removeClass('active');
        },

        //Показать список городов принадлежайщих округу с id
        showCitiesByCountyId: function(id) {
            __show_modal('cities');
            if ($('.js__map-modal-cities-main > *').length <= 0){
                self.renderMainCities();
            }

            if ($('.js__map-modal-county > *').length <= 0){
                self.renderCounties();
            }

            var item = self.objectManager.objects.getById(id);
            if(!item || $('.js__map-modal-county-item-link[data-id= "'+ id + '"]').length<=0) {
                return false;
            }

            self.renderCitiesByCountyName(item.properties.county);

            $('.js__map-modal-county-item-link').removeClass('active');
            $('.js__map-modal-county-item-link[data-id= "'+ id + '"]').addClass('active');

            //$('.js__map-modal-city-item-link').removeClass('active');
        },

        //Показать город на карте по id
        showCityById: function(id) {
            //чистим строку поиска
            $('.js__search-value').val('');
            __hide_modal();

            var item = self.objectManager.objects.getById(id);

            if(!item) {
                return false;
            }

            var address_full;

            if(item.properties.city == 'г. Москва') {
                address_full = 'Россия, ' + item.properties.city;
            } else {
                address_full = 'Россия, ' + item.properties.region + ', ' + item.properties.city;
            }

            self.setCenterByAddress(address_full);
        },

        //Показать станции метро
        showMetro: function() {
            if(!self.current_city) {
                return false;
            }

            __show_modal('metro');

            var metroLines = __findMetroLines(self.current_city);
            if(!metroLines) {
                return false;
            }

            metroLines = __sortMetroLines(metroLines.lines);

            var stations = __getMetroStationsFromLines(metroLines);
            if(!stations) {
                return false;
            }

            stations = __sortMetroStations(stations);

            self.renderMetroLines(metroLines);
            self.renderMetroStations(stations);

            $('.js__map-modal-line-item-link').removeClass('active');
            $('.js__map-modal-line-item-link[data-id= "all"]').addClass('active');

            //$('.js__map-modal-station-item-link').removeClass('active');
        },

        //Показать станции метро по id линии
        showStationsByLineId: function(id) {
            if(!self.current_city) {
                return false;
            }

            __show_modal('metro');

            var metroLines = __findMetroLines(self.current_city);
            if(!metroLines) {
                return false;
            }

            metroLines = __sortMetroLines(metroLines.lines);

            var stations = __getMetroStationsFromLinesByLineId(metroLines, id);
            if(!stations) {
                return false;
            }

            stations = __sortMetroStations(stations);

            self.renderMetroLines(metroLines);
            self.renderMetroStations(stations);

            $('.js__map-modal-line-item-link').removeClass('active');
            $('.js__map-modal-line-item-link[data-id= "'+ id + '"]').addClass('active');

            //$('.js__map-modal-station-item-link').removeClass('active');
        },

        //Показать метро на карте по id
        showStationById: function(id) {
            //чистим строку поиска
            $('.js__search-value').val('');
            __hide_modal();

            var item = __findStationById(id);

            if(!item) {
                return false;
            }

            var firstGeoObject = new ymaps.Placemark([item.lat, item.lng]);
            var closestObject = ymaps.geoQuery(self.objectManager.objects).getClosestTo(firstGeoObject);

            var bounds = ymaps.geoQuery(firstGeoObject).add(closestObject).getBounds();

            self.map.setBounds(bounds, {
                checkZoomRange: true
            });
        },

        //Найти адрес по форме поиска
        findAddress: function(event) {
            event.preventDefault();

            var $address = $('.js__search-value').val();

            if (!$address) {
                $('.js__search-value').val('');
                $('.js__search-value').addClass("shake animated");

                setTimeout(function() {
                    $('.js__search-value').removeClass("shake animated");
                }, 1000);

                return false;
            }

            ymaps.geocode($address, {
                results: 1,
                kind: 'locality'
            }).then(function (res) {
                var firstGeoObject = res.geoObjects.get(0);
                var firstGeoObjectCity = res.geoObjects.get(0).properties.get('metaDataProperty').GeocoderMetaData.AddressDetails.Country.AddressLine;

                if(__findCityByNameFromDB(firstGeoObjectCity)) {
                    var bounds = firstGeoObject.properties.get('boundedBy');
                } else {
                    var closestObject = ymaps.geoQuery(self.objectManager.objects).getClosestTo(firstGeoObject);
                    var bounds = ymaps.geoQuery(firstGeoObject).add(closestObject).getBounds();
                }

                self.map.setBounds(bounds, {
                    checkZoomRange: true
                });
            });
        },

        //Отрисовать главные города
        renderMainCities: function() {
            var templateCityItem = _.template($('#js__city-item-template').html()),
                contentMainCities = '',
                mainCities = [];

            var cityMoscow = __findCityByName('г. Москва');
            if(cityMoscow) {
                mainCities.push(cityMoscow);
            }

            var cityPeterburg = __findCityByName('г. Санкт-Петербург');
            if(cityPeterburg) {
                mainCities.push(cityPeterburg);
            }

            _.each(mainCities, function(item){
                contentMainCities += templateCityItem(item.properties);
            });

            $('.js__map-modal-cities-main').html(contentMainCities);
        },

        //Отрисовать все города (кроме главных)
        renderCities: function() {
            var templateCityItem = _.template($('#js__city-item-template').html()),
                contentCities = '';

            var cities = __getCities();

            if(!cities) {
                return false;
            }

            cities = __sortCities(cities);

            _.each(cities, function(item){
                contentCities += templateCityItem(item.properties);
            });

            $('.js__map-modal-cities').html(contentCities);
        },

        //Отрисовать округа
        renderCounties: function() {
            var templateCountyItem = _.template($('#js__county-item-template').html()),
                contentCounties = ''

            var counties = __getCounties();

            if(!counties) {
                return false;
            }

            counties = __sortCounties(counties);

            _.each(counties, function(item){
                contentCounties += templateCountyItem(item.properties);
            });

            $('.js__map-modal-county').html('<a class="map-link active js__map-modal-county-item-link" href="#cities" data-id="all"><span>Все округа</span></a>');
            $('.js__map-modal-county').append(contentCounties);
        },

        //Отрисовать все города по названию округа (кроме главных)
        renderCitiesByCountyName: function(name) {
            var templateCityItem = _.template($('#js__city-item-template').html()),
                contentCities = '';

            var cities = __getCitiesByCountyName(name);

            if(!cities) {
                return false;
            }

            cities = __sortCities(cities);

            _.each(cities, function(item){
                contentCities += templateCityItem(item.properties);
            });

            $('.js__map-modal-cities').html(contentCities);
        },

        //Отрисовать ветки метро по названию города
        renderMetroLines: function(metroLines) {
            var templateMetroLineItem = _.template($('#js__metro-line-item-template').html()),
                contentMetroLines = '';

            _.each(metroLines, function(item){
                contentMetroLines += templateMetroLineItem(item);
            });

            $('.js__map-modal-lines').html('<a class="map-link active js__map-modal-line-item-link" href="#metro" data-id="all"><span>Все станции</span></a>');
            $('.js__map-modal-lines').append(contentMetroLines);
        },

        //Отрисовать станции метро по названию города
        renderMetroStations: function(stations) {
            var templateMetroStationItem = _.template($('#js__metro-station-item-template').html()),
                contentMetroStations = '';

            _.each(stations, function(item){
                contentMetroStations += templateMetroStationItem(item);
            });

            $('.js__map-modal-stations').html(contentMetroStations);
        },

        //Центрирование по адресу
        setCenterByAddress: function(address) {
            ymaps.geocode(address, {
                results: 1,
                kind: 'locality'
            }).then(function (res) {
                var firstGeoObject = res.geoObjects.get(0),
                    bounds = firstGeoObject.properties.get('boundedBy');

                self.map.setBounds(bounds, {
                    checkZoomRange: true
                });
            });
        }
    };

    return Map;
});
